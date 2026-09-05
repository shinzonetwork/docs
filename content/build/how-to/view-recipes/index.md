+++
title = "View recipes"
aliases = ["/views/examples", "/build/create-a-view/examples/"]
description = "How to build common Views: decode event logs, filter by contract, decode multiple event types, transaction Views, and editing or rolling back a View."
+++

Seven recipes for the Views people build most often, from a basic event decode to editing and rolling back a deployed View. Each recipe states its goal, shows the View components (query, SDL, lens), gives the Viewkit commands to build it, and ends with the GraphQL query you run against the result.

If you have never built a View, work through [Create your first View](/build/tutorials/create-your-first-view/) first. When none of the prebuilt lenses does what you need, see [Write and test a custom lens](/build/how-to/write-a-lens/).

## Primitive data

Views query the primitive collections that Generator clients produce. All collection names are prefixed with `<Chain>__<Network>__`, derived from the Generator's `chain.name` and `chain.network` settings. Viewkit lets you use short names like `Log`, and the Host client auto-prefixes them at runtime.

| Collection | Common fields | Typical use |
| --- | --- | --- |
| `Log` | `address`, `topics`, `data`, `transactionHash`, `blockNumber` | Event decoding (fungible tokens, NFTs, governance) |
| `Transaction` | `hash`, `from`, `to`, `value`, `blockNumber`, `status`, `gasUsed` | Transaction analytics |
| `Block` | `number`, `hash`, `timestamp`, `miner`, `gasUsed`, `gasLimit` | Block-level metadata |
| `AccessListEntry` | `address`, `storageKeys`, `blockNumber` | Access lists |

There is no `Event` collection. Raw event data lives in `Log`, where `topics` holds indexed parameters and `data` holds non-indexed ones. A lens decodes those raw fields into structured output. For the full list of primitive collections, including `BlockSignature` and `SnapshotSignature`, see [Views for builders](/build/concepts/views-for-builders/#primitive-data-views-operate-on).

## Decode event logs

Goal: decode all `Transfer` events from fungible token contracts into structured records. This is the simplest useful View that includes a lens: it decodes raw log `topics` and `data` into named fields using an ABI.

### Query

```graphql
Log { address topics data transactionHash blockNumber transaction { hash from to } }
```

The query selects raw log fields plus the nested `transaction` relation. The `decode_log` lens uses `transaction.hash`, `transaction.from`, and `transaction.to` to populate the output's `hash`, `from`, and `to` fields.

### SDL

```graphql
type EventView @materialized(if: true) {
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

`@materialized(if: true)` tells DefraDB to pre-compute and store the output. See [Choose materialized vs on-query](#choose-materialized-vs-on-query) for the tradeoff.

### Lens

| Lens | Purpose | Arguments |
| --- | --- | --- |
| `decode_log` | ABI-decode log events into named fields | `{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",...}]"}` |

The `decode_log` lens takes an `abi` argument: a stringified JSON array of event definitions. For the `Transfer` event of a fungible token:

```json
[{"type":"event","name":"Transfer","inputs":[{"type":"address","name":"from","indexed":true},{"type":"address","name":"to","indexed":true},{"type":"uint256","name":"value","indexed":false}]}]
```

### Commands

1. Initialize the View:

    ```shell
    viewkit view init event-view
    ```

1. Add the query (raw log shape with the transaction relation):

    ```shell
    viewkit view add query \
      "Log { address topics data transactionHash blockNumber transaction { hash from to } }" \
      --name event-view
    ```

1. Add the SDL (output schema matching the `decode_log` output):

    ```shell
    viewkit view add sdl \
      "type EventView @materialized(if: true) { hash: String from: String to: String blockNumber: Int logAddress: String event: String signature: String arguments: [String] }" \
      --name event-view
    ```

1. Attach the decode lens with the Transfer ABI:

    ```shell
    viewkit view add lens \
      --label "decode-transfer" \
      --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm" \
      --args '{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",\"inputs\":[{\"type\":\"address\",\"name\":\"from\",\"indexed\":true},{\"type\":\"address\",\"name\":\"to\",\"indexed\":true},{\"type\":\"uint256\",\"name\":\"value\",\"indexed\":false}]}]"}' \
      --name event-view
    ```

1. Inspect to confirm everything is attached:

    ```shell
    viewkit view inspect event-view
    ```

1. Test locally (optional but recommended):

    ```shell
    viewkit view test event-view
    ```

1. Deploy locally and explore in the playground:

    ```shell
    viewkit view deploy event-view --target local
    ```

### Query the result

Once deployed, open the DefraDB Playground (URL printed in the terminal) and run:

```graphql
{
  EventView(limit: 10, order: { blockNumber: DESC }) {
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

This returns decoded `Transfer` events across all contracts. To narrow down to a specific token, see [Filter by contract address](#filter-by-contract-address).

## Filter by contract address

Goal: decode `Transfer` events from one specific contract only, such as a single token. Without a filter lens, `decode_log` processes every log on the chain. You filter the output using GraphQL queries against the `logAddress` field.

### Query and SDL

Same as [Decode event logs](#decode-event-logs). The query, SDL, and lens are identical. The filtering happens at query time, not at the lens level.

### Commands

Same as the previous recipe. Create a View named `usdc-event` with the same query, SDL, and lens.

### Filter to one contract

```graphql
{
  EventView(
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
  EventView(
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
`decode_log` outputs `arguments` as a JSON array (`[String]` in SDL). `decode_log_str` outputs it as a JSON string (`String` in SDL), which enables `_like` filtering in DefraDB queries. Use `decode_log_str` when you need to filter on decoded parameter values. The `_str` variant uses the same URL pattern but with `decode_log_str` in the path. Both lenses are listed in the [lens reference](/reference/components/lens/).
{% end %}

## Decode multiple event types

Goal: decode both `Transfer` and `Approval` events from a single contract in one View. Pass both event definitions in the ABI argument to `decode_log`.

### Query

```graphql
Log { address topics data transactionHash blockNumber transaction { hash from to } }
```

### SDL

```graphql
type EventView @materialized(if: true) {
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

### Lens

The ABI argument includes both `Transfer` and `Approval` event definitions. The `decode_log` lens matches each log's `topics[0]` against the event signature hash and decodes accordingly.

```json
[
  {"type":"event","name":"Transfer","inputs":[{"type":"address","name":"from","indexed":true},{"type":"address","name":"to","indexed":true},{"type":"uint256","name":"value","indexed":false}]},
  {"type":"event","name":"Approval","inputs":[{"type":"address","name":"owner","indexed":true},{"type":"address","name":"spender","indexed":true},{"type":"uint256","name":"value","indexed":false}]}
]
```

### Commands

```shell
# 1) initialize the View
viewkit view init erc20-events

# 2) add the query
viewkit view add query \
  "Log { address topics data transactionHash blockNumber transaction { hash from to } }" \
  --name erc20-events

# 3) add the SDL
viewkit view add sdl \
  "type EventView @materialized(if: true) { hash: String from: String to: String blockNumber: Int logAddress: String event: String signature: String arguments: [String] }" \
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

### Transfers only

```graphql
{
  EventView(
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

### Approvals only

```graphql
{
  EventView(
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

## Query transactions without a lens

Goal: expose all transactions sent to a specific contract. This View queries `Transaction` documents directly, and needs no lens because nothing is being decoded.

### Query

```graphql
Transaction { hash from to value blockNumber gasUsed gasPrice }
```

### SDL

```graphql
type TransactionView @materialized(if: false) {
  hash: String
  from: String
  to: String
  value: String
  blockNumber: Int
  gasUsed: String
  gasPrice: String
}
```

Here we use `@materialized(if: false)`: the View is computed on query, not pre-stored. This makes sense for transaction data, which is large and queried less frequently than decoded events. See [Choose materialized vs on-query](#choose-materialized-vs-on-query) for details.

### Lens

None. The query and SDL are sufficient. DefraDB applies the View as a virtual projection over the `Transaction` collection.

### Commands

```shell
# 1) initialize the View
viewkit view init transaction-view

# 2) add the query
viewkit view add query \
  "Transaction { hash from to value blockNumber gasUsed gasPrice }" \
  --name transaction-view

# 3) add the SDL
viewkit view add sdl \
  "type TransactionView @materialized(if: false) { hash: String from: String to: String value: String blockNumber: Int gasUsed: String gasPrice: String }" \
  --name transaction-view

# 4) inspect, test, and deploy
viewkit view inspect transaction-view
viewkit view test transaction-view
viewkit view deploy transaction-view --target local
```

### Query the result

```graphql
{
  TransactionView(
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

## Choose materialized vs on-query

Goal: decide whether a View's output should be pre-computed and stored, or computed fresh on each query.

The `@materialized` directive controls when the View's output is computed:

| `@materialized` | When it computes | Query speed | Storage | Best for |
| --- | --- | --- | --- | --- |
| `if: true` | At write time. The Host pre-computes and stores results. | Fast. Data is already materialized. | Higher. The Host stores the output collection. | Frequently queried data (e.g. token transfers in a UI). |
| `if: false` | At query time. The Host computes on the fly. | Slower. Depends on data volume. | Lower. No pre-stored output. | Large datasets queried occasionally, or during development. |

### Same View in two modes

Materialized (pre-computed):

```graphql
type EventView @materialized(if: true) {
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
type EventView @materialized(if: false) {
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

### Switch modes

To toggle materialization on an existing View, update the SDL:

```shell
# switch to materialized
viewkit view add sdl \
  "type EventView @materialized(if: true) { hash: String from: String to: String blockNumber: Int logAddress: String event: String signature: String arguments: [String] }" \
  --name event-view

# or switch to on-query
viewkit view add sdl \
  "type EventView @materialized(if: false) { hash: String from: String to: String blockNumber: Int logAddress: String event: String signature: String arguments: [String] }" \
  --name event-view
```

Then redeploy:

```shell
viewkit view test event-view
viewkit view deploy event-view --target local
```

{% admonition(type="tip") %}
Use `@materialized(if: false)` while developing and iterating on a View. Switch to `@materialized(if: true)` once the View is stable and you need fast queries in production.
{% end %}

## Edit and roll back a View

Goal: modify an existing View without starting from scratch. This recipe builds on the `erc20-events` View from [Decode multiple event types](#decode-multiple-event-types) and shows the full edit lifecycle: swap a lens, inspect revisions, roll back, test, and redeploy.

### Starting point

Assume you already have `erc20-events` deployed with:

- Query: `Log { address topics data transactionHash blockNumber transaction { hash from to } }`
- SDL: `type EventView @materialized(if: true) { hash: String from: String to: String blockNumber: Int logAddress: String event: String signature: String arguments: [String] }`
- Lens: `decode-erc20` (`decode_log`, Transfer + Approval ABI)

### Swap the lens

Remove the old lens, then add a new one with an updated ABI that decodes three event types (the third `Transfer` variant uses a `tokenId` parameter instead of `value`):

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

### Inspect the revision history

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
# validate the updated View compiles
viewkit view test erc20-events

# deploy locally to verify in the playground
viewkit view deploy erc20-events --target local

# once verified, deploy to the public testnet
viewkit view deploy erc20-events --target devnet --rpc http://testnet.shinzo.network:8545/
```

{% admonition(type="note") %}
The CLI's network target is called `devnet`, but pointed at `http://testnet.shinzo.network:8545/` it deploys to the public testnet. Registration is an on-chain transaction, so the wallet you deploy from needs testnet tokens from the [faucet](https://faucet.shinzo.network/).
{% end %}

### Delete a View

To remove a View bundle from your local machine entirely:

```shell
viewkit view delete erc20-events
```

This deletes the local bundle. It does not remove a View that has already been deployed to the network. On-chain registrations are permanent. To update a deployed View, deploy a new version with the same name.

## Query a deployed View

Goal: run GraphQL queries against a deployed View's output collection. These examples assume the `erc20-events` View from [Decode multiple event types](#decode-multiple-event-types) is deployed and receiving data.

### Get the latest 10 events

```graphql
{
  EventView(
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
  EventView(
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
  EventView(
    filter: { blockNumber: { _geq: 19540000 } }
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
  EventView(
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

For the full list of Viewkit commands and GraphQL filter operators, see the [Viewkit reference](/reference/components/viewkit/). For the prebuilt lens catalog and how to chain lenses, see the [lens reference](/reference/components/lens/). For more query patterns, see [Query data](/build/how-to/query-data/). For troubleshooting and common errors, see the [FAQ](/run/operations/troubleshooting/).

## Need help

{{ need_help(client="Viewkit", repo_name="shinzo-view-creator", repo="https://github.com/shinzonetwork/shinzo-view-creator/issues") }}
