+++
title = "High-throughput tuning"
description = "Tune the Generator for high throughput and fast catch-up from a historical start height by raising block and receipt concurrency, Badger cache sizes, and the Go runtime memory limit."
aliases = ["/generators/deployment-examples/high-throughput-tuning"]
[extra]
mermaid = true
+++

When to use this: your Generator needs to catch up from a historical start height quickly, or you want to maximize block processing throughput on a machine with available CPU and memory.

These scenarios use a supported EVM chain. Shinzo supports multiple EVM chains — see [shinzo.network/chains](https://shinzo.network/chains) for the current list. To target a different chain, change `chain.name` and point the RPC URLs at a compatible node. See the [chain config](/run/run-a-generator/config-reference#chain) for details.

## Topology

{% mermaid() %}
flowchart LR
  subgraph VM["Generator VM"]
    direction TB
    Gen["<b>Generator client</b><br/>concurrent_blocks: 8<br/>receipt_workers: 32<br/>GOMEMLIMIT: 14GiB"]
    DB[("Badger store<br/>block_cache: 1024MB<br/>memtable: 128MB<br/>index_cache: 512MB")]
    Gen --> DB
  end

  Node["Execution node"]
  Hosts["Hosts"]

  Node -- "HTTP + WS" --> Gen
  Gen -- "P2P (libp2p)" --> Hosts
{% end %}

The Generator fetches blocks from your execution node and processes them with a configurable number of concurrent workers. Receipt fetching happens in parallel per block. Badger cache sizes control how much data stays in memory before hitting disk. The `GOMEMLIMIT` env var tells the Go runtime when to trigger garbage collection, preventing OOM kills under load.

## Prerequisites

- Docker installed on the VM.
- An execution node endpoint with enough capacity to handle parallel RPC requests. A local node or a high-throughput managed provider works best.
- At least 16 GB of RAM on the VM. The tuning values below assume this.

## Config file

This `config.yaml` tunes the Generator for high throughput. The values are drawn from the `indexer` and `defradb.store` sections of the shipped `config.yaml`, adjusted upward from defaults. Mount this file into the container at `/app/config.yaml`:

```yaml
chain:
  name: "Ethereum"
  network: "Mainnet"

defradb:
  url: "http://localhost:9181"
  keyring_secret: ""
  embedded: true
  p2p:
    enabled: true
    accept_incoming: false
    bootstrap_peers: []
    listen_addr: "/ip4/0.0.0.0/tcp/9171"
  store:
    path: "./.defra"
    block_cache_mb: 1024
    memtable_mb: 128
    index_cache_mb: 512
    num_compactors: 8
    value_log_file_size_mb: 128

geth:
  node_url: "${GETH_RPC_URL}"
  ws_url: "${GETH_WS_URL}"
  api_key: "${GETH_API_KEY}"
  api_key_type: "${GETH_API_KEY_TYPE}"

indexer:
  start_height: 0
  concurrent_blocks: 8
  receipt_workers: 32
  max_docs_per_txn: 100
  blocks_per_minute: 0
  health_server_port: 8080
  open_browser_on_start: false
  start_buffer: 100

logger:
  development: true

pruner:
  enabled: true
  max_blocks: 1000
  interval_seconds: 30
  prune_history: false

snapshot:
  enabled: true
  dir: "./.defra/snapshots"
  blocks_per_file: 100
  interval_seconds: 30
```

## Compose file

Mount the config file and set `GOMEMLIMIT` via the environment. The node connection details come from env vars, which override the `${GETH_*}` placeholders in the config file:

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
      - ./config.yaml:/app/config.yaml:ro
    environment:
      - GETH_RPC_URL=http://localhost:8545
      - GETH_WS_URL=ws://localhost:8546
      - DEFRADB_KEYRING_SECRET=pingpong
      - GOMEMLIMIT=14GiB
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

### What each tuning value does

- `concurrent_blocks: 8`: Process 8 blocks at the same time instead of the shipped default of 1. This is the code default from `applyDefaults`. Increase it if your node can handle parallel requests. See [indexer config](/run/run-a-generator/config-reference#indexer).
- `receipt_workers: 32`: Fetch 32 receipts concurrently per block, up from the shipped 8. Receipts are the bottleneck for blocks with many transactions. See [indexer config](/run/run-a-generator/config-reference#indexer).
- `blocks_per_minute: 0`: Disable the rate limit. The shipped `config.yaml` sets 60, which caps indexing speed. Set to 0 for maximum throughput during catch-up. See [indexer config](/run/run-a-generator/config-reference#indexer).
- `block_cache_mb: 1024`: Double the shipped 512. More cache means fewer disk reads for recently written blocks. See [defradb store config](/run/run-a-generator/config-reference#defradb-store).
- `memtable_mb: 128`: Double the shipped 64. Larger memtables reduce the frequency of flushes to disk. See [defradb store config](/run/run-a-generator/config-reference#defradb-store).
- `index_cache_mb: 512`: Double the shipped 256. More index cache speeds up point lookups during pruning and snapshot creation. See [defradb store config](/run/run-a-generator/config-reference#defradb-store).
- `num_compactors: 8`: Double the shipped 4. More compaction workers prevent L0 table buildup during high write rates. See [defradb store config](/run/run-a-generator/config-reference#defradb-store).
- `GOMEMLIMIT=14GiB`: Go runtime soft memory limit, set below the 16g container limit. The runtime uses this to decide when to trigger GC, which prevents OOM kills. See [env vars](/run/run-a-generator/config-reference#environment-variables).

## Start the Generator

```shell
docker compose -f docker-compose.yml up -d
```

Monitor the catch-up rate:

```shell
curl -s http://localhost:8080/metrics | jq '.blocks_processed, .blocks_per_minute'
```

## Gotchas

- The shipped `config.yaml` sets `concurrent_blocks: 1`, but the code default in `applyDefaults` is 8. If you mount no config file and set no env var, you get the code default of 8. If the container image includes the shipped `config.yaml`, you get 1 unless you override it.
- High `concurrent_blocks` and `receipt_workers` values generate parallel RPC requests against your execution node. A local node can usually handle this. A shared or rate-limited managed provider may throttle or reject connections. Monitor your node's request queue and RPC error rate.
- `blocks_per_minute: 0` removes the rate limit entirely. This is useful for catch-up but means the Generator will process blocks as fast as your node can serve them. If your node is also serving other consumers, this can starve them of RPC capacity.
- `GOMEMLIMIT` is a Go runtime soft memory limit, not a Generator client config var. It is honored by the Go runtime's garbage collector. Set it below the container `mem_limit` to leave headroom for non-Go memory allocations. If you set it too high, the container can be OOM-killed by the kernel.
- Increasing Badger cache sizes raises memory usage. The values above (`block_cache_mb: 1024`, `memtable_mb: 128`, `index_cache_mb: 512`) add up to roughly 1.6 GB of cache alone. Make sure the total stays within the `GOMEMLIMIT` and container memory limit.
- `num_compactors: 8` uses more CPU. On a machine with fewer than 8 cores, this can cause CPU contention with block processing. Match it to your available cores.

## Need help

{{ need_help(client="Generator", repo_name="shinzo-generator-client", repo="https://github.com/shinzonetwork/shinzo-generator-client/issues") }}
