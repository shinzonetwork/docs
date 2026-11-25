+++
path = "run/bnb/data-model"
aliases = ["run/chains/bnb/mainnet/data-model"]
title = "Data model & examples \u2014 BNB Smart Chain Mainnet"
description = "Query BNB Smart Chain primitives using the exact source-network namespace."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Data model & examples"
+++

## Collection namespace

Use `BSC__Mainnet__Block`, `BSC__Mainnet__Transaction`, `BSC__Mainnet__Log`, and `BSC__Mainnet__AccessListEntry` for EVM primitives. Block signatures and snapshot signatures use the same prefix. See the [primitive reference](/reference/data-model/primitives/) for shared field definitions.

BNB is the product-facing chain name; the implementation uses **BSC** in collection names. `BNB__Mainnet__Block` is not the configured collection.

## Query blocks and logs

```graphql
{
  BSC__Mainnet__Block(limit: 5, order: {number: DESC}) {
    number
    hash
  }
  BSC__Mainnet__Log(limit: 5) {
    address
    topics
    data
    blockNumber
  }
}
```

These are direct local GraphQL queries, not signed/billed View queries. Use [Query your first View](/build/tutorials/query-your-first-view/) for the application-facing billed workflow.

## Contract addresses and filters

Use contract addresses deployed on BNB Smart Chain Mainnet. Do not copy Ethereum USDT or USDC contract addresses into BSC filters. EVM event signatures can be shared, but addresses, available history, and source data are chain-specific.

The reviewed Host only permits event filtering on a single-chain configuration. For a multi-chain Host, disable this filter or split the workload across single-chain Hosts.

## Retention and schema

A block count is not a portable duration across chains. Check the actual retention settings on your Generator and Host. Query the Generator's authenticated `/api/v1/schema` endpoint for the schema used by your deployment; do not infer a schema from a human-facing chain label.
