+++
path = "run/chains/tron/mainnet"
title = "TRON documentation \u2014 TRON Mainnet"
description = "Build the TRON integration preview and understand its source interfaces and data model."
template = "chain-page.html"
[extra]
chain = "tron"
heading = "TRON documentation"
overview = true
+++

{% <admonition type="info"> %}
**Integration preview.** These instructions target `aleks/tron-integration` at revision `0df7592`. They are not a production-release or completed registration announcement.
{% </admonition> %}

## What is different

The TRON adapter uses the **java-tron wallet HTTP API**, a separate `block_poster_tron` executable, and `Tron__Mainnet` collections. It does not use the EVM Generator's `GETH_*` configuration or Ethereum validator proof.

The adapter reads the FullNode head and uses the SolidityNode solidified height as the reorganization floor. Ingested data is not automatically solidified. [TRON's confirmation guide](https://developers.tron.network/docs/confirmation-semantics) explains the distinction.

## Current boundaries

- A source-build Generator path is available on the integration branch.
- A TRON-specific release image, production sizing, and live end-to-end validation are not established by this guide.
- Host integration needs a compatible release that handles TRON collections, including `InternalTransfer`. A generic chain prefix alone is insufficient evidence.
- TRON Generator registration eligibility and identity proof require a confirmed Shinzo onboarding flow. Do not use Ethereum withdrawal credentials or BLS-key instructions.

## Implementation references

- [TRON configuration](https://github.com/shinzonetwork/shinzo-generator-client/blob/0df7592fcf1a18ce9fdcbe44da82d3afea9e074b/config/config_tron.yml)
- [TRON build target](https://github.com/shinzonetwork/shinzo-generator-client/blob/0df7592fcf1a18ce9fdcbe44da82d3afea9e074b/Makefile)
- [TRON fetcher and finality handling](https://github.com/shinzonetwork/shinzo-generator-client/blob/0df7592fcf1a18ce9fdcbe44da82d3afea9e074b/pkg/chains/tron/fetcher.go)
- [TRON schemas](https://github.com/shinzonetwork/shinzo-generator-client/blob/0df7592fcf1a18ce9fdcbe44da82d3afea9e074b/pkg/chains/tron/collections)
