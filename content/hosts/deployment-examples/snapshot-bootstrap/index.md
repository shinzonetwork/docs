+++
title = "Snapshot bootstrap from an indexer"
description = "Bootstrap a Host with historical data on first startup by downloading signed snapshot files from an indexer over HTTPS, then receive live blocks over P2P."
[extra]
mermaid = true
+++

When to use this: you want your Host to sync historical data quickly on first startup by downloading signed snapshot files from an indexer, instead of waiting for P2P replication to catch up from the chain tip.

These scenarios use Ethereum Mainnet data. Ethereum is the only officially supported chain today, but any EVM-compatible chain should work by changing the contract addresses and topic hashes to match the target chain. See the [Generator chain config](/generators/config-reference#chain) for details.

## Topology

{% mermaid() %}
flowchart LR
  subgraph Startup["First startup"]
    direction TB
    S1["1. Download snapshots<br/>from indexer over HTTPS"]
    S2["2. Import snapshots<br/>into DefraDB"]
    S3["3. Start P2P<br/>for live blocks"]
    S1 --> S2 --> S3
  end

  Indexer["<b>Indexer</b><br/>HTTP :8080<br/>/snapshots endpoint"]
  Gens["Generators<br/>(live P2P feed)"]
  Host["<b>Host</b>"]

  Indexer -- "HTTPS<br/>snapshot files" --> Host
  Gens -- "P2P (libp2p)" --> Host
{% end %}

On first startup, the Host downloads signed snapshot files from an indexer over HTTPS and imports them into DefraDB. After the snapshot import completes, the Host connects to Generators over P2P and starts receiving live blocks from the chain tip. This is faster than waiting for P2P replication to fill in historical data block by block.

## Prerequisites

- Docker installed on the VM.
- An indexer serving snapshots over HTTP. The indexer must have `SNAPSHOT_ENABLED=true` and be reachable over HTTPS or HTTP. See the [nginx with TLS scenario](/generators/deployment-examples/nginx-tls-snapshots/) for how to set up an indexer that serves snapshots.
- The block range you want to bootstrap. The indexer must have snapshot files covering that range.

## Config file

This config enables snapshot bootstrap from the indexer at `http://35.206.105.60:8080` for blocks 24528700 through 24528999. It is drawn from the `host.snapshot` section of the shipped `host-client/config/config.yaml`:

```yaml
defradb:
  url: "localhost:9181"
  keyring_secret: "pingpong"
  p2p:
    enabled: true
    bootstrap_peers:
      - '/ip4/35.254.135.221/tcp/9171/p2p/12D3KooWDUdHSCXBM5Wb7te6ZdWMgqddw7tJ7npWSzXK5tQgBsbT'
      - '/ip4/34.57.239.57/tcp/9171/p2p/12D3KooWBAgCEJHYqzuCFEXzjsw2CnV9JqvqMgTKYDww58aCxwW5'
      - '/ip4/34.134.119.63/tcp/9171/p2p/12D3KooWQQTuSQaz4HfuvnJHakkQy3PhWbKBBbS3RkmBw4ZsFkyT'
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
  start_height: 0
  hub_base_url: testnet.shinzo.network:26657
  cache_queue_size: 50000
  batch_writer_count: 8
  batch_size: 500
  batch_flush_interval: 100
  use_block_signatures: true
  doc_worker_count: 32
  doc_queue_size: 50000

pruner:
  enabled: true
  max_blocks: 2000
  docs_per_block: 1000
  interval_seconds: 30
  prune_history: false

logger:
  development: true

host:
  lens_registry_path: "./.defra/lens"
  health_server_port: 8080
  open_browser_on_start: false
  snapshot:
    enabled: true
    indexer_url: "http://35.206.105.60:8080"
    historical_ranges:
      - start: 24528700
        end: 24528999
```

### What each snapshot value does

- `host.snapshot.enabled: true`: Run snapshot bootstrap on startup. The shipped `config.yaml` sets this to false. See [host snapshot](/hosts/config-reference#host-snapshot).
- `host.snapshot.indexer_url`: HTTP base URL of the indexer serving snapshots. Replace `http://35.206.105.60:8080` with your indexer URL. See [host snapshot](/hosts/config-reference#host-snapshot).
- `host.snapshot.historical_ranges`: Block ranges to download during bootstrap. Each range is inclusive. See [host snapshot](/hosts/config-reference#host-snapshot).

## How bootstrap works

All three conditions must be true for snapshot bootstrap to run: `snapshot.enabled` is true, `indexer_url` is non-empty, and `historical_ranges` has at least one entry. If any condition is false, bootstrap is skipped and the Host goes straight to P2P replication.

The Host downloads snapshot files from `{indexer_url}/snapshots/{filename}` for each block range. Each snapshot file contains signed blocks bundled by the Generator. The Host imports them into DefraDB, then starts P2P replication for live blocks.

## Running with Docker

Mount the config file into the container:

```shell
docker run -d \
  --name shinzo-host \
  --restart unless-stopped \
  -p 9181:9181 \
  -p 9171:9171 \
  -p 8080:8080 \
  -v $(pwd)/data/defradb:/app/.defra \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -e DEFRA_KEYRING_SECRET=pingpong \
  ghcr.io/shinzonetwork/shinzo-host-client:latest
```

Check the startup logs for snapshot import progress:

```shell
docker logs -f shinzo-host
```

You should see log lines indicating snapshot downloads and imports, followed by P2P network startup.

## Gotchas

- Snapshot bootstrap only runs on first startup when DefraDB has no existing data. If the Host already has data for the requested block range, bootstrap is skipped.
- The `indexer_url` in the shipped `config.yaml` is `http://35.206.105.60:8080`. This is a development indexer. Replace it with your own indexer URL or a production indexer that has snapshots enabled.
- The indexer must have `SNAPSHOT_ENABLED=true` on the Generator side. If the indexer is not producing snapshot files, the `/snapshots` endpoint will return nothing and bootstrap will fail. See the [nginx with TLS scenario](/generators/deployment-examples/nginx-tls-snapshots/) for setting up an indexer that serves snapshots.
- The `DEFRA_URL` env var overrides `defradb.url` at runtime and is read by the Host client (`config/config.go`). The `docker run` above does not set it, so the DefraDB URL comes from `defradb.url` in the YAML config. See [environment variables](/hosts/config-reference#environment-variables).
- The `DEFRA_KEYRING_SECRET` env var uses the `DEFRA_` prefix. The Generator client uses `DEFRADB_KEYRING_SECRET` with the `DEFRADB_` prefix. The two clients use different env var names for the same concept. See [environment variables](/hosts/config-reference#environment-variables).
- `LOG_LEVEL`, `LOG_SOURCE`, and `LOG_STACKTRACE` env vars appear in some deployment scripts but are not read by the Host client. They have been omitted from the `docker run` above. See [env vars that are not read](/hosts/config-reference#env-vars-that-are-not-read).

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
