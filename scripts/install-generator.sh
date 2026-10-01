#!/bin/sh
# Shinzo Generator client one-line installer.
#
#   curl -fsSL https://docs.shinzo.network/install-generator.sh | sh
#
# Safe to run more than once: if a Generator is already set up, the script says so and changes nothing.

set -eu

DIR=shinzo-generator
VOLUME=shinzo-generator_defradb

info() { printf '%s\n' "$*"; }
fail() { printf 'error: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "$2"; }

ask() { printf '%s' "$1" >/dev/tty; read -r "$2" </dev/tty || true; }

main() {
    need docker "Docker not found. Install it first: https://docs.docker.com/get-docker/"
    docker info >/dev/null 2>&1 || fail "Docker is installed but the daemon isn't running (or you lack permission). Start Docker, or add your user to the docker group, and re-run."
    docker compose version >/dev/null 2>&1 || fail "Docker Compose not found. Install the compose plugin: https://docs.docker.com/compose/install/"

    if [ -f "$DIR/docker-compose.yml" ] || docker volume inspect "$VOLUME" >/dev/null 2>&1; then
        info "A Generator client is already set up (./$DIR or Docker volume $VOLUME exists)."
        info "If ./$DIR isn't here, it was installed from another directory: run these from there."
        info "To start it:    docker compose -f $DIR/docker-compose.yml up -d"
        info "To start fresh: docker compose -f $DIR/docker-compose.yml down -v && rm -rf $DIR, then re-run this script."
        exit 0
    fi

    GETH_RPC_URL=${GETH_RPC_URL:-}
    GETH_WS_URL=${GETH_WS_URL:-}
    GETH_API_KEY=${GETH_API_KEY:-}

    if [ -z "$GETH_RPC_URL" ]; then
        (: </dev/tty) 2>/dev/null || fail "No terminal to prompt on. Provide the URLs upfront: curl -fsSL <url> | GETH_RPC_URL=... GETH_WS_URL=... sh"
        ask 'Execution node RPC URL (JSON-RPC): ' GETH_RPC_URL
        ask 'Execution node WebSocket URL: ' GETH_WS_URL
        ask 'API key (leave empty if the node has no auth): ' GETH_API_KEY
    fi

    [ -n "$GETH_RPC_URL" ] || fail "No RPC URL given. Re-run interactively, or provide it upfront: curl -fsSL <url> | GETH_RPC_URL=... GETH_WS_URL=... sh"
    [ -n "$GETH_WS_URL" ] || fail "No WebSocket URL given. Re-run and provide your node's WebSocket URL."

    GETH_API_KEY_TYPE=${GETH_API_KEY_TYPE:-}
    if [ -n "$GETH_API_KEY" ] && [ -z "$GETH_API_KEY_TYPE" ]; then
        case "$GETH_RPC_URL" in
            *blockchainnodeengine.com*) GETH_API_KEY_TYPE=x-goog-api-key ;;
            *) GETH_API_KEY_TYPE=x-api-key ;;
        esac
        info "API key header guessed as $GETH_API_KEY_TYPE. Set GETH_API_KEY_TYPE to override."
    fi

    mkdir -p "$DIR"

    DEFRADB_KEYRING_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')

    umask 077
    cat > "$DIR/.env" <<EOF
GETH_RPC_URL=$GETH_RPC_URL
GETH_WS_URL=$GETH_WS_URL
GETH_API_KEY=$GETH_API_KEY
GETH_API_KEY_TYPE=$GETH_API_KEY_TYPE
DEFRADB_KEYRING_SECRET=$DEFRADB_KEYRING_SECRET
INDEXER_START_HEIGHT=0
EOF
    umask 022

    cat > "$DIR/docker-compose.yml" <<'EOF'
name: shinzo-generator
services:
  generator:
    container_name: shinzo-generator
    image: ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest
    user: "1001:1001"
    restart: unless-stopped
    mem_limit: 16g
    mem_reservation: 13g
    ports:
      - "127.0.0.1:9181:9181"
      - "127.0.0.1:8080:8080"
      - "9171:9171"
    env_file: .env
    environment:
      - GETH_DIAL_TIMEOUT_SECONDS=10
      - GOMEMLIMIT=14GiB
      - SNAPSHOT_ENABLED=false
      - SCHEMA_AUTH_MODE=none
    volumes:
      - defradb:/app/.defra
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    logging:
      options:
        max-size: "50m"
        max-file: "3"
volumes:
  defradb:
EOF

    info "Created $DIR/docker-compose.yml and $DIR/.env (unique secret generated)"
    info "Pulling the Generator client image (this can take a few minutes)..."

    docker compose -f "$DIR/docker-compose.yml" up -d

    info ""
    info "Generator client is starting. The first sync begins at block 0, so expect it to take a long time."
    info "  Health:    curl -s http://localhost:8080/health"
    info "  Logs:      docker logs -f shinzo-generator"
    info "  Stop:      docker compose -f $DIR/docker-compose.yml down"
    info "  Uninstall: docker compose -f $DIR/docker-compose.yml down -v && rm -rf $DIR"
    info ""
    info "Next step: register your Generator with the Shinzo Network so the"
    info "network recognizes it: https://docs.shinzo.network/run/run-a-generator/register/"
}

main "$@"
