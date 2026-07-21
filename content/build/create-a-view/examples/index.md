+++
title = "View examples"
aliases = ["/views/examples"]
description = "Copy-pasteable Shinzo View examples: decode event logs, filter by contract, decode multiple event types, edit and update views, and query the results."
+++

Seven progressively more complex Views, from a basic event decode to a multi-event decoder with editing and updates. Each example shows the goal, the three View components (query, SDL, lens), the Viewkit commands to build it, and the GraphQL query you run against the result.

## Primitive data

Views query the primitive collections that Generator clients produce. All collection names are prefixed with `Ethereum__Mainnet__` (or the equivalent chain/network prefix). Viewkit lets you use short names like `Log`, and the Host client auto-prefixes them at runtime.

| Collection | Common fields | Typical use |
| --- | --- | --- |
| `Log` | `address`, `topics`, `data`, `transactionHash`, `blockNumber` | Event decoding (ERC-20, NFT, governance) |
| `Transaction` | `hash`, `from`, `to`, `value`, `blockNumber`, `status`, `gasUsed` | Transaction analytics |
| `Block` | `number`, `hash`, `timestamp`, `miner`, `gasUsed`, `gasLimit` | Block-level metadata |
| `AccessListEntry` | `address`, `storageKeys`, `blockNumber` | EIP-2930 access lists |

There is no `Event` collection. Raw event data lives in `Log`, where `topics` holds indexed parameters and `data` holds non-indexed ones. A lens decodes those raw fields into structured output.

## Decode event logs

Decode all ERC-20 `Transfer` events on Ethereum into structured records. This is the simplest useful View that includes a lens: it decodes raw log `topics` and `data` into named fields using an ABI.

**Query**

```graphql
Log { address topics data transactionHash blockNumber transaction { hash from to } }
```

The query selects raw log fields plus the nested `transaction` relation. The `decode_log` lens uses `transaction.hash`, `transaction.from`, and `transaction.to` to populate the output's `hash`, `from`, and `to` fields.

**SDL**

```graphql
type EthEvent @materialized(if: true) {
  hash: String
  from: String
  to: String
  blockNumber: Int
  logAddress: String
  event: String
  signature: String
  arguments: [String]
}
```

The `decode_log` lens outputs these fields:

- `hash`, `from`, `to`: from the parent transaction.
- `blockNumber`: block the log was emitted in.
- `logAddress`: the contract that emitted the log.
- `event`: decoded event name (e.g. `"Transfer"`).
- `signature`: event signature (e.g. `"Transfer(address,address,uint256)"`).
- `arguments`: array of decoded parameters as JSON strings.

`@materialized(if: true)` tells DefraDB to pre-compute and store the output. See [Materialized versus on-query](#materialized-vs-on-query) for the tradeoff.

**Lens**

| Lens | Purpose | Arguments |
| --- | --- | --- |
| `decode_log` | ABI-decode log events into named fields | `{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",...}]"}` |

The `decode_log` lens takes an `abi` argument: a stringified JSON array of event definitions. For the ERC-20 `Transfer` event:

```json
[{"type":"event","name":"Transfer","inputs":[{"type":"address","name":"from","indexed":true},{"type":"address","name":"to","indexed":true},{"type":"uint256","name":"value","indexed":false}]}]
```

**Commands**

1. Initalize the view:

    ```shell
    viewkit view init eth-event
    ```

1. Add the query (raw log shape with transaction relation):

    ```shell
    viewkit view add query \
      "Log { address topics data transactionHash blockNumber transaction { hash from to } }" \
      --name eth-event
    ```

1. Add the SDL (output schema matching decode_log output):

    ```shell
    viewkit view add sdl \
      "type EthEvent @materialized(if: true) { hash: String from: String to: String blockNumber: Int logAddress: String event: String signature: String arguments: [String] }" \
      --name eth-event
    ```

1. Attach the decode lens with the Transfer ABI:

    ```shell
    viewkit view add lens \
      --label "decode-transfer" \
      --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm" \
      --args '{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",\"inputs\":[{\"type\":\"address\",\"name\":\"from\",\"indexed\":true},{\"type\":\"address\",\"name\":\"to\",\"indexed\":true},{\"type\":\"uint256\",\"name\":\"value\",\"indexed\":false}]}]"}' \
      --name eth-event
    ```

1. Inspect to confirm everything is attached:

```shell
viewkit view inspect eth-event
```

1. test locally (optional but recommended):

```shell
viewkit view test eth-event
```

1. Deploy locally and explore in the playground:

```shell
viewkit view deploy eth-event --target local
```

**Querying the result**

Once deployed, open the DefraDB Playground (URL printed in the terminal) and run:

```graphql
{
  EthEvent(limit: 10, order: { blockNumber: DESC }) {
    hash
    from
    to
    blockNumber
    logAddress
    event
    signature
    arguments
  }
}
```

This returns all decoded `Transfer` events across all contracts. To narrow down to a specific token, see [Example 2](#filter-by-contract-address).

## Filter by contract address

Decode `Transfer` events from a specific contract only (e.g. USDC). Without a filter lens, `decode_log` processes every log on the chain. You filter the output using GraphQL queries against the `logAddress` field.

**Query and SDL**

Same as the [Decode event logs example](#decode-event-logs). The query, SDL, and lens are identical. The filtering happens at query time, not at the lens level.

**Commands**

Same as Example 1. Create a view named `usdc-event` with the same query, SDL, and lens.

**Querying the result**: USDC transfers only

```graphql
{
  EthEvent(
    filter: { logAddress: { _eq: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" } }
    order: { blockNumber: DESC }
    limit: 10
  ) {
    hash
    from
    to
    blockNumber
    event
    signature
    arguments
  }
}
```

The `logAddress` field contains the contract address that emitted the log. Filter on it to narrow results to one contract.

### Filter by sender or receiver

The `from` and `to` fields come from the parent transaction, not the event's indexed parameters. To filter by the event's `from`/`to` (the actual transfer sender and receiver), use the `arguments` field. With `decode_log_str` (which serializes `arguments` as a JSON string), you can use `_like`:

```graphql
{
  EthEvent(
    filter: {
      _and: [
        { logAddress: { _eq: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" } }
        { arguments: { _like: "%0x28C6c06298d514De0879A2640AB71F86b50Ce4E5%" } }
      ]
    }
  ) {
    hash
    from
    to
    arguments
    blockNumber
  }
}
```

{% admonition(type="tip", title="decode_log vs decode_log_str") %}
`decode_log` outputs `arguments` as a JSON array (`[String]` in SDL). `decode_log_str` outputs it as a JSON string (`String` in SDL), which enables `_like` filtering in DefraDB queries. Use `decode_log_str` when you need to filter on decoded parameter values. The `_str` variant uses the same URL pattern but with `decode_log_str` in the path.
{% end %}

## Decode multiple event types

Decode both `Transfer` and `Approval` events from a single contract in one View. Pass both event definitions in the ABI argument to `decode_log`.

**Query**

```graphql
Log { address topics data transactionHash blockNumber transaction { hash from to } }
```

**SDL**

```graphql
type EthEvent @materialized(if: true) {
  hash: String
  from: String
  to: String
  blockNumber: Int
  logAddress: String
  event: String
  signature: String
  arguments: [String]
}
```

**Lens**

The ABI argument includes both `Transfer` and `Approval` event definitions. The `decode_log` lens matches each log's `topics[0]` against the event signature hash and decodes accordingly.

```json
[
  {"type":"event","name":"Transfer","inputs":[{"type":"address","name":"from","indexed":true},{"type":"address","name":"to","indexed":true},{"type":"uint256","name":"value","indexed":false}]},
  {"type":"event","name":"Approval","inputs":[{"type":"address","name":"owner","indexed":true},{"type":"address","name":"spender","indexed":true},{"type":"uint256","name":"value","indexed":false}]}
]
```

**Commands**

```shell
# 1) initialize the view
viewkit view init erc20-events

# 2) add the query
viewkit view add query \
  "Log { address topics data transactionHash blockNumber transaction { hash from to } }" \
  --name erc20-events

# 3) add the SDL
viewkit view add sdl \
  "type EthEvent @materialized(if: true) { hash: String from: String to: String blockNumber: Int logAddress: String event: String signature: String arguments: [String] }" \
  --name erc20-events

# 4) attach the decode lens with both Transfer and Approval in the ABI
viewkit view add lens \
  --label "decode-erc20" \
  --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm" \
  --args '{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",\"inputs\":[{\"type\":\"address\",\"name\":\"from\",\"indexed\":true},{\"type\":\"address\",\"name\":\"to\",\"indexed\":true},{\"type\":\"uint256\",\"name\":\"value\",\"indexed\":false}]},{\"type\":\"event\",\"name\":\"Approval\",\"inputs\":[{\"type\":\"address\",\"name\":\"owner\",\"indexed\":true},{\"type\":\"address\",\"name\":\"spender\",\"indexed\":true},{\"type\":\"uint256\",\"name\":\"value\",\"indexed\":false}]}]"}' \
  --name erc20-events

# 5) inspect, test, and deploy
viewkit view inspect erc20-events
viewkit view test erc20-events
viewkit view deploy erc20-events --target local
```

**Querying the result**: Transfers only

```graphql
{
  EthEvent(
    filter: {
      _and: [
        { logAddress: { _eq: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" } }
        { event: { _eq: "Transfer" } }
      ]
    }
    limit: 10
  ) {
    hash
    from
    to
    event
    arguments
    blockNumber
  }
}
```

**Querying the result**: Approvals only

```graphql
{
  EthEvent(
    filter: {
      _and: [
        { logAddress: { _eq: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" } }
        { event: { _eq: "Approval" } }
      ]
    }
    limit: 10
  ) {
    hash
    from
    to
    event
    arguments
    blockNumber
  }
}
```

The `event` field lets you distinguish between event types in the same View collection.

## Transaction-based view (no lens)

Expose all transactions sent to a specific contract. This View queries `Transaction` documents directly. No lens needed because we're not decoding events.

**Query**

```graphql
Transaction { hash from to value blockNumber gasUsed gasPrice }
```

**SDL**

```graphql
type EthTransaction @materialized(if: false) {
  hash: String
  from: String
  to: String
  value: String
  blockNumber: Int
  gasUsed: String
  gasPrice: String
}
```

Here we use `@materialized(if: false)`: the view is computed on query, not pre-stored. This makes sense for transaction data, which is large and queried less frequently than decoded events. See [Example 5](#materialized-vs-on-query) for details.

**Lens**

None. The query and SDL are sufficient. DefraDB applies the view as a virtual projection over the `Transaction` collection.

**Commands**

```shell
# 1) initialize the view
viewkit view init eth-transaction

# 2) add the query
viewkit view add query \
  "Transaction { hash from to value blockNumber gasUsed gasPrice }" \
  --name eth-transaction

# 3) add the SDL
viewkit view add sdl \
  "type EthTransaction @materialized(if: false) { hash: String from: String to: String value: String blockNumber: Int gasUsed: String gasPrice: String }" \
  --name eth-transaction

# 4) inspect, test, and deploy
viewkit view inspect eth-transaction
viewkit view test eth-transaction
viewkit view deploy eth-transaction --target local
```

**Querying the result**

```graphql
{
  EthTransaction(
    filter: { to: { _eq: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45" } }
    order: { blockNumber: DESC }
    limit: 10
  ) {
    hash
    from
    to
    value
    blockNumber
    gasUsed
    gasPrice
  }
}
```

## Materialized vs on-query

Understand when to use `@materialized(if: true)` vs `@materialized(if: false)`.

The `@materialized` directive controls when the View's output is computed:

| `@materialized` | When it computes | Query speed | Storage | Best for |
| --- | --- | --- | --- | --- |
| `if: true` | At write time. Host pre-computes and stores results. | Fast. Data is already materialized. | Higher. Host stores the output collection. | Frequently queried data (e.g. token transfers in a UI). |
| `if: false` | At query time. Host computes on the fly. | Slower. Depends on data volume. | Lower. No pre-stored output. | Large datasets queried occasionally, or during development. |

### Same View, two modes

Materialized (pre-computed):

```graphql
type EthEvent @materialized(if: true) {
  hash: String
  from: String
  to: String
  blockNumber: Int
  logAddress: String
  event: String
  signature: String
  arguments: [String]
}
```

On-query (virtual):

```graphql
type EthEvent @materialized(if: false) {
  hash: String
  from: String
  to: String
  blockNumber: Int
  logAddress: String
  event: String
  signature: String
  arguments: [String]
}
```

### Switching modes

To toggle materialization on an existing view, update the SDL:

```shell
# switch to materialized
viewkit view add sdl \
  "type EthEvent @materialized(if: true) { hash: String from: String to: String blockNumber: Int logAddress: String event: String signature: String arguments: [String] }" \
  --name eth-event

# or switch to on-query
viewkit view add sdl \
  "type EthEvent @materialized(if: false) { hash: String from: String to: String blockNumber: Int logAddress: String event: String signature: String arguments: [String] }" \
  --name eth-event
```

Then redeploy:

```shell
viewkit view test eth-event
viewkit view deploy eth-event --target local
```

{% admonition(type="tip") %}
Use `@materialized(if: false)` while developing and iterating on a View. Switch to `@materialized(if: true)` once the View is stable and you need fast queries in production.
{% end %}

## Editing and updating a view

Modify an existing View without starting from scratch. This example builds on the `erc20-events` View from [Example 3](#decode-multiple-event-types) and shows the full edit-update lifecycle: add an SDL field, swap a lens, inspect revisions, roll back, test, and redeploy.

### Starting point

Assume you already have `erc20-events` deployed with:

- Query: `Log { address topics data transactionHash blockNumber transaction { hash from to } }`
- SDL: `type EthEvent @materialized(if: true) { hash: String from: String to: String blockNumber: Int logAddress: String event: String signature: String arguments: [String] }`
- Lens: `decode-erc20` (decode_log, Transfer + Approval ABI)

### Swap the lens to decode three event types

Remove the old lens, then add a new one with an updated ABI that includes `Transfer`, `Approval`, and `Transfer` (ERC-721, which has a `tokenId` instead of `value`):

```shell
# remove the old lens
viewkit view remove lens \
  --label "decode-erc20" \
  --name erc20-events

# add a new lens with three event types
viewkit view add lens \
  --label "decode-multi" \
  --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm" \
  --args '{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",\"inputs\":[{\"type\":\"address\",\"name\":\"from\",\"indexed\":true},{\"type\":\"address\",\"name\":\"to\",\"indexed\":true},{\"type\":\"uint256\",\"name\":\"value\",\"indexed\":false}]},{\"type\":\"event\",\"name\":\"Approval\",\"inputs\":[{\"type\":\"address\",\"name\":\"owner\",\"indexed\":true},{\"type\":\"address\",\"name\":\"spender\",\"indexed\":true},{\"type\":\"uint256\",\"name\":\"value\",\"indexed\":false}]},{\"type\":\"event\",\"name\":\"Transfer\",\"inputs\":[{\"type\":\"address\",\"name\":\"from\",\"indexed\":true},{\"type\":\"address\",\"name\":\"to\",\"indexed\":true},{\"type\":\"uint256\",\"name\":\"tokenId\",\"indexed\":true}]}]"}' \
  --name erc20-events
```

### Inspect with revision history

Every `add` and `remove` creates a new revision. To see the full history:

```shell
viewkit view inspect erc20-events --verbose
```

This shows the current state (query, SDL, lenses) and all past revisions, each with a version number.

### Roll back if something went wrong

If the updated ABI doesn't work as expected, revert to the previous version:

```shell
# roll back to the most recent previous version
viewkit view rollback erc20-events
```

Or roll back to a specific version:

```shell
viewkit view rollback erc20-events --version 3
```

### Test and redeploy

```shell
# validate the updated view compiles
viewkit view test erc20-events

# deploy locally to verify in the playground
viewkit view deploy erc20-events --target local

# once verified, deploy to devnet
viewkit view deploy erc20-events --target devnet --rpc http://34.29.171.79:8545/
```

### Delete a view (if needed)

To remove a view bundle from your local machine entirely:

```shell
viewkit view delete erc20-events
```

This deletes the local bundle. It does not remove a view that has already been deployed to devnet. On-chain registrations are permanent. To update a deployed view, deploy a new version with the same name.

## Querying a deployed view

GraphQL queries you can run against a deployed View's output collection. These examples assume the `erc20-events` View from Example 3 is deployed and receiving data.

### Basic query: latest 10 events

```graphql
{
  EthEvent(
    order: { blockNumber: DESC }
    limit: 10
  ) {
    hash
    from
    to
    blockNumber
    logAddress
    event
    signature
    arguments
  }
}
```

### Filter by contract and event type

```graphql
{
  EthEvent(
    filter: {
      _and: [
        { logAddress: { _eq: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" } }
        { event: { _eq: "Transfer" } }
      ]
    }
    limit: 10
  ) {
    hash
    from
    to
    arguments
    blockNumber
  }
}
```

### Filter by block range

```graphql
{
  EthEvent(
    filter: { blockNumber: { _gte: 19540000 } }
  ) {
    hash
    from
    to
    event
    blockNumber
  }
}
```

### Filter by transaction hash

```graphql
{
  EthEvent(
    filter: { hash: { _eq: "0xabc123..." } }
  ) {
    hash
    from
    to
    event
    signature
    arguments
    blockNumber
  }
}
```

For the full list of Viewkit commands and GraphQL filter operators, see the [Viewkit reference](/reference/components/viewkit/). For a deeper dive on lenses, available modules, and how to chain them, see the [Lenses guide](/reference/components/lens/). For troubleshooting and common errors, see the [FAQ](/run/operations/troubleshooting/).

## Need help

{{ need_help(client="Viewkit", repo_name="shinzo-view-creator", repo="https://github.com/shinzonetwork/shinzo-view-creator/issues") }}
