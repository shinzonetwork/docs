+++
path = "run/bnb/generator/register"
aliases = ["run/chains/bnb/mainnet/generator/register"]
title = "Register a Generator — BNB Smart Chain Mainnet"
description = "Prepare a verified BSC Generator for Shinzo network onboarding."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Register a Generator"
product = "generator"
task = "register"
+++

Registration makes a Generator discoverable through the Shinzo network. It is separate from [installing and checking](/run/bnb/generator/install/#confirm-bsc-ingestion) the client. An unregistered Generator can still be tested with a directly connected Host.

## BSC registration status

The BSC Generator runtime is configured in the [client repository](https://github.com/shinzonetwork/shinzo-generator-client/blob/main/config/config_bsc.yaml), but the BSC-specific operator eligibility, validator proof, and assertion steps have **not yet been confirmed**. Do not submit a registration based on another chain's identity or signing instructions.

Before attempting registry onboarding, ask [Shinzo support](https://discord.shinzo.network/) to confirm:

1. Whether BSC Mainnet Generator registration is open in the intended ShinzoHub environment.
1. Which BSC operator role is eligible and what proof or assertion is accepted.
1. Which wallet and on-chain transaction, if any, the current flow requires.
1. How the registry identifies the BSC source chain and your Generator's P2P endpoint.

This page will provide the exact BSC registration steps once those details are confirmed.

## Information to have ready

- The BSC Mainnet source chain (chain ID `56`) and a successful [ingestion check](/run/bnb/generator/install/#confirm-bsc-ingestion).
- The running Generator's version, DID or public identity, Peer ID, and reachable connection address.
- Secure backups of the DefraDB identity keys and the unchanged `DEFRADB_KEYRING_SECRET`.
- Access to the wallet and proof that Shinzo support confirms for BSC onboarding.

After registration, check that the registry entry identifies **BSC Mainnet** and your actual Generator endpoint. A registration record is not a substitute for checking that new BSC blocks continue to arrive.
