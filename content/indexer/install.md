# Running a Shinzo indexer

This tutorial covers spinning up a Shinzo indexer on a fresh Ubuntu 24.04 VM, checking it works, and managing the container lifecycle.

## Prerequisites

- Ubuntu 24.04 VM.
- Root/sudo access.
- Docker and Docker Compose installed.
- A Geth node with HTTP and WebSocket endpoints.
- A Geth API key (only required for externally hosted nodes).

## Steps

1. Verify that you've got Docker installed:

  ```shell
  docker --version
  # Docker version 29.1.3
  ```

1. Clone the `shinzer-indexer-client` repo and move into it:

  ```shell
  git clone https://github.com/shinzonetwork/shinzo-indexer-client.git
  cd shinzo-indexer-client
  ```

1. Create local data directories:

  ```shell
  mkdir -p ~/data/defradb ~/data/lens
  chown -R 1001:1001 ~/data/defradb ~/data/lens
  ```

  The indexer stores blockchain data on the host so it persists across container restarts. The container runs as UID 1001. If these directories are owned by root, DefraDB will fail to start with a `permission denied` error.


1. Build the Docker image. This takes around 15 minutes on the first run:

  ```shell
  docker build -t shinzo-indexer:local .
  ```

1. Create `~/docker-compose.yml` with your Geth connection details. This file goes in your home directory, not inside the repo:

  ```yaml
  networks:
    shinzo-net:
      driver: bridge

  services:
    shinzo-indexer:
      image: shinzo-indexer:local
      container_name: shinzo-indexer
      restart: unless-stopped
      networks:
        - shinzo-net
      ports:
        - "9171:9171"
        - "8080:8080"
        - "9181:9181"
      volumes:
        - ~/data/defradb:/app/.defra
        - ~/data/lens:/app/.defra/lens
      environment:
        - GETH_RPC_URL=<your-geth-http-url>
        - GETH_WS_URL=<your-geth-ws-url>
        - GETH_API_KEY=<your-api-key>
        - INDEXER_START_HEIGHT=0
        - DEFRADB_KEYRING_SECRET=<choose-a-secret-and-keep-it>
        - SNAPSHOT_ENABLED=false
        - LOG_LEVEL=info
      logging:
        options:
          max-size: "50m"
          max-file: "3"
  ```

  | Variable | Description |
  |---|---|
  | `GETH_RPC_URL` | HTTP JSON-RPC endpoint of your Geth node. |
  | `GETH_WS_URL` | WebSocket endpoint of your Geth node. |
  | `GETH_API_KEY` | API key for your Geth node. Leave empty if your node needs no authentication ([see below](#do-you-need-an-api-key)). |
  | `INDEXER_START_HEIGHT` | Block number to start from. `0` starts 100 blocks behind the current chain tip. |
  | `DEFRADB_KEYRING_SECRET` | Used to encrypt the DefraDB identity. Pick any value and keep it — if you change it after the first run the indexer will fail to load its existing identity. |

1. Start the indexer:

  ```shell
  docker-compose -f ~/docker-compose.yml up -d
  ```

1. Verify it is working:

  ```shell
  docker ps
  ```

  You should see `shinzo-indexer` with status `Up` and eventually `(healthy)`.

1. Hit the health endpoint:

  ```shell
  curl http://localhost:8080/health
  ```

  A working indexer returns something like:

  ```output
  {
    "status": "healthy",
    "current_block": 24891405,
    "last_processed": "2026-04-16T09:13:42Z",
    "defradb_connected": true,
    "uptime_seconds": 341,
    "p2p": {
      "enabled": true,
      "self": {
        "id": "12D3KooWK...",
        "addresses": ["/ip4/127.0.0.1/tcp/9171"]
      }
    }
  }
  ```

  Check that `status` is `"healthy"`, `defradb_connected` is `true`, and `current_block` is incrementing.

1. Watch blocks being indexed in real time:

  ```shell
  docker logs -f shinzo-indexer
  ```

  You should see a stream of committed blocks:

  ```
  INFO  Committed block 24891405 (ID: bae-...)
  INFO  Committed block 24891406 (ID: bae-...)
  ```

1. To query indexed data, call the DefraDB GraphQL API runs on port 9181:

  ```shell
  curl -s -X POST http://localhost:9181/api/v0/graphql \
    -H "Content-Type: application/json" \
    -d '{"query":"{ Ethereum__Mainnet__Block(filter: { number: { _eq: 24891405 } }) { hash number } }"}'
  ```

1. Once you're done, you can stop the indexer:

  ```shell
  docker-compose -f ~/docker-compose.yml stop
  ```

  This stops the container but keeps it and all indexed data intact. To restart it again, run:

  ```shell
  docker-compose -f ~/docker-compose.yml start
  ```

  After restarting, the indexer loads the existing DefraDB identity from the keyring and picks up from the last indexed block. No data is lost.

1. Done!

## Do you need an API key?

It depends on where your Geth node is.

If the indexer and the Geth node are on the same private network (both on VMs in the same VPC, for example) you probably don't need one. Geth has no authentication by default. Leave `GETH_API_KEY` empty and point `GETH_RPC_URL` at the node's internal IP or hostname.

If you are connecting to an externally hosted node, authentication is almost always required. Two common cases:

- **GCP Blockchain Node Engine** (`blockchainnodeengine.com`) — expects the API key in the `X-goog-api-key` header.
- **A self-hosted node behind a reverse proxy** (e.g. nginx) — the operator decides the header; `X-Api-Key` is common.

The indexer picks the right header automatically based on the URL.

## Automatic restart on VM reboot

The `restart: unless-stopped` policy means Docker starts the indexer automatically on boot. You do not need to do anything after a normal reboot.

If the container shows `(unhealthy)` after a reboot but otherwise appears to be running fine, this is a known Docker health check glitch that can occur after a host restart. A restart clears it:

```shell
docker-compose -f ~/docker-compose.yml restart
```

## Exposed ports

| Port | Service |
|---|---|
| `8080` | Health endpoint (`/health`), metrics (`/metrics`) |
| `9171` | DefraDB P2P |
| `9181` | DefraDB GraphQL API |

## Troubleshooting

**`permission denied` on `.defra/keys`**

The data directories are owned by root but the container runs as UID 1001. Stop the container, fix the ownership, then start again:

```shell
docker-compose -f ~/docker-compose.yml stop
chown -R 1001:1001 ~/data/defradb ~/data/lens
docker-compose -f ~/docker-compose.yml start
```

**`401 Unauthorized` from the Geth endpoint**

You are probably using the GHCR image rather than the local build. The GHCR image sends the wrong authentication header for non-GCP nodes. Rebuild locally (step 4) and make sure your compose file has `image: shinzo-indexer:local`.

**`403 Forbidden` from the Geth endpoint**

You are connecting to a GCP Blockchain Node Engine URL but the indexer is sending `X-Api-Key` instead of `X-goog-api-key`. Check that your `GETH_RPC_URL` contains `blockchainnodeengine.com` — the indexer uses the URL to pick the right header.

**`failed to load existing DefraDB identity`**

The `DEFRADB_KEYRING_SECRET` has changed since the first run. Restore the original value in your compose file and restart.

**`WARN WebSocket unavailable, will use HTTP-only mode`**

Not fatal — the indexer falls back to HTTP polling. Check that `GETH_WS_URL` is correct and the port is reachable. HTTP-only mode works but may be slightly slower.

