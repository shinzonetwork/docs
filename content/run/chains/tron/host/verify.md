+++
path = "run/tron/host/verify"
aliases = ["run/chains/tron/mainnet/host/verify"]
title = "TRON Host verification \u2014 TRON Mainnet"
description = "Use these acceptance checks with a confirmed TRON-compatible Host implementation."
template = "chain-page.html"
[extra]
chain = "tron"
heading = "TRON Host verification"
product = "host"
task = "verify"
+++

## Required before this check

These checks apply to a Host implementation confirmed to support the TRON Generator schema. The released EVM collection handling has not passed this compatibility gate; see [Prerequisites](../prerequisites/).

## Compare the chain schema

Confirm the Host exposes the same TRON types as the Generator. In particular, `Tron__Mainnet__InternalTransfer` must be available and replicated; a block-only check can miss lost dependent data.

```graphql
{
  Tron__Mainnet__Block(limit: 1, order: {number: DESC}) {
    number
    hash
    witnessAddress
  }
  Tron__Mainnet__InternalTransfer(limit: 5) {
    transactionHash
    from
    to
    amount
    rejected
  }
}
```

Run this against the local, direct Host GraphQL API after loading representative blocks containing internal transfers. Empty results without such source transactions do not prove a failure or success.

## Complete the acceptance checks

Compare Block, Transaction, Log, and InternalTransfer documents with the Generator for the same block range. Verify block-signature processing and attestation behavior, reorg recovery, retention of all dependent types, restart persistence, and the intended View execution. Confirm that partial or unsupported types are not silently dropped.

## Finality

The Generator preview can ingest a non-solidified head. Check the source's solidified boundary before treating records as final. A Host attestation count is not a substitute for source-chain finality.
