+++
title = "Install"
weight = 2
+++

A Host client pulls primitive blockchain data from Generator clients, runs Lens WASM transforms, and serves the resulting Views to subscriber nodes over an embedded DefraDB instance. This page is for operators who want to **run** a Host client.

{% admonition(type="info") %}
**Only want to query Shinzo data?** You don't need to run your own Host client. Connect to a public Host client instead. See [Querying Views](/views/). Running your own Host client is for serving data to the network, not for reading it.
{% end %}

## Prerequisites

- **Docker** (for the Docker path), or **[Go 1.25+](https://go.dev/dl/) and Make** (to build from source).
- **Access to a running Generator client.** The Host client doesn't produce data itself. It receives primitive block data from a Generator client over libp2p and transforms it, so it needs at least one Generator client to sync from. The Generator client doesn't have to be your own, you just need one you can reach and its libp2p multiaddr. A public Generator client you can point at is coming; this page will link it here once it's live. Until then, run your own. The [Operator Quickstart](/quickstart/) walks through standing up a Generator client and a Host client together.
- **Hardware** that meets the [recommendations](/hosts/overview/).

There are two ways to install: [Docker](#use-docker) (recommended) or [build from source](#build-from-source).

## Use Docker

Pull the image and start it with a single `docker run`. You supply two values: a keyring secret, and the Generator client to sync from.

1. Pull the image:

    ```shell
    docker pull ghcr.io/shinzonetwork/shinzo-host-client:standard
    ```

1. Generate a secure key for the `DEFRA_KEYRING_SECRET`:

    ```shell
    openssl rand -hex 32
    ```

1. Get your `BOOTSTRAP_PEERS` value. This is the libp2p address of the Generator client to sync from. It must be a full multiaddr that includes IP, port, and peer ID:

    ```plaintext
    /ip4/<generator-ip>/tcp/9171/p2p/<generator-peer-id>
    ```

    The peer ID is what libp2p authenticates the connection against, so an address without it won't connect. Read both the IP and the peer ID from your Generator client's health endpoint:

    ```shell
    curl -s http://<generator-host>:8080/health | jq -r '.p2p.self'
    ```

1. Run the container, supplying the secret and multiaddr:

    ```shell
    docker run -d \
      --name shinzo-host \
      -e DEFRA_KEYRING_SECRET="<your-strong-secret>" \
      -e BOOTSTRAP_PEERS="<indexer-multiaddr>" \
      -p 9181:9181 \
      -p 9182:9182 \
      -p 9171:9171 \
      ghcr.io/shinzonetwork/shinzo-host-client:standard
    ```

    {% admonition(type="info") %}
    **ARM machines (Apple Silicon):** the image is `linux/amd64` only. Add `--platform linux/amd64` to the `pull` and `run` commands to run it under emulation. Running on native x86-64 hardware is recommended.
    {% end %}

1. The remaining settings, including the ShinzoHub endpoint the Host client pulls View definitions from, use the image's built-in defaults:

    | Port | Service | Notes |
    | --- | --- | --- |
    | `9181` | DefraDB GraphQL + REST API | |
    | `9182` | GraphQL Playground UI | |
    | `9171` | libp2p P2P networking | Must be reachable from the internet — open/forward this port |
    | `8080` | Health + metrics | Served inside the container; publish with `-p 8080:8080` if you want to scrape it |

1. Confirm the container is up:

    ```shell
    docker ps --filter name=shinzo-host
    ```

    The `STATUS` column should read `Up ... (healthy)`.

1. Check the API responds:

    ```shell
    curl http://localhost:9181/api/v0/graphql -X POST \
      -H "Content-Type: application/json" \
      -d '{"query":"{ __typename }"}'
    ```

    A JSON response confirms the API is serving. On a freshly started Host client you'll see an error like `{"errors":[{"message":"key not found"}],"data":null}`, which is expected. The API is up; there's just no data yet. You can also open the Playground at `http://localhost:9182` to confirm the UI loads.

1. Returning real indexed data depends on the Host client reaching the Generator client you set in `BOOTSTRAP_PEERS` and syncing from it. Check the connection in the logs:

    ```shell
    docker logs shinzo-host | grep -i peer
    ```

    A healthy connection adds the Generator client's peer and keeps it. You should not see that peer stuck in a loop of `dial backoff` / `all dials failed`. Once it's syncing, query real data from the Playground or the API. A public Generator client to point at is coming; this page will link a known-good endpoint and a ready-to-run query once it's live. See [query examples](/views/).

1. To serve data to the network, register your Host client with ShinzoHub. See [Register a Host](/hosts/register/).

### Running a persistent host

The command above stores everything inside the container, so removing the container discards its database and node identity. That's fine for testing. For a long-running Host client, persist data on the host machine with volume mounts:

```shell
mkdir -p ~/data/defradb ~/data/keys ~/data/lens
sudo chown -R 1003:1006 ~/data/defradb ~/data/keys ~/data/lens

docker run -d \
  --name shinzo-host \
  -e DEFRA_KEYRING_SECRET="<your-strong-secret>" \
  -v ~/data/defradb:/app/.defra/data \
  -v ~/data/keys:/app/.defra/keys \
  -v ~/data/lens:/app/.lens \
  -p 9181:9181 \
  -p 9182:9182 \
  -p 9171:9171 \
  ghcr.io/shinzonetwork/shinzo-host-client:standard
```

{% admonition(type="warning") %}
The container runs as UID/GID `1003:1006`, and a bind mount takes the ownership of the host directory. Without the `chown` above, the Host client can't write to the mounts and exits with a `permission denied` error on `.defra/keys`. This is a workaround until the image handles directory ownership on startup.
{% end %}

Production deployments also put an nginx reverse proxy in front for TLS and CORS; see [Production deployment](/hosts/deployment/). The repo has example Compose files you can adapt if you prefer to orchestrate with Compose.

## Build from source

### Prerequisites

- [Go 1.25+](https://go.dev/dl/)
- Make

When building outside Docker, the Wasmtime and Wasmer WASM runtimes must be on your `LD_LIBRARY_PATH`. The repo's [`Dockerfile`](https://github.com/shinzonetwork/shinzo-host-client/blob/main/Dockerfile) has the exact versions and install steps. The Docker build installs these automatically.

### Build

```shell
git clone https://github.com/shinzonetwork/shinzo-host-client.git
cd shinzo-host-client
make build
```

The binary lands at `./bin/host`.

To include the GraphQL Playground UI (served on `9182`):

```shell
make deps-playground
make build-playground
```

### Configure and run

The only required setting is the keyring secret. Export it, then start the Host client:

```shell
export DEFRA_KEYRING_SECRET="<your-strong-secret>"
make start
```

Or run without building a binary:

```shell
go run cmd/main.go
```

### Build tags

| Tag | Effect |
| --- | --- |
| `hostplayground` | Embeds the GraphQL Playground UI (served on port `9182`) |

Ports, verification, and registration are the same as the Docker path above.

## Need Help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
