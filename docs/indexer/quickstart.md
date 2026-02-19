---
title: Quick Start
sidebar_label: Quick Start
sidebar_position: 2
description: Instructions for installing and running the Shinzo Indexer
---

The **Shinzo Indexer** is the entry point into the Shinzo Network. The indexer is a client built with golang allowing a validator of any network to earn an additional reward for sorting and storing blocks with Shinzo.

## Hardware Recommendations

| Component | Minimum | Recommended |
| --- | --- | --- |
| CPU | 8 vCPUs | 16 vCPUs |
| Memory (RAM) | 16 GB | 32–64 GB |
| Storage | 3 TB NVMe | 4+ TB NVMe |
| OS | Ubuntu 24.04 | Ubuntu 24.04 |

## Prerequisites

- Make sure to have minimum Go version 1.24 or higher. You can download the latest Go verion from [here](https://go.dev/doc/install).
- Running Ethereum node with JSON-RPC and WebSocket access (GCP Managed Blockchain Node recommended).
- Metamask with a wallet setup. This wallet does not need to hold any funds.

## One-Step Cloud Setup

You can run the indexer with the following commands. Be sure to replace **"&lt;YOUR_RPC_URL&gt;", "&lt;YOUR_WS_URL&gt;", and "&lt;YOUR_API_KEY&gt;"** before running.


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
docker pull ghcr.io/shinzonetwork/shinzo-indexer-client:sha-8701915

sudo docker run -d --network host --name shinzo-indexer   --restart unless-stopped   -e GETH_RPC_URL="<YOUR_RPC_URL>"   -e GETH_WS_URL="<YOUR_WS_URL>"   -e GETH_API_KEY="<YOUR_API_KEY>"   -e INDEXER_START_HEIGHT=23900000   -e DEFRADB_KEYRING_SECRET="pingpong"   -v /mnt/defradb-data:/app/.defra   -v /mnt/defradb-data/logs:/app/logs   -p 8080:8080   -p 9171:9171  ghcr.io/shinzonetwork/shinzo-indexer-client:sha-8701915
```

To ensure this is running properly, you can test it by checking the metrics endpoint.

```bash
curl http://localhost:8080/metrics
```

## Installation

0. If using Linux, install the native build toolchain:

```bash
sudo apt-get update
sudo apt-get install -y build-essential pkg-config
```

1. Clone the repository:

```bash
git clone https://github.com/shinzonetwork/shinzo-indexer-client.git
cd shinzo-indexer-client
```

2. Install Go dependencies:

```bash
go mod download
```

3. Once all the dependencies are installed, create a `.env` file which will have all the environment variables. You can copy and paste the below content in your `.env` file

```bash
GETH_RPC_URL=<your-geth-node-url>
GETH_WS_URL=<your-geth-ws-url>
GETH_API_KEY=<your-geth-api-key>        # Optional only if Geth has authentication

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

:::tip Note
The indexer requires the following GETH configuration values to run:

```bash
GETH_RPC_URL=
GETH_WS_URL=
GETH_API_KEY= # optional if Geth has authentication
```

These three keys are necessary for the indexer to function. The indexer queries the Geth node for each block, sorts the data into the appropriate collection types, and stores it in its local Defra instance.
If you are running Geth locally, use your local node's RPC and WebSocket URLs.
If you are using a deployed or remote Geth node, replace these values with the correct endpoint URLs and API key (if authentication is required).
:::

## Network Configuring

The system uses P2P networking over port `9171`. Make sure this port is open and accessible in all production deployments.

Optional: If you plan to use the GraphQL API, open port `9181` as well.

## Running Locally

To run the indexer locally, we have two options:

### Using Makefile (Recommended)

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

Once you start the client using `make start` command, it will begin submitting block data to the configured DefraDB instance.

> Running `make stop` command will shut down the client and DefraDB and all data will be saved to the configured storage location.

**OpenAPI / REST API**

The indexer also exposes an OpenAPI-compatible REST endpoint for basic health and operational checks, which you can visit here: http://localhost:8080/health

:::tip
⚠️ Security Recommendation
The GraphQL and REST endpoints are intended for local or private-network access only. Shinzo Hosts are expected to expose necessary public data, so you should NOT directly expose your indexer’s APIs to the public internet. Ensure proper firewall rules or private networking when deploying in production.
:::

## ShinzoHub Registration

To participate in the Shinzo Network, you must register your indexer. Registration identifies and authenticates your node so it can replicate data and earn rewards. Without this step, your indexer will not be recognized by the network. To register your indexer in ShinzoHub, follow the steps below:

1. Start your Indexer
2. Add Shinzo Devnet to Metamask with the following values:
  - Network name: Shinzo
  - Default RPC URL: http://rpc.devnet.shinzo.network:8545
  - Chain ID: 91273002
  - Currency symbol: SHN
3. Open the [registration route](http://localhost:8080/registration-app), connect your wallet and share your wallet address in the Shinzo Discord channel to request whitelisting as an Indexer.
4. Once your address has been whitelisted, return to the registration page, click Register, and select "Indexer" as your role to complete the process.
5. Submit your registration, then confirm the transaction in MetaMask. You should see a successful registration notification.

**🎉 Your indexer is now successfully registered and fully authorized to participate in the Shinzo Network.**

## Need Help?

If you encounter any issues while installing or running the Shinzo Indexer, please let us know by opening a GitHub issue [here](https://github.com/shinzonetwork/shinzo-indexer-client/issues).
