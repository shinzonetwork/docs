+++
path = "run/bnb/host/prerequisites"
aliases = ["run/chains/bnb/mainnet/host/prerequisites"]
title = "Host prerequisites \u2014 BNB Smart Chain Mainnet"
description = "Prepare a Host that serves BNB Smart Chain Mainnet collections."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Host prerequisites"
product = "host"
task = "prerequisites"
+++

## What you need

- Docker on an x86-64 machine, or a compatible source-build environment. The documented release image is `linux/amd64`; ARM emulation is not a production sizing recommendation.
- A reachable **BNB Smart Chain Generator**, its HTTP API base URL, and its full P2P multiaddr including Peer ID.
- A schema access token if the Generator uses token authentication.
- Persistent storage and a stable `DEFRA_KEYRING_SECRET`. The Host variable uses `DEFRA_`, while Generator uses `DEFRADB_`.

The Host does not require an Ethereum, BSC, or TRON source-node RPC connection. It receives data from Generators. For BNB Smart Chain, verify the namespace is `BSC__Mainnet`.

## Capacity and connectivity

No BSC-specific Host sizing benchmark is provided here. Size against the selected data volume, Views, database growth, retention, and P2P workload. Ethereum hardware figures are not a measured BSC minimum.

Allow the Host to reach the Generator's HTTP/schema endpoint and P2P port. Use a reachable host or DNS name, not the Generator container's loopback address. Obtain the Peer ID from the Generator's `/health` response.

## Release boundaries

These steps target `v0.7.2-ethereum-mainnet`. Its chain configuration supports explicit prefixes. Keep Host snapshot bootstrap disabled: the release permits it only for Ethereum Mainnet. Event filtering is restricted to a single-chain Host; this guide starts with filtering disabled.

See the [release configuration checks](https://github.com/shinzonetwork/shinzo-host-client/blob/fa5a245ce83cb6c1e601b080ed2b18c55cec6db7/config/config.go) for the enforced restrictions.
