---
title: Quick Start
sidebar_label: Quick Start
sidebar_position: 2
description: Run a Shinzo Host to transform blockchain data into verifiable Views
---

Hosts transform raw blockchain data into structured **Views** and contribute to network security by producing **Attestation Records**. This quick start guide walks you through installing, configuring, and running the Shinzo Host Client.

## Hardware Recommendations

| Component | Minimum | Recommended |
| --- | --- | --- |
| CPU | 8 vCPUs | 16 vCPUs |
| Memory (RAM) | 16 GB | 32–64 GB |
| Storage | 3 TB NVMe | 4+ TB NVMe |
| OS | Ubuntu 24.04 | Ubuntu 24.04 |

## 0. One-Step Cloud Setup

You can run the host with the following commands.

```bash
#!/bin/bash
set -e

# Install Docker
echo "Installing Docker..."
sudo apt-get update
sudo apt-get install -y docker.io


echo "🛑 Stopping existing container if running..."
sudo docker stop shinzo-host || true
sudo docker rm shinzo-host || true

# HOST
sudo mkdir -p ~/data/defradb ~/data/lens
sudo chown -R 1001:1001 ~/data/defradb ~/data/lens
curl -L -o ~/config.yaml \
  https://raw.githubusercontent.com/shinzonetwork/shinzo-host-client/main/config.yaml

# NON BRANCHABLE HOST

sudo docker pull ghcr.io/shinzonetwork/shinzo-host-client:sha-ddfead9
sudo docker run -d \
  --name shinzo-host \
  --network host \
  -v ~/data/defradb:/app/.defra/data \
  -v ~/data/lens:/app/.lens \
  -v ~/config.yaml:/app/config.yaml:ro \
  -e DEFRA_URL=0.0.0.0:9181 \
  -e LOG_LEVEL=error \
  -e LOG_SOURCE=false \
  -e LOG_STACKTRACE=false \
  --health-cmd="wget --no-verbose --tries=1 --spider http://localhost:8080/metrics || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  --health-start-period=40s \
  --restart unless-stopped \
  ghcr.io/shinzonetwork/shinzo-host-client:sha-ddfead9
```

To ensure this is running properly, you can test it by checking the metrics endpoint.

```bash
curl http://localhost:8080/metrics
```

## 1. Install the Shinzo Host Client

Clone the repository and enter the directory:

```bash
git clone https://github.com/shinzonetwork/shinzo-host-client.git
cd shinzo-host-client
```

## 2. Configuration

The Host Client reads from [config.yaml](https://github.com/shinzonetwork/shinzo-host-client/blob/main/config.yaml) which comes with sensible defaults.
The only field you need to set is **defradb.keyring_secret** which can alternatively be set with the following command in the terminal window.

```bash
export DEFRA_KEYRING_SECRET=<make_a_password>
```

### Key Fields

* **defradb.url** – API endpoint of your local DefraDB node. Defaults work for most setups.
* **defradb.keyring_secret** – Requires a secret to generate your private keys. 
* **p2p.bootstrap_peers** – Indexer peers for receiving indexed data. Defaults include a reliable bootstrap peer.
* **p2p.listen_addr** – Default is suitable for local runs. Override when containerizing.
* **store.path** – Directory where local DefraDB data is stored.
* **shinzo.web_socket_url** – Defaults to a hosted ShinzoHub node. Only change if connecting to a different node.
* **logger.development** – Set to `false` for production.
* **host.lens_registry_path** – Where received WASM lens files are stored.

### Default Behavior

The included `config.yaml` is ready for most local development workflows. You should only need to modify peer settings or storage paths for advanced setups.

### Connecting to your Indexer

If you are running your own indexer, you can connect your Host to this indexer by modifying **p2p.bootstrap_peers**. In your indexer logs you should see something like:

```
Dec 17 19:14:55.645 INF p2p Adding pubsub topic PeerID=12D3KooWSY5bv77pAaotM1WGKDFW7nPYaEe8e95XAYxpamkSVvsK Topic=bafyreiehjqcssqfigaawuwnbs3zbjlbubyri4w5dmghd5ocwp4oxhfmf2a
Dec 17 19:14:55.652 INF node Providing HTTP API at http://192.168.50.33:9181
```
From this information, assemble your peer connection info: `/ip4/<your-ip-here>/tcp/9171/p2p/<your-PeerID-here>`. Now replace the default peer in **p2p.bootstrap_peers** with your indexer peer.

If you are running your own indexer locally on the same machine, it's likely already using port 9181. If so, in **config.yaml** update the **defradb url** field to:

```
url: "localhost:9182"
```

Also, if you are running your own indexer locally on the same machine, then set the IP addresses to your localhost IP:

```
bootstrap_peers:
  - '/ip4/127.0.0.1/tcp/9171/p2p/<PeerID>'
listen_addr: "/ip4/127.0.0.1/tcp/9171"
```

## 3. Running the Host

### Run with Docker Compose

```bash
docker compose up --build
```

### Run just the Host Client

```bash
go run cmd/main.go
```

### Or Run with Playground Enabled

```bash
make build-playground
make start
```

This runs the Host and also exposes a **Playground GUI**. In the output logs, look for the address:

```
🧪 GraphQL Playground available at ...
```

The playground allows you to interactively run GraphQL queries against primitive data and any Views your Host is serving. Give it a try with the following GraphQL query:

```graphql
query GetLatestLogs {
  Ethereum__Mainnet__Log(
    order: { blockNumber: DESC }
    limit: 10
  ) {
    address
    topics
    data
    blockNumber
    blockHash
    transactionHash
    transactionIndex
    logIndex
    removed
  }
}
```

## Next Steps

You are now ready to:

* Begin receiving and hosting Views
* Experiment with queries through the playground GUI

