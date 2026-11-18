+++
path = "run/chains/bnb/mainnet/host/register"
title = "Register a Host \u2014 BNB Smart Chain Mainnet"
description = "Register the Host identity after verifying BNB Smart Chain ingestion."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Register a Host"
product = "host"
task = "register"
+++

## Verify the data first

Confirm the Host has the `BSC__Mainnet` schema and receives advancing data from the intended Generators. Registration cannot repair a wrong prefix, missing schema token, or unreachable peer.

## Register on ShinzoHub

The shared [Host registration guide](/run/run-a-host/register/) covers the hosted app, local app, and CLI options. Register against the designated **Shinzo testnet**, not BSC chain ID 56. Have a wallet funded with testnet SHNZ for the registry transaction.

Use the Host's public identity and reachable connection string. Generator validator assertions are a different flow and are not Host prerequisites.

## Confirm and preserve

Verify that the registry entry resolves to your Host identity and endpoint, and that health and data checks succeed externally as appropriate for your deployment. Back up the mounted `data` directory and stable keyring secret. If a source is not available in the onboarding UI, contact [Shinzo onboarding](https://discord.shinzo.network/) instead of selecting Ethereum to bypass the missing option.

A Host can configure more than one source prefix in this release, but that does not by itself specify additional registry transactions. Confirm the intended registration scope before changing a registered multi-chain deployment.
