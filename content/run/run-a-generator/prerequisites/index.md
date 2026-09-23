+++
title = "Prerequisites"
aliases = [
  "/run/run-a-generator/hardware-requirements",
  "/generator/hardware-requirements",
  "/generators/hardware-requirements",
  "/generator/prerequisites",
  "/generators/prerequisites",
]
+++

This page is the starting point for running a Generator. Two kinds of prerequisites apply: the hardware the Generator client runs on, and the items you need to register it with the Shinzo Network.

## The setup flow

Setting up a Generator takes two steps:

1. [Install](../install) the Generator client next to an execution node. Any node that exposes JSON-RPC and WebSocket works: one you run yourself, one co-located with your validator, or a managed provider. You do not need to be a validator for this step.
1. [Register](../register) the client with the Shinzo Network once it is running. Registration identifies and authenticates your node so it can replicate data for the network.

You can run the client without registering, but the network does not recognize your node until you do. Registration requires an active, bonded validator on your source chain and includes an assertion step that ties your generator's operator key to your validator identity. If you are not a validator, check the [registration requirements](#registration-requirements) before you start.

## Hardware requirements

These requirements are for the Generator client itself. It runs as a sidecar next to an execution node (such as Geth), so size the machine for the node first and add the Generator overhead on top.

### Recommended hardware

Generator client hardware requirements depend on which chain the Generator reads.

#### Ethereum Mainnet

| Resource | Minimum | Recommended |
| --- | --- | --- |
| CPU | 4 cores | 8 cores |
| Memory (RAM) | 8 GB | 16 GB |
| Storage | 300 GB | 500 GB |
| Network | 100 Mbps | 1 Gbps |

With pruning enabled (the default), the Generator retains roughly the last 1,000 blocks, so its own data stays bounded at roughly 50 to 100 GB on Ethereum Mainnet. The 300 to 500 GB figures above are the recommended provisioned disk. The headroom covers growth, snapshot serving, and P2P replication. In archival mode (pruning disabled), storage grows linearly with chain history and on Ethereum Mainnet can exceed 3 TB (see the [FAQ](/run/operations/troubleshooting/) for details on growth rate). Storage growth differs by chain. See [shinzo.network/chains](https://shinzo.network/chains) for the chains Shinzo supports.

### Sizing for your execution node

The numbers above do not include the execution node. Your execution node has its own, much larger footprint: a snap-synced full node typically needs over 650 GB of fast SSD storage and at least 16 GB of RAM, and an archive node can exceed 12 TB. See your client's docs (for example, the [Geth hardware requirements](https://geth.ethereum.org/docs/getting-started/hardware-requirements)) for current guidance, and provision accordingly.

### Network

A stable connection matters more than raw bandwidth. The Generator client reads new blocks from the execution node as they arrive, so latency to that node and uptime are more important than peak throughput. 100 Mbps is enough to keep up; 1 Gbps gives headroom for serving snapshots and P2P replication to Hosts.

## Registration requirements

Registering requires an active, bonded validator on your source chain. Running the client does not. Have the following ready before you reach the [registration](../register) step:

1. **An active, bonded chain validator.** On the current testnet, the assertion is approved through an admin-key flow rather than an on-chain contract check. The planned outpost contract will verify validator status on-chain once deployed.
1. **Your validator's consensus public key.** The key type, format, and lookup tooling are chain-specific. See [Consensus public key](/reference/components/outpost#consensus-public-key) for how to retrieve it on your chain. It is not your withdrawal address or an account address.
1. **Your validator's withdrawal address.** This is included in the assertion to identify your validator. On the current testnet you only need the address itself (the assertion is admin-key-approved). The planned contract-based flow will require the withdrawal key to sign the assertion. See [Validator assertions](/reference/components/outpost#validator-assertions) for the full flow.
1. **A browser wallet** to sign the on-chain registration transaction.
