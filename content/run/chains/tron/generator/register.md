+++
draft = true
path = "run/tron/generator/register"
aliases = ["run/chains/tron/mainnet/generator/register"]
title = "Register a Generator \u2014 TRON Mainnet"
description = "Understand what must be confirmed before registering a TRON Generator."
template = "chain-page.html"
[extra]
chain = "tron"
heading = "Register a Generator"
product = "generator"
task = "register"
+++

## Registration status

The reviewed TRON branch implements data ingestion. It does not establish a verified TRON-specific onboarding procedure for the Shinzo registry.

TRON's producer and account identity model must be mapped to Shinzo's accepted assertion format. Do not copy Ethereum's BLS consensus-key or withdrawal-address requirements, and do not assume that operating a FullNode or being a Super Representative automatically satisfies Shinzo eligibility.

## Prepare for onboarding

Retain the Generator's version, public identity, connection string, confirmed source network, and ingestion evidence. Contact [Shinzo onboarding](https://discord.shinzo.network/) for the accepted operator role, proof format, signing account, registry chain selection, and coordination environment.

Never provide a validator or account private key to the Generator or to a support request. The Generator's own persisted identity and keyring secret are separate from source-chain signing authority.

## Confirm the result

Once a supported flow is provided, verify that the registry records TRON Mainnet and your actual Generator identity and endpoint. Until then, treat the client as an integration-preview data source rather than a publicly registered participant.
