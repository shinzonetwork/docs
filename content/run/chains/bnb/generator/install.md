+++
path = "run/bnb/generator/install"
aliases = ["run/chains/bnb/mainnet/generator/install", "run/bnb/generator/verify", "run/chains/bnb/mainnet/generator/verify"]
title = "Install & Configure"
description = "Install and configure a Shinzo Generator for BNB Smart Chain Mainnet"
+++

A Generator is the entry point for chain data in Shinzo. It runs as a sidecar next to an execution node, reads blocks, transactions and logs over JSON-RPC and WebSocket and stores them in its embedded DefraDB as signed documents. Hosts then receive those documents over P2P and serve them to applications.

BSC is EVM-compatible, so the Generator uses the same EVM adapter it uses for Ethereum. What changes is the configuration, BSC deployments use a dedicated [config file](https://github.com/shinzonetwork/shinzo-generator-client/blob/main/config/config_bsc.yaml) that defines chain ID, storage paths, pruning settings and resource limits for BSC Mainnet. Every chain setting and node URL you use must point to BSC Mainnet.

This page covers installing and configuring a Generator for BSC Mainnet using Docker or building from source, and verifying that it is successfully indexing blocks.

## What You Will Need

Before installing the Generator, ensure you have:

- A machine that meets the [prerequisites](../prerequisites) for hardware, storage and network requirements.
- Access to a synchronized BSC Mainnet node with HTTP JSON-RPC and WebSocket endpoints enabled. The Generator client does not run a node for you; it just reads from one. This can be a node you run yourself, a node co-located with your validator, or a managed provider.
- Docker for container-based deployment or Go 1.27.3+ and Git if building from source.
- A browser wallet setup. This wallet does not need to hold any funds.

## Option 1: Run with Docker (Recommended)

Docker is the recommended deployment method for running a Shinzo Generator. The same Docker image supports Ethereum and BSC Mainnet. To run the Generator on BSC, specify [config_bsc.yaml](https://github.com/shinzonetwork/shinzo-generator-client/blob/main/config/config_bsc.yaml) when starting the container.

**Step 1: Pull the Docker image**

```bash
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest
```

The BSC configuration file is included in the image, so no additional download is required.

**Step 2: Gather Your BSC Node Connection Details**

Gather your execution node's:

- RPC URL
- WebSocket URL
- API key (if set)

**Step 3: Start the Generator**

Run the following command, replacing the placeholder values with your BSC Mainnet node’s RPC and WebSocket endpoints:

```bash
docker run \
  --name shinzo-bsc-generator \
  -e GETH_RPC_URL="<YOUR_BSC_RPC_URL>" \
  -e GETH_WS_URL="<YOUR_BSC_WEBSOCKET_URL>" \
  -e GETH_API_KEY={% raw %}{{ YOUR API KEY (OPTIONAL) }}{% endraw %} \
  -e GETH_API_KEY_TYPE={% raw %}{{ HEADER NAME, e.g. x-goog-api-key or x-api-key (OPTIONAL) }}{% endraw %} \
  -e INDEXER_START_HEIGHT=0 \
  -e DEFRADB_KEYRING_SECRET="<YOUR_KEYRING_SECRET>" \
  -e DEFRADB_PLAYGROUND=true \
  -e DEFRADB_P2P_ENABLED=true \
  -e DEFRADB_P2P_LISTEN_ADDR=/ip4/0.0.0.0/tcp/9171 \
  -e LOGGER_DEBUG=true \
  -p 127.0.0.1:9181:9181 \
  -p 9171:9171 \
  -p 8080:8080 \
  ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest \
  --config config_bsc.yaml
```

* Replace `<YOUR_BSC_RPC_URL>` with the HTTP JSON-RPC endpoint of your synchronized BSC Mainnet node.
* Replace `<YOUR_BSC_WEBSOCKET_URL>` with the corresponding WebSocket endpoint.
* Replace `<YOUR_KEYRING_SECRET>` with a secure secret for the Generator DefraDB keyring.
* `INDEXER_START_HEIGHT=0` automatically selects a starting block near the current chain tip.
* `--config config_bsc.yaml` loads the BSC Mainnet configuration.

If your node requires API-key authentication, add the following environment variables to the command:

```bash
-e GETH_API_KEY="<YOUR_API_KEY>" \
-e GETH_API_KEY_TYPE="<YOUR_API_KEY_HEADER>" \
```

{% <admonition type="info"> %}
Keep `DEFRADB_KEYRING_SECRET` unchanged across container restarts and upgrades. Changing this value prevents the Generator from accessing its existing identity and may cause startup failures.
{% </admonition> %}

## Option 2: Build from Source

You can build and run the Shinzo Generator directly from source instead of using Docker. The same codebase supports Ethereum and BSC Mainnet; the chain is selected by passing the BSC configuration file when starting the binary.

**Step 1: Clone the Repository**

```shell
git clone https://github.com/shinzonetwork/shinzo-generator-client.git
cd shinzo-generator-client
go mod download
```

**Step 2: Configure the Generator**

Create a `.env` file in the repository root with your BSC Mainnet node connection details and Generator settings:

```bash
cat > .env << 'EOF'
GETH_RPC_URL=<your-bsc-rpc-url>
GETH_WS_URL=<your-bsc-websocket-url>
GETH_API_KEY=<your-api-key>
GETH_API_KEY_TYPE=<your-api-key-header>

DEFRADB_KEYRING_SECRET=<your-keyring-secret>
DEFRADB_PLAYGROUND=true
DEFRADB_P2P_ENABLED=true
DEFRADB_P2P_LISTEN_ADDR=/ip4/0.0.0.0/tcp/9171

SCHEMA_AUTH_MODE=none
INDEXER_START_HEIGHT=0
LOGGER_DEBUG=true
EOF
```

Replace the placeholders with your BSC Mainnet endpoints and a secure keyring secret.

The `GETH_API_KEY` and `GETH_API_KEY_TYPE` variables are optional and can be omitted if your node does not require API-key authentication.

**Step 3: Build the Binary**

```bash
make build
```

**Step 4: Start the Generator**

Start the Generator with the BSC Mainnet configuration:

```bash
./<generator-binary> --config config/config_bsc.yaml
```

The `--config` flag selects the BSC configuration, BSC-specific indexing settings and the `.defra-bsc/` storage directory.

The Generator uses the RPC and WebSocket endpoints defined in your `.env` file to connect to your BSC Mainnet node.

## Do you need an API key?

It depends on where your node is. If the Generator client and your node are on the same private network (both on VMs in the same VPC, for example) you probably don't need one. Most execution nodes have no authentication by default. Leave `GETH_API_KEY` empty and point `GETH_RPC_URL` at the node's internal IP or hostname.

For an externally hosted node, authentication is almost always required. Two common cases:

- GCP Blockchain Node Engine (`blockchainnodeengine.com`) expects the key in the `x-goog-api-key` header.
- A self-hosted node behind a reverse proxy (e.g. nginx) uses whatever header the operator configures. `x-api-key` is common.

Set `GETH_API_KEY_TYPE` to the header name your provider expects.

| Provider | `GETH_API_KEY_TYPE` value |
| --- | --- |
| GCP Blockchain Node Engine | `x-goog-api-key` |
| Self-hosted / most others | `x-api-key` |

## Exposed ports

The following ports must be available on the machine. Ports 8080 and 9171 require inbound connectivity, while 9181 should remain accessible only locally. See [Security](/run/ethereum/generator/security/) for the full exposure rules.

| Port | Service | Public Access | Purpose |
| --- | --- | --- | --- |
| <code class="port-number">8080</code> | Health, metrics, and registration | Required | Exposes `/health`, `/metrics`, and `/registration`. The Shinzo dashboard uses `http://<your-server-ip>:8080/health` to monitor Generator availability. If unreachable, the Generator may appear offline even when running. |
| <code class="port-number">9171</code> | DefraDB P2P | Required | Enables Hosts to connect to the Generator and receive indexed blockchain data. |
| <code class="port-number">9181</code> | DefraDB GraphQL API | Not required | Provides access to the local database. Bind to `127.0.0.1` only to prevent unauthorized access. |

Exposing port `8080` directly makes all endpoints on that port publicly accessible, not just `/health`. To restrict access, configure a reverse proxy such as nginx to expose only the required endpoints.

Refer to the [security documentation](/run/ethereum/generator/security/) and the nginx with snapshots deployment example for configuration details.

## Next Steps

Once your BSC Generator is running and indexing blocks, proceed to [Register Your Generator](../register) to complete registration with the Shinzo network.

## Need help

{{<need_help client="Generator" repo_name="shinzo-generator-client" repo="https://github.com/shinzonetwork/shinzo-generator-client/issues" />}}