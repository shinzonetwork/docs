---
title: Quick Start
sidebar_label: Quick Start
sidebar_position: 2
description: Instructions for installing and running the Shinzo Indexer
---

The Shinzo Indexer is the entry point into the Shinzo Network. It is a lightweight Go client that runs as a sidecar in your validator environment and reads from an Ethereum node you already operate or have access to.

The indexer is not an RPC node. It does not replace your execution client (Geth, Reth, Nethermind, etc.), and it does not serve JSON-RPC. It consumes RPC and WebSocket endpoints from an upstream node, sorts the responses into the appropriate collection types, and writes them into a local DefraDB instance. Running the indexer lets a validator earn an additional reward for sorting and storing blocks with Shinzo.

## Hardware recommendations

| Component | Minimum | Recommended |
| --- | --- | --- |
| CPU | 8 vCPUs | 16 vCPUs |
| Memory (RAM) | 16 GB | 32–64 GB |
| Storage | 3 TB NVMe | 4+ TB NVMe |
| OS | Ubuntu 24.04 | Ubuntu 24.04 |

## Prerequisites

- Go 1.25 or higher. You can download the latest version from [the Go site](https://go.dev/doc/install).
- Access to an Ethereum execution node that exposes JSON-RPC and WebSocket. The indexer does not run a node for you; it reads from one. This can be a node you run yourself, a node co-located with your validator, or a managed provider (GCP Managed Blockchain Node works well).
- Metamask with a wallet setup. This wallet does not need to hold any funds.

## One-step cloud setup

You can run the indexer with the following commands. Replace `<YOUR_RPC_URL>`, `<YOUR_WS_URL>`, and `<YOUR_API_KEY>` with the endpoints of the upstream Ethereum node you want the indexer to read from. These are not endpoints the indexer creates; they belong to your existing node or managed provider.


```bash
#!/bin/bash
set -e

# Install Docker
echo "Installing Docker..."
sudo apt-get update
sudo apt-get install -y docker.io


echo "🛑 Stopping existing container if running..."
sudo docker stop shinzo-indexer || true
sudo docker rm shinzo-indexer || true

# INDEXER
sudo mkdir -p /mnt/defradb-data/logs
sudo chown -R 1001:1001 /mnt/defradb-data

# STANDARD SETUP (NON BRANCHABLE)
docker pull ghcr.io/shinzonetwork/shinzo-indexer-client:latest

sudo docker run -d --network host --name shinzo-indexer   --restart unless-stopped   -e GETH_RPC_URL="<YOUR_RPC_URL>"   -e GETH_WS_URL="<YOUR_WS_URL>"   -e GETH_API_KEY="<YOUR_API_KEY>"   -e INDEXER_START_HEIGHT=23900000   -e DEFRADB_KEYRING_SECRET="pingpong"   -v /mnt/defradb-data:/app/.defra   -v /mnt/defradb-data/logs:/app/logs   -p 8080:8080   -p 9171:9171  ghcr.io/shinzonetwork/shinzo-indexer-client:latest
```

Check that the container is running by hitting the metrics endpoint:

```bash
curl http://localhost:8080/metrics
```

## Installation

If you are on Linux, install the native build toolchain first:

```bash
sudo apt-get update
sudo apt-get install -y build-essential pkg-config
```

Then:

1. Clone the repository.

   ```bash
   git clone https://github.com/shinzonetwork/shinzo-indexer-client.git
   cd shinzo-indexer-client
   ```

1. Install Go dependencies.

   ```bash
   go mod download
   ```

1. Create a `.env` file with the environment variables below. The `GETH_*` values point at the upstream Ethereum node you want the indexer to read from; they are not endpoints the indexer creates.

```bash
# Upstream Ethereum execution node the indexer reads from.
# This is your own node or a managed provider. The indexer does not run one.
GETH_RPC_URL=<your-upstream-rpc-url>
GETH_WS_URL=<your-upstream-ws-url>
GETH_API_KEY=<your-upstream-api-key>    # Optional, only if the upstream node requires authentication

# DefraDB Configuration
DEFRADB_URL=                            # Keep it empty for embedded DefraDB
DEFRADB_KEYRING_SECRET=<pick_a_password>

# DEFRADB_PLAYGROUND=true
# DEFRADB_P2P_ENABLED=true
# DEFRADB_P2P_BOOTSTRAP_PEERS=[]
# DEFRADB_P2P_LISTEN_ADDR="/ip4/127.0.0.1/tcp/9171"

# Indexer Configuration (recommended 23000000)
INDEXER_START_HEIGHT=<pick_a_starting_block>
```

:::tip 
Note
The indexer needs to know how to reach an upstream Ethereum execution node. It does not run one. The variables are named `GETH_*` for historical reasons, but they accept the RPC and WebSocket URL of any standard Ethereum execution client (Geth, Reth, Nethermind, Erigon) or managed provider.

```bash
GETH_RPC_URL=
GETH_WS_URL=
GETH_API_KEY= # optional, only if your node requires authentication
```

For each new block, the indexer queries this upstream node, sorts the response into the appropriate collection types (blocks, transactions, logs, access list entries), and writes it to its local DefraDB. If you are running an execution client on the same machine, use that node's RPC and WebSocket URLs. If you are using a remote or managed node, use those endpoint URLs and the API key, if authentication is required.
:::

## Network configuration

The indexer uses P2P networking over port `9171`. Make sure this port is open and accessible in all production deployments.

If you plan to use the GraphQL API, open port `9181` as well. This is the indexer's read interface, not an Ethereum JSON-RPC endpoint.

## Running locally

To run the indexer locally, you have two options.

### Using Makefile

```bash
# Build the indexer
make build

# Start the indexer
make start
```

### Using Docker

```bash
# Build and run with Docker Compose
docker-compose up --build
```

Once you run `make start`, the client begins writing block data into the configured DefraDB instance.

`make stop` shuts down the client and DefraDB. Data is saved to the configured storage location.

### OpenAPI and REST endpoint

The indexer exposes an OpenAPI-compatible REST endpoint for basic health and operational checks at http://localhost:8080/health. This is for monitoring the indexer itself; it is not a JSON-RPC endpoint.

:::tip 
Security recommendation
The GraphQL and REST endpoints are intended for local or private-network access only. Shinzo Hosts are the layer expected to expose public data, so you should not expose your indexer's APIs directly to the public internet. Use proper firewall rules or private networking when deploying in production.
:::

## ShinzoHub registration

To participate in the Shinzo Network, you must register your indexer. Registration identifies and authenticates your node so it can replicate data and earn rewards. Without this step, your indexer will not be recognized by the network. To register your indexer in ShinzoHub, follow the steps below.

1. Start your indexer.
1. Add Shinzo Devnet to Metamask with the following values:
   - Network name: Shinzo
   - Default RPC URL: http://rpc.devnet.shinzo.network:8545
   - Chain ID: 91273002
   - Currency symbol: SHN
1. Open the [registration route](http://localhost:8080/registration-app), connect your wallet, and share your wallet address in the Shinzo Discord channel to request whitelisting as an Indexer.
1. Once your address has been whitelisted, return to the registration page, click Register, and select "Indexer" as your role.
1. Submit your registration, then confirm the transaction in MetaMask. You should see a successful registration notification.

Your indexer is now registered and authorized to participate in the Shinzo Network.

## Need help

If you run into issues installing or running the Shinzo Indexer, open a GitHub issue at the [shinzo-indexer-client repository](https://github.com/shinzonetwork/shinzo-indexer-client/issues).
