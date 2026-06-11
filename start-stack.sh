#!/usr/bin/env bash
#
# start-stack.sh — bring up a Shinzo Indexer and a Shinzo Host on the SAME VM,
# connect the Host to the Indexer over P2P, and verify the connection.
#
# Runs end-to-end with no human interaction:
#   1. (re)starts a fresh Indexer container
#   2. waits for the Indexer health endpoint + P2P self-info
#   3. writes the Host config pointing at the Indexer's real libp2p address
#   4. (re)starts the Host container on remapped ports
#   5. verifies both peers see each other
#
# Requirements: docker, curl, jq.
#
set -euo pipefail

# ---- Indexer Geth connection (override via env) -----------------------------
GETH_RPC_URL="${GETH_RPC_URL:-http://35.193.228.182:8080}"
GETH_WS_URL="${GETH_WS_URL:-ws://35.193.228.182:8080}"
GETH_API_KEY="${GETH_API_KEY:-df7fc1e2c686d61a26d390d00aad49f61e899c7d1cf9f97d13c8378f6819e6db}"
GETH_API_KEY_TYPE="${GETH_API_KEY_TYPE:-x-goog-api-key}"
INDEXER_START_HEIGHT="${INDEXER_START_HEIGHT:-0}"
INDEXER_KEYRING_SECRET="${INDEXER_KEYRING_SECRET:-devnet-secret}"
INDEXER_P2P_LISTEN_ADDR="${INDEXER_P2P_LISTEN_ADDR:-/ip4/0.0.0.0/tcp/9174}"

# ---- Indexer container / ports ----------------------------------------------
INDEXER_IMAGE="${INDEXER_IMAGE:-ghcr.io/shinzonetwork/shinzo-indexer-client:standard}"
INDEXER_NAME="${INDEXER_NAME:-shinzo-indexer}"
INDEXER_API_PORT="${INDEXER_API_PORT:-9181}"      # -> container 9181 (GraphQL API)
INDEXER_P2P_PUB_PORT="${INDEXER_P2P_PUB_PORT:-9171}"  # -> container 9171 (published P2P)
INDEXER_HEALTH_PORT="${INDEXER_HEALTH_PORT:-8080}"    # -> container 8080 (health)
INDEXER_HEALTH_URL="${INDEXER_HEALTH_URL:-http://localhost:${INDEXER_HEALTH_PORT}}"

# ---- Host config / container / ports ----------------------------------------
HOST_CONFIG="${HOST_CONFIG:-$HOME/host-config.yaml}"
KEYRING_SECRET="${KEYRING_SECRET:-host-devnet-secret}"   # Host DefraDB keyring secret
HOST_IMAGE="${HOST_IMAGE:-ghcr.io/shinzonetwork/shinzo-host-client:standard}"
HOST_NAME="${HOST_NAME:-shinzo-host}"
HOST_API_PORT="${HOST_API_PORT:-9182}"      # -> container 9181 (GraphQL API)
HOST_P2P_PORT="${HOST_P2P_PORT:-9172}"      # -> container 9171 (P2P)
HOST_HEALTH_PORT="${HOST_HEALTH_PORT:-8081}" # -> container 8080 (health)

# How the Host container reaches the Indexer's P2P endpoint.
# Leave both empty to auto-detect from the indexer's advertised /health addresses
# (recommended). Override INDEXER_P2P_IP with a remote VM's IP for separate-VM
# setups, or INDEXER_P2P_PORT to pin the libp2p port explicitly.
INDEXER_P2P_IP="${INDEXER_P2P_IP:-}"
INDEXER_P2P_PORT="${INDEXER_P2P_PORT:-}"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ---- Preflight --------------------------------------------------------------
command -v docker >/dev/null || die "docker not found"
command -v curl   >/dev/null || die "curl not found"
command -v jq     >/dev/null || die "jq not found (install: sudo apt-get install -y jq)"

# ---- Step 1: (re)start a fresh Indexer --------------------------------------
if docker ps -a --format '{{.Names}}' | grep -qx "$INDEXER_NAME"; then
  log "Removing existing Indexer container '${INDEXER_NAME}'"
  docker rm -f "$INDEXER_NAME" >/dev/null
fi

log "Starting Indexer container '${INDEXER_NAME}'"
docker run -d \
  --name "$INDEXER_NAME" \
  -e GETH_RPC_URL="${GETH_RPC_URL}" \
  -e GETH_WS_URL="${GETH_WS_URL}" \
  -e GETH_API_KEY="${GETH_API_KEY}" \
  -e GETH_API_KEY_TYPE="${GETH_API_KEY_TYPE}" \
  -e INDEXER_START_HEIGHT="${INDEXER_START_HEIGHT}" \
  -e DEFRADB_KEYRING_SECRET="${INDEXER_KEYRING_SECRET}" \
  -e DEFRADB_PLAYGROUND=true \
  -e DEFRADB_P2P_ENABLED=true \
  -e DEFRADB_P2P_LISTEN_ADDR="${INDEXER_P2P_LISTEN_ADDR}" \
  -e LOGGER_DEBUG=true \
  -p "${INDEXER_API_PORT}:9181" \
  -p "${INDEXER_P2P_PUB_PORT}:9171" \
  -p "${INDEXER_HEALTH_PORT}:8080" \
  "$INDEXER_IMAGE" >/dev/null

# ---- Step 2: wait for the Indexer's P2P self-info ---------------------------
# The indexer's /health endpoint reports the Peer ID AND the real libp2p
# listen addresses. The internal P2P port is NOT necessarily the published
# 9171 (DEFRADB_P2P_LISTEN_ADDR may bind 9174), so read it from here rather
# than assuming. We also read a non-loopback container IP so the Host
# container can dial the indexer directly over the shared docker bridge.
log "Waiting for Indexer P2P self-info from ${INDEXER_HEALTH_URL} ..."
SELF_JSON=""
for i in $(seq 1 60); do
  SELF_JSON="$(curl -fsS -H 'Accept: application/json' "${INDEXER_HEALTH_URL}/health" 2>/dev/null \
    | jq -c '.p2p.self // empty' 2>/dev/null || true)"
  [[ -z "$SELF_JSON" ]] && SELF_JSON="$(curl -fsS "${INDEXER_HEALTH_URL}/registration" 2>/dev/null \
    | jq -c '.p2p.self // empty' 2>/dev/null || true)"
  if [[ -n "$SELF_JSON" && "$(jq -r '.id // empty' <<<"$SELF_JSON")" != "" ]]; then
    break
  fi
  sleep 2
  if [[ "$i" -eq 60 ]]; then
    docker logs --tail 30 "$INDEXER_NAME" 2>&1 || true
    die "Indexer did not report P2P self-info in time. Check: docker logs ${INDEXER_NAME}"
  fi
done

PEER_ID="$(jq -r '.id // empty' <<<"$SELF_JSON")"
[[ -n "$PEER_ID" ]] || die "Indexer reported no Peer ID."
log "Indexer Peer ID: ${PEER_ID}"

# Derive the P2P port from the indexer's advertised addresses (first non-loopback,
# else first address). Allow explicit override via INDEXER_P2P_PORT.
if [[ -z "${INDEXER_P2P_PORT:-}" ]]; then
  INDEXER_P2P_PORT="$(jq -r '
    ([.addresses[]? | select(test("127\\.0\\.0\\.1")|not)] + .addresses)[0]
    | capture("/tcp/(?<p>[0-9]+)").p // empty' <<<"$SELF_JSON")"
  INDEXER_P2P_PORT="${INDEXER_P2P_PORT:-9171}"
fi

# Determine how the Host container reaches the indexer:
#   - If INDEXER_P2P_IP is preset (e.g. a remote VM IP), use it.
#   - Else prefer the indexer's own non-loopback container IP from its
#     advertised addresses (direct container-to-container over the bridge).
#   - Else fall back to the docker0 gateway.
if [[ -z "$INDEXER_P2P_IP" ]]; then
  INDEXER_P2P_IP="$(jq -r '
    [.addresses[]? | capture("/ip4/(?<ip>[0-9.]+)/").ip
                  | select(. != "127.0.0.1" and . != "0.0.0.0")][0] // empty' <<<"$SELF_JSON")"
fi
if [[ -z "$INDEXER_P2P_IP" ]]; then
  INDEXER_P2P_IP="$(ip -4 addr show docker0 2>/dev/null | grep -oP 'inet \K[\d.]+' || true)"
  INDEXER_P2P_IP="${INDEXER_P2P_IP:-172.17.0.1}"
fi
log "Indexer P2P reachable at ${INDEXER_P2P_IP}:${INDEXER_P2P_PORT} (from inside the Host container)"

BOOTSTRAP_PEER="/ip4/${INDEXER_P2P_IP}/tcp/${INDEXER_P2P_PORT}/p2p/${PEER_ID}"
log "Bootstrap peer: ${BOOTSTRAP_PEER}"

# ---- Step 3: write the Host config ------------------------------------------
log "Writing Host config to ${HOST_CONFIG}"
cat > "$HOST_CONFIG" <<YAML
defradb:
  url: "localhost:9181"
  keyring_secret: "${KEYRING_SECRET}"
  p2p:
    enabled: true
    bootstrap_peers:
      - '${BOOTSTRAP_PEER}'
    listen_addr: "/ip4/0.0.0.0/tcp/9171"
    enable_auto_reconnect: true
  store:
    path: "./.defra"
shinzo:
  hub_base_url: rpc.devnet.shinzo.network:26657
  minimum_attestations: 1
  start_height: 0
logger:
  development: true
  level: "info"
host:
  lens_registry_path: "./.defra/lens"
  health_server_port: 8080
YAML

# ---- Step 4: (re)launch the Host container ----------------------------------
if docker ps -a --format '{{.Names}}' | grep -qx "$HOST_NAME"; then
  log "Removing existing Host container '${HOST_NAME}'"
  docker rm -f "$HOST_NAME" >/dev/null
fi

log "Starting Host container '${HOST_NAME}'"
docker run -d \
  --name "$HOST_NAME" \
  -e BOOTSTRAP_PEERS="${BOOTSTRAP_PEER}" \
  -v "${HOST_CONFIG}:/app/config.yaml:ro" \
  -p "${HOST_API_PORT}:9181" \
  -p "${HOST_P2P_PORT}:9171" \
  -p "${HOST_HEALTH_PORT}:8080" \
  "$HOST_IMAGE" >/dev/null

# ---- Step 5: verify ---------------------------------------------------------
log "Waiting for Host to connect to the Indexer ..."
CONNECTED=false
for i in $(seq 1 45); do
  PEERS="$(curl -fsS -H 'Accept: application/json' "http://localhost:${HOST_HEALTH_PORT}/health" 2>/dev/null \
    | jq -r '[.p2p.peers[]?.id] | join(",")' 2>/dev/null || true)"
  if [[ "$PEERS" == *"$PEER_ID"* ]]; then
    CONNECTED=true
    break
  fi
  sleep 2
done

log "Host health / P2P peers:"
curl -fsS -H 'Accept: application/json' "http://localhost:${HOST_HEALTH_PORT}/health" \
  | jq '{status, current_block, p2p: {self: .p2p.self.id, peers: [.p2p.peers[].id]}}' || true

if [[ "$CONNECTED" == true ]]; then
  log "SUCCESS: Host is connected to the Indexer over P2P."
else
  log "ERROR: Host has not listed the Indexer peer yet. Check: docker logs -f ${HOST_NAME}"
fi

cat <<EOF

------------------------------------------------------------------
Stack is up.

Indexer
  GraphQL API : http://localhost:${INDEXER_API_PORT}
  Health      : ${INDEXER_HEALTH_URL}/health
  P2P         : ${INDEXER_P2P_PUB_PORT} (published), libp2p on ${INDEXER_P2P_PORT}
  Register at : ${INDEXER_HEALTH_URL}/registration-app

Host
  GraphQL API : http://localhost:${HOST_API_PORT}
  Health      : http://localhost:${HOST_HEALTH_PORT}/health
  P2P         : ${HOST_P2P_PORT} (container 9171)
  Register at : http://localhost:${HOST_HEALTH_PORT}/registration-app

Verify replication:
  - Indexer should list the Host:
      curl -s -H 'Accept: application/json' ${INDEXER_HEALTH_URL}/health | jq '[.p2p.peers[].id]'
  - Logs:  docker logs -f ${HOST_NAME}
           docker logs -f ${INDEXER_NAME}
------------------------------------------------------------------
EOF
