+++
path = "run/chains/bnb/mainnet"
title = "BNB Smart Chain Mainnet"
description = "Run a Generator to publish BNB Smart Chain data, or connect a Host to serve it."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "BNB Smart Chain"
overview = true
generator_summary = "Connect a BSC Mainnet node and publish signed chain data."
host_summary = "Connect to a BSC Generator and serve its data to applications."
host_cta = "Start Host setup"
+++

## Before you start

A Generator needs a BSC Mainnet JSON-RPC and WebSocket endpoint and uses the [BSC configuration](https://github.com/shinzonetwork/shinzo-generator-client/blob/main/config/config_bsc.yaml). A Host needs a reachable BSC Generator, its P2P identity, and a schema token; it does not need its own BSC node.

BSC-specific Generator registration eligibility and proof are still being confirmed. You can install the Generator and verify data flow before public registry onboarding.
