+++
title = "Changelog"
description = "Developer updates for the Shinzo network, SDKs and tools"
template = "changelog.html"
sort_by = "date"
weight = 7
page_template = "changelog.html"
+++

Track what's new across the Shinzo developer platform: network releases, SDK changes, tooling updates and documentation improvements.

## Nov 12, 2026 {% raw %}{#11-12-2026}{% endraw %}

### 🐳 Upgrade

#### Generator client

```shell
docker pull ghcr.io/Shinzonetwork/Shinzo-generator-client:v0.7.2-ethereum-mainnet
```

#### Host client

```shell
docker pull ghcr.io/Shinzonetwork/Shinzo-host-client:v0.7.2-ethereum-mainnet
```

#### ⚠️ Host Upgrade Note: Action Required


Shinzo has deployed its Generators on new infrastructure with updated connection endpoints.

**All Host operators connected to Shinzo’s existing Generators must upgrade to `v0.7.2` and update their configuration before Tuesday, November 17, 2026.**

The new Host version introduces a chain-based configuration format, replacing the previous `bootstrap_peers` configuration.

#### Step 1: Upgrade the Host client

Pull the latest Host image:

```bash
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.7.2-ethereum-mainnet
```

#### Step 2: Update `config.yaml`

Follow the instructions below based on your existing configuration.

**Option A: Using the default `config.yaml`**

1. Remove the old config file
2. Copy the updated config provided below and save it as `config.yaml`

<details>
<summary>Show full config.yaml</summary>

```yaml
defradb:
  url: "localhost:9181"
  keyring_secret: "pingpong"
  p2p:
    enabled: true
    listen_addr: "/ip4/0.0.0.0/tcp/9171"
    max_retries: 5                  # Number of connection attempts before marking peer as failed
    retry_base_delay_ms: 1000       # Base delay for exponential backoff (1s, 2s, 4s, 8s, 16s)
    reconnect_interval_ms: 60000    # Check for disconnected peers every 60 seconds
    enable_auto_reconnect: true     # Automatically reconnect to failed/disconnected peers
  store:
    path: "./.defra"
    # Badger memory configuration
    block_cache_mb: 512  # Block cache size
    memtable_mb: 64      # Memtable size
    index_cache_mb: 256   # Index cache size
    # Badger compaction configuration
    num_compactors: 4              # Number of compaction workers
    # num_level_zero_tables: 20      # L0 tables before compaction starts
    # num_level_zero_tables_stall: 40  # L0 tables that trigger write stalls
    # Badger value log configuration
    value_log_file_size_mb: 128     # Size of each vlog file (smaller = faster GC)
# The chain this host serves. Its schema comes from its generators, tried in order, and the host
# dials each generator's peer.
chains:
  - prefix: Ethereum__Mainnet
    generators:
      - url: https://generator01.infra.shinzo.network:8445
        peer: /dns4/generator01.infra.shinzo.network/tcp/9174/p2p/12D3KooWHVQHUMxWmSwCHVPZ2pE1xzwjjNJbC7UmcwyqxJUmxRwV
      - url: https://generator02.infra.shinzo.network:8445
        peer: /dns4/generator02.infra.shinzo.network/tcp/9175/p2p/12D3KooWKZvZTTWxAGVwBfpVrk6guEt4ZwSXPQogZNUa5pUnV4nR
      - url: https://generator03.infra.shinzo.network:8445
        peer: /dns4/generator03.infra.shinzo.network/tcp/9176/p2p/12D3KooWCthjY1CT2Ug7zhyW3jZZugeNnqHrKcpKRWEyU4dJVTL6
      - url: https://generator04.infra.shinzo.network:8445
        peer: /dns4/generator04.infra.shinzo.network/tcp/9177/p2p/12D3KooWP7Dy4QevtXX64po3L1MG1Je5m5Dmj81CArTfs76TuPxj
shinzo:
  minimum_attestations: 1
  start_height: 0 # Indexer auto-detects from chain tip
  hub_base_url: testnet.shinzo.network
  # P2P Control Settings
  wait_for_gaps: true         # Wait for gap processing before starting P2P
  max_gap_size: 1000          # Skip P2P if gap is larger than this
  # View Management Settings
  view_inactivity_timeout: "24h"  # Stop updating views after 24h of no access
  view_cleanup_interval: "1h"     # Check for inactive views every hour
  view_worker_count: 20            # Workers for batch lens transformations
  view_queue_size: 5000           # Queue size for batch processing jobs
  batch_processing_enabled: true     # Enable batch processing for efficiency
  batch_max_views_per_job: 50         # Split large batches to prevent memory issues
  batch_query_cache_size: 1000        # Cache query templates for reuse
  # Attestation Processing Settings
  doc_worker_count: 32
  doc_queue_size: 50000
  # Event Replication Filter
  # Controls which P2P documents the host stores. Blocks are checked only
  # against block_range; BlockSignatures and SnapshotSignatures always pass.
  event_filter:
    enabled: false                 # Set to false to accept all documents (no filtering)
    # Mode: "allowlist" (default) - only accept documents matching a group.
    #        "blocklist"          - accept everything EXCEPT documents matching a group.
    mode: "allowlist"
    # When true, a contract filter with types: ["transaction"] also applies to
    # logs and access-list entries from the same address. Set to false for
    # strict per-type matching only.
    cascade_filters: true
    # Optional block range gate (omit to accept all blocks):
    # block_range:
    #   min_block: 20000000
    #   max_block: 0              # 0 = no upper limit
    #
    # Filter groups - each group bundles related contracts and topics.
    # In allowlist mode a document must match at least one enabled group.
    # In blocklist mode a document is rejected if it matches any enabled group.
    groups:
      - name: "uniswap-v3"       # Human-readable label (for logs)
        enabled: false             # Set to false to disable this group without removing it
        # Contract filters - match documents by on-chain address.
        # "types" controls which collection types this address applies to:
        #   "transaction" - matches tx.to field
        #   "log"         - matches log.address field
        #   "accessListEntry" - matches accessListEntry.address field
        # Multiple types can be combined: ["transaction", "log"]
        contracts:
          - name: "Uniswap V3 Router 2"
            address: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"
            types: ["transaction", "log"]
        # Topic filters - match logs by event signature (topic0).
        # topic0 is required; topic1-3 are optional (omit = wildcard).
        topics:
          - name: "Swap"
            topic0: "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"
            # topic1: "0x..."    # Optional: filter by indexed param 1
            # topic2: "0x..."    # Optional: filter by indexed param 2
            # topic3: "0x..."    # Optional: filter by indexed param 3
      - name: "stablecoins"
        enabled: false
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
  enabled: true             # Set to true to enable automatic pruning
  max_blocks: 1000         # Newest block heights kept; documents at older heights are deleted
  interval_seconds: 30      # How often to check and prune
  prune_history: true       # true: each prune also deletes the removed docs' block history (walks their DAG, slower per prune); false keeps it, so the blockstore only grows.
logger:
  development: false
  level: "info"
host:
  lens_registry_path: "./.defra/lens"
  health_server_port: 8080
  open_browser_on_start: false
  # Snapshot Bootstrap - download historical data from an indexer on first startup.
  # Import runs only with enabled: true and indexer_url set to an indexer that serves snapshots.
  snapshot:
    enabled: false
    historical_ranges:
      - start: 24528700
        end: 24528999
```
</details>

**Option B: You have a customized `config.yaml`**

If you’ve modified your configuration, preserve your existing settings and update only the Generator connections.

1. Open your existing `config.yaml`.
2. Remove the `bootstrap_peers` subsection.
3. Copy the new `chains` configuration block below and paste it between the `defradb` and `shinzo` sections, immediately after `defradb.store`.

New Ethereum Mainnet Generator connections:

<details>
<summary>Show partial config.yaml</summary>

```yaml
chains:
  - prefix: Ethereum__Mainnet
  generators:
    - url: https://generator01.infra.Shinzo.network:8445
      peer: /dns4/generator01.infra.Shinzo.network/tcp/9174/p2p/12D3KooWHVQHUMxWmSwCHVPZ2pE1xzwjjNJbC7UmcwyqxJUmxRwV
    - url: https://generator02.infra.Shinzo.network:8445
      peer: /dns4/generator02.infra.Shinzo.network/tcp/9175/p2p/12D3KooWKZvZTTWxAGVwBfpVrk6guEt4ZwSXPQogZNUa5pUnV4nR
    - url: https://generator03.infra.Shinzo.network:8445
      peer: /dns4/generator03.infra.Shinzo.network/tcp/9176/p2p/12D3KooWCthjY1CT2Ug7zhyW3jZZugeNnqHrKcpKRWEyU4dJVTL6
    - url: https://generator04.infra.Shinzo.network:8445
      peer: /dns4/generator04.infra.Shinzo.network/tcp/9177/p2p/12D3KooWP7Dy4QevtXX64po3L1MG1Je5m5Dmj81CArTfs76TuPxj
```
</details>

{% <admonition type="info"> %}
`chains` must be at the same indentation level as `defradb` and `shinzo`, not nested inside either section.

Keep your existing database, networking, filters, pruning, and other custom settings unchanged unless the new version requires otherwise.
{% </admonition> %}

#### Step 3: Recreate the Host container

After updating your configuration and Docker image, recreate the Host container to apply the changes:

```bash
docker-compose down && docker-compose up -d
```

{% <admonition type="warning"> %}

**Do not use `docker-compose restart`.** Restarting an existing container does not apply the new image.

{% </admonition> %}

**Migration Deadline: Tuesday, November 17, 2026**

The previous Generator endpoints will be retired on this date.

**Complete the upgrade before the deadline to maintain uninterrupted data replication.**

#### ⚠️ Generator Upgrade Note

The DefraDB keyring has moved outside the `.defra` directory.

Operators upgrading existing Generators must preserve their node identity and keyring secret (`DEFRADB_KEYRING_SECRET`) to maintain their existing peer ID and registration.

Do not delete the existing identity keys during the upgrade.

### 💡 Improvements

- {{<tag name="Generator" />}} Added blockchain reorganization handling to maintain indexing consistency during chain reorgs. ([PR #426](https://github.com/shinzonetwork/shinzo-generator-client/pull/426))
- {{<tag name="Generator" />}} Added optional OpenTelemetry metrics and Grafana dashboards for single-node and multi-node monitoring. Monitoring is disabled by default and must be explicitly enabled. ([PR #435](https://github.com/shinzonetwork/shinzo-generator-client/pull/435)) ([PR #451](https://github.com/shinzonetwork/shinzo-generator-client/pull/451))
- {{<tag name="Generator" />}} Moved the DefraDB keyring outside the `.defra` directory, separating node identity from database storage. ([PR #455](https://github.com/shinzonetwork/shinzo-generator-client/pull/455))
- {{<tag name="Generator" />}} Improved version reporting. The Generator version is now accessible through the `-v` flag and the health and metrics endpoints. ([PR #458](https://github.com/shinzonetwork/shinzo-generator-client/pull/458))
- {{<tag name="Generator" />}} Added BSC integration, expanding Generator support beyond Ethereum. ([PR #431](https://github.com/shinzonetwork/shinzo-generator-client/pull/431))
- {{<tag name="Generator" />}} Fixed transaction status and gas field processing for accurate Ethereum transaction indexing. ([PR #481](https://github.com/shinzonetwork/shinzo-generator-client/pull/481))
- {{<tag name="Generator" />}} Improved pruning to eliminate duplicate block counts and ensure stale queue entries are cleaned up correctly. ([PR #482](https://github.com/shinzonetwork/shinzo-generator-client/pull/482)) ([PR #505](https://github.com/shinzonetwork/shinzo-generator-client/pull/505))
- {{<tag name="Generator" />}} Added RPC chain ID validation, preventing startup when the configured endpoint reports an incorrect chain. ([PR #433](https://github.com/shinzonetwork/shinzo-generator-client/pull/433))
- {{<tag name="Generator" />}} Secured logging by redacting endpoint URLs containing embedded API keys. ([PR #452](https://github.com/shinzonetwork/shinzo-generator-client/pull/452))
- {{<tag name="Host" />}} Added multi-chain support, allowing Hosts to serve multiple configured chains with chain-specific schemas and collections. ([PR #440](https://github.com/shinzonetwork/shinzo-host-client/pull/440)) ([PR #450](https://github.com/shinzonetwork/shinzo-host-client/pull/450)) ([PR #456](https://github.com/shinzonetwork/shinzo-host-client/pull/456))
- {{<tag name="Host" />}} Hosts now retrieve chain schemas directly from Generators and initialize collections based on database state. ([PR #435](https://github.com/shinzonetwork/shinzo-host-client/pull/435)) ([PR #436](https://github.com/shinzonetwork/shinzo-host-client/pull/436))
- {{<tag name="Host" />}} Added per-chain reporting for block heights, last document timestamps, readiness, and metrics. ([PR #454](https://github.com/shinzonetwork/shinzo-host-client/pull/454)) ([PR #455](https://github.com/shinzonetwork/shinzo-host-client/pull/455))
- {{<tag name="Host" />}} Added OpenTelemetry support and Grafana dashboards for single-node and multi-node deployments. ([PR #458](https://github.com/shinzonetwork/shinzo-host-client/pull/458)) ([PR #469](https://github.com/shinzonetwork/shinzo-host-client/pull/469))
- {{<tag name="Host" />}} Improved Generator peer connectivity and attestation listener management for reliable initialization and shutdown. ([PR #437](https://github.com/shinzonetwork/shinzo-host-client/pull/437))
- {{<tag name="Host" />}} DefraDB’s API now starts only after the chain schema has been applied. ([PR #446](https://github.com/shinzonetwork/shinzo-host-client/pull/446))

## Sep 29, 2026 {% raw %}{#09-29-2026}{% endraw %}

### 🐳 Upgrade

#### Generator client

Generator operators upgrading to `v0.7.0-ethereum-mainnet` need to reset their DefraDB database files while preserving their existing node identity. Do not delete the entire DefraDB store or keys directory. Your existing identity must be preserved to avoid generating a new peer ID and having to register the Generator again.

Before upgrading, keep the following unchanged:

* **Keys folder:** The existing DefraDB identity key must remain in place. If the node cannot find its key, it creates a new identity and will need to register again.
* **Keyring secret:** Keep the same `DEFRADB_KEYRING_SECRET`. A different secret prevents the Generator from reading its existing key.
* **Public IP:** Keep the same registered public IP. The IP is part of the node’s on-chain registration. If the server is recreated and its IP is not reserved, the address may change.

Only remove the database files required for the reset. **Never `rm -rf` the entire store.** This is especially important for Generators started with docker run, where identity keys may live inside the data directory. Once the existing identity, keyring secret, and registered IP are preserved, start the Generator with the new image:

```shell
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:v0.7.0-ethereum-mainnet
```

#### Host client

Host operators also need to reset their DefraDB database files while preserving the Host identity.

Keep the following unchanged:

* **Keys folder:** Do not remove the Host’s existing identity keys.
* **Keyring secret:** Keep the same `keyring_secret` configured in `config.yaml`.
* **Public IP:** Keep the same registered public IP.

Never `rm -rf` the entire store. Hosts started with docker run may store their keys inside it. After resetting only the required database files, start the Host with the new image:

```bash
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.7.0-ethereum-mainnet
```

### 💡 Improvements

- {{<tag name="Generator" />}} Generator now uses the new chain abstraction architecture, separating chain-specific logic and enabling support for additional chains. ([PR #348](https://github.com/shinzonetwork/shinzo-generator-client/pull/348))
- {{<tag name="Generator" />}} LinkStamper errors now stop processing instead of allowing corrupted records to be indexed. ([PR #367](https://github.com/shinzonetwork/shinzo-generator-client/pull/367))
- {{<tag name="Generator" />}} CID waits are now cancellable and document fields are read directly from DefraDB. ([PR #371](https://github.com/shinzonetwork/shinzo-generator-client/pull/371))
- {{<tag name="Generator" />}} In-flight indexing and signing operations now complete before DefraDB shuts down. ([PR #390](https://github.com/shinzonetwork/shinzo-generator-client/pull/390)) ([PR #391](https://github.com/shinzonetwork/shinzo-generator-client/pull/391))
- {{<tag name="Generator" />}} DefraDB’s libp2p protocol now enforces resource limits, including a configurable memory budget. ([PR #384](https://github.com/shinzonetwork/shinzo-generator-client/pull/384))
- {{<tag name="Generator" />}} Generator version is now logged at startup, making the running version directly visible in logs. ([PR #383](https://github.com/shinzonetwork/shinzo-generator-client/pull/383))
- {{<tag name="Host" />}} Attestation records now include an indexed block number for more efficient block-based operations. ([PR #386](https://github.com/shinzonetwork/shinzo-host-client/pull/386))
- {{<tag name="Host" />}} Pruning now operates by block height, improving how historical data is identified and removed. ([PR #426](https://github.com/shinzonetwork/shinzo-host-client/pull/426))
- {{<tag name="Host" />}} Added resource limits to the DefraDB libp2p protocol to improve resource management and network stability. ([PR #411](https://github.com/shinzonetwork/shinzo-host-client/pull/411))

**⚠️ Notes for operators**

1. Memory

The default configuration assumes a 16 GB container with:

```bash
GOMEMLIMIT=14GiB
```

The DefraDB libp2p memory budget now defaults to **10 GiB**. If you’re running a smaller container or machine, set `DEFRADB_P2P_RESOURCE_MEMORY_MIB` below your `GOMEMLIMIT` to keep the libp2p resource budget within the memory available to the process.

2. Host pruning

`max_blocks` now represents the number of **block heights retained**.
`docs_per_block` has been removed. If it is still present in your `config.yaml`, it has no effect and can be deleted.
`max_docs_per_cycle`, which controls the number of documents deleted during each pruning cycle, now defaults to:

```bash
max_docs_per_cycle: 50000
```

3. (optional) Host disk readahead

For Host operators, setting the data disk’s readahead to 16 KB can reduce disk reads from DefraDB’s memory-mapped files.

Identify the data disk:

```bash
lsblk
```

Then set its readahead:

```bash
echo 16 | sudo tee /sys/block/<disk>/queue/read_ahead_kb
```

This setting resets after a reboot.

## Sep 16, 2026 {% raw %}{#09-16-2026}{% endraw %}

### 🐳 Upgrade

#### Generator client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:v0.6.5.4-ethereum-mainnet
```

#### Host client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.6.5.4-ethereum-mainnet
```

### 💡 Improvements

- {{<tag name="Generator" />}} Improved indexing and pruning performance to reduce chain lag and help Generators stay closer to the chain tip. ([PR #333](https://github.com/shinzonetwork/shinzo-generator-client/pull/333)) ([PR #335](https://github.com/shinzonetwork/shinzo-generator-client/pull/335))
- {{<tag name="Generator" />}} Secondary indexes are now rebuilt correctly after importing data, improving data consistency after restores or migrations. ([PR #338](https://github.com/shinzonetwork/shinzo-generator-client/pull/338))
- {{<tag name="Generator" />}} Chain configuration has been generalized to improve support for different chain configurations. ([PR #329](https://github.com/shinzonetwork/shinzo-generator-client/pull/329))
- {{<tag name="Generator" />}}{{<tag name="Host" />}} Health checks now actively probe DefraDB, providing a more accurate indication of client health. ([PR #364](https://github.com/shinzonetwork/shinzo-generator-client/pull/364)) ([PR #382](https://github.com/shinzonetwork/shinzo-host-client/pull/382))
- {{<tag name="Generator" />}}{{<tag name="Host" />}} Registration no longer suggests addresses that are unreachable by other network participants. ([PR #366](https://github.com/shinzonetwork/shinzo-generator-client/pull/366)) ([PR #367](https://github.com/shinzonetwork/shinzo-host-client/pull/367))
- {{<tag name="Host" />}} Improved pruning behavior with cleaner shutdown handling and bounded pruning cycles. ([PR #357](https://github.com/shinzonetwork/shinzo-host-client/pull/357)) ([PR #360](https://github.com/shinzonetwork/shinzo-host-client/pull/360))
- {{<tag name="Host" />}} Added a warning state to Host metrics for better operational visibility. ([PR #370](https://github.com/shinzonetwork/shinzo-host-client/pull/370))
- {{<tag name="Host" />}} Fixed registration to preserve the forwarded Host port correctly. ([PR #383](https://github.com/shinzonetwork/shinzo-host-client/pull/383))

**⚠️ Generator Upgrade Note**

Generator operators upgrading to `v0.6.5.4-ethereum-mainnet` need to reset their DefraDB data.

Back up your node identity key before removing the existing DefraDB directory. If the key is not preserved, you will need to register the Generator again.

```bash
# Back up the identity key
cp shinzo-data/defradb/keys/node-identity-key ./path/to/new/location

# Reset DefraDB
rm -rf shinzo-data/defradb

# Recreate the keys directory
mkdir -p shinzo-data/defradb/keys

# Restore the identity key
cp ./path/to/new/location/node-identity-key shinzo-data/defradb/keys/

# Set the correct ownership to prevent identity and permission errors
sudo chown -R 1001:1001 ~/shinzo-data/defradb ~/shinzo-data/lens
```

Once the existing identity key has been restored, you can start the upgraded Generator without re-registering.

**⚠️ Host Upgrade Note**

```bash
# Reset DefraDB
rm -rf data/defradb

# Recreate the required data directories
sudo mkdir -p ~/data/defradb

# Set the correct ownership to prevent permission errors
sudo chown -R 1001:1001 ~/data/ ~/data/defradb ~/data/lens ~/data/keys
```

## Aug 06, 2026 {% raw %}{#08-06-2026}{% endraw %}

### 🐳 Upgrade

#### Generator client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:v0.6.5.3-ethereum-mainnet
```

#### Host client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.6.5.3-ethereum-mainnet
```

### 💡 Improvements

- {{<tag name="Generator" />}} Improved block signing performance by signing batched blocks directly from collected CIDs instead of performing a read-back query. ([PR #308](https://github.com/shinzonetwork/shinzo-generator-client/pull/308))
- {{<tag name="Generator" />}} Fixed a hardcoded Shinzo Hub URL used during testnet deployments. ([PR #313](https://github.com/shinzonetwork/shinzo-generator-client/pull/313))
- {{<tag name="Host" />}} History pruning is now enabled by default. ([PR #326](https://github.com/shinzonetwork/shinzo-host-client/pull/326))
- {{<tag name="Host" />}} Fixed a hardcoded Shinzo Hub URL in the health server. ([PR #351](https://github.com/shinzonetwork/shinzo-host-client/pull/351))
- {{<tag name="Generator" />}}{{<tag name="Host" />}} Updated dependencies, including Go Ethereum, GitHub Actions, gRPC, and other internal libraries for improved stability and maintenance.


## July 16, 2026 {% raw %}{#07-16-2026}{% endraw %}

### 🐳 Upgrade

#### Generator client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:v0.6.5.2-ethereum-mainnet
```

#### Host client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.6.5.2-ethereum-mainnet
```

### 💡 Improvements

- {{<tag name="Generator" />}} Blocks are now signed only after all required block data has been received. ([PR #293](https://github.com/shinzonetwork/shinzo-generator-client/pull/293))
- {{<tag name="Generator" />}} Pruning now skips invalid or incomplete records instead of stopping the entire process. ([PR #287](https://github.com/shinzonetwork/shinzo-generator-client/pull/287))
- {{<tag name="Host" />}}{{<tag name="Generator" />}} Updated status pages to point to the correct hub. ([PR #319](https://github.com/shinzonetwork/shinzo-host-client/pull/319)) ([PR #302](https://github.com/shinzonetwork/shinzo-generator-client/pull/302))
- {{<tag name="Host" />}} Billing now validates against the pool included in each signed request. Queries without a pool are rejected. ([PR #314](https://github.com/shinzonetwork/shinzo-host-client/pull/314))
- {{<tag name="Host" />}} Failed pruning jobs are now automatically retried instead of being discarded. ([PR #316](https://github.com/shinzonetwork/shinzo-host-client/pull/316))
- {{<tag name="Host" />}} History pruning is now disabled by default. ([PR #317](https://github.com/shinzonetwork/shinzo-host-client/pull/317))
- {{<tag name="Storage" />}} Improved pruning reliability when new data is written during concurrent writes.
- {{<tag name="Storage" />}} Large deletion operations are now processed in smaller batches for better stability.
- {{<tag name="Storage" />}} Deleting documents now also removes their associated index entries.
- {{<tag name="Storage" />}} Improved pruning performance by reducing unnecessary ownership scans.

## July 08, 2026 {% raw %}{#07-08-2026}{% endraw %}

### 🐳 Upgrade

#### Generator client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest
```

#### Host client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.6.5-ethereum-mainnet
```

### ✨ Highlights

- Shinzō Testnet is now live.
- {{<tag name="Generator" />}} Generator Client is available for Shinzo Testnet deployments. Installation instructions: [Generator Installation Guide](https://docs.shinzo.network/run/run-a-generator/install/)
- {{<tag name="Host" />}} Host Client is available for Shinzo Testnet deployments. Installation instructions: [Host Installation Guide](https://docs.shinzo.network/run/run-a-host/install/)
