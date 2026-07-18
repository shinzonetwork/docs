+++
title = "Prod VM with nginx and TLS"
[extra]
mermaid = true
+++

When to use this: you want to run a production Host on a VM with nginx as a reverse proxy, TLS termination, and persistent volumes for DefraDB data, keys, and lens files.

These scenarios use Ethereum Mainnet data. Ethereum is the only officially supported chain today, but any EVM-compatible chain should work by changing the contract addresses and topic hashes to match the target chain. See the [Generator chain config](/generators/config-reference#chain) for details.

## Topology

{% mermaid() %}
flowchart LR
  subgraph VM["Prod VM"]
    direction TB
    Nginx["<b>nginx</b><br/>:8080 reverse proxy"]
    Host["<b>Host container</b><br/>:9181 GraphQL API<br/>:9171 P2P<br/>:8080 Health/Metrics"]
    Nginx -- "proxy" --> Host
  end

  Gens["Generators"]
  Clients["API clients"]

  Gens -- "P2P (libp2p)<br/>:9171" --> Host
  Clients -- "HTTPS<br/>/api/v0/graphql<br/>/metrics" --> Nginx
{% end %}

nginx terminates incoming HTTPS traffic and proxies GraphQL and metrics requests to the Host container. P2P traffic from Generators goes directly to the Host on port 9171, bypassing nginx. Persistent volumes on the VM keep DefraDB data, keys, and lens files across container restarts.

## Prerequisites

- Docker installed on the VM.
- A `config.yaml` file with your Host configuration.
- Ports 8080 and 9171 open externally. Port 9181 is internal to the Docker network.

## Config file

This config is drawn from `host-prod-setup.sh` in the `shinzo-host-client` repo. It sets the DefraDB URL, keyring secret, P2P bootstrap peers, and the ShinzoHub endpoint. The event filter is disabled, accepting all documents:

```yaml
defradb:
  url: "localhost:9181"
  keyring_secret: "pingpong"
  p2p:
    enabled: true
    bootstrap_peers:
      - '/ip4/34.63.13.57/tcp/9171/p2p/12D3KooW9vHms1Uyzai3j8L3ZykcPhLYXoHifzrhgKP6HaTmszbV'
      - '/ip4/35.208.241.78/tcp/9171/p2p/12D3KooWDUN4xrdREQ4qcAbRmHb1otefmwi6F3a9FTsZdconUHUZ'
    listen_addr: "/ip4/0.0.0.0/tcp/9171"
    max_retries: 5
    retry_base_delay_ms: 1000
    reconnect_interval_ms: 60000
    enable_auto_reconnect: true
  store:
    path: "./.defra"
    block_cache_mb: 512
    memtable_mb: 64
    index_cache_mb: 256
    num_compactors: 4
    value_log_file_size_mb: 128

shinzo:
  minimum_attestations: 1
  start_height: 0
  hub_base_url: rpc.develop.devnet.shinzo.network:26657
  cache_queue_size: 50000
  batch_writer_count: 8
  batch_size: 500
  batch_flush_interval: 100
  use_block_signatures: true
  doc_worker_count: 32
  doc_queue_size: 50000
  event_filter:
    enabled: false
    mode: "allowlist"
    cascade_filters: true
    groups:
      - name: "uniswap-v3"
        enabled: true
        contracts:
          - name: "Uniswap V3 Router 2"
            address: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"
            types: ["transaction", "log"]
        topics:
          - name: "Swap"
            topic0: "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"
      - name: "stablecoins"
        enabled: true
        contracts:
          - name: "USDT"
            address: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
            types: ["log"]
          - name: "USDC"
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
            types: ["log"]
        topics:
          - name: "Transfer"
            topic0: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

pruner:
  enabled: true
  max_blocks: 2000
  docs_per_block: 1000
  interval_seconds: 30
  prune_history: false

logger:
  development: false

host:
  lens_registry_path: "./.defra/lens"
  health_server_port: 8080
  open_browser_on_start: false
  snapshot:
    enabled: false
    indexer_url: "http://35.206.105.60:8080"
    historical_ranges:
      - start: 24528700
        end: 24528999
```

## Compose file

This compose file is drawn from `host-prod-setup.sh`. It runs the Host container and an nginx container on a shared Docker network. The Host container exposes P2P on 9171, the GraphQL API on 9181, and the playground on 444. nginx proxies external traffic on port 8080:

```yaml
networks:
  shinzo-net:
    driver: bridge

services:
  shinzo-host:
    image: ghcr.io/shinzonetwork/shinzo-host-client:standard
    user: "1003:1006"
    mem_limit: 16g
    mem_reservation: 13g
    restart: unless-stopped
    container_name: shinzo-host
    networks:
      - shinzo-net
    ports:
      - "9181:9181"
      - "444:9182"
      - "9171:9171"
    volumes:
      - ~/data/defradb:/app/.defra/data
      - ~/data/keys:/app/.defra/keys
      - ~/data/lens:/app/.lens
      - ~/config.yaml:/app/config.yaml:ro
    environment:
      - GOMEMLIMIT=14GiB
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/metrics"]
      interval: 15s
      timeout: 30s
      retries: 10
      start_period: 120s

  nginx:
    image: nginx:alpine
    ports:
      - "8080:8080"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - shinzo-host
    networks:
      - shinzo-net
    restart: unless-stopped
```

## nginx configuration

This nginx config is drawn from `host-prod-setup.sh`. It proxies GraphQL and metrics requests to the Host container, with CORS headers restricted to `explorer.shinzo.network`:

```nginx
events { worker_connections 1024; }

http {
  map $http_origin $cors_origin {
    default "";
    "https://explorer.shinzo.network" $http_origin;
  }

  server {
    listen 8080;
    server_name _;

    add_header 'Access-Control-Allow-Origin' $cors_origin always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, Origin' always;
    add_header 'Access-Control-Max-Age' 3600 always;
    add_header 'Vary' 'Origin' always;

    location / {
      if ($request_method = OPTIONS) {
        return 204;
      }

      proxy_pass http://shinzo-host:9181;
      proxy_set_header Host $host;
    }

    location = /metrics {
      if ($request_method = OPTIONS) {
        return 204;
      }

      proxy_pass http://shinzo-host:8080/metrics;
      proxy_set_header Host $host;
    }

    location = /api/v0/graphql {
      if ($request_method = OPTIONS) {
        return 204;
      }

      proxy_pass http://shinzo-host:9181/api/v0/graphql;
      proxy_set_header Host $host;
    }
  }
}
```

### What the key values mean

- `user: "1003:1006"`: The container runs as UID 1003, GID 1006. Update this to match your user and group ID on the VM. The data directories must be owned by this UID and GID.
- `GOMEMLIMIT=14GiB`: Go runtime soft memory limit, set below the 16g container limit. See [env vars](/hosts/config-reference#environment-variables).
- `~/data/defradb:/app/.defra/data`: Persistent volume for DefraDB data. See [defradb store](/hosts/config-reference#defradb-store).
- `~/data/keys:/app/.defra/keys`: Persistent volume for DefraDB keyring keys. See [defradb](/hosts/config-reference#defradb).
- `~/data/lens:/app/.lens`: Persistent volume for lens WASM files. See [host](/hosts/config-reference#host).
- `~/config.yaml:/app/config.yaml:ro`: Mount the config file read-only.
- The `444:9182` port mapping exposes the GraphQL Playground on port 444. The playground is built with the `hostplayground` build tag, not controlled by env vars.

## Start the Host

Place all three files (`config.yaml`, `docker-compose.yml`, `nginx.conf`) in the same directory, then start:

```shell
docker compose -f docker-compose.yml up -d
```

Verify the Host is healthy through nginx:

```shell
curl http://localhost:8080/metrics
```

Query GraphQL through nginx:

```shell
curl -s -X POST http://localhost:8080/api/v0/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ Ethereum__Mainnet__Block(limit: 1) { number hash } }"}'
```

## Gotchas

- The `user: "1003:1006"` in the compose file must match the ownership of the data directories. If the directories are owned by root, the Host container will fail to write. Fix ownership with `chown -R 1003:1006 ~/data/defradb ~/data/keys ~/data/lens`.
- `DEFRA_URL`, `LOG_LEVEL`, `LOG_SOURCE`, and `LOG_STACKTRACE` appear in the original `host-prod-setup.sh` compose file but are not read by the Host client. They have been omitted from this compose file. See [env vars that are not read](/hosts/config-reference#env-vars-that-are-not-read).
- The `DEFRA_KEYRING_SECRET` env var uses the `DEFRA_` prefix. The Generator client uses `DEFRADB_KEYRING_SECRET` with the `DEFRADB_` prefix. If you are running both clients on the same VM, do not confuse the two env var names. See [environment variables](/hosts/config-reference#environment-variables).
- The shipped `config.yaml` includes several `shinzo.*` keys that are not in the `config.go` struct and are silently ignored: `wait_for_gaps`, `max_gap_size`, `batch_processing_enabled`, `batch_max_views_per_job`, `batch_query_cache_size`. They have been omitted from the config above. See [no-op keys](/hosts/config-reference#no-op-keys).
- The `logger.level` field in the shipped config is not in the `LoggerConfig` struct and has no effect. It has been omitted. See [logger](/hosts/config-reference#logger).
- The bootstrap peer IDs in the shipped `host-prod-setup.sh` differ from the ones in the shipped `config.yaml`. Both may be stale. Check the [Shinzo Validators list](https://registration.shinzo.network/validators) for current peers.
- The nginx CORS config restricts origins to `https://explorer.shinzo.network`. If you need to allow other origins, add them to the `map` block in the nginx config.
- The Host image tag in this compose file is `ghcr.io/shinzonetwork/shinzo-host-client:standard`. The GCP startup scripts pin `:v0.5.1`, and the Watchtower setup uses `:latest`. Pick one tag and be consistent across your deployment.

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
