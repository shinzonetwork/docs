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

Use a BSC Mainnet endpoint with JSON-RPC block, transaction, and receipt access. WebSocket access is useful where your provider supports it. An Ethereum endpoint with a renamed chain is not a BSC endpoint.

```shell
export GETH_RPC_URL="https://your-bsc-mainnet-endpoint"
curl -fsS "$GETH_RPC_URL" -H 'Content-Type: application/json'   --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

Expect `0x38` (56). Supply provider authentication as required. The environment variable name `GETH_RPC_URL` is historical; the BSC adapter uses it too.

## Build and machine requirements

Install Git, Make, a C toolchain for CGO, and the Go version required by the pinned revision's `go.mod` (1.27.3 for this source revision). See the [build dependencies](https://github.com/shinzonetwork/shinzo-generator-client/blob/855509506246cc84062ca306e58309854a52691c/Dockerfile).

The supplied BSC configuration budgets resources around a 16 GB machine. That is a configuration assumption, not a measured minimum or throughput guarantee. If using a smaller machine, adjust the database caches and P2P resource budget together. The source node requires separate capacity.

Use a dedicated working directory, persistent storage, a stable `DEFRADB_KEYRING_SECRET`, and a schema token. BSC retention is configured in blocks; do not reuse Ethereum's blocks-to-hours estimates.

## Network registration

Installation is documented independently of registry eligibility. Confirm BSC-specific operator eligibility and assertion inputs before attempting [registration](../register/).
