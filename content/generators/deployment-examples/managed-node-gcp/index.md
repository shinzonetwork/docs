+++
title = "Managed node on GCP Blockchain Node Engine"
description = "Run the Generator client against GCP Blockchain Node Engine or another managed node provider that requires an API key header."
[extra]
mermaid = true
+++

When to use this: you want to run the Generator client against GCP Blockchain Node Engine or another managed node provider, authenticating with an API key header.

These scenarios use Ethereum Mainnet and Geth. Ethereum is the only officially supported chain today, but any EVM-compatible chain should work by changing `chain.name` and pointing the RPC URLs at a compatible node. See the [chain config](/generators/config-reference#chain) for details.

## Topology

{% mermaid() %}
flowchart LR
  subgraph VM["Generator VM"]
    Gen["<b>Generator client</b><br/>:9171 P2P<br/>:8080 Health/Metrics"]
  end

  GCP["<b>GCP Blockchain Node Engine</b><br/>json-rpc...blockchainnodeengine.com"]
  Hosts["Hosts"]

  GCP -- "HTTPS<br/>x-goog-api-key header" --> Gen
  Gen -- "P2P (libp2p)" --> Hosts
{% end %}

The Generator runs on its own VM and connects to GCP Blockchain Node Engine over HTTPS. GCP BNE requires an API key in the `x-goog-api-key` header. The Generator sends this header on every JSON-RPC and WebSocket request. Data flows out to Hosts over P2P.

## Prerequisites

- Docker installed on the VM.
- A GCP Blockchain Node Engine instance provisioned. See the [GCP documentation](https://cloud.google.com/blockchain-node-engine) for setup.
- Your GCP API key for the BNE instance.
- Port 9171 open for P2P traffic from Hosts. Port 8080 open for health and metrics if you want to monitor externally.

## Compose file

This compose file is drawn from `docker-compose-prod.yml` in the `shinzo-generator-client` repo. Replace `<YOUR_API_KEY_HERE>` with your GCP API key:

```yaml
networks:
  shinzo-net:
    driver: bridge

services:
  shinzo-generator:
    container_name: shinzo-generator
    platform: linux/amd64
    image: ghcr.io/shinzonetwork/shinzo-generator-client:standard
    user: "1001:1001"
    restart: unless-stopped
    networks:
      - shinzo-net
    mem_limit: 16g
    mem_reservation: 13g
    ports:
      - "9171:9171"
    volumes:
      - ~/shinzo-data/defradb:/app/.defra
    environment:
      - GETH_RPC_URL=https://json-rpc.aouzyll7wj7e9xe4g7t82w88c.blockchainnodeengine.com
      - GETH_WS_URL=wss://ws.aouzyll7wj7e9xe4g7t82w88c.blockchainnodeengine.com
      - GETH_API_KEY=<YOUR_API_KEY_HERE>
      - GETH_API_KEY_TYPE=x-goog-api-key
      - INDEXER_START_HEIGHT=0
      - DEFRADB_KEYRING_SECRET=pingpong
      - GOMEMLIMIT=14GiB
      - SNAPSHOT_ENABLED=false
      - SCHEMA_AUTH_MODE=none
    logging:
      options:
        max-size: "50m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

### What each value means

- `GETH_RPC_URL` and `GETH_WS_URL`: Your GCP BNE endpoints. Replace the example URLs with your own BNE instance URLs. See [geth config](/generators/config-reference#geth).
- `GETH_API_KEY=<YOUR_API_KEY_HERE>`: Your GCP API key. Replace this with the actual key from your GCP console. See [geth config](/generators/config-reference#geth).
- `GETH_API_KEY_TYPE=x-goog-api-key`: The header name GCP BNE expects for authentication. See [geth config](/generators/config-reference#geth).
- `INDEXER_START_HEIGHT=0`: Start indexing from the chain tip. See [indexer config](/generators/config-reference#indexer).
- `DEFRADB_KEYRING_SECRET=pingpong`: Encryption secret for the DefraDB keyring. Change this to your own secret and keep it consistent across restarts. See [defradb config](/generators/config-reference#defradb).
- `GOMEMLIMIT=14GiB`: Go runtime soft memory limit. Set below the container `mem_limit` to leave headroom for non-Go memory. See [env vars](/generators/config-reference#environment-variables).
- `SNAPSHOT_ENABLED=false`: Disable snapshots. Enable if you want the Generator to produce snapshot files for Host bootstrap. See [snapshot config](/generators/config-reference#snapshot).
- `SCHEMA_AUTH_MODE=none`: Disable authentication on the `/api/v1/schema` endpoints. The code default is `token`, which requires keys via `SCHEMA_API_KEYS` or every schema request returns 503. The repo's `docker-compose-prod.yml` sets `none`. See [indexer config](/generators/config-reference#indexer).

## Env file

You can also use an `.env` file instead of inline environment variables. This mirrors the vars in the compose above:

```shell
GETH_RPC_URL=https://json-rpc.aouzyll7wj7e9xe4g7t82w88c.blockchainnodeengine.com
GETH_WS_URL=wss://ws.aouzyll7wj7e9xe4g7t82w88c.blockchainnodeengine.com
GETH_API_KEY=YOUR_API_KEY
GETH_API_KEY_TYPE=x-goog-api-key
INDEXER_START_HEIGHT=0
DEFRADB_KEYRING_SECRET=YOUR_DEFRADB_KEYRING_SECRET
SCHEMA_AUTH_MODE=none
```

To use it with `docker run`, mount the `.env` file with `--env-file .env`.

## Start the Generator

```shell
docker compose -f docker-compose.yml up -d
```

Verify health. The health server listens on port 8080 inside the container but is not published to the host in this compose, so use `docker compose exec`:

```shell
docker compose exec shinzo-generator curl -f http://localhost:8080/health
```

## Registration

Once the Generator is running, register it with the Shinzo Network. See [Registration](/generators/register/).

## Gotchas

- The image tag `ghcr.io/shinzonetwork/shinzo-generator-client:standard` in this compose matches `docker-compose-prod.yml`. The repo's `indexer-prod-setup.sh` pins a versioned tag (`ghcr.io/shinzonetwork/shinzo-generator-client:v0.6.5.1-ethereum-mainnet`), and the [install page](/generators/install/) uses `ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest`. Docker pull/run tag strategy is being consolidated in issues #326 and #327; align with whatever those land on rather than mixing tags across deployments.
- `LOG_LEVEL`, `LOG_SOURCE`, and `LOG_STACKTRACE` appear in the original `docker-compose-prod.yml` but are not read by the Generator client, so they are omitted here. `SCHEMA_AUTH_MODE=none` is kept because the Generator client does read it. Log level is controlled by `LOGGER_DEBUG`. See the [env vars table](/generators/config-reference#environment-variables) for details.
- The `GETH_WS_URL` in this compose file uses `wss://` (secure WebSocket) because GCP BNE requires TLS on all connections. If you switch to a non-TLS WebSocket provider, use `ws://` instead.
- `GOMEMLIMIT` is not a Generator client config var. It is a Go runtime soft memory limit, honored by the Go runtime itself. Set it below the container memory limit to control garbage collection under pressure.

## Need help

{{ need_help(client="Generator", repo_name="shinzo-generator-client", repo="https://github.com/shinzonetwork/shinzo-generator-client/issues") }}
