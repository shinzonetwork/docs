---
title: Quick Start
sidebar_label: Quick Start
sidebar_position: 2
description: Instructions for installing and running the Shinzo Indexer
---

The **Shinzo Indexer** is the entry point into the Shinzo Network. The indexer is a client built with golang allowing a validator of any network to earn an additional reward for sorting and storing blocks with Shinzo.

## Prerequisites

- Make sure to have minimum Go version 1.24 or higher. You can download the latest Go verion from [here](https://go.dev/doc/install).
- Running Ethereum node with JSON-RPC and WebSocket access (GCP Managed Blockchain Node recommended).

## Installation

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

## Querying the Indexer

Once the indexer is running, you can query the stored blockchain data through the built-in APIs. The indexer exposes the following interfaces:

**GraphQL API (Playground Included)**

The indexer provides a GraphQL endpoint with an optional in-browser GraphQL Playground for interactive development.

GraphQL Endpoint: http://localhost:9181/api/v0/graphql

**GraphQL Playground:**

To enable the interactive GraphQL playground, set the following in your `.env` file:

```bash
DEFRADB_PLAYGROUND=true
```

Once enabled, access the playground at: http://localhost:9181/api/v0/playground

This UI allows you to explore all available queries, run test requests, and inspect schema documentation.

Example Query:

```bash
{
  Block(filter: { number: { _eq: 18100003 } }) {
    hash
    number
    transactions {
      hash
      value
      gasPrice
      accessList {
        address
        storageKeys
      }
      logs {
        logIndex
        data
        address
        topics
      }
    }
  }
}
```

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
2. Open the [registration route](http://localhost:8080/registration)
3. Copy the required fields under registration `message`, `public_key`, `signed_pk_message`, `peer_id` and `signed_peer_message`

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

4. Install Foundry forge to use cast from https://getfoundry.sh/introduction/installation/
5. Complete this script and `run`

    ```bash
    #!/usr/bin/env bash
    set -euo pipefail

    RPC_URL="http://34.29.171.79:8545"
    FROM_ADDR="0x..."
    PRECOMPILE_ADDR="0x0000000000000000000000000000000000000211"
    GAS_HEX="0x100000"
    ENTITY=1

    PEER_PUB="0x..."
    PEER_SIG="0x..."

    NODE_PUB="0x..."
    NODE_SIG="0x..."

    # "Shinzo Network Indexer registration" in hex, starting with 0x
    MESSAGE="0x..."

    PRIVATE_KEY="0x..."

    cast send "$PRECOMPILE_ADDR" \
      "register(bytes,bytes,bytes,bytes,bytes,uint8)" \
      "$PEER_PUB" \
      "$PEER_SIG" \
      "$NODE_PUB" \
      "$NODE_SIG" \
      "$MESSAGE" \
      "$ENTITY" \
      --rpc-url "$RPC_URL" \
      --from "$FROM_ADDR" \
      --private-key "$PRIVATE_KEY" \
      --gas-limit "$GAS_LIMIT"

    ```

**🎉 Your indexer is now successfully registered and fully authorized to participate in the Shinzo Network.**

## Need Help?

If you encounter any issues while installing or running the Shinzo Indexer, please let us know by opening a GitHub issue here: https://github.com/shinzonetwork/shinzo-indexer-client/issues