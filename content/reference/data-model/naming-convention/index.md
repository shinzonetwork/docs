+++
title = "Naming convention"
description = "How collection and type names are constructed across chains and networks."
+++

Every primitive collection name is built as `{Chain}__{Network}__{Type}`, with two underscores between each part:

```plaintext
{Chain}__{Network}__Block
{Chain}__{Network}__Transaction
{Chain}__{Network}__Log
{Chain}__{Network}__AccessListEntry
{Chain}__{Network}__BlockSignature
{Chain}__{Network}__SnapshotSignature
{Chain}__{Network}__AttestationRecord
```

The `Chain` and `Network` parts come from the `chain.name` and `chain.network` settings of the Generator client that produced the data. With the default settings that is `Ethereum__Mainnet`; the shipped config also includes Arbitrum, Optimism, and Avalanche, and any other configured chain gets the same treatment. The prefix tells you which chain and network a collection holds, which is all you need to know before querying it.

## What does not carry the prefix

View output types keep whatever name the View's SDL declares: `Erc20Event`, `EventView`, `FilteredAndDecodedLogs`, and so on. A View is a dataset definition rather than raw chain data, so there is no chain to name. View-specific attestation collections do carry the prefix: `{Chain}__{Network}__AttestationRecord_{ViewName}`. See [AttestationRecord](../attestation-record/).

## Gotchas

- The separator is two underscores, not one. `Ethereum_Mainnet_Block` matches nothing.
- The parts are case-sensitive and use the configured values verbatim.
- The examples across these docs use the `<Chain>__<Network>__` placeholder. Substitute the prefix that matches your data, for example `Ethereum__Mainnet__Block` or `Optimism__Mainnet__Block`.

See the [chain config](/run/run-a-generator/config-reference#chain) for the settings behind the prefix.
