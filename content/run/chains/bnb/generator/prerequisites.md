+++
path = "run/bnb/generator/prerequisites"
aliases = ["run/chains/bnb/mainnet/generator/prerequisites"]
title = "Generator prerequisites — BNB Smart Chain Mainnet"
description = "Prepare a BSC Mainnet node, a machine for the Generator, and the credentials needed to start indexing."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Generator prerequisites"
product = "generator"
task = "prerequisites"
+++

The Generator reads BNB Smart Chain (BSC) Mainnet from a JSON-RPC endpoint, writes chain data to its local DefraDB, and makes that data available to Hosts. You can run it without registering it; registration controls discovery through the Shinzo network.

## The setup flow

1. Prepare a BSC Mainnet node or provider endpoint and capacity for the Generator.
1. [Install and configure](/run/bnb/generator/install/) the EVM Generator with `config/config_bsc.yaml`.
1. [Verify ingestion](/run/bnb/generator/verify/) before connecting a Host or requesting registration.
1. [Register](/run/bnb/generator/register/) when BSC operator onboarding is available for your role.

## BSC source node

You need HTTP JSON-RPC and preferably WebSocket access to **BSC Mainnet**. The Generator reads blocks and transaction receipts from this endpoint; it does not run a source node for you. A node you operate or a managed provider can work if it supplies the required methods and enough request capacity for receipt fetching.

Check the chain ID before installing. Supply your provider's authentication headers if required:

```shell
curl -fsS https://your-bsc-mainnet-rpc.example \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

The result must be `0x38` (decimal `56`). Also check that the endpoint supports `eth_getBlockByNumber` and `eth_getTransactionReceipt`. The `GETH_*` environment variable names used in the config are historical; enter your **BSC** endpoints in them. The WebSocket endpoint helps the client follow the chain head. If its initial connection fails while HTTP is available, the client can use HTTP polling.

## Generator machine

Install Git, Make, and **Go 1.27.3 or newer** for the [source build](https://github.com/shinzonetwork/shinzo-generator-client/blob/main/BUILD.md). The BSC guide uses a source build because it does not rely on a published BSC container image.

The [supplied BSC config](https://github.com/shinzonetwork/shinzo-generator-client/blob/main/config/config_bsc.yaml) is sized around a **16 GB machine**: it reserves 10,240 MiB for the P2P resource manager and specifies 8,192 file descriptors. Run with a process file-descriptor limit of at least 8,192. If the Generator shares a machine with the source node, size the machine for both workloads; the BSC node's storage and memory are separate from the Generator's.

| Resource | Starting point for this config |
| --- | --- |
| Memory | 16 GB allocation with `GOMEMLIMIT=14GiB`; resize the P2P budget if you change the allocation. |
| Open file descriptors | At least 8,192 for the Generator process. |
| CPU and network | Size against your node's block and receipt rate, Host connections, and observed backlog. No BSC-specific minimum has been measured for this guide. |
| Disk | Persistent, monitored storage for DefraDB, snapshots, and identity keys. Provision from observed usage; no fixed BSC capacity is established here. |

Use persistent disk for the DefraDB store (`./.defra-bsc` by default), snapshots (`./.defra-bsc/snapshots`), and identity keys. The amount of disk required depends on data volume and how long you retain it. The supplied config prunes after **16,000 BSC blocks** and keeps up to **200 snapshots of 100 blocks each**. Monitor actual disk use before choosing a capacity; these settings are not a measured storage minimum.

Before starting, prepare:

- A stable `DEFRADB_KEYRING_SECRET` that you will retain across restarts.
- At least one `SCHEMA_API_KEYS` token for the authenticated schema endpoint used by Hosts.
- A reachable P2P port (`9171` in the supplied config) if Hosts will connect to this Generator.
- A plan to back up the identity keys and secrets. Losing them changes the Generator's identity.

## Registration

The BSC-specific operator role and validator assertion requirements have not been confirmed. You can install and verify the Generator without registration. See [Register a Generator](/run/bnb/generator/register/) before attempting registry onboarding.
