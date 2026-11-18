+++
path = "run/chains/bnb/mainnet/generator/register"
title = "Register a Generator \u2014 BNB Smart Chain Mainnet"
description = "Separate BSC ingestion from approval to join the Shinzo registry."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Register a Generator"
product = "generator"
task = "register"
+++

## Registration status

BSC runtime configuration is present in the reviewed Generator source. A complete BSC-specific registry eligibility and assertion procedure has not been verified for this documentation revision.

Do not submit Ethereum validator keys or withdrawal-address instructions by analogy. BSC operator identity and the accepted proof must match the live Shinzo onboarding flow.

## Prepare the onboarding details

Collect the source network (BNB Smart Chain Mainnet, ID 56), Generator version, DID/public identity, reachable connection string, and successful ingestion checks. Retain the persistent identity keys and secret.

Ask [Shinzo onboarding](https://discord.shinzo.network/) to confirm the accepted operator role, consensus identity representation, assertion authority, and BSC availability in the registry. The [shared registration page](/run/run-a-generator/register/) explains the current Ethereum-oriented process; it is not a verified BSC walkthrough.

## After the flow is confirmed

Register against the designated ShinzoHub environment, then verify that the registry entry identifies BSC Mainnet and your actual Generator endpoint. Running the Generator and connecting a Host directly can be evaluated separately from public registry onboarding.
