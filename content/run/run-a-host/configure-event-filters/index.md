+++
aliases = ["/run/run-a-host/deployment-examples/event-filter-allowlist/"]
title = "Configure event filters (single-chain)"
description = "Configure event filtering on a single-chain Host, using Ethereum mainnet USDT transfers as an example."
+++

A Shinzo Host receives primitive blockchain data from Generator clients and writes it to a local DefraDB instance. Event filtering controls which incoming documents it stores. This guide uses an Ethereum-only Host to filter for USDT transfer logs on Ethereum mainnet.

{% <admonition type="warning"> %}
**Event filtering requires a single-chain Host.** The Host will not start if `shinzo.event_filter.enabled` is `true` while it serves multiple chains. Before adding another chain, disable event filtering or run a separate single-chain Host for the filtered workload.
{% </admonition> %}

## Prerequisites

- Docker installed and running.
- Git, `curl`, and `jq`.
- A Generator for Ethereum mainnet with a reachable HTTP API URL and P2P multiaddr. See [Install](/run/run-a-host/install/) for the Docker setup and connection requirements.

## Clone the repository

```shell
git clone https://github.com/shinzonetwork/shinzo-host-client.git
cd shinzo-host-client
```

## Configure the host

Open `config/config.yaml`. Merge the examples below into the existing sections; do not replace the entire configuration or create duplicate top-level keys. This guide keeps exactly one entry under `chains:`.

### Securing your local database

```yaml
defradb:
  keyring_secret: "your-secret-here"
```

This key encrypts the local DefraDB instance. Use a strong secret value before running a host in production.

### Connecting to the Shinzo network

Views can be published to and discovered through ShinzoHub. Once you've created a View, connect it to ShinzoHub to make it available across the network for other builders to use. [See the documentation for more details.](/reference/components/shinzohub/).

### Pruning

```yaml
pruner:
  enabled: true
  max_blocks: 2000
  interval_seconds: 30
```

This example retains the latest 2,000 block heights; it is an example setting, not the default. At roughly 12 seconds per Ethereum block, that is about 6–7 hours of history. An optional `max_blocks` in the chain entry overrides `pruner.max_blocks` for that chain. Increase retention if needed, keeping storage requirements in mind.

### Filtering blockchain events

Place `event_filter` under the existing `shinzo:` section. Replace its example groups with the groups you want to use; leaving other allowlist groups enabled also allows their matching data. With event filtering disabled, incoming documents are not restricted by these rules.

Block documents are checked only against an optional `block_range`; block signatures and snapshot signatures always pass. The filter therefore does not limit the entire database to token transfer logs.

```yaml
shinzo:
  event_filter:
    enabled: true
    mode: "allowlist"

    groups:
      - name: "usdt-transfers"
        enabled: true

        contracts:
          - name: "USDT"
            address: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
            types: ["log"]

        topics:
          - name: "Transfer"
            topic0: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
```

#### How event filtering works

- `mode: "allowlist"`: stores matching events, with the block and signature exceptions above. Use `"blocklist"` to exclude matching events instead.
- `contracts.address`: the on-chain address of the contract you want to watch.
- `contracts.types: ["log"]`: EVM event logs. This is where token transfers live.
- `topics.topic0`: the keccak256 hash of the event signature. For `Transfer(address,address,uint256)` this is always `0xddf252ad...`. This is what distinguishes a Transfer log from any other log emitted by the same contract.

#### Tracking different tokens

- To track another token, replace the contract `address` with the one you want. Use the address deployed on the Host's configured chain. The USDT and USDC addresses on this page are for Ethereum mainnet.
- To track multiple tokens on the same chain, add another group under `shinzo.event_filter.groups`. This does not enable filtering across multiple chains.

```yaml
  - name: "usdc-transfers"
    enabled: true
    contracts:
      - name: "USDC"
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        types: ["log"]
    topics:
      - name: "Transfer"
        topic0: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
```

The `topic0` for ERC-20 Transfer is the same across all tokens, derived from the event signature rather than the contract.

#### Filtering by sender and receiver

Within a group's `topics` entry, use `topic1` and `topic2` to filter by sender or receiver. Indexed event parameters are exposed as topics. For ERC-20 Transfer: `topic1` is the sender, `topic2` is the receiver. Addresses must be zero-padded to 32 bytes:

```yaml
topics:
  - name: "Transfer"
    topic0: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    topic1: "0x000000000000000000000000<sender-address-without-0x>"
```

#### Computing `topic0` for a custom event

Hash its canonical signature:

```javascript
// ethers.js
const { ethers } = require("ethers");
console.log(ethers.utils.id("Transfer(address,address,uint256)"));
```

Or use an [online keccak256 tool](https://emn178.github.io/online-tools/keccak_256.html).

### Using blocklist mode

To store incoming events except those matching your enabled groups, change `shinzo.event_filter.mode` from `allowlist` to `blocklist`. Keep the same groups: the USDT and USDC examples above will then exclude matching transfer logs instead of selecting them. Block and signature exceptions still apply.

### Optional block range gate

Add this under the existing `shinzo.event_filter` section, alongside `mode` and `groups`:

```yaml
block_range:
  min_block: 20000000
  max_block: 0
```

`max_block: 0` means no upper limit. Omit `block_range` to apply no block-height gate. Block documents are subject to this range, while block signatures and snapshot signatures always pass.

### Contract types and cascading

Contract filters support `transaction`, `log`, and `accessListEntry`. With `shinzo.event_filter.cascade_filters: true`, a contract filter for `transaction` also applies to logs and access-list entries from the same address. Set it to `false` for strict per-type matching. Toggle individual groups using `enabled` without removing their definitions.

See the [event-filter reference](/run/run-a-host/config-reference/#shinzo-event-filter) for the individual fields.

### Configure the chain and Generator connections

Add a top-level `chains:` section with one entry. Replace the placeholders with your Ethereum Generator's HTTP API address and full P2P multiaddr:

```yaml
chains:
  - prefix: Ethereum__Mainnet
    generators:
      - url: http://<generator-ip>:8080
        peer: /ip4/<generator-ip>/tcp/9171/p2p/<generator-peer-id>
```

The prefix must match the Generator's chain exactly, including case. The Host uses `url` to retrieve the chain schema on first start and dials `peer` for P2P data. At least one listed Generator must answer the schema request then. Add further Generators for the same chain under `generators` for redundancy; do not add a second chain while filtering is enabled.

Without `chains`, the Host serves Ethereum only. Once the key is present, explicitly list the chain you want to serve. Adding bootstrap peers alone does not configure a different chain.

To adapt this guide to another single chain, change the prefix, Generator connections, contract addresses, and query collection names together. A Host without Ethereum can remove the default Ethereum peers from `defradb.p2p.bootstrap_peers` and must keep `host.snapshot.enabled` set to `false`, because snapshots support Ethereum-only Hosts.

## Running the host

### Mount your configuration

Follow [Install](/run/run-a-host/install/) to start the Host with the release image and your keyring secret. If using Compose, add this mount under the Host service's `volumes` so it uses the file edited above:

```yaml
volumes:
  - ./config/config.yaml:/app/config.yaml:ro
```

Apply a new Compose mount by recreating the Host service with `docker compose up -d`. After editing an already mounted configuration, restart the Host to load the changes:

```shell
docker restart shinzo-host
```

### Confirm the Host is healthy

```shell
docker ps
```

The Host container should be running. If the image defines a health check, wait for it to report `healthy`, then verify the configured chain below.

## Verifying data ingestion

### Health

```shell
curl -s http://localhost:8080/health | jq '.chains'
```

Check the Ethereum mainnet entry. A responding endpoint alone does not confirm that the chain is syncing.

### Processing metrics

```shell
curl -s http://localhost:8080/metrics | jq '.chains'
```

`/health`, `/registration`, `/stats`, and `/metrics` report status per chain under `chains`. Inspect the configured chain's processing metrics as data arrives. Monitoring that used the old top-level `current_block` or `last_processed` fields must be updated; those fields have been removed.

If blocks are being processed but no matching logs appear, check that the contract address belongs to the configured chain, the filter group is enabled, and matching events occurred in the retained block range. Also confirm that the Generator supplies the required log data.

### Query stored logs

These queries use the Ethereum-prefixed collection. For another single-chain Host, use the collection name from that chain's schema. Views that reference unprefixed tables are treated as Ethereum Views and will not load on a Host without Ethereum.

```shell
curl -s -X POST http://localhost:9181/api/v0/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ Ethereum__Mainnet__Log(limit: 10) { _docID address topics blockNumber } }"}' \
  | jq
```

To filter down to a specific contract:

```shell
curl -s -X POST http://localhost:9181/api/v0/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ Ethereum__Mainnet__Log(filter: {address: {_eq: \"0xdAC17F958D2ee523a2206206994597C13D831ec7\"}}, limit: 10) { _docID address topics blockNumber data } }"}' \
  | jq
```

The `topics` array maps directly to `topic0`-`topic3`. For a Transfer event: `topics[0]` is the event signature, `topics[1]` is the sender, `topics[2]` is the receiver. The transfer amount is ABI-encoded in the `data` field and must be decoded in your application.


## Troubleshooting

#### Container restarts immediately

Run `docker logs shinzo-host | tail -50`. Check that event filtering is enabled under `shinzo.event_filter` and that the Host serves exactly one chain. Also check YAML indentation, the keyring secret, and Generator HTTP availability for schema loading. Snapshots must remain disabled unless the Host serves Ethereum alone.

#### Cannot connect to health endpoint

Verify the container is running with `docker ps`. If the container is healthy but the endpoint is still unreachable, check whether another application is already using port 8080.

#### P2P connection warnings (peer id mismatch)

Check the `peer` addresses under `chains[].generators`: each must contain the current peer ID and a reachable public IP or hostname. Update stale entries manually, along with any configured `defradb.p2p.bootstrap_peers`, then restart the Host.
