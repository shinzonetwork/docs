#!/usr/bin/env bash
# Shinzo Host client one-line installer.
#
# Usage:
#   ./install-shinzo-host.sh [options] GENERATOR
#
# GENERATOR (required): connection info for the Generator, one of:
#   /ip4/<ip>/tcp/9171/p2p/<peer-id>   full libp2p multiaddr (peer ID required:
#                                      libp2p authenticates the connection
#                                      against it)
#   <ip-or-host>                       Generator host; the script reads the
#                                      peer ID from its /health endpoint
#                                      (default health port 8080)
#   <ip-or-host>:<port>                same, with an explicit health port
#   http(s)://<ip-or-host>[:<port>]    Generator health endpoint URL
#   localhost | 127.0.0.1              a Generator on this machine
#
# Options:
#   --p2p-port PORT          Generator libp2p port when building the multiaddr
#                            from a host (default 9171)
#   --generator-api-url URL Explicit HTTP base URL of the Generator's API
#                            (schema fetch). Default: derived from GENERATOR
#   --schema-auth-token TOK  Bearer token for Generators running with
#                            SCHEMA_AUTH_MODE=token
#   --name NAME              Container name (default: shinzo-host)
#   --image IMAGE            Host client image (default:
#                            ghcr.io/shinzonetwork/shinzo-host-client:
#                            ethereum-mainnet-latest)
#   --data-dir DIR           Data root: defradb/, keys/, lens/ (default: ~/data)
#   --state-dir DIR          State root: keyring secret + generated config
#                            (default: ~/.shinzo-host)
#   --keyring-secret SECRET DefraDB keyring secret. Default: generated once,
#                            stored in <state-dir>/keyring-secret and reused
#   --api-port PORT          Host-side port for the DefraDB GraphQL/REST API
#                            (container port 9181; default 9181)
#   --playground-port PORT   Host-side port for the GraphQL Playground
#                            (container port 9182; default 9182)
#   --p2p-host-port PORT     Host-side port for libp2p P2P networking
#                            (container port 9171; default 9171)
#   --health-port PORT       Host-side port for health + metrics
#                            (container port 8080; default 8080)
#                            If any default port is already in use, the script
#                            picks the next free port automatically.
#   --memory LIMIT           Container memory limit, e.g. 16g (default: none)
#   --gomemlimit LIMIT       Go runtime soft memory limit, e.g. 14GiB
#                            (default: 75% of --memory when --memory is given)
#   --start-height N         Block height to start from (default: auto-detect)
#   --force                  Remove an existing container of the same name
#                            first (data and node identity are preserved)
#   -h | --help              Show this help
#
# Environment:
#   DEFRA_KEYRING_SECRET     same as --keyring-secret
#   SHINZO_HOST_IMAGE        same as --image
#
# Exit codes:
#   0  success
#   1  usage error
#   2  Docker not installed or not usable
#   3  Generator connection info invalid or unreachable
#   4  a container with the target name already exists (use --force)
#   5  installation verification failed
#
# Examples:
#   ./install-shinzo-host.sh localhost
#   ./install-shinzo-host.sh 10.0.0.5:8080
#   ./install-shinzo-host.sh /ip4/10.0.0.5/tcp/9171/p2p/12D3KooW...
#   ./install-shinzo-host.sh --memory 16g --gomemlimit 14GiB \
#       /ip4/203.0.113.7/tcp/9171/p2p/12D3KooW...
#

set -euo pipefail

# --------------------------------------------------------------------------
# Defaults
# --------------------------------------------------------------------------
IMAGE="${SHINZO_HOST_IMAGE:-ghcr.io/shinzonetwork/shinzo-host-client:ethereum-mainnet-latest}"
CONTAINER_NAME="shinzo-host"
DATA_DIR="${HOME}/data"
STATE_DIR="${HOME}/.shinzo-host"

GEN_P2P_PORT_OPT=""          # --p2p-port
GEN_API_URL_OPT=""           # --generator-api-url
SCHEMA_AUTH_TOKEN="${INDEXER_SCHEMA_ENDPOINT_AUTH_TOKEN:-}"
KEYRING_SECRET_OPT="${DEFRA_KEYRING_SECRET:-}"
API_PORT_OPT=""
PLAYGROUND_PORT_OPT=""
P2P_HOST_PORT_OPT=""
HEALTH_PORT_OPT=""
MEMORY_OPT=""
GOMEMLIMIT_OPT=""
START_HEIGHT_OPT=""
FORCE=0

GEN_P2P_PORT_DEFAULT=9171
GEN_HEALTH_PORT_DEFAULT=8080
HEALTH_TIMEOUT=10
PROBE_TIMEOUT=10

# --------------------------------------------------------------------------
# Logging helpers
# --------------------------------------------------------------------------
if [ -t 1 ]; then
    C_INFO=$'\033[1;34m'; C_OK=$'\033[1;32m'; C_WARN=$'\033[1;33m'
    C_ERR=$'\033[1;31m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
    C_INFO=""; C_OK=""; C_WARN=""; C_ERR=""; C_DIM=""; C_OFF=""
fi

info()  { printf '%s[info]%s %s\n'  "$C_INFO" "$C_OFF" "$*"; }
ok()    { printf '%s[ ok ]%s %s\n'  "$C_OK"   "$C_OFF" "$*"; }
warn()  { printf '%s[warn]%s %s\n'  "$C_WARN" "$C_OFF" "$*"; }
err()   { printf '%s[fail]%s %s\n'  "$C_ERR"  "$C_OFF" "$*" >&2; }
dim()   { printf '%s%s%s\n' "$C_DIM" "$*" "$C_OFF"; }

usage() { sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

die() { # die <exit-code> <message>
    local code="$1"; shift
    err "$*"
    exit "$code"
}

# --------------------------------------------------------------------------
# Option parsing
# --------------------------------------------------------------------------
GENERATOR_INPUT=""
need_value() { [ $# -ge 2 ] || die 1 "option $1 requires a value (see --help)"; }

while [ $# -gt 0 ]; do
    case "$1" in
        --p2p-port)          need_value "$@"; GEN_P2P_PORT_OPT="$2"; shift 2 ;;
        --generator-api-url) need_value "$@"; GEN_API_URL_OPT="$2"; shift 2 ;;
        --schema-auth-token) need_value "$@"; SCHEMA_AUTH_TOKEN="$2"; shift 2 ;;
        --name)              need_value "$@"; CONTAINER_NAME="$2"; shift 2 ;;
        --image)             need_value "$@"; IMAGE="$2"; shift 2 ;;
        --data-dir)          need_value "$@"; DATA_DIR="$2"; shift 2 ;;
        --state-dir)         need_value "$@"; STATE_DIR="$2"; shift 2 ;;
        --keyring-secret)    need_value "$@"; KEYRING_SECRET_OPT="$2"; shift 2 ;;
        --api-port)          need_value "$@"; API_PORT_OPT="$2"; shift 2 ;;
        --playground-port)   need_value "$@"; PLAYGROUND_PORT_OPT="$2"; shift 2 ;;
        --p2p-host-port)     need_value "$@"; P2P_HOST_PORT_OPT="$2"; shift 2 ;;
        --health-port)       need_value "$@"; HEALTH_PORT_OPT="$2"; shift 2 ;;
        --memory)            need_value "$@"; MEMORY_OPT="$2"; shift 2 ;;
        --gomemlimit)        need_value "$@"; GOMEMLIMIT_OPT="$2"; shift 2 ;;
        --start-height)      need_value "$@"; START_HEIGHT_OPT="$2"; shift 2 ;;
        --force)             FORCE=1; shift ;;
        -h|--help)           usage 0 ;;
        --)                  shift; break ;;
        -*)                  die 1 "unknown option: $1 (see --help)" ;;
        *)
            [ -n "$GENERATOR_INPUT" ] && die 1 "unexpected extra argument: $1"
            GENERATOR_INPUT="$1"; shift ;;
    esac
done

[ -n "$GENERATOR_INPUT" ] || usage 1

# --------------------------------------------------------------------------
# Step 1: Docker must be installed and usable.
# The Host client ships as a Linux container image and this script runs it
# with Docker; there is nothing to install without it.
# --------------------------------------------------------------------------
info "Checking Docker..."
if ! command -v docker >/dev/null 2>&1; then
    err "Docker is not installed."
    cat >&2 <<EOF

  Why it is required:
    The Shinzo Host client is published as a Linux container image
    (${IMAGE}). This script uses Docker to pull and run it, and to keep it
    running as a container. Without Docker Engine there is no supported
    way to install the Host client on this machine from this script
    (the alternative, building from source, needs Go 1.25+ and Make — see
    https://docs.shinzo.network/run/run-a-host/install/#build-from-source).

  How to fix it:
    Install Docker Engine:  https://docs.docker.com/engine/install/
    Then verify with:       docker --version
    And re-run this script.
EOF
    exit 2
fi

DOCKER_VERSION="$(docker --version 2>/dev/null || true)"
[ -n "$DOCKER_VERSION" ] || die 2 "'docker' exists but 'docker --version' failed."

if ! docker info >/dev/null 2>&1; then
    err "Docker is installed but not usable — the Docker daemon is not reachable."
    cat >&2 <<EOF

  Likely causes and fixes:
    - The daemon is not running:      sudo systemctl start docker
    - You lack permission to use it:  sudo usermod -aG docker "\$USER"
                                      (then log out and back in)
    - Re-run this script afterwards.
EOF
    exit 2
fi
ok "Docker is available: $DOCKER_VERSION"

# Hardware preflight (see https://docs.shinzo.network/run/run-a-host/hardware-requirements/):
# minimum 4 cores / 8 GB RAM / 300 GB storage, recommended 8 / 16 / 500.
# Warnings only: development and testing installs can proceed anyway.
CORES="$(nproc 2>/dev/null || echo 0)"
[ "${CORES:-0}" -ge 4 ] || warn "CPU: ${CORES} cores detected; 4 is the minimum, 8 recommended."
if [ -r /proc/meminfo ]; then
    RAM_KB="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
    RAM_GB=$(( RAM_KB / 1024 / 1024 ))
    [ "$RAM_GB" -ge 8 ] || warn "RAM: ~${RAM_GB}GB total; 8GB is the minimum, 16GB recommended (pass --memory/--gomemlimit to size the container)."
fi

# Other required tools
command -v curl >/dev/null 2>&1 \
    || die 2 "curl is required (to probe the Generator and verify the install) but was not found."
SUDO=""; [ "$(id -u)" = 0 ] || SUDO="sudo"

# ARM machines: the image is linux/amd64 only; run under emulation (see docs).
PLATFORM_FLAGS=()
case "$(uname -m)" in
    aarch64|arm64)
        warn "ARM machine: image is linux/amd64 only — running under emulation."
        warn "Native x86-64 hardware is recommended for production."
        PLATFORM_FLAGS=(--platform linux/amd64)
        ;;
esac

# --------------------------------------------------------------------------
# Step 2: Resolve the Generator connection info
# --------------------------------------------------------------------------
info "Resolving Generator connection info: $GENERATOR_INPUT"

INPUT_KIND=""          # "multiaddr" | "http"
GEN_HOST=""            # host or IP used to reach the Generator's HTTP API
GEN_HEALTH_PORT=""     # port of the Generator's /health endpoint
GEN_SCHEME="http"      # http | https
MA_PEER_ID=""          # peer ID from multiaddr input (may be empty)
MA_TCP_PORT=""         # tcp port from multiaddr input (may be empty)

# JSON field extraction (python3 preferred; sed fallback in callers).
json_get() { # $1=json $2=dotted path e.g. p2p.self.id
    printf '%s' "$1" | python3 -c '
import json, sys
try:
    d = json.loads(sys.stdin.read())
    for part in sys.argv[1].split("."):
        if part == "":
            continue
        d = d[int(part)] if isinstance(d, list) else d[part]
    print(d if not isinstance(d, (dict, list)) else json.dumps(d))
except Exception:
    sys.exit(1)
' "$2" 2>/dev/null
}

peer_id_from_health() { # $1=health json -> peer id (works without python3)
    local j="$1"
    if command -v python3 >/dev/null 2>&1; then
        json_get "$j" "p2p.self.id" && return 0
    fi
    # Fallback: the first "id":"..." in /health is p2p.self.id
    printf '%s' "$j" | grep -o '"id":"[^"]*"' | head -n1 | sed 's/"id":"//; s/"$//'
}

if [ "${GENERATOR_INPUT#\/}" != "$GENERATOR_INPUT" ]; then
    # ---- multiaddr input --------------------------------------------------
    INPUT_KIND="multiaddr"
    case "$GENERATOR_INPUT" in
        /ip4/*)
            [[ "$GENERATOR_INPUT" =~ ^/ip4/([^/]+)/tcp/([0-9]+)(/p2p/([^/]+))?$ ]] \
                || die 3 "unsupported multiaddr (expected /ip4/<ip>/tcp/<port>[/p2p/<peer-id>]): $GENERATOR_INPUT"
            GEN_HOST="${BASH_REMATCH[1]}"
            MA_TCP_PORT="${BASH_REMATCH[2]}"
            MA_PEER_ID="${BASH_REMATCH[4]:-}"
            ;;
        /ip6/*)
            [[ "$GENERATOR_INPUT" =~ ^/ip6/([^/]+)/tcp/([0-9]+)(/p2p/([^/]+))?$ ]] \
                || die 3 "unsupported multiaddr (expected /ip6/<ip>/tcp/<port>[/p2p/<peer-id>]): $GENERATOR_INPUT"
            GEN_HOST="${BASH_REMATCH[1]}"
            MA_TCP_PORT="${BASH_REMATCH[2]}"
            MA_PEER_ID="${BASH_REMATCH[4]:-}"
            ;;
        /dns4/*|/dns6/*|/dnsaddr/*)
            [[ "$GENERATOR_INPUT" =~ ^/(dns4|dns6|dnsaddr)/([^/]+)/tcp/([0-9]+)(/p2p/([^/]+))?$ ]] \
                || die 3 "unsupported multiaddr format: $GENERATOR_INPUT"
            GEN_HOST="${BASH_REMATCH[2]}"
            MA_TCP_PORT="${BASH_REMATCH[3]}"
            MA_PEER_ID="${BASH_REMATCH[5]:-}"
            ;;
        *) die 3 "unsupported multiaddr (expected /ip4/... /ip6/... or /dns4/...): $GENERATOR_INPUT" ;;
    esac
    GEN_HEALTH_PORT="$GEN_HEALTH_PORT_DEFAULT"
else
    # ---- host[:port] or URL input ------------------------------------------
    INPUT_KIND="http"
    REST="$GENERATOR_INPUT"
    case "$REST" in
        http://*)  GEN_SCHEME="http";  REST="${REST#http://}" ;;
        https://*) GEN_SCHEME="https"; REST="${REST#https://}" ;;
    esac
    REST="${REST%%/*}"    # drop any path component
    REST="${REST%%\?*}"   # drop any query component
    if [[ "$REST" == \[*\]:* ]]; then
        GEN_HOST="${REST#\[}"; GEN_HOST="${GEN_HOST%%\]:*}"; GEN_HEALTH_PORT="${REST##*:}"
    elif [[ "$REST" == \[*\] ]]; then
        GEN_HOST="${REST#\[}"; GEN_HOST="${GEN_HOST%\]}"; GEN_HEALTH_PORT="$GEN_HEALTH_PORT_DEFAULT"
    elif [[ "$REST" == *:* && "$REST" != *::* ]]; then
        GEN_HOST="${REST%:*}"; GEN_HEALTH_PORT="${REST##*:}"
    else
        GEN_HOST="$REST"; GEN_HEALTH_PORT="$GEN_HEALTH_PORT_DEFAULT"
    fi
    [ -n "$GEN_HOST" ] || die 3 "could not parse a host out of: $GENERATOR_INPUT"
fi

# Sanity-check a numeric port
valid_port() { [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]; }
valid_port "$GEN_HEALTH_PORT" || die 3 "invalid Generator health port: $GEN_HEALTH_PORT"

# Bracket-wrap IPv6 hosts so they stay valid inside URLs.
GEN_HOST_URL="$GEN_HOST"
[[ "$GEN_HOST_URL" == *:* ]] && GEN_HOST_URL="[${GEN_HOST_URL}]"
GEN_HEALTH_URL="${GEN_SCHEME}://${GEN_HOST_URL}:${GEN_HEALTH_PORT}"

# Probe the Generator /health endpoint.
# - host input:  required (the peer ID is read from it)
# - multiaddr:   optional (used to discover the peer ID if missing, and to
#                confirm the Generator's API/schema endpoint is reachable)
probe_generator_health() { # -> sets GEN_HEALTH_JSON; returns 0 on HTTP 200
    local url="$1" code tmp
    tmp="$(mktemp "${TMPDIR:-/tmp}/shinzo-host-probe.XXXXXX")" || return 1
    GEN_HEALTH_JSON="$(curl -s -m "$PROBE_TIMEOUT" -o "$tmp" -w '%{http_code}' "$url/health" 2>/dev/null || echo 000)"
    code="$GEN_HEALTH_JSON"; GEN_HEALTH_JSON="$(cat "$tmp" 2>/dev/null || true)"
    rm -f "$tmp"
    [ "$code" = 200 ] && [ -n "$GEN_HEALTH_JSON" ]
}

if probe_generator_health "$GEN_HEALTH_URL"; then
    ok "Generator health endpoint responded: $GEN_HEALTH_URL/health"
else
    if [ "$INPUT_KIND" = "http" ]; then
        die 3 "could not query the Generator at $GEN_HEALTH_URL/health.

  The peer ID needed to link the Host is read from the Generator's /health
  endpoint. Check that:
    - the Generator is running and reachable from this machine
    - the port is right (health port defaults to ${GEN_HEALTH_PORT_DEFAULT}; pass <host>:<port> or a URL)
    - any firewall between here and the Generator allows it
  Alternatively pass the Generator's full libp2p multiaddr directly:
    /ip4/<generator-ip>/tcp/${GEN_P2P_PORT_DEFAULT}/p2p/<generator-peer-id>"
    else
        warn "Generator /health not reachable at $GEN_HEALTH_URL/health (continuing with the multiaddr)."
        GEN_HEALTH_JSON=""
    fi
fi

# Peer ID: from the multiaddr, or discover it from /health.
GEN_PEER_ID="$MA_PEER_ID"
if [ -z "$GEN_PEER_ID" ] && [ -n "$GEN_HEALTH_JSON" ]; then
    GEN_PEER_ID="$(peer_id_from_health "$GEN_HEALTH_JSON" || true)"
fi
if [ -z "$GEN_PEER_ID" ]; then
    die 3 "no peer ID available for the Generator.

  libp2p authenticates the connection against the peer ID, so an address
  without it will not connect. Either:
    - pass a full multiaddr: /ip4/${GEN_HOST}/tcp/<port>/p2p/<peer-id>, or
    - make the Generator's /health endpoint reachable at ${GEN_HEALTH_URL}/health
      (the peer ID is read from its p2p.self.id field)."
fi
[[ "$GEN_PEER_ID" =~ ^[1-9A-HJ-NP-Za-km-z]+$ ]] || die 3 "Generator peer ID looks invalid: $GEN_PEER_ID"
ok "Generator peer ID: $GEN_PEER_ID"

# --------------------------------------------------------------------------
# Step 3: Same-machine detection.
# If the Generator runs in Docker on this machine, attach the Host container
# to the Generator's Docker network and talk to it directly (container IP).
# If it runs on the host itself, reach it through the host gateway.
# --------------------------------------------------------------------------
RUN_NETWORK=""                # --network value for the Host container ("" = default)
ADD_HOST_FLAG=""              # --add-host value when routing via the host gateway
GEN_SCHEMA_URL=""             # HTTP base URL of the Generator API (schema fetch)

is_localhost_host() {
    case "$1" in
        localhost|127.0.0.1|::1) return 0 ;;
    esac
    return 1
}

is_host_ip() { # any IP of this machine (incl. docker bridges)
    [ -n "$1" ] || return 1
    hostname -I 2>/dev/null | tr ' ' '\n' | grep -qx -- "$1" 2>/dev/null
}

# Find a running Docker container whose IP matches $1 (any of its networks).
container_by_ip() {
    local want="$1" c ips
    for c in $(docker ps -q); do
        [ "$(docker inspect -f '{{.Name}}' "$c")" = "/$CONTAINER_NAME" ] && continue
        ips="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "$c" 2>/dev/null || true)"
        if printf '%s' "$ips" | tr ' ' '\n' | grep -qx -- "$want" 2>/dev/null; then
            printf '%s' "$c"; return 0
        fi
    done
    return 1
}

# Find a running container that publishes host port $1 (on any interface).
container_by_published_port() {
    local want="$1" c line hostport
    for c in $(docker ps -q); do
        [ "$(docker inspect -f '{{.Name}}' "$c")" = "/$CONTAINER_NAME" ] && continue
        while read -r line; do
            [ -z "$line" ] && continue
            hostport="${line##*:}"
            [ "$hostport" = "$want" ] && { printf '%s' "$c"; return 0; }
        done < <(docker port "$c" 2>/dev/null | awk '{print $3}' || true)
    done
    return 1
}

GEN_CONTAINER=""
GEN_FOUND_BY=""   # "ip" (addressed directly by container IP) | "port" (found via published port)
_cip="$(container_by_ip "$GEN_HOST" 2>/dev/null || true)"
if [ -n "$_cip" ]; then
    GEN_CONTAINER="$_cip"; GEN_FOUND_BY="ip"
elif is_localhost_host "$GEN_HOST" || is_host_ip "$GEN_HOST"; then
    _cport="$(container_by_published_port "$GEN_HEALTH_PORT" || true)"
    if [ -n "$_cport" ]; then GEN_CONTAINER="$_cport"; GEN_FOUND_BY="port"; fi
fi

if [ -n "$GEN_CONTAINER" ]; then
    # Generator runs in Docker on this machine.
    GEN_NETWORK="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$GEN_CONTAINER")"
    GEN_IP="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$v.IPAddress}}{{end}}' "$GEN_CONTAINER")"
    GEN_NAME="$(docker inspect -f '{{.Name}}' "$GEN_CONTAINER" | sed 's#^/##')"
    info "Detected Generator running in Docker on this machine: $GEN_NAME (network: $GEN_NETWORK, IP: $GEN_IP)"

    if [ "$GEN_NETWORK" = "host" ]; then
        # Host-networked Generator: route via the Docker host gateway.
        ADD_HOST_FLAG="host.docker.internal:host-gateway"
        GEN_SCHEMA_URL="http://host.docker.internal:${GEN_HEALTH_PORT}"
    else
        # Container-side health port. When the Generator was found through a
        # published host port, translate it; when addressed directly by its
        # container IP, the port given is already the container port.
        GEN_HEALTH_CPORT="$GEN_HEALTH_PORT"
        if [ "$GEN_FOUND_BY" = "port" ]; then
            GEN_HEALTH_CPORT="$(docker port "$GEN_CONTAINER" 2>/dev/null | awk -v hp="$GEN_HEALTH_PORT" \
                '{split($3,a,":"); if (a[length(a)]==hp) {split($1,b,"/"); print b[1]}}' | head -n1)"
            [ -n "$GEN_HEALTH_CPORT" ] || GEN_HEALTH_CPORT="$GEN_HEALTH_PORT"
        fi
        # Re-probe health via the container IP so later steps (schema probe)
        # validate the address the Host container will actually use, and read
        # the Generator's actual libp2p listen port from its reported
        # listen addresses. When the container was found by its published
        # port the match is only a guess — any container publishing that port
        # qualifies — so a reachable container must prove it is the Generator.
        # An unreachable one keeps the benefit of the doubt: it may still be
        # starting, and the peer check at the end catches a wrong guess.
        if probe_generator_health "http://${GEN_IP}:${GEN_HEALTH_CPORT}"; then
            PROBE_PEER="$(peer_id_from_health "$GEN_HEALTH_JSON" || true)"
            if [ "$GEN_FOUND_BY" = "port" ] && { [ -z "$PROBE_PEER" ] \
                || { [ -n "$GEN_PEER_ID" ] && [ "$PROBE_PEER" != "$GEN_PEER_ID" ]; }; }; then
                warn "container '$GEN_NAME' publishes port $GEN_HEALTH_PORT but is not the Generator — using the host gateway instead."
                GEN_CONTAINER=""
            else
                [ -z "$GEN_PEER_ID" ] && GEN_PEER_ID="$PROBE_PEER"
                MA_TCP_PORT="$(printf '%s' "$GEN_HEALTH_JSON" \
                    | grep -o "/ip4/${GEN_IP}/tcp/[0-9]*" | head -n1 | awk -F/ '{print $5}')"
            fi
        else
            warn "could not reach the Generator container directly at ${GEN_IP}:${GEN_HEALTH_CPORT}."
        fi
        if [ -n "$GEN_CONTAINER" ]; then
            RUN_NETWORK="$GEN_NETWORK"
            GEN_SCHEMA_URL="http://${GEN_IP}:${GEN_HEALTH_CPORT}"
            GEN_HOST="$GEN_IP"   # build the multiaddr against the container IP
        fi
    fi
fi

if [ -z "$GEN_CONTAINER" ]; then
    if is_localhost_host "$GEN_HOST"; then
        # Generator listens on the host itself (not in Docker): containers reach it
        # via the Docker host gateway alias.
        info "Generator appears to run directly on this machine — routing the Host container through the Docker host gateway."
        ADD_HOST_FLAG="host.docker.internal:host-gateway"
        GEN_SCHEMA_URL="${GEN_SCHEME}://host.docker.internal:${GEN_HEALTH_PORT}"
        if [ "$GEN_HOST" = "localhost" ] || [ "$GEN_HOST" = "127.0.0.1" ]; then
            GEN_HOST="host.docker.internal"   # must not be 127.0.0.1 from inside a container
        fi
    else
        GEN_SCHEMA_URL="${GEN_SCHEME}://${GEN_HOST_URL}:${GEN_HEALTH_PORT}"
    fi
fi

# Allow explicit override of the Generator API (schema) URL.
[ -n "$GEN_API_URL_OPT" ] && { GEN_SCHEMA_URL="$GEN_API_URL_OPT"; info "Using explicit Generator API URL: $GEN_SCHEMA_URL"; }

# Build the final bootstrap multiaddr.
GEN_P2P_PORT="${GEN_P2P_PORT_OPT:-${MA_TCP_PORT:-$GEN_P2P_PORT_DEFAULT}}"
valid_port "$GEN_P2P_PORT" || die 3 "invalid Generator P2P port: $GEN_P2P_PORT"

if [ "$GEN_HOST" = "host.docker.internal" ]; then
    BOOTSTRAP_PEERS="/dns4/${GEN_HOST}/tcp/${GEN_P2P_PORT}/p2p/${GEN_PEER_ID}"
elif [[ "$GEN_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    BOOTSTRAP_PEERS="/ip4/${GEN_HOST}/tcp/${GEN_P2P_PORT}/p2p/${GEN_PEER_ID}"
elif [[ "$GEN_HOST" =~ : ]]; then
    BOOTSTRAP_PEERS="/ip6/${GEN_HOST}/tcp/${GEN_P2P_PORT}/p2p/${GEN_PEER_ID}"
else
    BOOTSTRAP_PEERS="/dns4/${GEN_HOST}/tcp/${GEN_P2P_PORT}/p2p/${GEN_PEER_ID}"
fi
ok "BOOTSTRAP_PEERS = $BOOTSTRAP_PEERS"

# Probe the Generator's schema endpoint (the Host fetches its schema from the
# Generator so its tables match the Generator's exactly).
if [ -n "$GEN_SCHEMA_URL" ]; then
    SCHEMA_CODE="$(curl -s -m "$PROBE_TIMEOUT" -o /dev/null -w '%{http_code}' \
        ${SCHEMA_AUTH_TOKEN:+-H "Authorization: Bearer ${SCHEMA_AUTH_TOKEN}"} \
        "$GEN_SCHEMA_URL/api/v1/schema" 2>/dev/null || echo 000)" || SCHEMA_CODE=000
    case "$SCHEMA_CODE" in
        200) ok "Generator schema endpoint reachable: $GEN_SCHEMA_URL/api/v1/schema" ;;
        401|403|503)
            warn "Generator schema endpoint returned HTTP $SCHEMA_CODE."
            warn "If it runs with SCHEMA_AUTH_MODE=token, pass --schema-auth-token <token>."
            ;;
        *)
            warn "Generator schema endpoint not reachable at $GEN_SCHEMA_URL/api/v1/schema (HTTP $SCHEMA_CODE)."
            warn "The Host will fall back to its embedded schema — if the Generator serves a"
            warn "different schema, the Host may not receive its data. See the warning above."
            ;;
    esac
fi

# --------------------------------------------------------------------------
# Step 4: Existing container check (--force replaces it)
# --------------------------------------------------------------------------
if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    if [ "$FORCE" = 1 ]; then
        info "Removing existing container '$CONTAINER_NAME' (--force; data and identity are preserved)..."
        docker rm -f "$CONTAINER_NAME" >/dev/null
    else
        die 4 "a container named '$CONTAINER_NAME' already exists.

  To replace it (keeping the database and node identity), re-run with --force:
      $0 --force $GENERATOR_INPUT
  To keep it, choose another name with --name, or remove it yourself:
      docker rm -f $CONTAINER_NAME"
    fi
fi

# --------------------------------------------------------------------------
# Step 5: Host-side port selection
# (defaults follow the docs; if a port is taken, e.g. by a local Generator,
#  the script picks the next free port automatically)
# --------------------------------------------------------------------------
port_busy() { # -> 0 if the TCP port is in use on this machine
    local port="$1"
    if command -v python3 >/dev/null 2>&1; then
        python3 -c '
import socket, sys
port = int(sys.argv[1])
for family, host in ((socket.AF_INET, "0.0.0.0"), (socket.AF_INET6, "::")):
    try:
        s = socket.socket(family, socket.SOCK_STREAM)
    except OSError:
        continue  # family unavailable on this machine (e.g. IPv6 disabled)
    try:
        s.bind((host, port))
    except OSError:
        sys.exit(1)
    finally:
        s.close()
sys.exit(0)
' "$port" >/dev/null 2>&1 && return 1 || return 0
    elif command -v ss >/dev/null 2>&1; then
        ss -tlnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}\$" && return 0 || return 1
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tln 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}\$" && return 0 || return 1
    else
        warn "no tool to check port availability (python3/ss/netstat) — assuming port $port is free"
        return 1
    fi
}

pick_port() { # $1=preferred $2...=reserved/claimed ports -> echoes chosen port
    local preferred="$1"; shift
    local reserved=("$@") p candidate
    if ! port_busy "$preferred" && ! printf '%s\n' "${reserved[@]}" 2>/dev/null | grep -qx "$preferred"; then
        printf '%s' "$preferred"; return 0
    fi
    for p in $(seq "$((preferred + 1))" "$((preferred + 99))"); do
        if port_busy "$p"; then continue; fi
        if printf '%s\n' "${reserved[@]}" 2>/dev/null | grep -qx "$p"; then continue; fi
        printf '%s' "$p"; return 0
    done
    return 1
}

API_PORT="$API_PORT_OPT"
PLAYGROUND_PORT="$PLAYGROUND_PORT_OPT"
P2P_HOST_PORT="$P2P_HOST_PORT_OPT"
HEALTH_PORT="$HEALTH_PORT_OPT"

[ -n "$API_PORT" ]         || API_PORT="$(pick_port 9181 9182 9171 8080)"        || die 1 "no free port found near 9181"
[ -n "$PLAYGROUND_PORT" ]  || PLAYGROUND_PORT="$(pick_port 9182 "$API_PORT" 9171 8080)" || die 1 "no free port found near 9182"
[ -n "$P2P_HOST_PORT" ]    || P2P_HOST_PORT="$(pick_port 9171 "$API_PORT" "$PLAYGROUND_PORT" 8080)" || die 1 "no free port found near 9171"
[ -n "$HEALTH_PORT" ]      || HEALTH_PORT="$(pick_port 8080 "$API_PORT" "$PLAYGROUND_PORT" "$P2P_HOST_PORT")" || die 1 "no free port found near 8080"

for p in "$API_PORT" "$PLAYGROUND_PORT" "$P2P_HOST_PORT" "$HEALTH_PORT"; do
    valid_port "$p" || die 1 "invalid host port: $p"
done

info "Port mapping (host:container):"
info "  DefraDB GraphQL API : ${API_PORT}:9181"
info "  GraphQL Playground  : ${PLAYGROUND_PORT}:9182"
info "  libp2p P2P          : ${P2P_HOST_PORT}:9171   (must be reachable from the internet for inbound peers)"
info "  Health + metrics    : ${HEALTH_PORT}:8080"

# --------------------------------------------------------------------------
# Step 6: Keyring secret (node identity), data directories
# --------------------------------------------------------------------------
mkdir -p "$STATE_DIR"
if [ -n "$KEYRING_SECRET_OPT" ]; then
    KEYRING_SECRET="$KEYRING_SECRET_OPT"
    info "Using keyring secret from option/environment."
elif [ -s "$STATE_DIR/keyring-secret" ]; then
    KEYRING_SECRET="$(cat "$STATE_DIR/keyring-secret")"
    ok "Reusing existing keyring secret from $STATE_DIR/keyring-secret (keeps the node identity stable)."
else
    if command -v openssl >/dev/null 2>&1; then
        KEYRING_SECRET="$(openssl rand -hex 32)"
    else
        KEYRING_SECRET="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
    fi
    ok "Generated a new keyring secret."
fi
[ ${#KEYRING_SECRET} -ge 32 ] || die 1 "keyring secret looks too weak (need >= 32 chars of entropy)"
printf '%s\n' "$KEYRING_SECRET" > "$STATE_DIR/keyring-secret"
chmod 600 "$STATE_DIR/keyring-secret"

mkdir -p "$DATA_DIR/defradb" "$DATA_DIR/keys" "$DATA_DIR/lens"
# The container runs as UID/GID 1001:1001 and bind mounts take the ownership
# of the host directory. Without this chown the Host exits with
# 'permission denied' on .defra/keys (per the Shinzo install docs).
if chown -R 1001:1001 "$DATA_DIR/defradb" "$DATA_DIR/keys" "$DATA_DIR/lens" 2>/dev/null; then
    ok "Data directories ready under $DATA_DIR (owned by 1001:1001)."
else
    if [ -n "$SUDO" ] && $SUDO -n true 2>/dev/null; then
        $SUDO chown -R 1001:1001 "$DATA_DIR/defradb" "$DATA_DIR/keys" "$DATA_DIR/lens" \
            || die 2 "failed to chown the data directories to 1001:1001."
        ok "Data directories ready under $DATA_DIR (owned by 1001:1001)."
    else
        die 2 "cannot chown the data directories to 1001:1001.

  The Host container runs as UID/GID 1001:1001; without ownership of the
  bind-mounted directories it exits with 'permission denied' on .defra/keys.
  Run this as root, or execute first:
      sudo chown -R 1001:1001 $DATA_DIR/defradb $DATA_DIR/keys $DATA_DIR/lens
  then re-run this script."
    fi
fi
DISK_AVAIL_GB="$(df -BG "$DATA_DIR" 2>/dev/null | awk 'NR==2 {print $4}' | tr -dc '0-9')"
[ "${DISK_AVAIL_GB:-0}" -ge 300 ] \
    || warn "Storage: ~${DISK_AVAIL_GB:-?}GB free under $DATA_DIR; 300GB is the minimum for a production Host (a pruned or filtered Host stays much smaller)."

# --------------------------------------------------------------------------
# Step 7: Optional memory sizing
# (scale resource_memory_mib < GOMEMLIMIT < container memory limit together)
# --------------------------------------------------------------------------
GOMEMLIMIT_ENV="$GOMEMLIMIT_OPT"
if [ -n "$MEMORY_OPT" ]; then
    if ! [[ "$MEMORY_OPT" =~ ^([0-9]+)([bkmgt]?)$ ]]; then
        die 1 "--memory must look like 512m, 4g or 16g — got: $MEMORY_OPT"
    fi
    MEM_VALUE="${BASH_REMATCH[1]}"; MEM_UNIT="${BASH_REMATCH[2]}"
    case "$MEM_UNIT" in
        b) MEM_MIB=$(( MEM_VALUE / 1048576 )) ;;
        k) MEM_MIB=$(( MEM_VALUE / 1024 )) ;;
        m|"") MEM_MIB="$MEM_VALUE" ;;
        g) MEM_MIB=$(( MEM_VALUE * 1024 )) ;;
        t) MEM_MIB=$(( MEM_VALUE * 1048576 )) ;;
    esac
    RESOURCE_MEM_MIB=$(( MEM_MIB / 2 ))
    if [ -z "$GOMEMLIMIT_ENV" ]; then
        GOMEMLIMIT_ENV="$(( MEM_MIB * 3 / 4 ))MiB"
    fi
    info "Memory: container limit ${MEMORY_OPT}, GOMEMLIMIT ${GOMEMLIMIT_ENV}, libp2p budget ${RESOURCE_MEM_MIB}MiB"
fi

# --------------------------------------------------------------------------
# Step 8: Pull the image
# --------------------------------------------------------------------------
info "Pulling image: $IMAGE"
docker pull ${PLATFORM_FLAGS[@]+"${PLATFORM_FLAGS[@]}"} "$IMAGE" >/dev/null \
    || docker pull "$IMAGE" >/dev/null \
    || die 2 "failed to pull $IMAGE (is the registry reachable?)"
ok "Image pulled: $IMAGE"

# --------------------------------------------------------------------------
# Step 9: Generate the Host config override
# Base it on the image's own built-in config so every default stays intact;
# only point the schema fetch at the user's Generator (chains.generators on
# current images, host.snapshot.indexer_url on older ones), so the Host's
# tables match the Generator's schema exactly.
# --------------------------------------------------------------------------
info "Generating Host config from the image defaults..."
IMAGE_CONFIG="$(docker run --rm ${PLATFORM_FLAGS[@]+"${PLATFORM_FLAGS[@]}"} \
    --entrypoint cat "$IMAGE" /app/config.yaml 2>/dev/null || true)"

if [ -z "$IMAGE_CONFIG" ]; then
    warn "could not read /app/config.yaml from the image — using the image's built-in defaults."
    CONFIG_MOUNT=()
else
    printf '%s\n' "$IMAGE_CONFIG" > "$STATE_DIR/config.yaml"
    # Write the keyring secret into the mounted config: the Host reads
    # defradb.keyring_secret from the file; the DEFRA_KEYRING_SECRET env var
    # never overrides it (see LoadConfig in shinzo-host-client).
    if ! grep -qE '^\s*keyring_secret:' "$STATE_DIR/config.yaml"; then
        warn "no keyring_secret key in the image config — the Host keeps its built-in secret handling."
    elif command -v python3 >/dev/null 2>&1; then
        python3 - "$STATE_DIR/config.yaml" "$KEYRING_SECRET" <<'PYEOF' 2>/dev/null \
            || die 1 "failed to write the keyring secret into $STATE_DIR/config.yaml"
import json, re, sys
path, secret = sys.argv[1], sys.argv[2]
text = open(path).read()
new, n = re.subn(r"(?m)^(\s*)keyring_secret:.*$",
                 lambda m: m.group(1) + "keyring_secret: " + json.dumps(secret), text)
if n != 1:
    sys.exit(1)
open(path, "w").write(new)
PYEOF
    elif [[ "$KEYRING_SECRET" =~ ^[A-Za-z0-9+/=._-]+$ ]]; then
        # Characters outside this set need YAML/sed escaping — that is what the
        # python3 branch above is for.
        sed -i.bak "s|^\(\s*keyring_secret:\).*|\1 \"$KEYRING_SECRET\"|" "$STATE_DIR/config.yaml" && rm -f "$STATE_DIR/config.yaml.bak"
    else
        die 1 "the keyring secret needs characters only python3 can write into the config safely — install python3 or pass a simpler --keyring-secret."
    fi
    chmod 600 "$STATE_DIR/config.yaml"   # the mounted config now holds the keyring secret
    SCHEMA_CFG_OK=0
    if grep -q '^chains:' "$STATE_DIR/config.yaml" || ! grep -qE '^\s*indexer_url:' "$STATE_DIR/config.yaml"; then
        # chains layout: chains[].generators[].url (+peer) provides the
        # Generator's schema endpoint and P2P address. An image whose config
        # has no chains key yet gets the block appended.
        if python3 - "$STATE_DIR/config.yaml" "$GEN_SCHEMA_URL" "$BOOTSTRAP_PEERS" <<'PYEOF' 2>/dev/null; then
import re, sys
path, url, peer = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path).read()
gen_block = f"chains:\n  - prefix: Ethereum__Mainnet\n    generators:\n      - url: {url}\n        peer: {peer}\n"
if re.search(r"(?m)^chains:", text):
    text = re.sub(r"(?m)^chains:.*?(?=^\S|\Z)", gen_block, text, count=1, flags=re.S)
else:
    if not text.endswith("\n"):
        text += "\n"
    text += "\n" + gen_block
open(path, "w").write(text)
PYEOF
            SCHEMA_CFG_OK=1
        else
            warn "could not write chains.generators — continuing with image defaults."
        fi
    else
        # Older image layout: host.snapshot.indexer_url doubles as the
        # schema-fetch base URL.
        sed -i.bak "s|^\(\s*indexer_url:\).*|\1 \"$GEN_SCHEMA_URL\"|" "$STATE_DIR/config.yaml" && rm -f "$STATE_DIR/config.yaml.bak"
        SCHEMA_CFG_OK=1
    fi
    [ "$SCHEMA_CFG_OK" = 1 ] && info "Schema fetch pointed at the Generator: $GEN_SCHEMA_URL"
    CONFIG_MOUNT=(-v "$STATE_DIR/config.yaml:/app/config.yaml:ro")
fi

# --------------------------------------------------------------------------
# Step 10: Run the Host container
# --------------------------------------------------------------------------
info "Starting container '$CONTAINER_NAME'..."
DOCKER_RUN_ARGS=(
    -d
    --name "$CONTAINER_NAME"
    --restart unless-stopped
    -e DEFRA_KEYRING_SECRET="$KEYRING_SECRET"
    -e BOOTSTRAP_PEERS="$BOOTSTRAP_PEERS"
)
[ -n "$RUN_NETWORK" ]        && DOCKER_RUN_ARGS+=(--network "$RUN_NETWORK")
[ -n "$ADD_HOST_FLAG" ]      && DOCKER_RUN_ARGS+=(--add-host "$ADD_HOST_FLAG")
[ -n "$GOMEMLIMIT_ENV" ]     && DOCKER_RUN_ARGS+=(-e GOMEMLIMIT="$GOMEMLIMIT_ENV")
# Env override rather than a config edit: LoadConfig honours it on every
# image layout, unlike the resource_memory_mib key's location in the file.
[ -n "${RESOURCE_MEM_MIB:-}" ] && [ "$RESOURCE_MEM_MIB" -gt 0 ] \
    && DOCKER_RUN_ARGS+=(-e DEFRADB_P2P_RESOURCE_MEMORY_MIB="$RESOURCE_MEM_MIB")
[ -n "$MEMORY_OPT" ]         && DOCKER_RUN_ARGS+=(--memory "$MEMORY_OPT")
[ -n "$START_HEIGHT_OPT" ]   && DOCKER_RUN_ARGS+=(-e START_HEIGHT="$START_HEIGHT_OPT")
[ -n "$SCHEMA_AUTH_TOKEN" ]  && DOCKER_RUN_ARGS+=(-e INDEXER_SCHEMA_ENDPOINT_AUTH_TOKEN="$SCHEMA_AUTH_TOKEN")
DOCKER_RUN_ARGS+=(
    -p "${API_PORT}:9181"
    -p "${PLAYGROUND_PORT}:9182"
    -p "${P2P_HOST_PORT}:9171"
    -p "${HEALTH_PORT}:8080"
    -v "$DATA_DIR/defradb:/app/.defra"
    -v "$DATA_DIR/keys:/app/.defra/keys"
    -v "$DATA_DIR/lens:/app/.defra/lens"
)
DOCKER_RUN_ARGS+=(${PLATFORM_FLAGS[@]+"${PLATFORM_FLAGS[@]}"} ${CONFIG_MOUNT[@]+"${CONFIG_MOUNT[@]}"} "$IMAGE")

if ! CONTAINER_ID="$(docker run ${DOCKER_RUN_ARGS[@]})"; then
    err "docker run failed. Last logs (if any):"
    docker logs "$CONTAINER_NAME" 2>&1 | tail -n 30 >&2 || true
    exit 5
fi
ok "Container started: ${CONTAINER_ID:0:12}"

# --------------------------------------------------------------------------
# Step 11: Verify the installation
# --------------------------------------------------------------------------
info "Waiting for the container health check to pass (this can take ~2 minutes)..."
HEALTH_STATUS=""
for _ in $(seq 1 60); do
    RUNNING="$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || echo false)"
    if [ "$RUNNING" != "true" ]; then
        err "container is not running. Last logs:"
        docker logs "$CONTAINER_NAME" 2>&1 | tail -n 40 >&2 || true
        exit 5
    fi
    HEALTH_STATUS="$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo starting)"
    [ "$HEALTH_STATUS" = "healthy" ] && break
    sleep 5
done
if [ "$HEALTH_STATUS" != "healthy" ]; then
    err "container did not become healthy (status: $HEALTH_STATUS). Last logs:"
    docker logs "$CONTAINER_NAME" 2>&1 | tail -n 40 >&2 || true
    exit 5
fi
ok "Container is healthy."

# GraphQL API responds (a JSON error body on a fresh host is expected).
GQL_PROBE='{"query":"{ __typename }"}'
GQL_RESP="$(curl -s -m 15 -X POST -H 'Content-Type: application/json' \
    --data "$GQL_PROBE" "http://localhost:${API_PORT}/api/v0/graphql" || true)"
if printf '%s' "$GQL_RESP" | grep -q '^{'; then
    ok "GraphQL API is serving on http://localhost:${API_PORT}/api/v0/graphql"
else
    err "GraphQL API probe failed (no JSON response). Last logs:"
    docker logs "$CONTAINER_NAME" 2>&1 | tail -n 40 >&2 || true
    exit 5
fi

# P2P connection to the Generator: the Generator's peer ID must appear among
# the Host's connected peers (or in the connection logs).
info "Checking the P2P connection to the Generator (peer ${GEN_PEER_ID})..."
PEER_CONNECTED=0
for _ in $(seq 1 18); do
    HOST_HEALTH="$(curl -s -m 10 "http://localhost:${HEALTH_PORT}/health" || true)"
    if [ -n "$HOST_HEALTH" ] && printf '%s' "$HOST_HEALTH" | grep -q "$GEN_PEER_ID"; then
        PEER_CONNECTED=1; break
    fi
    if docker logs --since 10m "$CONTAINER_NAME" 2>&1 | grep -q "Connected to peer .*${GEN_PEER_ID}"; then
        PEER_CONNECTED=1; break
    fi
    sleep 5
done
if [ "$PEER_CONNECTED" = 1 ]; then
    ok "Host is connected to the Generator over libp2p."
else
    warn "the Generator peer was not observed as connected yet. Recent peer logs:"
    docker logs "$CONTAINER_NAME" 2>&1 | grep -iE "peer|dial" | tail -n 15 | sed 's/^/      /' || true
    warn "if the peer is stuck in 'dial backoff' / 'all dials failed', the Generator's"
    warn "P2P port (${GEN_P2P_PORT}) is not reachable from this container — check the"
    warn "multiaddr, firewalls and port publishing."
fi

# Real data flowing from the Generator (soft check: a fresh Host only receives
# blocks the Generator processes from now on).
info "Checking for live data from the Generator (up to 90s)..."
BLOCK_QUERY='{"query":"{ Ethereum__Mainnet__Block(order: {number: DESC}, limit: 1) { number hash } }"}'
DATA_OK=0
for _ in $(seq 1 18); do
    RESP="$(curl -s -m 15 -X POST -H 'Content-Type: application/json' \
        --data "$BLOCK_QUERY" "http://localhost:${API_PORT}/api/v0/graphql" || true)"
    if printf '%s' "$RESP" | grep -q '"Ethereum__Mainnet__Block"'; then
        LATEST_BLOCK="$(printf '%s' "$RESP" | grep -o '"number":[0-9]*' | head -n1 | grep -o '[0-9]*')"
        DATA_OK=1; break
    fi
    sleep 5
done
if [ "$DATA_OK" = 1 ]; then
    ok "Live data verified — latest synced Ethereum mainnet block: ${LATEST_BLOCK:-?}"
else
    warn "no documents yet. On a fresh Host this is expected until the Generator processes"
    warn "new blocks; historical data requires snapshot bootstrap (see the docs)."
fi

# Persist an install record (useful for reference and uninstalling).
cat > "$STATE_DIR/install.env" <<EOF
# Shinzo Host install record — $(date -u +%Y-%m-%dT%H:%M:%SZ)
CONTAINER_NAME=$CONTAINER_NAME
IMAGE=$IMAGE
BOOTSTRAP_PEERS=$BOOTSTRAP_PEERS
GENERATOR_PEER_ID=$GEN_PEER_ID
GENERATOR_SCHEMA_URL=$GEN_SCHEMA_URL
API_PORT=$API_PORT
PLAYGROUND_PORT=$PLAYGROUND_PORT
P2P_HOST_PORT=$P2P_HOST_PORT
HEALTH_PORT=$HEALTH_PORT
DATA_DIR=$DATA_DIR
STATE_DIR=$STATE_DIR
EOF

echo
ok "SHINZO HOST INSTALLED"
echo
cat <<EOF
  Endpoints (this machine):
    DefraDB GraphQL API : http://localhost:${API_PORT}/api/v0/graphql
    GraphQL Playground : http://localhost:${PLAYGROUND_PORT}
    Health             : http://localhost:${HEALTH_PORT}/health
    Metrics            : http://localhost:${HEALTH_PORT}/metrics

  Linked Generator:
    libp2p multiaddr   : $BOOTSTRAP_PEERS
    schema endpoint    : ${GEN_SCHEMA_URL}/api/v1/schema

  Persistence:
    data               : $DATA_DIR/{defradb,keys,lens}
    keyring secret     : $STATE_DIR/keyring-secret  (keep it: it holds the node identity)
    generated config   : $STATE_DIR/config.yaml  (contains the keyring secret)
    install record     : $STATE_DIR/install.env

  Operations:
    logs               : docker logs -f $CONTAINER_NAME
    stop               : docker stop $CONTAINER_NAME
    start              : docker start $CONTAINER_NAME
    uninstall          : docker rm -f $CONTAINER_NAME   (data stays in $DATA_DIR)

  Next steps:
    - open the firewall for inbound P2P on host port ${P2P_HOST_PORT} (tcp)
      so other nodes can reach this Host
    - register the Host with ShinzoHub to serve data to the network:
      https://docs.shinzo.network/run/run-a-host/register/
EOF
echo
exit 0
