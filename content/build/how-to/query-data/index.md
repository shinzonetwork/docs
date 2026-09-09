+++
title = "Query data"
aliases = ["/hosts/examples", "/build/query-data/"]
description = "How to query Shinzo data with GraphQL: filters, ordering, nested documents, DocIDs, CIDs, and signatures."
+++

You query Shinzo data with GraphQL, and there are two places to run it. A local-first app queries its embedded DefraDB instance through the app-sdk helpers, with no network call. A direct-query app POSTs the same query to a Host client's `/api/v0/graphql` endpoint over HTTP. Same language, same collections, same filter operators on both. Only the transport changes. [Connect your app to a Host](/build/how-to/connect-to-a-host/) covers the wiring.

Here are the patterns you'll reach for most. The examples use primitive collections (blocks, transactions, logs), and they all work against a View's output collection too.

{% admonition(type="note") %}
Collection names are prefixed with `<Chain>__<Network>__`, derived from the `chain.name` and `chain.network` settings of the Generator client that indexed the data (for example `<Chain>__<Network>__Block` or `Optimism__Mainnet__Block`). The examples below use the `<Chain>__<Network>__` placeholder. Substitute the prefix that matches your chain. See the [chain config](/run/run-a-generator/config-reference#chain) for details.
{% end %}

## Get the latest N documents

Order by a field and cap the result with `limit`. This is the pattern behind most "recent activity" displays.

```graphql
{
  <Chain>__<Network>__Block(limit: 10, order: { number: DESC }) {
    _docID
    number
    timestamp
    hash
  }
}
```

The same shape works for a View. This query fetches the 10 most recent decoded events from a View collection:

```graphql
{
  EventView(limit: 10, order: { blockNumber: DESC }) {
    hash
    from
    to
    blockNumber
    logAddress
    event
    arguments
  }
}
```

## Fetch a document by DocID or CID

When you already know a document's `_docID`, pass it as the `docID` argument to fetch exactly that document:

```graphql
{
  <Chain>__<Network>__Transaction(docID: "bae-6ab5ece1-26a9-529d-a8af-3d10557672af") {
    _docID
    blockHash
    blockNumber
    hash
    to
    from
    value
  }
}
```

Documents are content-addressed too. Pass a commit CID as the `cid` argument and you get the document back at exactly that version:

```graphql
{
  <Chain>__<Network>__Transaction(cid: "bafyreifaiu62wsgf64tdgdeejyvnhuwio7yvkxfufadxe5yfjaf5w4cf6u") {
    _docID
    blockHash
    blockNumber
    hash
    to
    from
    value
  }
}
```

```json
{
  "data": {
    "<Chain>__<Network>__Transaction": [
      {
        "_docID": "bae-6ab5ece1-26a9-529d-a8af-3d10557672af",
        "blockHash": "0x118954c3455addda1889a648d56faf8a7a2ab67909b473b06c7a9cc1981e73bc",
        "blockNumber": 25937618,
        "from": "0xf30b758081001716bBF99688C5233F5C74530eb0",
        "hash": "0x06b7ab30c7d5d705ffa142acba266de475013a9e5617f1b87903663a98760c73",
        "to": "0xf15A1F564669d29045D50698778DD7dFA1e1D07a",
        "value": "7341990419000"
      }
    ]
  }
}
```

You usually get a CID from a document's `_version` field or from an attestation record. [Verify data with signatures and CIDs](/build/how-to/verify-data/) covers that flow. The example DocIDs and CIDs on this page come from a live Host; Hosts prune old data over time, so if one no longer resolves, substitute a current one.

## Filter by field values

The `filter` argument narrows results with operators like `_eq`, `_geq`, `_and`, and `_like`. This query returns blocks above a height:

```graphql
{
  <Chain>__<Network>__Block(filter: { number: { _geq: 19540000 } }) {
    _docID
    number
    hash
  }
}
```

Combine conditions with `_and`. This query returns `Transfer` events decoded from one contract:

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

The full operator table lives in the [Viewkit reference](/reference/components/viewkit/#filter-operators).

## Get a block with nested data

Relations are nested in the query, so one round trip fetches a block with its transactions and their logs:

```graphql
{
  <Chain>__<Network>__Block(limit: 1) {
    _docID
    number
    timestamp
    hash
    gasUsed
    gasLimit
    baseFeePerGas
    parentHash
    miner
    transactions {
      hash
      transactionIndex
      _docID
      logs {
        transactionHash
        address
        topics
        data
      }
    }
  }
}
```

Nested selections accept their own `filter`, `order`, and `limit` arguments, so you can shape each level independently.

## Count the transactions in a block

There is no aggregate count field, but the `transactionIndex` values within a block are zero-based and contiguous. Fetch the highest `transactionIndex` and add one:

```graphql
{
  <Chain>__<Network>__Block(filter: { number: { _eq: 23901130 } }) {
    number
    transactions(
      limit: 1
      filter: { blockNumber: { _eq: 23901130 } }
      order: { transactionIndex: DESC }
    ) {
      transactionIndex
    }
  }
}
```

The total transaction count is the returned `transactionIndex` plus 1.

## Check who signed a document

Each document exposes the CIDs of its commits in `_version`. The `signature` field on those entries is part of the schema but is not populated today: Generator clients sign per block rather than per document. To see who signed, query the `BlockSignature` collection for the block your document belongs to:

```graphql
{
  <Chain>__<Network>__BlockSignature(filter: { blockNumber: { _eq: 25938055 } }) {
    blockNumber
    blockHash
    merkleRoot
    signatureIdentity
    signatureType
    signatureValue
  }
}
```

`signatureIdentity` is the public key of the Generator client that produced the block, and `signatureValue` is its ES256K signature over the block's Merkle root of document CIDs. For what these signatures cover, attestation records, and CID navigation, see [Verify data with signatures and CIDs](/build/how-to/verify-data/).

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
