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
  <Chain>__<Network>__Transaction(docID: "bae-25fb059c-f232-5305-8a5d-0162f01e43e6") {
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

Documents are also content-addressed. Passing a commit CID as the `cid` argument resolves the document at that exact version:

```graphql
{
  <Chain>__<Network>__Transaction(cid: "bafyreibtbym4uht5dppohohg4wg66tdg4r253ws2i4wshc2gtwje6e25sy") {
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
        "_docID": "bae-25fb059c-f232-5305-8a5d-0162f01e43e6",
        "blockHash": "0x9ea35b3bd9e71c57617cc30394b22f607b735f2eea7a0db974cf02ad54de98fb",
        "blockNumber": 23902272,
        "from": "0x654a6BCe2C6F0aF68eAdCFEaD06bB49C398B3F98",
        "hash": "0x61b79fc417ef183e1798681c59481410dd79f919d11806a6e7e77ebd0a744f78",
        "to": "0x677f857da5e7C42b823655290cc40ff401e138D3",
        "value": "1000000000"
      }
    ]
  }
}
```

You usually get a CID from a document's `_version` field or from an attestation record. [Verify data with signatures and CIDs](/build/how-to/verify-data/) covers that flow.

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

Every document carries signed commits. Selecting `_version` returns the CID and signature for each commit, which is the starting point for verifying data:

```graphql
{
  <Chain>__<Network>__Block(limit: 10, order: { number: DESC }) {
    number
    _docID
    _version {
      cid
      signature {
        identity
        value
        type
      }
    }
  }
}
```

The `identity` field is the public key of the Generator client that signed the commit. For commit metadata, attestation records, and CID navigation, see [Verify data with signatures and CIDs](/build/how-to/verify-data/).

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
