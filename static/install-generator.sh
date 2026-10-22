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

# stdin is this script under `curl | sh`, so prompts read from the terminal.
ask() { printf '%s' "$1" >/dev/tty; read -r "$2" </dev/tty || true; }
has_tty() { (: </dev/tty) 2>/dev/null; }

main() {
    need docker "Docker not found. Install it first: https://docs.docker.com/get-docker/"
    docker info >/dev/null 2>&1 || fail "Docker is installed but the daemon isn't running (or you lack permission). Start Docker, or add your user to the docker group, and re-run."
    docker compose version >/dev/null 2>&1 || fail "Docker Compose not found. Install the compose plugin: https://docs.docker.com/compose/install/"

    # Already installed? Leave everything alone.
    if [ -f "$DIR/docker-compose.yml" ] || docker volume inspect "$VOLUME" >/dev/null 2>&1; then
        info "A Generator client is already set up (./$DIR or Docker volume $VOLUME exists)."
        info "If ./$DIR isn't here, it was installed from another directory: run these from there."
        info "To start it:    docker compose -f $DIR/docker-compose.yml up -d"
        info "To start fresh: docker compose -f $DIR/docker-compose.yml down -v && rm -rf $DIR, then re-run this script."
        exit 0
    fi

    # MacOS management...
    if [ "$(uname -s)" = Darwin ]; then
        has_tty || fail "Running on macOS needs an interactive terminal to confirm the warning. Run the installer from Terminal."
        RAM_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
        info "WARNING: The Generator client isn't designed to run on macOS for long periods."
        info "  - The image is built for x86-64 only. On Apple Silicon it runs under emulation, which is much slower."
        info "  - It needs at least 16 GB of RAM. With less, it will run out of memory quickly. This Mac has ${RAM_GB} GB."
        info "  - Docker Desktop must also be allowed that much memory: Settings > Resources > Memory."
        info "For a long-running Generator, use a Linux x86-64 machine."
        REPLY=
        ask 'Install anyway? [y/N] ' REPLY
        case "$REPLY" in
            [yY]|[yY][eE][sS]) ;;
            *) fail "Installation cancelled. Nothing was changed." ;;
        esac
    fi

    # User needs to add this info.
    GETH_RPC_URL=${GETH_RPC_URL:-}
    GETH_WS_URL=${GETH_WS_URL:-}
    GETH_API_KEY=${GETH_API_KEY:-}

    if [ -z "$GETH_RPC_URL" ]; then
        has_tty || fail "No terminal to prompt on. Provide the URLs upfront: curl -fsSL <url> | GETH_RPC_URL=... GETH_WS_URL=... sh"
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
    platform: linux/amd64       # x86-64 only; emulated on ARM hosts such as Apple Silicon
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
