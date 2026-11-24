+++
path = "run/tron/host/prerequisites"
aliases = ["run/chains/tron/mainnet/host/prerequisites"]
title = "Host prerequisites \u2014 TRON Mainnet"
description = "Confirm TRON schema compatibility before provisioning a Host."
template = "chain-page.html"
[extra]
chain = "tron"
heading = "Host prerequisites"
product = "host"
task = "prerequisites"
+++

{% <admonition type="info"> %}
**Compatibility gate:** the reviewed Host release is not established as a TRON-capable Host.
{% </admonition> %}

## Why a prefix is not enough

The reviewed Host release `v0.7.2-ethereum-mainnet` constructs EVM collection sets, including `AccessListEntry`, and its P2P subscription list does not include TRON's `InternalTransfer`. See [the released collection definitions](https://github.com/shinzonetwork/shinzo-host-client/blob/fa5a245ce83cb6c1e601b080ed2b18c55cec6db7/pkg/chain/chain.go).

The TRON Generator preview has a different schema. Before deploying a Host, obtain a compatible Host revision that explicitly supports that schema and its lifecycle. Setting `prefix: Tron__Mainnet` does not demonstrate compatibility.

## Required integration evidence

- A Host revision or release verified against the pinned TRON Generator.
- Successful loading, replication, and querying of Block, Transaction, Log, InternalTransfer, and BlockSignature data.
- Confirmed attestation, retention, reorg, and View behavior for these collections.
- A reachable TRON Generator HTTP API, P2P connection, and schema authorization token.
- A supported registration path and appropriate sizing for the actual workload.

Keep Ethereum snapshot bootstrap and EVM-specific event filters disabled during compatibility evaluation. See [installation status](../install/) before provisioning a production Host.
