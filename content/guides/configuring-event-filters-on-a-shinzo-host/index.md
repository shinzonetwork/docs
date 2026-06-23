+++
title = "Configuring Event Filters on a Shinzo Host"
weight = 2
description = "Shinzo hosts will store absolutely everything it is given from an Indexer by default. In this guide you will learn how to configure a Host to only store USDT ERC-20 contact events."
+++

A Shinzo Host subscribes to a stream of blockchain data and writes it to a local DefraDB instance. By default the Host stores everything, but it can be configured to only store specific data. This guide configures the Host client to only store USDT ERC-20 transfer events.

## Prerequisites

- Docker installed and running.
- Git.

## Clone the repository

```shell
git clone https://github.com/shinzonetwork/shinzo-host-client.git
cd shinzo-host-client
```

## Configure the host

Open `config/config.yaml`. The sections below are the ones you need to understand.

### Securing your local database

```yaml
defradb:
  keyring_secret: "your-secret-here"
```

This key encrypts the local DefraDB instance. Use a strong secret value before running a host in production.

### Connecting to the Shinzo network

Views can be published to and discovered through ShinzoHub. Once you've created a view, connect it to ShinzoHub to make it available across the network for other builders to use. [See the documentation for more details.](/reference/components/shinzohub/).

### Pruning

```yaml
pruner:
  enabled: true
  max_blocks: 2000
  interval_seconds: 30
```

The pruner deletes data for blocks older than `max_blocks`. At roughly 12 seconds per Ethereum block, 2000 blocks is about 6-7 hours of history. Increase this if you need more, keeping in mind the storage implications.

### Filtering blockchain events

This is what controls what gets stored. Without a filter, everything is written to disk.

```yaml
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

- `mode: "allowlist"`: only events matching a group are stored. Use `"blocklist"` to invert this.
- `contracts.address`: the on-chain address of the contract you want to watch.
- `contracts.types: ["log"]`: EVM event logs. This is where token transfers live.
- `topics.topic0`: the keccak256 hash of the event signature. For `Transfer(address,address,uint256)` this is always `0xddf252ad...`. This is what distinguishes a Transfer log from any other log emitted by the same contract.

#### Tracking different tokens

- To track another token, replace the contract `address` with the one you want. Contract addresses are available on Etherscan.
- To track multiple tokens, add another group under `groups`.

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

The `topic0` for ERC-20 Transfer is the same across all tokens, derived from the function signature rather than the contract.

#### Filtering by sender and receiver

To filter by sender or receiver, use `topic1` and `topic2`. Indexed event parameters are exposed as topics. For ERC-20 Transfer: `topic1` is the sender, `topic2` is the receiver. Addresses must be zero-padded to 32 bytes:

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

### P2P peers

```yaml
p2p:
  enabled: true
  bootstrap_peers:
    - '/ip4/34.63.13.57/tcp/9171/p2p/12D3KooWBT2F45LH7Gy6EadTE3sm7PKofyJ3RXcCnKufdu4L5c4M'
    - '/ip4/35.208.241.78/tcp/9171/p2p/12D3KooWDYXkjdncFL3X1SaaYBpFi4XfWskbXv4y5gYdTvmGm3bo'
    - '/ip4/35.209.45.53/tcp/9171/p2p/12D3KooWNLCXZEVZoM6NwU1i7zAZDscEZHhynsF74M5hP99sptM9'
```

These are the addresses of the peers your host connects to for data. Check the [Shinzo Validators list](https://registration.shinzo.network/validators) for updated peer lists; these change when the network is updated.

## Running the host

### Mount your configuration

In `docker-compose.yml`, uncomment the volumes entry so Docker uses your config file:

```yaml
volumes:
  - ./config/config.yaml:/app/config.yaml:ro
```

### Confirm containers are healthy

```shell
docker ps
```

Both `shinzo-host` and `shinzo-host-client-nginx-1` should show status `Up` and `(healthy)`.

## Verifying data ingestion

### Health

```shell
curl http://localhost:8080/health
```

Expected response:

```json
{ "status": "healthy", "defradb_connected": true }
```

### Processing metrics

```shell
curl -s http://localhost:8080/metrics | jq
```

Key fields:

| Field | Meaning |
| --- | --- |
| `blocks_processed` | Blocks scanned so far |
| `logs_processed` | Events captured matching your filter |
| `attestations_created` | Data integrity records written |

If `logs_processed` stays at 0 but `blocks_processed` is climbing, either no matching events have occurred in the blocks being indexed, or the connected indexer is not providing full transaction data (only block headers). If `transactions_processed` is also 0, contact the [Shinzo team](https://discord.shinzo.network/) for access to a full-data indexer.

### Query stored logs

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

Run `docker logs shinzo-host | tail -50`. A YAML parse error (indentation, missing quotes) or unset `keyring_secret` are the most common causes. Use a [YAML validator](https://www.yamllint.com/) to make sure your config is correct.

#### Cannot connect to health endpoint

Verify the container is running with `docker ps`. If the container is healthy but the endpoint is still unreachable, check whether another application is already using port 8080.

#### P2P connection warnings (peer id mismatch)

Your `bootstrap_peers` list is stale. Replace it with current peers from the Shinzo docs.
