+++
title = "Archival versus pruned"
[extra]
mermaid = true
+++

When to use this: you need to decide whether your Generator keeps all historical data or prunes old blocks. A pruned Generator uses less storage but can still serve snapshots for Host bootstrap. An archival Generator keeps everything but grows without bound.

These scenarios use Ethereum Mainnet and Geth. Ethereum is the only officially supported chain today, but any EVM-compatible chain should work by changing `chain.name` and pointing the RPC URLs at a compatible node. See the [chain config](/generators/config-reference#chain) for details.

## Topology

{% mermaid() %}
flowchart TB
  subgraph Pruned["Pruned Generator"]
    direction LR
    GenP["<b>Generator</b><br/>pruner.enabled: true<br/>max_blocks: 1000"]
    SnapP["Snapshot files<br/>blocks_per_file: 1000"]
    GenP -- "writes snapshots<br/>before pruning" --> SnapP
  end

  subgraph Archival["Archival Generator"]
    GenA["<b>Generator</b><br/>pruner.enabled: false<br/>snapshot.enabled: false"]
  end

  Hosts["Hosts"]

  GenP -- "P2P (libp2p)" --> Hosts
  GenA -- "P2P (libp2p)" --> Hosts
  Hosts -- "HTTPS snapshot<br/>bootstrap" --> SnapP
{% end %}

The pruned Generator writes snapshot files before deleting old blocks. Hosts can download those snapshots for historical bootstrap, then receive live blocks over P2P. The archival Generator never deletes anything. It uses more disk space but does not need snapshots because it can serve any block range directly over P2P.

## Pruned Generator config

This config keeps 1000 blocks in the database and produces snapshot files before pruning. It is drawn from the `pruner` and `snapshot` sections of the shipped `config.yaml`:

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
    block_cache_mb: 512
    memtable_mb: 64
    index_cache_mb: 256
    num_compactors: 4
    value_log_file_size_mb: 128

geth:
  node_url: "${GETH_RPC_URL}"
  ws_url: "${GETH_WS_URL}"
  api_key: "${GETH_API_KEY}"
  api_key_type: "${GETH_API_KEY_TYPE}"

indexer:
  start_height: 0
  concurrent_blocks: 1
  receipt_workers: 8
  max_docs_per_txn: 500
  blocks_per_minute: 60
  health_server_port: 8080
  open_browser_on_start: false
  start_buffer: 100

logger:
  development: false

pruner:
  enabled: true
  max_blocks: 1000
  docs_per_block: 1000
  interval_seconds: 30
  prune_history: false

snapshot:
  enabled: true
  dir: "./.defra/snapshots"
  blocks_per_file: 100
  interval_seconds: 30
```

### Pruned key values

- `pruner.enabled: true`: Turn on automatic pruning. See [pruner config](/generators/config-reference#pruner).
- `pruner.max_blocks: 1000`: Keep the last 1000 blocks in the database. At roughly 12 seconds per Ethereum block, that is about 3.3 hours of history. See [pruner config](/generators/config-reference#pruner).
- `pruner.docs_per_block: 1000`: Average docs per block. The pruner triggers at `max_blocks` times `docs_per_block` documents. See [pruner config](/generators/config-reference#pruner).
- `pruner.interval_seconds: 30`: Check for pruning every 30 seconds. See [pruner config](/generators/config-reference#pruner).
- `pruner.prune_history: false`: Do not walk DAG chains to delete historical block versions. Setting this to true is two to three times slower. See [pruner config](/generators/config-reference#pruner).
- `snapshot.enabled: true`: Produce snapshot files before pruning. Hosts can download these for historical bootstrap. See [snapshot config](/generators/config-reference#snapshot).
- `snapshot.blocks_per_file: 100`: Bundle 100 blocks per snapshot file. The shipped `config.yaml` sets 100, while the code default in `SetDefaults` is 1000. See [snapshot config](/generators/config-reference#snapshot).

## Archival Generator config

This config disables both pruning and snapshots. The database grows without bound. Mount this file at `/app/config.yaml`:

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
    block_cache_mb: 512
    memtable_mb: 64
    index_cache_mb: 256
    num_compactors: 4
    value_log_file_size_mb: 128

geth:
  node_url: "${GETH_RPC_URL}"
  ws_url: "${GETH_WS_URL}"
  api_key: "${GETH_API_KEY}"
  api_key_type: "${GETH_API_KEY_TYPE}"

indexer:
  start_height: 0
  concurrent_blocks: 1
  receipt_workers: 8
  max_docs_per_txn: 500
  blocks_per_minute: 60
  health_server_port: 8080
  open_browser_on_start: false
  start_buffer: 100

logger:
  development: false

pruner:
  enabled: false

snapshot:
  enabled: false
```

### Archival key values

- `pruner.enabled: false`: No pruning. The database retains every block, transaction, log, and signature from `start_height` onward. See [pruner config](/generators/config-reference#pruner).
- `snapshot.enabled: false`: No snapshots. An archival Generator does not need snapshots because it never deletes blocks. Hosts can replicate the full history over P2P. See [snapshot config](/generators/config-reference#snapshot).

## Storage comparison

The pruned Generator with `max_blocks: 1000` and `docs_per_block: 1000` holds roughly 1 million documents at steady state. On Ethereum mainnet, each block produces approximately 150 documents on average (blocks with many transactions produce more, empty blocks produce fewer). The actual document count varies, but 1000 blocks typically uses 2 to 5 GB of Badger storage.

The archival Generator grows by roughly 150 documents per block, or about 650,000 documents per day. At Ethereum's 12-second block time, a year of mainnet history is approximately 2.6 million blocks, producing hundreds of GB of storage. Plan disk capacity accordingly.

## Compose file

Either config can be mounted with the same compose file. Change the config file path as needed:

```yaml
networks:
  shinzo-net:
    driver: bridge

services:
  shinzo-indexer:
    container_name: shinzo-indexer
    platform: linux/amd64
    image: ghcr.io/shinzonetwork/shinzo-indexer-client:standard
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

## Gotchas

- `pruner.prune_threshold` appears in the shipped `config.yaml` with value 1. It is deprecated and unused by the pruner. It has been omitted from both configs above. See [pruner config](/generators/config-reference#pruner).
- `snapshot.blocks_per_file` defaults to 1000 in the code (`SetDefaults`), but the shipped `config.yaml` sets 100. If you omit the field entirely, you get 1000. If you mount the shipped config, you get 100.
- When switching from pruned to archival, old pruned data is gone. The Generator will not re-fetch blocks that were already deleted. You need to restart with `start_height` set to a block you want to begin archival from, or accept that history before the switch is incomplete.
- When switching from archival to pruned, the pruner will start deleting old blocks on the next interval. Snapshot files are created before pruning begins, but if the snapshot directory does not have enough disk space, snapshots may fail and blocks will be pruned without a snapshot backup.
- The pruner uses `DefaultCollectionConfig` which prunes `Block`, `BlockSignature`, `AccessListEntry`, `Log`, and `Transaction` collections. It does not prune `SnapshotSignature` documents, which accumulate over time even on a pruned Generator.
- For an archival Generator, consider increasing `block_cache_mb` and `index_cache_mb` to keep more of the larger database in memory. See the [high-throughput tuning scenario](../high-throughput-tuning/) for cache sizing guidance.

## Need help

{{ need_help(client="Generator", repo_name="shinzo-generator-client", repo="https://github.com/shinzonetwork/shinzo-generator-client/issues") }}
