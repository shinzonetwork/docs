+++
title = "Config reference"
description = "Reference for every Generator client config field: YAML key, default, env var override, and whether the field is actually read."
+++

The Generator client loads configuration from a YAML file (default `config/config.yaml`) and then applies environment variable overrides on top. Fields left unset in both the YAML and env vars receive code defaults from `applyDefaults` in `config/config.go` and `SetDefaults` in `pkg/pruner/config.go` and `pkg/snapshot/snapshot.go`.

Env vars override YAML values. Where the shipped `config.yaml` sets a different value than the code default, both are noted below.

## chain

Identifies which EVM chain to index. Collection names are derived as `{name}__{network}__Block`, etc.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | string | `Ethereum` | no | `CHAIN_NAME` | Chain name. Also supports `Arbitrum`, `Optimism`, `Avalanche`, or any EVM chain. |
| `network` | string | `Mainnet` | no | `CHAIN_NETWORK` | Network name, for example `Mainnet` or `Testnet`. |

Ethereum is the only officially supported chain today. The shipped `config.yaml` lists Arbitrum, Optimism, and Avalanche as supported, and any EVM-compatible chain can likely be indexed by setting `chain.name` and `chain.network` to the correct values and pointing `geth.node_url` at a compatible RPC endpoint. The codebase is being refactored from EVM-only to a `Chain` interface with chain-specific Fetcher and Converter components, which will formalize multi-chain support. See [Chain abstraction](/reference/components/generator-client#chain-abstraction-in-progress) for the current state.

## defradb

Embedded database configuration. DefraDB handles storage, P2P replication, content addressing, and query serving.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `url` | string | empty | yes if `embedded` is false | `DEFRADB_URL` | DefraDB API URL. When `embedded` is true and `url` is empty, DefraDB runs on a random port. `DEFRADB_HOST` with optional `DEFRADB_PORT` also constructs this URL. |
| `keyring_secret` | string | empty | no | `DEFRADB_KEYRING_SECRET` | Encryption secret for the DefraDB keyring. Must stay the same across restarts or the existing identity becomes unreadable. |
| `embedded` | bool | false | no | (none) | When true, runs an embedded DefraDB instance. When false, requires a non-empty `url` pointing to an external DefraDB. Shipped `config.yaml` sets true. |

### defradb p2p

P2P networking configuration. The Generator pushes data out over libp2p and rejects all incoming replication.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `enabled` | bool | false | no | `DEFRADB_P2P_ENABLED` | Enable P2P networking. Shipped `config.yaml` sets true. |
| `accept_incoming` | bool | false | no | `DEFRADB_P2P_ACCEPT_INCOMING` | Accept incoming P2P documents. false means reject all. The Generator is a source of truth and should keep this false. |
| `bootstrap_peers` | string array | empty | no | (none) | P2P bootstrap peer multiaddrs. Peers are also discovered through `EntityRegistered` events from ShinzoHub. |
| `listen_addr` | string | empty | no | `DEFRADB_P2P_LISTEN_ADDR` | Multiaddr to listen on for P2P connections. Shipped `config.yaml` sets `/ip4/0.0.0.0/tcp/9171`. |
| `max_retries` | int | 0 | no | (none) | Connection attempts before marking a peer as failed. Shipped `config.yaml` sets 5. |
| `retry_base_delay_ms` | int | 0 | no | (none) | Base delay in milliseconds for exponential backoff (1s, 2s, 4s, 8s, 16s). Shipped `config.yaml` sets 1000. |
| `reconnect_interval_ms` | int | 0 | no | (none) | Interval in milliseconds to check for disconnected peers. Shipped `config.yaml` sets 60000. |
| `enable_auto_reconnect` | bool | false | no | (none) | Automatically reconnect to failed or disconnected peers. Shipped `config.yaml` sets true. |

### defradb store

Badger storage engine configuration. All cache and compaction fields map directly to Badger options.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `path` | string | empty | no | `DEFRADB_STORE_PATH` | Path to the DefraDB data directory. Shipped `config.yaml` sets `./.defra`. |
| `block_cache_mb` | int64 | 0 | no | `DEFRADB_BLOCK_CACHE_MB` | Badger block cache size in MB. Shipped `config.yaml` sets 512. |
| `memtable_mb` | int64 | 0 | no | `DEFRADB_MEMTABLE_MB` | Badger memtable size in MB. Shipped `config.yaml` sets 64. |
| `index_cache_mb` | int64 | 0 | no | `DEFRADB_INDEX_CACHE_MB` | Badger index cache size in MB. Shipped `config.yaml` sets 256. |
| `num_compactors` | int | 0 | no | `DEFRADB_NUM_COMPACTORS` | Number of Badger compaction workers. Shipped `config.yaml` sets 4. |
| `num_level_zero_tables` | int | 0 | no | `DEFRADB_NUM_LEVEL_ZERO_TABLES` | L0 tables before compaction starts. Shipped `config.yaml` comments this out. |
| `num_level_zero_tables_stall` | int | 0 | no | `DEFRADB_NUM_LEVEL_ZERO_TABLES_STALL` | L0 tables that trigger write stalls. Shipped `config.yaml` comments this out. |
| `value_log_file_size_mb` | int64 | 0 | no | (none) | Size of each value log file in MB. Smaller files mean more effective GC. Shipped `config.yaml` sets 128. |

## geth

Connection details for the Ethereum execution node. The Generator does not run a node. It reads from one you provide.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `node_url` | string | empty | yes | `GETH_RPC_URL` | Geth JSON-RPC endpoint URL. Used for full block fetches, gap fills, and historical ranges. |
| `ws_url` | string | empty | yes | `GETH_WS_URL` | Geth WebSocket endpoint URL. Used for real-time new block header subscriptions. |
| `api_key` | string | empty | no | `GETH_API_KEY` | API key for node authentication. Leave empty for same-VPC nodes without auth. |
| `api_key_type` | string | empty | no | `GETH_API_KEY_TYPE` | Header name for the API key. `x-goog-api-key` for GCP Blockchain Node Engine, `x-api-key` for most others. |

## indexer

Controls how the Generator fetches and processes blocks.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `start_height` | int | 0 | no | `INDEXER_START_HEIGHT` | Block number to start indexing from on first run with no existing data. 0 means auto-detect from chain tip. Must be 0 or higher. |
| `concurrent_blocks` | int | 8 | no | `INDEXER_CONCURRENT_BLOCKS` | Number of blocks to process concurrently. Shipped `config.yaml` sets 1. |
| `receipt_workers` | int | 16 | no | `INDEXER_RECEIPT_WORKERS` | Concurrent receipt fetchers per block. Shipped `config.yaml` sets 8. |
| `max_docs_per_txn` | int | 1000 | no | `INDEXER_MAX_DOCS_PER_TXN` | Document threshold for single-transaction block creation. Shipped `config.yaml` sets 100. |
| `max_tx_docs_per_batch` | int | 0 | no | `INDEXER_MAX_TX_DOCS` | Per-batch document size for transactions. 0 means use `max_docs_per_txn`. Shipped `config.yaml` sets 100. |
| `max_log_docs_per_batch` | int | 0 | no | `INDEXER_MAX_LOG_DOCS` | Per-batch document size for logs. 0 means use `max_docs_per_txn`. Shipped `config.yaml` sets 125. |
| `max_ale_docs_per_batch` | int | 0 | no | `INDEXER_MAX_ALE_DOCS` | Per-batch document size for access list entries. 0 means use `max_docs_per_txn`. Shipped `config.yaml` sets 500. |
| `blocks_per_minute` | int | 0 | no | `INDEXER_BLOCKS_PER_MINUTE` | Block indexing rate limit. 0 means no limit. Shipped `config.yaml` sets 60. |
| `health_server_port` | int | 8080 | no | `INDEXER_HEALTH_SERVER_PORT` | Health server port. Set to -1 to disable. |
| `open_browser_on_start` | bool | false | no | (none) | Auto-open the health page in a browser on startup. |
| `start_buffer` | int | 100 | no | `INDEXER_START_BUFFER` | Start this many blocks before chain tip when skipping ahead. |
| `schema_auth_mode` | string | `token` | no | `SCHEMA_AUTH_MODE` | Auth mode for the `/api/v1/schema` endpoints. One of `none`, `token`, or `mtls`. Empty defaults to `token`. `mtls` is not yet implemented. Shipped `config.yaml` sets `${SCHEMA_AUTH_MODE}` (env-substituted). |
| `schema_api_keys` | string array | empty | yes if `schema_auth_mode` is `token` | `SCHEMA_API_KEYS` | Bearer tokens accepted for `/api/v1/schema` endpoints when mode is `token`. Comma-separated. Not settable in `config.yaml` (the field uses `yaml:"-"`); provide via `SCHEMA_API_KEYS` or every schema request returns 503. |

## pruner

Removes old data to keep storage bounded. Defaults are applied by `SetDefaults` in `pkg/pruner/config.go` when fields are unset.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `enabled` | bool | false | no | `PRUNER_ENABLED` | Enable automatic pruning. Shipped `config.yaml` sets true. |
| `max_blocks` | int64 | 10000 | no | `PRUNER_MAX_BLOCKS` | Number of blocks to retain. Shipped `config.yaml` sets 1000. |
| `docs_per_block` | int | 1000 | no | (none) | Average docs per block, used with `max_blocks` to compute the max document count. Approximately 1057 on Ethereum mainnet. |
| `prune_threshold` | int64 | 0 | no | `PRUNER_PRUNE_THRESHOLD` | Deprecated. Kept for backward compatibility but unused by the pruner. Shipped `config.yaml` sets 1. |
| `interval_seconds` | int | 60 | no | `PRUNER_INTERVAL_SECONDS` | How often in seconds to check and prune. Shipped `config.yaml` sets 30. |
| `prune_history` | bool | false | no | (none) | Walk DAG chains to delete historical block versions. Two to three times slower. |

## snapshot

Bundles multiple blocks into a single signed file for faster initial sync. Defaults are applied by `SetDefaults` in `pkg/snapshot/snapshot.go` when fields are unset.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `enabled` | bool | false | no | `SNAPSHOT_ENABLED` | Enable automatic snapshots before pruning. Shipped `config.yaml` sets true. |
| `dir` | string | `./snapshots` | no | `SNAPSHOT_DIR` | Directory to store snapshot files. Shipped `config.yaml` sets `./.defra/snapshots`. |
| `blocks_per_file` | int64 | 1000 | no | `SNAPSHOT_BLOCKS_PER_FILE` | Blocks per snapshot file. Shipped `config.yaml` sets 100. |
| `interval_seconds` | int | 60 | no | `SNAPSHOT_INTERVAL_SECONDS` | How often in seconds to check and create snapshots. Shipped `config.yaml` sets 30. |

## logger

Logging configuration. The logger is zap-based. The log level is controlled by `development`, not by a `level` field.

| Key | Type | Default | Required | Env var | Description |
| --- | --- | --- | --- | --- | --- |
| `development` | bool | false | no | `LOGGER_DEBUG` | Enable development mode logging. When true, shows debug and test-level output. When false, shows info level and above. Shipped `config.yaml` sets true. |

The shipped `config.yaml` also sets `logger.level: "info"`. This field is not in the `LoggerConfig` struct and has no effect. The log level is determined entirely by `development`.

## Environment variables

The table below lists every environment variable the Generator client reads, the YAML key it overrides, and the source file that reads it.

| Env var | Overrides | Read in |
| --- | --- | --- |
| `CHAIN_NAME` | `chain.name` | `config/config.go` |
| `CHAIN_NETWORK` | `chain.network` | `config/config.go` |
| `GETH_RPC_URL` | `geth.node_url` | `config/config.go` |
| `GETH_WS_URL` | `geth.ws_url` | `config/config.go` |
| `GETH_API_KEY` | `geth.api_key` | `config/config.go` |
| `GETH_API_KEY_TYPE` | `geth.api_key_type` | `config/config.go` |
| `INDEXER_START_HEIGHT` | `indexer.start_height` | `config/config.go` |
| `INDEXER_CONCURRENT_BLOCKS` | `indexer.concurrent_blocks` | `config/config.go` |
| `INDEXER_RECEIPT_WORKERS` | `indexer.receipt_workers` | `config/config.go` |
| `INDEXER_MAX_DOCS_PER_TXN` | `indexer.max_docs_per_txn` | `config/config.go` |
| `INDEXER_MAX_TX_DOCS` | `indexer.max_tx_docs_per_batch` | `config/config.go` |
| `INDEXER_MAX_LOG_DOCS` | `indexer.max_log_docs_per_batch` | `config/config.go` |
| `INDEXER_MAX_ALE_DOCS` | `indexer.max_ale_docs_per_batch` | `config/config.go` |
| `INDEXER_BLOCKS_PER_MINUTE` | `indexer.blocks_per_minute` | `config/config.go` |
| `INDEXER_HEALTH_SERVER_PORT` | `indexer.health_server_port` | `config/config.go` |
| `INDEXER_START_BUFFER` | `indexer.start_buffer` | `config/config.go` |
| `SCHEMA_AUTH_MODE` | `indexer.schema_auth_mode` | `config/config.go` |
| `SCHEMA_API_KEYS` | `indexer.schema_api_keys` | `config/config.go` |
| `DEFRADB_URL` | `defradb.url` | `config/config.go` |
| `DEFRADB_HOST` | `defradb.url` | `config/config.go` (combined with `DEFRADB_PORT`) |
| `DEFRADB_PORT` | `defradb.url` | `config/config.go` (combined with `DEFRADB_HOST`) |
| `DEFRADB_KEYRING_SECRET` | `defradb.keyring_secret` | `pkg/defradb/defra.go` |
| `DEFRADB_P2P_ENABLED` | `defradb.p2p.enabled` | `config/config.go` |
| `DEFRADB_P2P_LISTEN_ADDR` | `defradb.p2p.listen_addr` | `config/config.go` |
| `DEFRADB_P2P_ACCEPT_INCOMING` | `defradb.p2p.accept_incoming` | `config/config.go` |
| `DEFRADB_STORE_PATH` | `defradb.store.path` | `config/config.go` |
| `DEFRADB_BLOCK_CACHE_MB` | `defradb.store.block_cache_mb` | `config/config.go` |
| `DEFRADB_MEMTABLE_MB` | `defradb.store.memtable_mb` | `config/config.go` |
| `DEFRADB_INDEX_CACHE_MB` | `defradb.store.index_cache_mb` | `config/config.go` |
| `DEFRADB_NUM_COMPACTORS` | `defradb.store.num_compactors` | `config/config.go` |
| `DEFRADB_NUM_LEVEL_ZERO_TABLES` | `defradb.store.num_level_zero_tables` | `config/config.go` |
| `DEFRADB_NUM_LEVEL_ZERO_TABLES_STALL` | `defradb.store.num_level_zero_tables_stall` | `config/config.go` |
| `PRUNER_ENABLED` | `pruner.enabled` | `config/config.go` |
| `PRUNER_MAX_BLOCKS` | `pruner.max_blocks` | `config/config.go` |
| `PRUNER_PRUNE_THRESHOLD` | `pruner.prune_threshold` | `config/config.go` |
| `PRUNER_INTERVAL_SECONDS` | `pruner.interval_seconds` | `config/config.go` |
| `SNAPSHOT_ENABLED` | `snapshot.enabled` | `config/config.go` |
| `SNAPSHOT_DIR` | `snapshot.dir` | `config/config.go` |
| `SNAPSHOT_BLOCKS_PER_FILE` | `snapshot.blocks_per_file` | `config/config.go` |
| `SNAPSHOT_INTERVAL_SECONDS` | `snapshot.interval_seconds` | `config/config.go` |
| `LOGGER_DEBUG` | `logger.development` | `config/config.go` |

### Env vars that are not read

The following env vars appear in some deployment artifacts but are not read by the Generator client code. They have no effect on runtime behavior.

| Env var | Where it appears | Notes |
| --- | --- | --- |
| `LOG_LEVEL` | `docker-compose-prod.yml`, `indexer-prod-setup.sh` | Not read. Log level is controlled by `logger.development` and `LOGGER_DEBUG`. |
| `LOG_SOURCE` | `docker-compose-prod.yml`, `indexer-prod-setup.sh` | Not read. |
| `LOG_STACKTRACE` | `docker-compose-prod.yml`, `indexer-prod-setup.sh` | Not read. |
| `DEFRADB_PLAYGROUND` | Install page `docker run` example | Not read. The playground is controlled by build tags, not env vars. |
| `GOMEMLIMIT` | `docker-compose-prod.yml` | Not read by the client. This is a Go runtime soft memory limit, honored by the Go runtime itself. Set it to control garbage collection behavior under memory pressure. |

## Need help

{{ need_help(client="Generator", repo_name="shinzo-generator-client", repo="https://github.com/shinzonetwork/shinzo-generator-client/issues") }}
