---
title: Quick Start
sidebar_label: Quick Start
sidebar_position: 2
description: Instructions for installing and running the Shinzo Indexer
---

The Shinzo Indexer is the entry point into the Shinzo Network. It is a lightweight Go client that runs as a sidecar in your validator environment and reads from an Ethereum node you already operate or have access to.

The indexer is not an RPC node. It does not replace your execution client (Geth, Reth, Nethermind, etc.), and it does not serve JSON-RPC. It consumes RPC and WebSocket endpoints from an upstream node, sorts the responses into the appropriate collection types, and writes them into a local DefraDB instance. Running the indexer lets a validator earn an additional reward for sorting and storing blocks with Shinzo.

## Install 

### Hardware recommendations

| Component | Minimum | Recommended |
| --- | --- | --- |
| CPU | 8 vCPUs | 16 vCPUs |
| Memory (RAM) | 16 GB | 32–64 GB |
| Storage | 3 TB NVMe | 4+ TB NVMe |
| OS | Ubuntu 24.04 | Ubuntu 24.04 |

### Prerequisites

- Docker
- Access to an Ethereum execution node that exposes JSON-RPC and WebSocket. The indexer does not run a node for you; it reads from one. This can be a node you run yourself, a node co-located with your validator, or a managed provider (GCP Managed Blockchain Node works well).
- Metamask with a wallet setup. This wallet does not need to hold any funds.

### Steps

1. Pull the pre-built indexer image from the Shinzo container registry.

    ```shell
    docker pull ghcr.io/shinzonetwork/shinzo-indexer-client:standard
    ```

1. Gather your Geth node's:

    - RPC URL
    - WebSocket URL
    - API key (if set)

1. Start the indexer by filling in your details and running:

    ```shell
    docker run --rm \
      -e GETH_RPC_URL={{ YOUR RPC URL }}:8080 \
      -e GETH_WS_URL={{ YOUR WEBSOCKET URL }}:8080 \
      -e GETH_API_KEY={{ YOUR API KEY }} \
      -e INDEXER_START_HEIGHT=0 \
      -e DEFRADB_KEYRING_SECRET=devnet-secret \
      -e DEFRADB_PLAYGROUND=true \
      -e DEFRADB_P2P_ENABLED=true \
      -e DEFRADB_P2P_LISTEN_ADDR=/ip4/0.0.0.0/tcp/9174 \
      -e LOGGER_DEBUG=true \
      -p 9181:9181 \
      -p 9171:9171 \
      -p 8080:8080 \
      ghcr.io/shinzonetwork/shinzo-indexer-client:standard
    ```

You should see the indexer connect to Geth, index block 0, and then wait for new blocks:

```output
INFO    No existing blocks, starting from 0 (chain tip: 0)
INFO    Starting indexer - will process latest blocks from Geth http://YOUR_VM_IP:8545
DEBUG   Block 0: block sig created, 1 CIDs (expected ~1), merkle: ab188cf26947bb53, verified: true
INFO    Committed block 0 (ID: bae-5dda79eb-b0eb-539b-83c5-5c73ab2b8d0d)
INFO    Block 1 not available yet, waiting...
[...]
```

## Network configuration

The indexer uses P2P networking over port `9171`. Make sure this port is open and accessible in all production deployments.

If you plan to use the GraphQL API, open port `9181` as well. This is the indexer's read interface, not an Ethereum JSON-RPC endpoint.

## ShinzoHub registration

To participate in the Shinzo Network, you must register your indexer. Registration identifies and authenticates your node so it can replicate data and earn rewards. Without this step, your indexer will not be recognized by the network. To register your indexer in ShinzoHub, follow the steps below.

1. Start your indexer.
1. Add Shinzo Devnet to Metamask with the following values:
   - Network name: `Shinzo`
   - Default RPC URL: `http://rpc.devnet.shinzo.network:8545`
   - Chain ID: `91273002`
   - Currency symbol: `SHNZ`
1. Open the [registration route](http://localhost:8080/registration-app), connect your wallet, and share your wallet address in the Shinzo Discord channel to request whitelisting as an Indexer.
1. Once your address has been whitelisted, return to the registration page, click Register, and select "Indexer" as your role.
1. Submit your registration, then confirm the transaction in MetaMask. You should see a successful registration notification.

Your indexer is now registered and authorized to participate in the Shinzo Network.

:::tip 
**Back up your `node-identity-key`**

This key defines your indexer’s identity on the network. Persisting it ensures your node can be restored without losing identity.

- Store a secure backup of the key
- In a recovery scenario, place it back into the same path (e.g. /defra/keys)
- Use the same keyring/secret configuration

Failing to back up this key means the node cannot be restored with the same identity.
:::
