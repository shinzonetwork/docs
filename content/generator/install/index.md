+++
title = "Install"
weight = 2
+++

This page covers installing a Shinzo Generator with Docker or from source. To complete an generator setup, you must also register it with the Shinzo Network (see [Registration](./register)).

## Hardware recommendations

| Component | Minimum | Recommended |
| --- | --- | --- |
| CPU | 8 vCPUs | 16 vCPUs |
| Memory (RAM) | 16 GB | 32–64 GB |
| Storage | 3 TB NVMe | 4+ TB NVMe |
| OS | Ubuntu 24.04 | Ubuntu 26.04 |

## Using Docker 

These steps use Docker to run the Shinzo Generator. To build the generator from source, see [Building from source](#building-from-source) below.

### Prerequisites

- Docker.
- Access to an Ethereum execution node that exposes JSON-RPC and WebSocket. The generator does not run a node for you, it just reads from one. This can be a node you run yourself, a node co-located with your validator, or a managed provider.
- A browser wallet setup. This wallet does not need to hold any funds.

### Steps

1. Pull the pre-built generator image from the Shinzo container registry.

    ```shell
    docker pull ghcr.io/shinzonetwork/shinzo-generator-client:standard
    ```

    {% output() %}
```
    standard: Pulling from shinzonetwork/shinzo-generator-client
    2521f1b70bf8: Pull complete
    2c845527b24c: Pull complete
    
    [...]

    Digest: sha256:a272b09607e6f3f07399d72d019f058919ba2854469835b80478fd75799fa0fd
    Status: Downloaded newer image for ghcr.io/shinzonetwork/shinzo-generator-client:standard
    
```
{% end %}

1. Gather your Geth node's:

    - RPC URL
    - WebSocket URL
    - API key ([if set](#do-you-need-an-api-key))

1. Start the generator by filling in your details and running:

    ```shell
    docker run --rm \
      -e GETH_RPC_URL={{ YOUR RPC URL }}\
      -e GETH_WS_URL={{ YOUR WEBSOCKET URL }}\
      -e GETH_API_KEY={{ YOUR API KEY (OPTIONAL) }} \
      -e GETH_API_KEY_TYPE={{ HEADER NAME, e.g. x-goog-api-key or x-api-key (OPTIONAL) }} \
      -e INDEXER_START_HEIGHT=0 \
      -e DEFRADB_KEYRING_SECRET=devnet-secret \
      -e DEFRADB_PLAYGROUND=true \
      -e DEFRADB_P2P_ENABLED=true \
      -e DEFRADB_P2P_LISTEN_ADDR=/ip4/0.0.0.0/tcp/9171 \
      -e LOGGER_DEBUG=true \
      -p 9181:9181 \
      -p 9171:9171 \
      -p 8080:8080 \
      ghcr.io/shinzonetwork/shinzo-generator-client:standard
    ```

You should see the generator connect to Geth and start collecting and committing blocks:

{% output() %}
```
2026-05-11T10:59:54.762Z	INFO	Committed block 25071330 (ID: bae-235bbc36-32ff-5fb0-8361-6c4dc3d6aeb9)
2026-05-11T10:59:54.902Z	DEBUG	HTTP response: 200 OK (Content-Length: )
2026-05-11T10:59:54.902Z	DEBUG	HTTP request successful, status: 200 OK
2026-05-11T10:59:55.272Z	DEBUG	HTTP Request: POST http://35.193.228.182:8080
2026-05-11T10:59:55.272Z	DEBUG	Setting x-goog-api-key header: df7f****e6db
2026-05-11T10:59:55.272Z	DEBUG	Request headers: Content-Type=application/json, User-Agent=
2026-05-11T10:59:55.409Z	DEBUG	HTTP response: 200 OK (Content-Length: )
2026-05-11T10:59:55.409Z	DEBUG	HTTP request successful, status: 200 OK
```
{% end %}

Eventually your generator will catch up with the validator node and start waiting for new blocks rather than pulling historical data:

{% output() %}
```
2026-05-11T11:05:09.338Z	DEBUG	HTTP response: 200 OK (Content-Length: )
2026-05-11T11:05:09.338Z	DEBUG	HTTP request successful, status: 200 OK
2026-05-11T11:05:09.338Z	INFO	Block 25071451 not available yet, waiting...
```
{% end %}

### Registration

Once the generator is running, register it with the Shinzo Network. See [Registration](./register) for details.

## Building from source

You can also build the generator binary from source instead of using Docker.

### Prerequisites

- Go 1.26 or later.
- Git.
- Access to an Ethereum execution node (same as the [Docker install method](#using-docker)).

### Steps

1. Clone the repository and install the Go dependencies.

    ```shell
    git clone https://github.com/shinzonetwork/shinzo-generator-client.git
    cd shinzo-generator-client
    go mod download
    ```

1. Create a `.env` file with your node details and generator settings.

    ```shell
    cat > .env << EOF
    GETH_RPC_URL=<your-rpc-url>
    GETH_WS_URL=<your-ws-url>
    GETH_API_KEY=<your-api-key>
    GETH_API_KEY_TYPE=<header-name, e.g. x-goog-api-key or x-api-key>

    DEFRADB_KEYRING_SECRET=<your-keyring-secret>
    DEFRADB_PLAYGROUND=true
    DEFRADB_P2P_ENABLED=true
    DEFRADB_P2P_LISTEN_ADDR=/ip4/0.0.0.0/tcp/9171

    INDEXER_START_HEIGHT=0
    LOGGER_DEBUG=true
    EOF
    ```

    You [may not need to enter a Geth API key](#do-you-need-an-api-key).

1. Build the binary.

    ```shell
    make build
    ```

1. Run the generator.

    ```shell
    make start
    ```

{% admonition(type="info") %}
The included `config.yaml` works for most local development. You typically only need to change peer settings or storage paths for advanced setups. Environment variables in `.env` override values in `config.yaml`.
{% end %}

### Registration

Once your generator is running, register it with the Shinzo Network. See [Registration](./register) for details.

## Do you need an API key?

It depends on where your Geth node is.

If the generator and the Geth node are on the same private network (both on VMs in the same VPC, for example) you probably don't need one. Geth has no authentication by default. Leave `GETH_API_KEY` empty and point `GETH_RPC_URL` at the node's internal IP or hostname.

For an externally hosted node, authentication is almost always required. Two common cases:

- GCP Blockchain Node Engine (`blockchainnodeengine.com`) expects the key in the `x-goog-api-key` header.
- A self-hosted node behind a reverse proxy (e.g. nginx) uses whatever header the operator configures. `x-api-key` is common.

Set `GETH_API_KEY_TYPE` to the header name your provider expects.

| Provider | `GETH_API_KEY_TYPE` value |
| --- | --- |
| GCP Blockchain Node Engine | `x-goog-api-key` |
| Self-hosted / most others | `x-api-key` |

## Exposed ports

The following ports must be exposed and available on the machine.

| Port | Service |
| --- | --- |
| `8080` | Health endpoint (`/health`), metrics (`/metrics`), and registration ('/registration'). |
| `9171` | DefraDB P2P. |
| `9181` | DefraDB GraphQL API. |

## Troubleshooting

### Permission denied on `.defra/keys`

The data directories are owned by root but the container runs as UID 1001. Stop the container, fix the ownership, then start again:

```shell
docker-compose -f ~/docker-compose.yml stop
chown -R 1001:1001 ~/data/defradb ~/data/lens
docker-compose -f ~/docker-compose.yml start
```

### Failed to load existing DefraDB identity

`DEFRADB_KEYRING_SECRET` has changed since the first run. Restore the original value in your compose file and restart.

### WebSocket unavailable, will use HTTP-only mode

The generator falls back to HTTP polling. Check that `GETH_WS_URL` is correct and the port is reachable. HTTP-only mode works but is slightly slower.
