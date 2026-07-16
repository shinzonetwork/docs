+++
title = "Config reference"
+++

The Host client loads configuration from a YAML file (default `config/config.yaml`). Unlike the Generator client, the Host applies only two environment variable overrides directly in `config/config.go`: `START_HEIGHT` and `BOOTSTRAP_PEERS`. A third env var, `DEFRA_KEYRING_SECRET`, is read separately in `pkg/defradb/defra.go`.

The Host has no `applyDefaults` function. Unset numeric fields stay at Go zero values (0, false, empty string) unless the shipped `config.yaml` sets them. The pruner is the one exception: `cfg.Pruner.SetDefaults()` is called in `pkg/host/host.go` when pruning is enabled, filling in defaults for `max_blocks`, `docs_per_block`, and `interval_seconds`. Several P2P fields also receive defaults inside `pkg/defradb/network_handler.go` and `pkg/defradb/defra.go` at startup.

Some fields in the shipped `config.yaml` are not in the `config.go` struct and are silently ignored. These are listed in the no-op keys section below.

## defradb

Embedded database configuration. DefraDB handles storage, P2P replication, content addressing, CRDT merging, and query serving.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `url` | string | `http://localhost:9181` | no | (none) | DefraDB API URL. Used for the playground address and health endpoint. The `DEFRA_URL` env var is not read. Shipped `config.yaml` sets `localhost:9181`. |
| `keyring_secret` | string | from `DEFRA_KEYRING_SECRET` | no | `DEFRA_KEYRING_SECRET` | Encryption secret for the DefraDB keyring. Read in `pkg/defradb/defra.go`, not in `config.go`. Shipped `config.yaml` sets `pingpong`. |

The Host uses the env var name `DEFRA_KEYRING_SECRET` (with `DEFRA_` prefix). The Generator client uses `DEFRADB_KEYRING_SECRET` (with `DEFRADB_` prefix). The two clients use different env var names for the same concept.

### defradb p2p

P2P networking configuration. The Host receives data from Generator clients over libp2p.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `enabled` | bool | true | no | (none) | Enable P2P networking. |
| `bootstrap_peers` | string array | empty | no | `BOOTSTRAP_PEERS` | P2P bootstrap peer multiaddrs. Env var is comma-separated. Shipped `config.yaml` lists two indexer peers. |
| `listen_addr` | string | `/ip4/127.0.0.1/tcp/9171` | no | (none) | Multiaddr to listen on for P2P connections. Applied as a fallback in `StartDefraInstance` when empty. Shipped `config.yaml` sets `/ip4/0.0.0.0/tcp/9171`. |
| `max_retries` | int | 5 | no | (none) | Connection attempts before marking a peer as failed. Default applied in `network_handler.go`. |
| `retry_base_delay_ms` | int | 1000 | no | (none) | Base delay in milliseconds for exponential backoff. Default applied in `network_handler.go`. |
| `reconnect_interval_ms` | int | 60000 | no | (none) | Interval in milliseconds to check for disconnected peers. |
| `enable_auto_reconnect` | bool | true | no | (none) | Automatically reconnect to failed or disconnected peers. |
| `peer_discovery_timeout_ms` | int | 10000 | no | (none) | Timeout in milliseconds for auto-discovering peer IDs. When 0, falls back to 10 seconds via `DefaultPeerDiscoveryTimeout` in `peer_discovery.go`. |

### defradb store

Badger storage engine configuration. All cache and compaction fields map directly to Badger options.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `path` | string | `.defra` | no | (none) | Path to the DefraDB data directory. Shipped `config.yaml` sets `./.defra`. |
| `block_cache_mb` | int64 | 0 | no | (none) | Badger block cache size in MB. Shipped `config.yaml` sets 512. |
| `memtable_mb` | int64 | 0 | no | (none) | Badger memtable size in MB. Shipped `config.yaml` sets 64. |
| `index_cache_mb` | int64 | 0 | no | (none) | Badger index cache size in MB. Shipped `config.yaml` sets 256. |
| `num_compactors` | int | 0 | no | (none) | Number of Badger compaction workers. Shipped `config.yaml` sets 4. |
| `num_level_zero_tables` | int | 0 | no | (none) | L0 tables before compaction starts. Shipped `config.yaml` comments this out. |
| `num_level_zero_tables_stall` | int | 0 | no | (none) | L0 tables that trigger write stalls. Shipped `config.yaml` comments this out. |
| `value_log_file_size_mb` | int64 | 0 | no | (none) | Size of each value log file in MB. Smaller files mean faster GC. Shipped `config.yaml` sets 128. |

## shinzo

Shinzo-specific host configuration: attestation processing, view management, document queueing, and event filtering.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `minimum_attestations` | int | 1 | no | (none) | Loaded from YAML but not consumed in the host startup path. Shipped `config.yaml` sets 1. |
| `hub_base_url` | string | empty | no | (none) | ShinzoHub CometBFT RPC URL. Used to construct the RPC, WebSocket, and LCD endpoints. Shipped `config.yaml` sets `rpc.develop.devnet.shinzo.network:26657`. |
| `start_height` | uint64 | 0 | no | `START_HEIGHT` | Block number to start from. 0 means auto-detect from chain tip. |
| `cache_queue_size` | int | 50000 | no | (none) | Job queue size for document processing. Shipped `config.yaml` sets 50000. |
| `batch_writer_count` | int | 8 | no | (none) | Number of batch writers for attestation processing. Shipped `config.yaml` sets 8. |
| `batch_size` | int | 1000 | no | (none) | Max attestations per batch. Shipped `config.yaml` sets 500. |
| `batch_flush_interval` | int | 100 | no | (none) | Flush interval in milliseconds for attestation batches. Shipped `config.yaml` sets 100. |
| `max_concurrent_verifications` | int | 50 | no | (none) | Max concurrent signature verifications. Shipped `config.yaml` does not set this, so the code default of 50 applies. |
| `use_block_signatures` | bool | false | no | (none) | Use block signatures for attestation verification. Shipped `config.yaml` sets true. |
| `doc_worker_count` | int | 16 | no | (none) | Number of document processing workers. Shipped `config.yaml` sets 32. |
| `doc_queue_size` | int | 5000 | no | (none) | Queue size for document event notifications. Shipped `config.yaml` sets 50000. |

### shinzo event filter

Controls which P2P documents the Host stores. Blocks and BlockSignatures always pass through regardless of filter settings.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `enabled` | bool | false | no | (none) | Master switch for filtering. false means accept all documents. Shipped `config.yaml` sets false. |
| `mode` | string | `allowlist` | no | (none) | `allowlist` means only accept documents matching a group. `blocklist` means accept everything except documents matching a group. |
| `cascade_filters` | bool | false | no | (none) | When true, a contract filter with `types: ["transaction"]` also applies to logs and access-list entries from the same address. Shipped `config.yaml` sets true. |
| `block_range` | object | (none) | no | (none) | Optional block number range gate. Omit to accept all blocks. |
| `groups` | object array | empty | no | (none) | Named filter groups combined with OR logic. In allowlist mode a document must match at least one enabled group. |

### shinzo event filter block range

Restricts processing to a range of block numbers. All three conditions must be true for snapshot bootstrap to run: `enabled`, a non-empty `indexer_url`, and at least one `historical_ranges` entry.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `min_block` | uint64 | 0 | no | (none) | Minimum block number, inclusive. |
| `max_block` | uint64 | 0 | no | (none) | Maximum block number, inclusive. 0 means no upper limit. |

### shinzo event filter groups

Each group bundles related contract and topic filters.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | string | empty | no | (none) | Human-readable label for logging. |
| `enabled` | bool | false | no | (none) | Toggle this group on or off without removing it. |
| `contracts` | object array | empty | no | (none) | Contract address filters. |
| `topics` | object array | empty | no | (none) | Event topic filters. |

### shinzo event filter groups contracts

Matches documents by on-chain address.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `address` | string | empty | no | (none) | Contract address, 0x-prefixed. |
| `name` | string | empty | no | (none) | Human-readable name for logging. |
| `types` | string array | empty | no | (none) | Collection types to apply to: `transaction`, `log`, or `accessListEntry`. Multiple types can be combined. |

### shinzo event filter groups topics

Matches log events by topic values. `topic0` is the event signature hash.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `topic0` | string | empty | no | (none) | Event signature hash. Required for topic matching. |
| `topic1` | string | empty | no | (none) | Optional indexed parameter 1. Omit for wildcard. |
| `topic2` | string | empty | no | (none) | Optional indexed parameter 2. Omit for wildcard. |
| `topic3` | string | empty | no | (none) | Optional indexed parameter 3. Omit for wildcard. |
| `name` | string | empty | no | (none) | Human-readable name, for example `Swap` or `Transfer`. |

## host

Host-level configuration: lens registry path, health server, and snapshot bootstrap.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `lens_registry_path` | string | `./.defra/lens` | no | (none) | Path to store lens WASM files. |
| `health_server_port` | int | 8080 | no | (none) | Health server port. When 0, falls back to 8080. |
| `open_browser_on_start` | bool | false | no | (none) | Auto-open the metrics page in a browser on startup. |
| `snapshot` | object | (none) | no | (none) | Snapshot bootstrap configuration. See below. |

### host snapshot

Downloads historical data from an indexer on first startup for fast initial sync.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `enabled` | bool | false | no | (none) | Enable snapshot bootstrap on startup. Shipped `config.yaml` sets false. |
| `indexer_url` | string | empty | no | (none) | HTTP base URL of the indexer serving snapshots. Shipped `config.yaml` sets `http://35.206.105.60:8080`. |
| `historical_ranges` | object array | empty | no | (none) | Block ranges to download during bootstrap. |

#### host snapshot historical ranges

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `start` | int64 | 0 | no | (none) | Start block number, inclusive. |
| `end` | int64 | 0 | no | (none) | End block number, inclusive. |

## pruner

Removes old data to keep storage bounded. Defaults are applied by `SetDefaults` in `pkg/pruner/config.go`, called from `pkg/host/host.go` when `enabled` is true.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `enabled` | bool | false | no | (none) | Enable automatic pruning. Shipped `config.yaml` sets true. |
| `max_blocks` | int64 | 10000 | no | (none) | Number of blocks to retain. Shipped `config.yaml` sets 2000. |
| `docs_per_block` | int | 1000 | no | (none) | Average docs per block, used with `max_blocks` to compute the max document count. Shipped `config.yaml` sets 1000. |
| `prune_threshold` | int64 | 0 | no | (none) | Deprecated. Kept for backward compatibility but unused by the pruner. |
| `interval_seconds` | int | 60 | no | (none) | How often in seconds to check and prune. Shipped `config.yaml` sets 30. |
| `prune_history` | bool | false | no | (none) | Walk DAG chains to delete historical block versions. Two to three times slower. |

## logger

Logging configuration. The logger is zap-based.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `development` | bool | false | no | (none) | Enable development mode logging. Shipped `config.yaml` sets true. The prod setup script sets false. |

The shipped `config.yaml` also sets `logger.level: "info"` and the prod setup script sets `logger.level: "error"`. This field is not in the `LoggerConfig` struct and has no effect. The log level is determined by `development`.

## No-op keys

The following keys appear in the shipped `config.yaml` but are not in the `config.go` struct. They are parsed by the YAML loader and then silently discarded. Tuning them has no effect on runtime behavior.

| Key | Shipped value | Notes |
| --- | --- | --- |
| `shinzo.wait_for_gaps` | true | Not in `ShinzoConfig` struct. |
| `shinzo.max_gap_size` | 1000 | Not in `ShinzoConfig` struct. |
| `shinzo.batch_processing_enabled` | true | Not in `ShinzoConfig` struct. |
| `shinzo.batch_max_views_per_job` | 50 | Not in `ShinzoConfig` struct. |
| `shinzo.batch_query_cache_size` | 1000 | Not in `ShinzoConfig` struct. |
| `shinzo.p2p_enabled` | not set | In the struct but not consumed anywhere in non-test code. |
| `shinzo.view_inactivity_timeout` | `24h` | In the struct but not consumed anywhere in non-test code. |
| `shinzo.view_cleanup_interval` | `1h` | In the struct but not consumed anywhere in non-test code. |
| `shinzo.view_worker_count` | 20 | In the struct but not consumed anywhere in non-test code. |
| `shinzo.view_queue_size` | 5000 | In the struct but not consumed anywhere in non-test code. |
| `shinzo.minimum_attestations` | 1 | In the struct and loaded from YAML but not read from the config in the host startup path. |
| `logger.level` | `info` or `error` | Not in `LoggerConfig` struct. |

## Environment variables

The Host client reads only two env vars in `config/config.go` and one in `pkg/defradb/defra.go`.

| Env var | Overrides | Read in |
| --- | --- | --- |
| `START_HEIGHT` | `shinzo.start_height` | `config/config.go` |
| `BOOTSTRAP_PEERS` | `defradb.p2p.bootstrap_peers` | `config/config.go` (comma-separated) |
| `DEFRA_KEYRING_SECRET` | `defradb.keyring_secret` | `pkg/defradb/defra.go` |

Note the keyring env var prefix: the Host uses `DEFRA_KEYRING_SECRET` (with `DEFRA_`), while the Generator uses `DEFRADB_KEYRING_SECRET` (with `DEFRADB_`).

### Env vars that are not read

The following env vars appear in some deployment artifacts but are not read by the Host client code. They have no effect on runtime behavior.

| Env var | Where it appears | Notes |
| --- | --- | --- |
| `DEFRA_URL` | `docker-compose-prod.yml`, `host-prod-setup.sh`, `gcp-startup-host-local-ssd.sh` | Not read. The DefraDB URL comes from `defradb.url` in the YAML config. |
| `LOG_LEVEL` | `docker-compose-prod.yml`, `host-prod-setup.sh`, GCP startup scripts | Not read. Log level is controlled by `logger.development`. |
| `LOG_SOURCE` | `docker-compose-prod.yml`, `host-prod-setup.sh`, GCP startup scripts | Not read. |
| `LOG_STACKTRACE` | `docker-compose-prod.yml`, `host-prod-setup.sh`, GCP startup scripts | Not read. |
| `GOMEMLIMIT` | `docker-compose-prod.yml` | Not read by the client. This is a Go runtime soft memory limit, honored by the Go runtime itself. Set it to control garbage collection behavior under memory pressure. |

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
