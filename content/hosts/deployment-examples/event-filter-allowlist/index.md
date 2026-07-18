+++
title = "Event filter with allowlist and blocklist"
[extra]
mermaid = true
+++

When to use this: you want your Host to store only specific contract events instead of every document from every Generator. This cuts storage and speeds up view processing.

These scenarios use Ethereum Mainnet data. Ethereum is the only officially supported chain today, but any EVM-compatible chain should work by changing the contract addresses and topic hashes to match the target chain. See the [Generator chain config](/generators/config-reference#chain) for details.

## Topology

{% mermaid() %}
flowchart LR
  Gen1["Generator A"]
  Gen2["Generator B"]

  subgraph HOST["Host"]
    direction TB
    Filter["<b>Event filter</b><br/>allowlist mode"]
    Store[("DefraDB<br/>filtered documents only")]
    Filter --> Store
  end

  Gen1 -- "P2P" --> HOST
  Gen2 -- "P2P" --> HOST
{% end %}

Generators push all block, transaction, and log data to the Host over P2P. The event filter inspects each document before it is written to DefraDB. In allowlist mode, only documents matching an enabled group are stored. Blocks and BlockSignatures always pass through regardless of filter settings.

## Config file

This config enables the event filter in allowlist mode with two groups: Uniswap V3 swaps and stablecoin transfers. It is drawn from the `event_filter` section of the shipped `host-client/config/config.yaml`:

```yaml
defradb:
  url: "localhost:9181"
  keyring_secret: "pingpong"
  p2p:
    enabled: true
    bootstrap_peers:
      - '/ip4/34.63.13.57/tcp/9171/p2p/12D3KooWJGCSs1tkiDif4rgQMS7uNqTNA8BKNsNhW62NXbUN5Au3'
      - '/ip4/35.208.241.78/tcp/9171/p2p/12D3KooWSwrdPrfgm79Zne51hpihmfeZgGGpNqcim2LSoEDRquvr'
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
  hub_base_url: rpc.develop.devnet.shinzo.network:26657
  cache_queue_size: 50000
  batch_writer_count: 8
  batch_size: 500
  batch_flush_interval: 100
  use_block_signatures: true
  doc_worker_count: 32
  doc_queue_size: 50000
  event_filter:
    enabled: true
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
```

### What each filter value does

- `event_filter.enabled: true`: Turn on content-based filtering. Without this, the Host stores every document it receives. See [shinzo event filter](/hosts/config-reference#shinzo-event-filter).
- `event_filter.mode: "allowlist"`: Only accept documents matching an enabled group. Set to `blocklist` to invert: accept everything except documents matching a group. See [shinzo event filter](/hosts/config-reference#shinzo-event-filter).
- `event_filter.cascade_filters: true`: A contract filter with `types: ["transaction"]` also applies to logs and access-list entries from the same address. Set to false for strict per-type matching only. See [shinzo event filter](/hosts/config-reference#shinzo-event-filter).
- `groups[].name`: Human-readable label for logging. See [shinzo event filter groups](/hosts/config-reference#shinzo-event-filter-groups).
- `groups[].enabled`: Toggle a group on or off without removing it. See [shinzo event filter groups](/hosts/config-reference#shinzo-event-filter-groups).
- `contracts[].address`: The on-chain contract address to match. See [shinzo event filter groups contracts](/hosts/config-reference#shinzo-event-filter-groups-contracts).
- `contracts[].types`: Which collection types the address filter applies to: `transaction`, `log`, or `accessListEntry`. Multiple types can be combined. See [shinzo event filter groups contracts](/hosts/config-reference#shinzo-event-filter-groups-contracts).
- `topics[].topic0`: The keccak256 hash of the event signature. Required for topic matching. See [shinzo event filter groups topics](/hosts/config-reference#shinzo-event-filter-groups-topics).

## Using blocklist mode

To accept everything except Uniswap V3 swaps and stablecoin transfers, change `mode` to `blocklist` and keep the same groups:

```yaml
  event_filter:
    enabled: true
    mode: "blocklist"
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
```

In blocklist mode, a document is rejected if it matches any enabled group. Everything else is stored.

## Optional block range gate

Add a `block_range` to restrict filtering to a specific block range. Omit it to accept all blocks:

```yaml
  event_filter:
    enabled: true
    mode: "allowlist"
    cascade_filters: true
    block_range:
      min_block: 20000000
      max_block: 0
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
```

`max_block: 0` means no upper limit. See [shinzo event filter block range](/hosts/config-reference#shinzo-event-filter-block-range).

## Tutorial companion

For a step-by-step walkthrough of configuring a single USDT Transfer filter, see the [Configuring Event Filters guide](/guides/configuring-event-filters-on-a-shinzo-host/). This scenario shows the fuller multi-group topology from the shipped config.

## Gotchas

- The shipped `config.yaml` sets `event_filter.enabled: false`. This scenario changes it to `true`. If you keep it false, no filtering happens and the Host stores everything.
- Blocks and BlockSignatures always pass through the filter regardless of mode or group settings. You cannot filter out block headers or signatures.
- `cascade_filters: true` means a `transaction` type filter on a contract address also filters logs and access-list entries from that address. If you want strict per-type matching, set it to false.
- The shipped `config.yaml` includes several `shinzo.*` keys that are not in the `config.go` struct and are silently ignored: `wait_for_gaps`, `max_gap_size`, `batch_processing_enabled`, `batch_max_views_per_job`, `batch_query_cache_size`. They have been omitted from this config. See [no-op keys](/hosts/config-reference#no-op-keys) for the full list.
- The `topic0` for ERC-20 Transfer is the same across all tokens because it is derived from the function signature `Transfer(address,address,uint256)`, not from the contract address. To filter a different event, compute its keccak256 hash from the canonical signature.
- The bootstrap peer IDs in this config are from the shipped `config.yaml` and may be stale. Check the [Shinzo Validators list](https://registration.shinzo.network/validators) for current peers.

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
