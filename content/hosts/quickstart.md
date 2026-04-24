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


## Local Deployment

This section covers running the Shinzo Host Client directly on your local machine for development and testing.

### Prerequisites

- Go 1.25
- Metamask with a wallet setup. This wallet does not need to hold any funds.

### 1. Clone the Repository

```bash
git clone https://github.com/shinzonetwork/shinzo-host-client.git
cd shinzo-host-client
```

### 2. Configuration

The Host Client reads from [config.yaml](https://github.com/shinzonetwork/shinzo-host-client/blob/main/config/config.yaml) which comes with sensible defaults.
The only field you need to set is **defradb.keyring_secret** which can alternatively be set with the following command in the terminal window.

```bash
export DEFRA_KEYRING_SECRET=<make_a_password>
```

#### Key Fields

* **defradb.url** – API endpoint of your local DefraDB node. Defaults work for most setups.
* **defradb.keyring_secret** – Requires a secret to generate your private keys. 
* **p2p.bootstrap_peers** – Indexer peers for receiving indexed data. Defaults include a reliable bootstrap peer.
* **p2p.listen_addr** – Default is suitable for local runs. Override when containerizing.
* **store.path** – Directory where local DefraDB data is stored.
* **shinzo.web_socket_url** – Defaults to a hosted ShinzoHub node. Only change if connecting to a different node.
* **logger.development** – Set to `false` for production.
* **host.lens_registry_path** – Where received WASM lens files are stored.

> The included `config.yaml` is ready for most local development workflows. You should only need to modify peer settings or storage paths for advanced setups.

### 3. Connecting to an Indexer

If you are running your own indexer, you can connect your Host to this indexer by modifying **p2p.bootstrap_peers**. In your indexer logs you should see something like:

```
Dec 17 19:14:55.645 INF p2p Adding pubsub topic PeerID=12D3KooWSY5bv77pAaotM1WGKDFW7nPYaEe8e95XAYxpamkSVvsK Topic=bafyreiehjqcssqfigaawuwnbs3zbjlbubyri4w5dmghd5ocwp4oxhfmf2a
Dec 17 19:14:55.652 INF node Providing HTTP API at http://192.168.50.33:9181
```
From this information, assemble your peer connection info: `/ip4/<your-ip-here>/tcp/9171/p2p/<your-PeerID-here>`. Now replace the default peer in **p2p.bootstrap_peers** with your indexer peer.

If you are running both Indexer and Host on the same machine, apply the following changes to the [Host's **config.yaml**](https://github.com/shinzonetwork/shinzo-host-client/blob/main/config/config.yaml) to avoid port collisions.

The Indexer is likely already using port `9181`, so update the **defradb url** field:

```
url: "localhost:9182"
```

Also update the P2P settings to use localhost and a different port so the Host doesn't clash with the Indexer:


```
bootstrap_peers:
  - '/ip4/127.0.0.1/tcp/9171/p2p/<PeerID>'
listen_addr: "/ip4/0.0.0.0/tcp/9172"
```

### 4. Build and Run

**Option A — Run directly (no build step):**

```bash
go run cmd/main.go
```

**Option B — Build then run:**

```bash
make build
make start
```

### 5. (Optional) Enable the GraphQL Playground

The host ships with an optional web-based GraphQL Playground for querying the embedded DefraDB instance.

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

You can checkout more query examples [here](/docs/hosts/examples.md).

## VM Deployment

This section covers deploying the host on a virtual machine using Docker, docker-compose, and Nginx — the recommended approach for production and devnet participation.

### Prerequisites

- Ports `9171`, `9181`, `8080`, and `444` open in your firewall/security group

### 1. Install System Dependencies

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose nginx
```

### 2. Create the Data Directory

```bash
sudo mkdir -p ~/data/defradb ~/data/lens
sudo chown -R 1001:1001 ~/data/defradb ~/data/lens
```

### 3. Generate SSL Certificates

```bash
# Generate private key, certificate signing request, and self-signed certificate
set -e &&
sudo mkdir -p ~/ssl &&
sudo openssl genrsa -out ~/ssl/nginx.key 2048 &&
sudo openssl req -new -key ~/ssl/nginx.key -out /tmp/nginx.csr -subj "/C=US/ST=State/L=City/O=Shinzo/OU=Host Client/CN=shinzo.network" &&
sudo openssl x509 -req -days 365 -in /tmp/nginx.csr -signkey ~/ssl/nginx.key -out ~/ssl/nginx.crt &&
sudo rm /tmp/nginx.csr
```

### 4. Write the Configuration File

Create `~/config.yaml` with your desired settings. The production config enables all performance tuning, peer reconnection, pruning, and optional event filtering. Key values to set:

```yaml
defradb:
  url: "localhost:9181"
  keyring_secret: "<YOUR_SECRET>"        # Required — change this
  p2p:
    enabled: true
    bootstrap_peers:
      - '/ip4/34.63.13.57/tcp/9171/p2p/12D3KooWMYhYNBo4zAi9j7TpyGQJBSvbwSSNkgsMrLs6vHUnFUzY'
    listen_addr: "/ip4/0.0.0.0/tcp/9171"
    enable_auto_reconnect: true
  store:
    path: "./.defra"
shinzo:
  hub_base_url: rpc.devnet.shinzo.network:26657
  minimum_attestations: 1
logger:
  development: false
  level: "error"
host:
  lens_registry_path: "./.defra/lens"
  health_server_port: 8080
```

> The full production config (with pruning, batch processing, event filtering, and memory tuning) is generated automatically by `host-prod-setup.sh`. See below.

### 5. Write the Nginx Config

Create `~/nginx.conf`:

```bash
events { worker_connections 1024; }

http {
  map $http_origin $cors_origin {
    default "";
    "https://explorer.shinzo.network" $http_origin;
  }

  server {
    listen 8080;
    server_name _;

    add_header 'Access-Control-Allow-Origin' $cors_origin always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, Origin' always;
    add_header 'Access-Control-Max-Age' 3600 always;
    add_header 'Vary' 'Origin' always;

    location / {
      if ($request_method = OPTIONS) { return 204; }
      proxy_pass http://shinzo-host:9181;
      proxy_set_header Host $host;
    }

    location = /metrics {
      if ($request_method = OPTIONS) { return 204; }
      proxy_pass http://shinzo-host:8080/metrics;
      proxy_set_header Host $host;
    }

    location = /api/v0/graphql {
      if ($request_method = OPTIONS) { return 204; }
      proxy_pass http://shinzo-host:9181/api/v0/graphql;
      proxy_set_header Host $host;
    }
  }
}
```
 
### 6. Write the docker-compose File

Create `~/docker-compose.yml`:

```yaml
networks:
  shinzo-net:
    driver: bridge

services:
  shinzo-host:
    image: ghcr.io/shinzonetwork/shinzo-host-client:standard
    mem_limit: 16g
    mem_reservation: 13g
    restart: unless-stopped
    container_name: shinzo-host
    networks:
      - shinzo-net
    ports:
      - "9181:9181"   # DefraDB API
      - "444:9182"    # GraphQL Playground
      - "9171:9171"   # P2P networking
    volumes:
      - ~/data/defradb:/app/.defra/data
      - ~/data/lens:/app/.lens
      - ~/config.yaml:/app/config.yaml:ro
    environment:
      - DEFRA_URL=0.0.0.0:9181
      - GOMEMLIMIT=14GiB
      - LOG_LEVEL=error
      - LOG_SOURCE=false
      - LOG_STACKTRACE=false
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/metrics"]
      interval: 15s
      timeout: 30s
      retries: 10
      start_period: 120s

  nginx:
    image: nginx:alpine
    ports:
      - "8080:8080"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - shinzo-host
    networks:
      - shinzo-net
    restart: unless-stopped
```

### 7. Start the Host

```bash
docker-compose up -d
```

### Monitoring

The health check endpoint is available at:

```
http://<VM_IP>:8080/metrics
```

The container health check polls this every 15 seconds. View container status with:

```bash
docker ps
docker logs shinzo-host
```

### Docker Image

The multi-stage Dockerfile builds the host binary (Go 1.25) along with Wasmtime and Wasmer WASM runtimes. The production image is based on Ubuntu 24.04 and runs as a non-root `shinzo` user. Pre-built images are published to:

```
ghcr.io/shinzonetwork/shinzo-host-client:standard
```

## ShinzoHub Registration

To participate in the Shinzo Network, you must register your host. Registration identifies and authenticates your node so it can replicate data and earn rewards. Without this step, your host will not be recognized by the network. To register your host in ShinzoHub, follow the steps below:

### Option A: Register with the GUI

1. Start your Host
2. Add Shinzo Devnet to Metamask with the following values:
  - Network name: Shinzo
  - Default RPC URL: http://rpc.devnet.shinzo.network:8545
  - Chain ID: 91273002
  - Currency symbol: SHN
3. Open the [registration route](http://localhost:8080/registration-app) and connect your wallet.
4. On the registration page, click Register and select "Host" as your role to complete the process.
5. Submit your registration, then confirm the transaction in MetaMask. You should see a successful registration notification.

### Option B: Register with the CLI

You can also register your host by submitting the registration transaction directly with Foundry’s `cast` CLI.

```bash
cast send "0x0000000000000000000000000000000000000211" \
  "register(bytes,bytes,bytes,bytes,bytes,uint8)" \
  "<public_key>" \
  "<public_key_signedMessage>" \
  "<peer_id>" \
  "<peer_id_signedMessage>" \
  "<signed_message>" \
  "1" \
  --rpc-url "http://rpc.devnet.shinzo.network:8545" \
  --from "<your_address>" \
  --private-key "<your_private_key>" \
  --gas-limit 100000
  ```

Replace each placeholder with your actual registration values.

> Be careful with your private key. Do not commit it to source control, paste it in public channels, or store it in shell history on shared machines.

**🎉 Your host is now successfully registered and fully authorized to participate in the Shinzo Network.**

## Need Help?

If you encounter any issues while installing or running the Shinzo Indexer, please let us know by opening a GitHub issue [here](https://github.com/shinzonetwork/shinzo-indexer-client/issues).

## Next Steps

You are now ready to:

* Begin receiving and hosting Views
* Experiment with queries through the playground GUI
