+++
title = "Quicknode setup"
description = "A walkthrough for operators who want to run a Shinzo Generator client but would rather pay a managed node provider than run and babysit their own Ethereum execution node."
+++

In this guide, you'll stand up the Shinzo Generator client as a Docker sidecar, point it at a QuickNode HTTPS + WSS endpoint, authenticate with an `x-token` header, and watch it sign and commit blocks from chain tip. We're using Ethereum mainnet in this example; the process is similar or the same for other networks.

If you want to participate in the Shinzo by trustlessly reading and signing on-chain data, but you don't want to run your own node then this guide is for you. Most managed node providers, like Quicknode, require a monthly subscription fee, however most offer a free tier for basic testing. This guide also assumed you have a small Linux VM and can run Docker.

{% admonition(type="note") %}
Installing and running the Generator client does not require you to be a Validator. The separate Registration step, which makes the Generator a recognized source on the Shinzo network, _does_ require an active and bonded validator on your source chain. However, this guide covers install, run, and verify only, and flags registration as an optional next step.
{% end %}

## Prerequisites

- A [QuickNode](https://www.quicknode.com/) account.
- A Linux VM with:
  - ~8 GB RAM, ~30 GB free disk.
  - **Docker** + the **Docker Compose plugin** installed.
  - Port `9171` reachable if you want Hosts to connect over P2P (fine to leave closed for this guide, since the Generator still reads and signs data locally).
  - The examples in this guide assume you're running a Debian-based Linux distro, however any distro is fine; you'll just have to tweak some commands to fit your OS.

## Create a QuickNode endpoint

1. In the QuickNode dashboard, create an endpoint. In this guide we're using **Ethereum mainnet** as an example.
1. Under **Security**, make sure **Token Authentication** is enabled (JWTs can stay disabled).
1. Copy three things from the endpoint's **Connection Details**:
   - HTTP Provider URL (e.g. `https://alpha-proud-isle.ethereum-mainnet.quiknode.pro/77f6889.../`).
   - WebSocket URL (e.g. `wss://alpha-proud-isle.ethereum-mainnet.quiknode.pro/77f6889.../`).
   - The auth token itself (e.g. `77f6889ea5a4f33fed9a02ce024811980754c573`).

You'll use the base URLs (strip the token off the path) plus the token sent as a header. So your working values become:

| Variable | Value (example, replace with yours) |
| --- | --- |
| RPC URL (no token) | `https://alpha-proud-isle.ethereum-mainnet.quiknode.pro/` |
| WS URL (no token) | `wss://alpha-proud-isle.ethereum-mainnet.quiknode.pro/` |
| Token | `77f6889ea5a4f33fed9a02ce024811980754c573` |

{% admonition(type="warning") %}
QuickNode's admin Console API uses an `x-api-key` header but the RPC endpoints don't. The RPC endpoints use the token-in-URL or an `x-token` header. Sending `x-api-key` to the RPC endpoint will still get you a `401`. This guide uses `x-token`, which the Shinzo Generator supports natively via `GETH_API_KEY_TYPE`.
{% end %}

Sanity-check the header auth with curl before touching the Generator client. With no header you should get a `401`; with `x-token` you should get a block number:

This is wrong:

```shell
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://alpha-proud-isle.ethereum-mainnet.quiknode.pro/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

```output
401
```

This is correct:

```shell
curl -s -X POST https://alpha-proud-isle.ethereum-mainnet.quiknode.pro/ \
  -H "x-token: 77f6889ea5a4f33fed9a02ce024811980754c573" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

```output
{"jsonrpc":"2.0","id":1,"result":"0x188f3f9"}
```

Getting a block number (like `"result":"0x188f3f9"`) means you're ready to wire up the Generator client.

## Install Docker

If you've already got Docker installed, skip this section. Get the latest install instructions from the [official Docker Docs site](https://docs.docker.com/engine/install/). The general process for Debian/Ubuntu hosts is:

1. Install the prerequisites:

    ```shell
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    ```

1. Add Docker's official `apt` repo and install the Docker packages:

    ```shell
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
         docker-buildx-plugin docker-compose-plugin
    ```

1. Verify that everything installed properly:

    ```shell
    docker --version
    docker compose version
    ```
    
    ```output
    Docker version 29.7.2, build a7dcaa6
    Docker Compose version v5.4.0
    ```

1. Done.

## Configure the Generator client

Clone the client repo (it ships the compose templates and sample env):

```shell
git clone https://github.com/shinzonetwork/shinzo-generator-client.git
cd shinzo-generator-client
```

### Create your env file

Create a `.env` in the repo root, gitignored by default. Use the base URLs (token removed) and put the token in `GETH_API_KEY` with `GETH_API_KEY_TYPE=x-token`:

```dotenv
# --- QuickNode endpoint: token is sent via x-token header, NOT in the URL ---
GETH_RPC_URL=https://alpha-proud-isle.ethereum-mainnet.quiknode.pro/
GETH_WS_URL=wss://alpha-proud-isle.ethereum-mainnet.quiknode.pro/
GETH_API_KEY=77f6889ea5a4f33fed9a02ce024811980754c573
GETH_API_KEY_TYPE=x-token

# --- Indexer ---
# 0 = auto-detect from chain tip (no full-genesis backfill). Set a block number
# to start elsewhere.
INDEXER_START_HEIGHT=0

# --- Embedded DefraDB ---
# Generate your own: openssl rand -hex 32
# IMPORTANT: keep this stable across restarts, or DefraDB can't load its identity.
DEFRADB_KEYRING_SECRET=<paste-your-own-random-secret-here>
DEFRADB_PLAYGROUND=true
DEFRADB_P2P_ENABLED=true
DEFRADB_P2P_LISTEN_ADDR=/ip4/0.0.0.0/tcp/9171

# --- Logging / schema ---
LOGGER_DEBUG=true
SCHEMA_AUTH_MODE=none
```

Generate a keyring secret and keep it safe:

```shell
openssl rand -hex 32   # paste the output into DEFRADB_KEYRING_SECRET
```

### Create a QuickNode-tailored compose file

Save this as `docker-compose.quicknode.yml` in the repo root. It's derived from the repo's `docker-compose-prod.yml` (the managed-node example) with three changes: the mainnet image tag, memory limits sized for an ~8 GB VM, and no nginx reverse proxy (health/graphql bound to localhost instead).

```yaml
# Shinzo Generator client backed by a QuickNode Ethereum Mainnet endpoint.
# Uses x-token header auth: the token lives in GETH_API_KEY (.env), NOT in URLs.
# Memory is sized for an ~8 GB VM. Scale mem_limit / GOMEMLIMIT up on larger hosts.
# Run:   docker compose -f docker-compose.quicknode.yml --env-file .env up -d

networks:
  shinzo-net:
    driver: bridge

services:
  shinzo-generator:
    container_name: shinzo-generator
    platform: linux/amd64
    image: ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest
    user: "1001:1001"
    restart: unless-stopped
    networks:
      - shinzo-net
    mem_limit: 6g
    mem_reservation: 5g
    ports:
      - "9171:9171"            # DefraDB P2P (libp2p), exposed for Hosts to connect
      - "127.0.0.1:8080:8080"  # Health / metrics, localhost only
      - "127.0.0.1:9181:9181"  # DefraDB GraphQL API, localhost only
    volumes:
      - /root/shinzo-data/defradb:/app/.defra
    environment:
      # QuickNode Ethereum Mainnet endpoint
      - GETH_RPC_URL=${GETH_RPC_URL}
      - GETH_WS_URL=${GETH_WS_URL}
      - GETH_API_KEY=${GETH_API_KEY}
      - GETH_API_KEY_TYPE=${GETH_API_KEY_TYPE}

      # Embedded DefraDB
      - DEFRADB_KEYRING_SECRET=${DEFRADB_KEYRING_SECRET}
      - DEFRADB_PLAYGROUND=${DEFRADB_PLAYGROUND:-true}
      - DEFRADB_P2P_ENABLED=${DEFRADB_P2P_ENABLED:-true}
      - DEFRADB_P2P_LISTEN_ADDR=${DEFRADB_P2P_LISTEN_ADDR:-/ip4/0.0.0.0/tcp/9171}

      # Generator settings
      - INDEXER_START_HEIGHT=${INDEXER_START_HEIGHT:-0}
      - GOMEMLIMIT=5GiB
      - SNAPSHOT_ENABLED=false
      - SCHEMA_AUTH_MODE=${SCHEMA_AUTH_MODE:-none}
      - LOGGER_DEBUG=${LOGGER_DEBUG:-true}
    logging:
      options:
        max-size: "50m"
        max-file: "3"
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:8080/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

Create the data directory with the right ownership (the container runs as UID `1001`):

```shell
mkdir -p /root/shinzo-data/defradb
chown -R 1001:1001 /root/shinzo-data
```

### Key settings explained

| Setting | What it does |
| --- | --- |
| `GETH_RPC_URL` / `GETH_WS_URL` | QuickNode base URLs without the token. |
| `GETH_API_KEY` | Your QuickNode auth token, sent as a header. |
| `GETH_API_KEY_TYPE=x-token` | The header name the Generator sends. (Use `x-goog-api-key` for GCP BNE, `x-api-key` for most self-hosted proxies.) |
| `INDEXER_START_HEIGHT=0` | Auto-detect: start ~100 blocks behind chain tip and catch up. No full-genesis backfill. |
| `DEFRADB_KEYRING_SECRET` | Encryption secret for the embedded DefraDB keyring. Keep it stable across restarts. |
| `DEFRADB_PLAYGROUND=true` | Enables GraphQL introspection on the API. |
| `SCHEMA_AUTH_MODE=none` | Disables token auth on `/api/v1/schema` (fine for a single-operator node). |
| `GOMEMLIMIT=5GiB` | Go runtime soft memory limit; keep below `mem_limit`. Scale both up on bigger hosts. |

{% admonition(type="info") %}
See the [Generator client config reference](../../../run-a-generator/config-reference/index.md) for a detailed list of available configuration options.
{% end %}

## Start the client

```shell
docker compose -f docker-compose.quicknode.yml --env-file .env up -d
```

This pulls the image (`ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest`) and starts the container. Follow the logs:

```shell
docker logs -f shinzo-generator
```

### What success looks like in the logs

On a healthy start you'll see, in order:

1. **DefraDB identity loaded from keyring**, confirming your keyring secret is consistent.
1. **HTTP client created for your QuickNode URL** and a **WebSocket connection established successfully with the `x-token` header**, confirming auth worked:

   ```output
   INFO  Creating HTTP client with API key authentication for https://alpha-proud-isle.ethereum-mainnet.quiknode.pro/
   INFO  Attempting WebSocket connection to wss://alpha-proud-isle.ethereum-mainnet.quiknode.pro/
   INFO  Creating WebSocket connection with x-token header
   INFO  WebSocket connection established successfully with x-token header
   ```

1. **Starting from `<N>` (chain tip: `<M>`)**. `INDEXER_START_HEIGHT=0` kicked in, so `N` will be roughly 100 blocks behind tip.

   ```output
   INFO  No existing blocks, starting from 25745359 (chain tip: 25745459)
   INFO  Starting indexer - will process latest blocks from Geth https://alpha-proud-isle.ethereum-mainnet.quiknode.pro/
   ```

1. **`Committed block <N>`** lines streaming by as it catches up:

   ```output
   INFO  Block 25745359: signed (1761 docs, 1761 CIDs, identity: 02be4d5c...)
   INFO  Committed block 25745359 (ID: bae-ddd65ab7-1512-5435-8432-7bc38fe1225b)
   INFO  Committed block 25745360 (ID: bae-0304136d-f6c5-512b-ab37-35b78125f444)
   ...
   ```

1. Once it reaches the head of the chain, it transitions to waiting for new blocks (HTTP-only polling fallback message, or a short `not available yet, waiting...` line), which is the live-at-tip milestone.

The Generator's default rate limit is 60 blocks/minute, and Ethereum mainnet produces ~5 blocks/minute, so the ~100-block startup gap closes in roughly a couple of minutes.

## Verify

#### Health check

Port `8080` should be bound to localhost:

```shell
curl -s http://127.0.0.1:8080/health | jq
```

```output
{
  "status": "healthy",
  "current_block": 25745390,
  "last_processed": "2026-08-13T10:22:58.429548055Z",
  "defradb_connected": true,
  "p2p": { "enabled": true, "self": { "id": "12D3KooWS3Wy…", "addresses": [...] }, "peers": [] }
}
```

Getting `status: "healthy"` and `defradb_connected: true` mean you're good. `current_block` climbs as catch-up proceeds. `peers: []` is expected until you register and Hosts dial in.

#### GraphQL query

Port `9181`, POST to `/api/v0/graphql`. Query the committed blocks directly from the embedded DefraDB:

```shell
curl -s -X POST http://127.0.0.1:9181/api/v0/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ Ethereum__Mainnet__Block { number } }"}'
```

```output
{
  "data": {
    "Ethereum__Mainnet__Block": [
      { "number": 25745359 }, { "number": 25745360 }, { "number": 25745361 },
      { "number": 25745362 }, { "number": 25745363 }, { "number": 25745364 }
    ]
  }
}
```

#### Container status

```shell
docker ps --filter name=shinzo-generator --format "{{.Status}}"
# Up 2 minutes (healthy)
```

If you see `(healthy)`, the in-container healthcheck (`curl /health`) is passing too.

## Stopping and cleanup

To stop everything but _keep_ the data:

```shell
docker compose -f docker-compose.quicknode.yml down
```

If you don't care about keeping any data:

```shell
docker compose -f docker-compose.quicknode.yml down -v
sudo rm -rf /root/shinzo-data/defradb/*
```

{% admonition(type="warning") %}
Running `rm -rf` is (mostly) irreversable. Data deleted this way is really, _really_ hard to get back. But you already knew that, right?
{% end %}

## Gotchas

Here are a few things that might trip you up.

- **`x-token` isn't `x-api-key`.** QuickNode's RPC endpoints authenticate with the URL token or an `x-token` header. `x-api-key` is only for QuickNode's admin Console API. Pointing `GETH_API_KEY_TYPE` at `x-api-key` against an RPC endpoint will give you `401`s that look mysterious.
- **`DEFRADB_KEYRING_SECRET` must be stable.** If it changes between restarts, DefraDB can't load its existing identity and the container will fail to start with "Failed to load existing DefraDB identity." Restore the original value. Generate it once with `openssl rand -hex 32` and treat it like a password.
- **Data dir ownership.** The container runs as UID `1001`, but the bind-mounted data dir is often root-owned on first create. If you see "Permission denied on `.defra/keys`", fix it with `chown -R 1001:1001 /root/shinzo-data/defradb`.
- **`INDEXER_START_HEIGHT=0` means "start near tip," not "start at genesis."** The Generator auto-detects chain tip and begins ~100 blocks back (configurable via `indexer.start_buffer`), then catches up. If you actually want a deep historical backfill, set an explicit block number, and expect it to take a long time and need a lot more disk.
- **Memory limits.** The repo's `docker-compose-prod.yml` targets a 16 GB host (`mem_limit: 16g`, `GOMEMLIMIT=14GiB`). On an ~8 GB VM, scale both down (this guide uses `6g` / `5GiB`). `GOMEMLIMIT` is a Go runtime soft cap, not a Generator config var, so keep it below `mem_limit`.
- **Image tags are being consolidated.** The install docs use `:ethereum-mainnet-latest`, the prod compose uses `:standard`, and the prod setup script pins versioned tags like `:v0.6.5.1-ethereum-mainnet`. Pick one strategy and don't mix tags across deployments. This guide uses the mainnet-latest tag from the install docs.
- **WebSocket fallback.** If `GETH_WS_URL` is wrong or unreachable, the Generator falls back to HTTP polling ("WebSocket unavailable, will use HTTP-only mode"). It still works, just slightly slower. The logs above show a successful WSS connection; if you don't see that line, check the URL and token.
- **Port 9171 (P2P).** Only needed for Hosts to pull from your Generator. For this guide you can leave it firewalled; the Generator still reads and signs data locally. Open it (and ideally advertise a public IP) before registration.
