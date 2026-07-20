+++
title = "Quick Start"
description = "Run a Shinzo Host to transform blockchain data into verifiable Views"
+++

Hosts turn raw blockchain data into structured **Views** and produce **Attestation Records** that help secure the network. This guide covers installing, configuring, and running the Shinzo Host Client.

## Hardware recommendations

The Host client does not run a blockchain node and has no archival mode, so it never needs the multi-terabyte storage of an execution client or archival Generator. See the [hardware requirements page](../hardware-requirements/) for details.

{{ hardware(component="host") }}

## Local Deployment

Run the Shinzo Host Client directly on your local machine for development and testing.

### Prerequisites

- Go 1.25
- Metamask with a wallet setup. This wallet does not need to hold any funds.

### Clone the Repository

```shell
git clone https://github.com/shinzonetwork/shinzo-host-client.git
cd shinzo-host-client
```

### Configuration

The Host Client reads from [config.yaml](https://github.com/shinzonetwork/shinzo-host-client/blob/main/config/config.yaml), which comes with working defaults. The only field you need to set is `defradb.keyring_secret`. Alternatively, you can also set the password as an environment variable to avoid storing it in plaintext:

```shell
export DEFRA_KEYRING_SECRET=<make_a_password>
```

#### Key Fields

- `defradb.url`: API endpoint of your local DefraDB node. Defaults work for most setups.
- `defradb.keyring_secret`: Requires a secret to generate your private keys.
- `p2p.bootstrap_peers`: Generator client peers for receiving indexed data. Defaults include a reliable bootstrap peer.
- `p2p.listen_addr`: Default is suitable for local runs. Override when containerizing.
- `store.path`: Directory where local DefraDB data is stored.
- `shinzo.web_socket_url`: Defaults to a hosted ShinzoHub node. Only change if connecting to a different node.
- `logger.development`: Set to `false` for production.
- `host.lens_registry_path`: Where received WASM lens files are stored.

{% admonition(type="tip", title="Note") %}
The included `config.yaml` works for most local development. You typically only need to change peer settings or storage paths for advanced setups.
{% end %}

### Running a Generator client and a Host client on the same machine

If you are running your own Generator client, you can connect your Host client to this Generator client by configuring `p2p.bootstrap_peers`. To get the required Peer ID, query the registration endpoint:

```shell
curl http://localhost:8080/registration
```

From this information, assemble your peer connection info: `/ip4/<your-ip-here>/tcp/9171/p2p/<your-PeerID-here>`. Now replace the default peer in `p2p.bootstrap_peers` with your Generator client's peer.

If you are running a Generator client and a Host client on the same machine, apply the following changes to the [Host client's `config.yaml`](https://github.com/shinzonetwork/shinzo-host-client/blob/main/config/config.yaml) to avoid port collisions.

The Generator client is likely already using port `9181`, so update the `defradb.url` field:

```shell
url: "localhost:9182"
```

Also update the [P2P settings](https://github.com/shinzonetwork/shinzo-host-client/blob/main/config/config.yaml#L4) to use localhost and a different port so the Host doesn't clash with the Generator client:


```shell
bootstrap_peers:
  - '/ip4/127.0.0.1/tcp/9171/p2p/<PeerID>'
listen_addr: "/ip4/0.0.0.0/tcp/9172"
```

### Build and Run

{% tab(label="Run directly") %}
```shell
go run cmd/main.go
```
{% end %}

{% tab(label="Build then run") %}
```shell
make build
make start
```
{% end %}

### (Optional) Enable the GraphQL Playground

The Host client ships with an optional web-based GraphQL Playground for querying the embedded DefraDB instance.

```shell
make build-playground
make start
```

This runs the Host client and exposes a Playground GUI. Check the output logs for the address:

```plaintext
🧪 GraphQL Playground available at ...
```

The playground lets you run GraphQL queries against primitive data and any Views your Host client is serving. Try this query:

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

More query examples are available [here](/hosts/examples/).

## VM Deployment

This is the recommended approach for production and testnet participation. It uses Docker, docker-compose, and Nginx on a virtual machine.

### Prerequisites

- Port `444` open in your firewall/security group.

### Install System Dependencies

```shell
sudo apt-get update
sudo apt-get install -y docker.io docker-compose nginx
```

### Create the Data Directory

```shell
sudo mkdir -p ~/data/defradb ~/data/lens
sudo chown -R 1001:1001 ~/data/defradb ~/data/lens
```

### Generate SSL Certificates

```shell
# Generate private key, certificate signing request, and self-signed certificate
set -e &&
sudo mkdir -p ~/ssl &&
sudo openssl genrsa -out ~/ssl/nginx.key 2048 &&
sudo openssl req -new -key ~/ssl/nginx.key -out /tmp/nginx.csr -subj "/C=US/ST=State/L=City/O=Shinzo/OU=Host Client/CN=shinzo.network" &&
sudo openssl x509 -req -days 365 -in /tmp/nginx.csr -signkey ~/ssl/nginx.key -out ~/ssl/nginx.crt &&
sudo rm /tmp/nginx.csr
```

### Write the Configuration File

Create `~/config.yaml`. The production config enables performance tuning, peer reconnection, pruning, and optional event filtering. Key values to set:

```yaml
defradb:
  url: "localhost:9181"
  keyring_secret: "<YOUR_SECRET>"        # Required, change this
  p2p:
    enabled: true
    bootstrap_peers:
      - '/ip4/34.63.13.57/tcp/9171/p2p/12D3KooWMYhYNBo4zAi9j7TpyGQJBSvbwSSNkgsMrLs6vHUnFUzY'
    listen_addr: "/ip4/0.0.0.0/tcp/9171"
    enable_auto_reconnect: true
  store:
    path: "./.defra"
shinzo:
  hub_base_url: testnet.shinzo.network:26657
  minimum_attestations: 1
logger:
  development: false
  level: "error"
host:
  lens_registry_path: "./.defra/lens"
  health_server_port: 8080
```

{% admonition(type="tip", title="Note") %}
The full production config is generated automatically by `host-prod-setup.sh`. See below.
{% end %}

### Write the Nginx Config

Create `~/nginx.conf`:

```shell
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
 
### Write the docker-compose File

Create `~/docker-compose.yml`:

```yaml
networks:
  shinzo-net:
    driver: bridge

services:
  shinzo-host:
    image: ghcr.io/shinzonetwork/shinzo-host-client:v0.6.5-ethereum-mainnet
    user: "1001:1001"
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

### Start the Host client

```shell
docker-compose up -d
```

### Monitoring

The health check endpoint is available at:

```shell
http://<VM_IP>:8080/metrics
```

The container health check polls this every 15 seconds. To check container status:

```shell
docker ps
docker logs shinzo-host
```

### Docker Image

The multi-stage Dockerfile builds the host binary (Go 1.25) along with the Wasmtime and Wasmer WASM runtimes. The production image is based on Ubuntu 24.04 and runs as a non-root `shinzo` user. Pre-built images are published to:

```shell
ghcr.io/shinzonetwork/shinzo-host-client:v0.6.5-ethereum-mainnet
```

## ShinzoHub Registration

To participate in the Shinzo Network, you must register your Host. Registration identifies your node so it can replicate data and earn rewards. An unregistered Host will not be recognized by the network. There are two ways to register:

### Option A: Register with the GUI

1. Start your Host client.
2. Add Shinzo testnet to Metamask with the following values:
  - Network name: Shinzo
  - Default RPC URL: http://testnet.shinzo.network:8545
  - Chain ID: 91273001
  - Currency symbol: SHNZ
3. Open the [registration route](http://localhost:8080/registration-app) and connect your wallet.
4. On the registration page, click Register and select "Host" as your role to complete the process.
5. Submit your registration, then confirm the transaction in MetaMask. You should see a successful registration notification.

### Option B: Register with the CLI

You can also register your Host by submitting the registration transaction directly with Foundry’s `cast` CLI.

```shell
cast send "0x0000000000000000000000000000000000000211" \
  "register(bytes,bytes,bytes,bytes,bytes,uint8)" \
  "<public_key>" \
  "<public_key_signedMessage>" \
  "<peer_id>" \
  "<peer_id_signedMessage>" \
  "<signed_message>" \
  "1" \
  --rpc-url "http://testnet.shinzo.network:8545" \
  --from "<your_address>" \
  --private-key "<your_private_key>" \
  --gas-limit 100000
  ```

Replace each placeholder with your actual registration values.

{% admonition(type="warning") %}
Be careful with your private key. Do not commit it to source control, paste it in public channels, or store it in shell history on shared machines.
{% end %}

Your Host is now registered and authorized to participate in the Shinzo Network.

## Need Help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}

## Next Steps

Your Host can now receive and serve Views. Try running queries against it through the playground GUI.
