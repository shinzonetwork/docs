+++
path = "run/chains/tron/mainnet/generator/prerequisites"
title = "Generator prerequisites \u2014 TRON Mainnet"
description = "Prepare the TRON wallet APIs and the integration-preview build environment."
template = "chain-page.html"
[extra]
chain = "tron"
heading = "Generator prerequisites"
product = "generator"
task = "prerequisites"
+++

{% <admonition type="info"> %}
This guide targets a pinned development-branch revision. No production hardware minimum or released TRON container is claimed.
{% </admonition> %}

## Required source APIs

Provide the base URL of a TRON Mainnet FullNode wallet API and a SolidityNode wallet API. They can share a host when the provider serves both `/wallet/*` and `/walletsolidity/*`. These are HTTP JSON APIs; `GETH_RPC_URL` and an Ethereum WebSocket subscription are not the configuration used by this adapter.

The source needs block bodies, transaction receipts, latest head, and the solidified head. Ensure your provider permits the required calls and history. See [TRON API reference](https://developers.tron.network/docs/api).

## Toolchain and capacity

Install Git, Make, the Go version in the pinned revision's `go.mod`, and a C toolchain for CGO. Use a dedicated checkout with persistent database and identity directories. The supplied resource budget assumes a 16 GB machine; it is not a measured TRON minimum. Adjust caches, P2P budget, and the runtime memory budget together.

Have a provider API key if required, a stable Generator identity secret, and a schema access token. Do not reuse source-node signing credentials as the Generator secret.

## Network and identity

This path is for **TRON Mainnet**. The branch's `chain_id: 0` is an adapter configuration value, not an EVM network-verification command. Check the source provider's network explicitly; setting the namespace to Mainnet does not verify that the endpoint is Mainnet.

Registry eligibility and the accepted TRON identity proof are separate from API access. See [Registration](../register/).
