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

# Indexer Configuration
INDEXER_START_HEIGHT=<pick_a_starting_block> # recommended 23000000
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

To check the health status and uptime data, you can visit here: http://localhost:8080/health

> On running `make stop` command, it will shut down the client and DefraDB and all data will be saved to the configured storage location.


**OpenAPI / REST API**

The indexer also exposes an OpenAPI-compatible REST endpoint for basic health and operational checks:

Health Check:

```bash
http://localhost:8080/health
```

:::tip
⚠️ Security Recommendation
The GraphQL and REST endpoints are intended for local or private-network access only. Shinzo Hosts are expected to expose necessary public data, so you should NOT directly expose your indexer’s APIs to the public internet. Ensure proper firewall rules or private networking when deploying in production.
:::

## ShinzoHub Registration

To participate in the Shinzo Network, you must register your indexer. Registration identifies and authenticates your node so it can replicate data and earn rewards. Without this step, your indexer will not be recognized by the network. To register your indexer in ShinzoHub, follow the steps below:

1. Start your Indexer
2. Add Shinzo Devnet to Metamask with the following values:
  - Network name: Shinzo
  - Default RPC URL: http://shinzohub-rpc.infra.source.network:8545
  - Chain ID: 9000
  - Currency symbol: SHN
3. Open the [registration route](http://localhost:8080/registration)
4. Copy the required fields under registration `message`, `public_key`, `signed_pk_message`, `peer_id` and `signed_peer_message`

```bash
"registration": {
    "enabled": true,
    "message": "0x5368696e7a6f204e6574776f726b20496e646578657220726567697374726174696f6e",
    "defra_pk_registration": {
        "public_key": "0x02cea33c883fe893a277ef7637efbc844638d78a595e1776e7e30263631be798e3",
        "signed_pk_message": "0x3045022100c210e58b0547d7ed236cacc395c424a866b941422632e8d28f714ca7a0e6baa302201e94c77ac2124a21a62921bc28c909beaf4c8c3b03072c03d58853b12ea10f05"
    },
    "peer_id_registration": {
        "peer_id": "0xe02a3d4bd4b735aade91f5bcda664c446ecc44a5edfd8f6a45e49ac0bde4c2f6",
        "signed_peer_message": "0x0f926a1f832ca9b79581bdee22cc74c60099460ff6a75616f763cb1a1dd5508a184bf45efd7f25c048d60347ad99b19dd652c278f4b9c808eabe64c15e9f7201"
    }
}
```
5. Go to [register.shinzo.network](https://register.shinzo.network), connect your wallet, click register, and fill in the copied fields from the previous step
6. Submit your registration. In the metamask popup, click the edit icon in Network fee, then click **Advanced**. Set `Max base fee` to 0. Click **Edit** by `Gas limit` and set this to the max allowed, which should be 35000000. Click **Save** and then **Confirm**. After a few seconds you should see a successful registration toast at the top of the page!

**🎉 Your indexer is now successfully registered and fully authorized to participate in the Shinzo Network.**

## Need Help?

If you encounter any issues while installing or running the Shinzo Indexer, please let us know by opening a GitHub issue here: https://github.com/shinzonetwork/shinzo-indexer-client/issues