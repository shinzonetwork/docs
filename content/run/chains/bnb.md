+++
path = "run/chains/bnb/mainnet"
title = "BNB Smart Chain documentation \u2014 BNB Smart Chain Mainnet"
description = "Configure the BSC Generator and connect a Host to BSC Mainnet data."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "BNB Smart Chain documentation"
overview = true
+++

## Release scope

The Generator guide is based on source revision `8555095`, which includes `config/config_bsc.yaml`, `make start-bsc`, and the EVM adapter. This is a source-build guide; it does not assume a BSC-specific published image tag. The [November changelog](/reference/changelog/) records the BSC integration.

The Host guide targets release `v0.7.2-ethereum-mainnet`. Despite that artifact's historical name, its source accepts explicitly configured chain prefixes. BSC deployment still requires a reachable BSC Generator and a successful data check.

## BNB means BSC here

This guide covers **BNB Smart Chain Mainnet**, with EVM chain ID **56** and namespace **`BSC__Mainnet`**. Do not substitute `BNB__Mainnet`, an opBNB endpoint, or BSC testnet. [BNB's endpoint reference](https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/) identifies the source networks.

## Current boundaries

- Generator runtime configuration is present in the source.
- Generator registration eligibility and the BSC-specific assertion fields still require confirmation from Shinzo onboarding. Runtime support does not establish registration support.
- The Host release supports per-chain configuration. Snapshot bootstrap is restricted to Ethereum Mainnet, and event filtering requires a single-chain Host.
- No BSC hardware benchmark or live deployment was performed for these docs.

## Implementation references

- [BSC configuration](https://github.com/shinzonetwork/shinzo-generator-client/blob/855509506246cc84062ca306e58309854a52691c/config/config_bsc.yaml)
- [Generator build/start commands](https://github.com/shinzonetwork/shinzo-generator-client/blob/855509506246cc84062ca306e58309854a52691c/Makefile)
- [Host chain configuration](https://github.com/shinzonetwork/shinzo-host-client/blob/fa5a245ce83cb6c1e601b080ed2b18c55cec6db7/pkg/chain/config.go)
- [Host feature restrictions](https://github.com/shinzonetwork/shinzo-host-client/blob/fa5a245ce83cb6c1e601b080ed2b18c55cec6db7/config/config.go)
