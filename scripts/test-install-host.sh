#!/usr/bin/env bash
# Tests for static/install-host.sh. Runs the installer against stub
# docker/curl/sudo binaries, so no Docker daemon (and no network) is needed.
#
#   ./scripts/test-install-host.sh
#
# Exits 0 when every check passes. Prints TAP-ish lines.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="${INSTALL_HOST_SH:-$REPO_ROOT/static/install-host.sh}"
PEER="12D3KooWDUdHSCXBM5Wb7te6ZdWMgqddw7tJ7npWSzXK5tQgBsbT"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/install-host-test.XXXXXX")"
STUB_BIN="$TMP/bin"
STUB_DIR="$TMP/stub"
LISTENER_PID=""
cleanup() {
    [ -n "$LISTENER_PID" ] && kill "$LISTENER_PID" 2>/dev/null
    rm -rf "$TMP"
}
trap cleanup EXIT
mkdir -p "$STUB_BIN" "$STUB_DIR" "$TMP/fixtures"
export STUB_DIR PEER

# --------------------------------------------------------------------------
# Stubs
# --------------------------------------------------------------------------
cat > "$STUB_BIN/docker" <<'EOF'
#!/usr/bin/env bash
# Fake docker: no daemon, every run succeeds. The real run's args land in
# $STUB_DIR/run.args. Touch $STUB_DIR/has-container to simulate an existing
# Host container; $STUB_DIR/gen-container for a container publishing 8080
# (a Generator candidate); $STUB_DIR/wrong-gen makes its /health answer with
# a different peer ID.
cmd="${1:-}"; shift 2>/dev/null || true
case "$cmd" in
    --version) echo "Docker version 27.3.1, build fake" ;;
    info|logs|pull|rm) exit 0 ;;
    ps) [ -f "$STUB_DIR/gen-container" ] && echo "abc123"; exit 0 ;;
    port)
        [ -f "$STUB_DIR/gen-container" ] && echo "8080/tcp -> 0.0.0.0:8080"
        exit 0 ;;
    inspect)
        case "$*" in
            *State.Running*)              echo true ;;
            *State.Health.Status*)        echo healthy ;;
            *NetworkSettings*IPAddress*)  echo "172.17.0.2" ;;
            *NetworkSettings*)            echo "bridge" ;;
            *.Name*)                      echo "/maybe-generator" ;;
            *) [ -f "$STUB_DIR/has-container" ] && exit 0 || exit 1 ;;
        esac ;;
    run)
        if [[ "$*" == *"--entrypoint cat"* ]]; then
            cat "$STUB_DIR/fixture-config.yaml"
        else
            printf '%s\n' "$@" > "$STUB_DIR/run.args"
            echo "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        fi ;;
    *) exit 0 ;;
esac
EOF

cat > "$STUB_BIN/curl" <<'EOF'
#!/usr/bin/env bash
# Fake curl: answers by URL shape. 203.0.113.9 is always unreachable.
out=""; url=""; want_code=0
while [ $# -gt 0 ]; do
    case "$1" in
        -o) out="$2"; shift 2 ;;
        -w) want_code=1; shift 2 ;;
        -m|-X|-H|-d|--data|--data-raw|--connect-timeout|--max-time) shift 2 ;;
        -*) shift ;;
        *) url="$1"; shift ;;
    esac
done
body=""; code=200
case "$url" in
    *172.17.0.2*)
        # The Generator-candidate container. $STUB_DIR/wrong-gen makes it
        # answer /health with a peer ID that is not the Generator's.
        if [ -f "$STUB_DIR/wrong-gen" ]; then
            body='{"status":"healthy","p2p":{"enabled":true,"self":{"id":"12D3KooWRaNdOmPeErThAtIsNoTtHeGeNeRaToR"},"addresses":[]}}'
        else
            body='{"status":"healthy","p2p":{"enabled":true,"self":{"id":"'"$PEER"'","addresses":["/ip4/172.17.0.2/tcp/9171"]},"peers":[]}}'
        fi ;;
    *203.0.113.9*)    code=000 ;;
    */api/v1/schema*) body='{}' ;;
    */api/v0/graphql*) body='{"data":{"Ethereum__Mainnet__Block":[{"number":18900000,"hash":"0xabc"}]}}' ;;
    */health)         body='{"status":"healthy","p2p":{"enabled":true,"self":{"id":"'"$PEER"'","addresses":["/ip4/203.0.113.5/tcp/9171"]},"peers":[]}}' ;;
    *)                code=000 ;;
esac
if [ -n "$out" ]; then printf '%s' "$body" > "$out"; else printf '%s' "$body"; fi
[ "$want_code" = 1 ] && printf '%s' "$code"
exit 0
EOF

printf '#!/bin/sh\nexit 0\n' > "$STUB_BIN/sudo"   # chown no-op for non-root runs
chmod +x "$STUB_BIN"/*

# --------------------------------------------------------------------------
# Fixture image configs (one per layout the installer must handle)
# --------------------------------------------------------------------------
cat > "$TMP/fixtures/old.yaml" <<'EOF'
defradb:
  url: "localhost:9181"
  keyring_secret: "pingpong"
  p2p:
    resource_memory_mib: 10240
schema:
  indexer_schema_endpoint: /api/v1/schema
host:
  snapshot:
    enabled: false
    indexer_url: "http://35.206.105.60:8080"
EOF

cat > "$TMP/fixtures/chains.yaml" <<'EOF'
defradb:
  url: "localhost:9181"
  keyring_secret: "pingpong"
chains:
  - prefix: Ethereum__Mainnet
    generators:
      - url: http://35.254.135.221:8080
        peer: /ip4/35.254.135.221/tcp/9171/p2p/12D3KooWOldPeer
schema:
  indexer_schema_endpoint: /api/v1/schema
EOF

cat > "$TMP/fixtures/neither.yaml" <<'EOF'
defradb:
  url: "localhost:9181"
  keyring_secret: "pingpong"
pruner:
  enabled: true
schema:
  indexer_schema_endpoint: /api/v1/schema
EOF

# --------------------------------------------------------------------------
# Harness
# --------------------------------------------------------------------------
T=0; FAILED=0
check() { # check <desc> <cmd...>
    local desc="$1"; shift
    T=$((T+1))
    if "$@" >>"$TMP/test.log" 2>&1; then
        printf 'ok %d - %s\n' "$T" "$desc"
    else
        printf 'not ok %d - %s\n' "$T" "$desc"
        FAILED=$((FAILED+1))
    fi
}
has()     { grep -qF -- "$1" "$2"; }
has_re()  { grep -qE -- "$1" "$2"; }
lacks()   { ! grep -qF -- "$1" "$2"; }

CASE=""   # current case dir
run_case() { # run_case <name> <fixture> <generator> [extra installer args...]
    local name="$1" fixture="$2" gen="$3"; shift 3
    CASE="$TMP/$name"; mkdir -p "$CASE"
    cp "$TMP/fixtures/$fixture.yaml" "$STUB_DIR/fixture-config.yaml"
    rm -f "$STUB_DIR/run.args"
    PATH="$STUB_BIN:$PATH" bash "$SCRIPT" \
        --data-dir "$CASE/data" --state-dir "$CASE/state" "$@" "$gen" \
        > "$CASE/out" 2>&1
}

# --------------------------------------------------------------------------
# CLI surface
# --------------------------------------------------------------------------
PATH="$STUB_BIN:$PATH" bash "$SCRIPT" --help > "$TMP/help.out" 2>&1
check "--help exits 0" test $? -eq 0
check "--help prints usage" has "GENERATOR" "$TMP/help.out"
PATH="$STUB_BIN:$PATH" bash "$SCRIPT" --bogus localhost > /dev/null 2>&1
check "unknown option exits 1" test $? -eq 1
PATH="$STUB_BIN:$PATH" bash "$SCRIPT" > /dev/null 2>&1
check "missing generator exits 1" test $? -eq 1

# --------------------------------------------------------------------------
# Generator input forms
# --------------------------------------------------------------------------
run_case localhost old localhost
check "localhost: exit 0" test $? -eq 0
check "localhost: bootstrap via host gateway" has \
    "BOOTSTRAP_PEERS = /dns4/host.docker.internal/tcp/9171/p2p/$PEER" "$CASE/out"
check "localhost: --add-host passed to docker" has \
    "host.docker.internal:host-gateway" "$STUB_DIR/run.args"

run_case remote-ip old 203.0.113.5
check "ip: exit 0" test $? -eq 0
check "ip: bootstrap multiaddr" has \
    "BOOTSTRAP_PEERS = /ip4/203.0.113.5/tcp/9171/p2p/$PEER" "$CASE/out"
check "ip: schema endpoint probed" has \
    "http://203.0.113.5:8080/api/v1/schema" "$CASE/out"

run_case host-port old 203.0.113.5:8081
check "host:port: exit 0" test $? -eq 0
check "host:port: custom health port used" has \
    "http://203.0.113.5:8081/api/v1/schema" "$CASE/out"

run_case url old https://gen.example.com
check "url: exit 0" test $? -eq 0
check "url: dns4 multiaddr" has \
    "BOOTSTRAP_PEERS = /dns4/gen.example.com/tcp/9171/p2p/$PEER" "$CASE/out"

run_case multiaddr old "/ip4/203.0.113.9/tcp/9171/p2p/$PEER"
check "multiaddr: exit 0 despite unreachable health" test $? -eq 0
check "multiaddr: preserved verbatim" has \
    "BOOTSTRAP_PEERS = /ip4/203.0.113.9/tcp/9171/p2p/$PEER" "$CASE/out"

# --------------------------------------------------------------------------
# Config rewrite per image layout
# --------------------------------------------------------------------------
run_case cfg-old old 203.0.113.5
check "old layout: exit 0" test $? -eq 0
check "old layout: indexer_url pointed at generator" has \
    'indexer_url: "http://203.0.113.5:8080"' "$CASE/state/config.yaml"
check "old layout: default indexer gone" lacks "35.206.105.60" "$CASE/state/config.yaml"
check "keyring secret written into config" has \
    "$(cat "$CASE/state/keyring-secret")" "$CASE/state/config.yaml"
check "keyring default gone" lacks "pingpong" "$CASE/state/config.yaml"
check "config not world-readable" test "$(stat -c %a "$CASE/state/config.yaml")" = 600

run_case cfg-chains chains 203.0.113.5
check "chains layout: generator url written" has \
    "url: http://203.0.113.5:8080" "$CASE/state/config.yaml"
check "chains layout: generator peer written" has \
    "peer: /ip4/203.0.113.5/tcp/9171/p2p/$PEER" "$CASE/state/config.yaml"
check "chains layout: bundled generator replaced" lacks "35.254.135.221" "$CASE/state/config.yaml"
check "chains layout: following keys survive" has_re "^schema:" "$CASE/state/config.yaml"

run_case cfg-neither neither 203.0.113.5
check "neither layout: chains block appended" has_re "^chains:" "$CASE/state/config.yaml"
check "neither layout: generator url written" has \
    "url: http://203.0.113.5:8080" "$CASE/state/config.yaml"

# --------------------------------------------------------------------------
# Generator container detection (fix: a published port is only a guess)
# --------------------------------------------------------------------------
touch "$STUB_DIR/gen-container"
run_case gen-container old localhost
check "generator container: exit 0" test $? -eq 0
check "generator container: peer confirmed, container IP used" has \
    "BOOTSTRAP_PEERS = /ip4/172.17.0.2/tcp/9171/p2p/$PEER" "$CASE/out"
check "generator container: host joins its network" has \
    "bridge" "$STUB_DIR/run.args"

touch "$STUB_DIR/wrong-gen"
run_case wrong-container old localhost
check "wrong container: exit 0" test $? -eq 0
check "wrong container: rejection warned" has "is not the Generator" "$CASE/out"
check "wrong container: falls back to host gateway" has \
    "BOOTSTRAP_PEERS = /dns4/host.docker.internal/tcp/9171/p2p/$PEER" "$CASE/out"
rm -f "$STUB_DIR/gen-container" "$STUB_DIR/wrong-gen"

# --------------------------------------------------------------------------
# Memory sizing, existing container, port shift
# --------------------------------------------------------------------------
run_case mem old 203.0.113.5 --memory 1g
check "--memory 1g: exit 0" test $? -eq 0
check "--memory 1g: GOMEMLIMIT in MiB, not 0" has \
    "GOMEMLIMIT=768MiB" "$STUB_DIR/run.args"
check "--memory 1g: libp2p budget passed via env" has \
    "DEFRADB_P2P_RESOURCE_MEMORY_MIB=512" "$STUB_DIR/run.args"

touch "$STUB_DIR/has-container"
run_case exists old 203.0.113.5
check "existing container: exit 4" test $? -eq 4
check "existing container: explains --force" has "already exists" "$CASE/out"
run_case forced old 203.0.113.5 --force
check "--force: exit 0" test $? -eq 0
rm -f "$STUB_DIR/has-container"

if command -v python3 >/dev/null 2>&1; then
    python3 -c '
import socket, time
s = socket.socket()
s.bind(("0.0.0.0", 9181))
s.listen(1)
time.sleep(120)
' >/dev/null 2>&1 &
    LISTENER_PID=$!
    sleep 1
    run_case portshift old 203.0.113.5
    check "busy 9181: exit 0" test $? -eq 0
    check "busy 9181: api port moved" lacks \
        "DefraDB GraphQL API : 9181:9181" "$CASE/out"
    kill "$LISTENER_PID" 2>/dev/null; LISTENER_PID=""
fi

# --------------------------------------------------------------------------
echo
if [ "$FAILED" -gt 0 ]; then
    echo "$FAILED of $T checks failed (log: kept on failure only)"
    cp "$TMP/test.log" /tmp/install-host-test.log 2>/dev/null
    echo "stub log: /tmp/install-host-test.log"
    exit 1
fi
echo "all $T checks passed"
