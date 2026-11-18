+++
path = "run/chains/tron/mainnet/data-model"
title = "Data model & examples \u2014 TRON Mainnet"
description = "Inspect the TRON adapter\u2019s collections and avoid EVM-only assumptions."
template = "chain-page.html"
[extra]
chain = "tron"
heading = "Data model & examples"
+++

## Namespace and collections

The reviewed integration uses **`Tron__Mainnet`**, with this exact capitalization. Its source schemas define Block, Transaction, Log, InternalTransfer, BlockSignature, and SnapshotSignature. They do **not** define an AccessListEntry collection.

[Schema source](https://github.com/shinzonetwork/shinzo-generator-client/blob/0df7592fcf1a18ce9fdcbe44da82d3afea9e074b/pkg/chains/tron/collections) is pinned to the same revision as the installation guide.

## Query blocks and transaction resources

```graphql
{
  Tron__Mainnet__Block(limit: 5, order: {number: DESC}) {
    number
    hash
    witnessAddress
    transactionCount
  }
  Tron__Mainnet__Transaction(limit: 5) {
    hash
    type
    from
    to
    fee
    energyUsage
  }
}
```

Run these on the Generator's local GraphQL endpoint, or a Host whose TRON compatibility has been verified. These fields belong to the TRON schema; Ethereum gas-field assumptions do not apply.

## Logs and internal transfers

`Log` records contain `address`, `topics`, `data`, `transactionHash`, `blockNumber`, and a synthetic per-transaction `logIndex`. `InternalTransfer` records include `from`, `to`, `amount`, `assetName`, `rejected`, and a synthetic `transferIndex`.

The adapter preserves address values from wallet API payloads. Do not assume every stored address is a Base58 display address or an Ethereum-style `0x` address. Inspect the actual schema and sample documents before applying address filters or a decoding Lens. Similar-looking `topics` and `data` fields do not establish compatibility with all EVM lenses.

## Source finality

The fetcher reads the FullNode head and obtains the SolidityNode solidified height for reorg handling. The most recent indexed block can be non-solidified. Keep this distinct from Shinzo signatures and Host attestations.

## Host boundary

The reviewed Host release's EVM subscription set lacks `InternalTransfer`. Follow the [TRON Host prerequisites](../host/prerequisites/) before relying on complete replicated data.
