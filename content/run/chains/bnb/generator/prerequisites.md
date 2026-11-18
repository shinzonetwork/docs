+++
path = "run/chains/bnb/mainnet/generator/prerequisites"
title = "Generator prerequisites \u2014 BNB Smart Chain Mainnet"
description = "Prepare a BSC Mainnet endpoint and the source-build toolchain."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Generator prerequisites"
product = "generator"
task = "prerequisites"
+++

## Source node

Use a BSC Mainnet endpoint with JSON-RPC block, transaction, and receipt access. Configure its WebSocket endpoint too; the client can continue over HTTP if the initial WebSocket dial times out after the HTTP connection succeeds. An Ethereum endpoint with a renamed chain is not a BSC endpoint.

```shell
export GETH_RPC_URL="https://your-bsc-mainnet-endpoint"
curl -fsS "$GETH_RPC_URL" \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

Expect `0x38` (56). Supply provider authentication as required. The environment variable name `GETH_RPC_URL` is historical; the BSC adapter uses it too.

## Build and machine requirements

Install Git, Make, and Go **1.27.3 or newer**, as specified by the current [build guide](https://github.com/shinzonetwork/shinzo-generator-client/blob/main/BUILD.md) and [`go.mod`](https://github.com/shinzonetwork/shinzo-generator-client/blob/main/go.mod). This is a source-build guide; no BSC-specific published image is assumed.

The supplied BSC configuration budgets resources around a 16 GB machine, including a 10,240 MiB P2P memory budget and 8,192 file descriptors. The process file-descriptor limit must be at least 8,192. That is a configuration assumption, not a measured minimum or throughput guarantee. If using a smaller machine, adjust the database caches and P2P resource budget together. The source node requires separate capacity.

Use a dedicated working directory, persistent storage, a stable `DEFRADB_KEYRING_SECRET`, and a schema token. BSC retention is configured in blocks; do not reuse Ethereum's blocks-to-hours estimates.

## Network registration

Installation is documented independently of registry eligibility. Confirm BSC-specific operator eligibility and assertion inputs before attempting [registration](../register/).
