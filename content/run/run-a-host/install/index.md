+++
title = "Install"
description = "How to install a Host client with Docker or a source build and connect it to a Generator client to sync from."
+++

A Host client pulls primitive blockchain data from Generator clients, runs Lens WASM transforms, and serves the resulting Views to subscriber nodes over an embedded DefraDB instance. This page is for operators who want to **run** a Host client.

{% <admonition type="info"> %}
**Only want to query Shinzo data?** You don't need to run your own Host client. Connect to a public Host client instead. See [Query your first View](/build/tutorials/query-your-first-view/). Running your own Host client is for serving data to the network, not for reading it.
{% </admonition> %}

## Prerequisites

- **Docker** (for the Docker path), or **[Go 1.25+](https://go.dev/dl/) and Make** (to build from source).
- **Access to a running Generator client for each chain.** You need its HTTP API URL and full libp2p multiaddr, including the peer ID. The Host fetches chain schemas over HTTP and receives primitive data over P2P. You can use reachable Shinzo-operated Generators or your own. Configure these connections manually under `chains:` in `config.yaml`. See [Run a Generator and Host on one machine](/run/run-a-host/deployment-examples/generator-and-host/) if you are colocating them.
- **Hardware** that meets the [recommendations](/run/run-a-host/hardware-requirements/).

There are two ways to install: [Docker](#use-docker) (recommended) or [build from source](#build-from-source).

## Use Docker

Use the same Docker image for every supported chain. Before starting the container, set `DEFRA_KEYRING_SECRET` and add each chain’s prefix, Generator HTTP URL, and P2P address to `config.yaml`.

1. Pull the image:

    ```shell
    docker pull shinzo-host-client:multichain-latest
    ```

1. Generate a secure key for the `DEFRA_KEYRING_SECRET`:

    ```shell
    openssl rand -hex 32
    ```

1. Save a copy of the release's [default configuration](https://github.com/shinzonetwork/shinzo-host-client/blob/main/config/config.yaml) as `config.yaml` in your working directory. Keep its other settings and add or replace the top-level `chains:` section. The example below serves Ethereum mainnet and BSC mainnet; replace each placeholder with a reachable Generator's details:

    ```yaml
    chains:
      - prefix: Ethereum__Mainnet
        generators:
          - url: http://<ethereum-generator-ip>:8080
            peer: /ip4/<ethereum-generator-ip>/tcp/9171/p2p/<ethereum-generator-peer-id>
      - prefix: BSC__Mainnet
        generators:
          - url: http://<bsc-generator-ip>:8080
            peer: /ip4/<bsc-generator-ip>/tcp/9171/p2p/<bsc-generator-peer-id>
        # max_blocks: 1000  # Optional retention limit for this chain
    ```

    Each `prefix` must match the Generator's chain exactly, including case. `url` is the Generator's HTTP API base URL; `peer` is its P2P multiaddr. Use the ports exposed by your Generator, which may differ from this example. The optional `max_blocks` overrides `pruner.max_blocks` for that chain.

    Without a `chains` key, the Host serves Ethereum only. Once you add it, list every chain you want to serve, including Ethereum. For a single-chain Host, keep only that chain's entry. A Host that does not serve Ethereum can remove the Ethereum peers from `defradb.p2p.bootstrap_peers`. Adding bootstrap peers alone does not enable another chain.

    At least one listed Generator for each chain must answer the HTTP schema request on first start. If none of the BSC Generators answers, BSC is disabled; a BSC-only Host will not start.

    {% <admonition type="warning"> %}
    **Check startup compatibility:** snapshots work only on an Ethereum-only Host, and event filtering works only on a single-chain Host. For the two-chain example above, keep `host.snapshot.enabled` and `shinzo.event_filter.enabled` set to `false`. The Host will not start with an incompatible feature enabled.
    {% </admonition> %}

    If your Generator client has a public hostname, use a `dns4` multiaddr instead:

    ```plaintext
    /dns4/<generator-hostname>/tcp/9171/p2p/<generator-peer-id>
    ```

    The peer ID is what libp2p authenticates the connection against, so an address without it won't connect. Read the peer ID from your Generator client's health endpoint:

    ```shell
    curl -s http://<generator-host>:8080/health | jq -r '.p2p.self.id'
    ```

    For the address portion, use the Generator client's public IP or hostname. Don't copy an address from `.p2p.self.addresses` in the health response: those are the addresses the Generator client listens on, and under Docker bridge networking they're loopback (`127.0.0.1`) and the container's internal IP, which your Host client can't reach.

1. From the directory containing `config.yaml`, create directories for the database, identity keys, and Lens files, then run the container with these directories and your configuration mounted:

    ```shell
    mkdir -p ~/data/defradb ~/data/keys ~/data/lens
    sudo chown -R 1001:1001 ~/data/defradb ~/data/keys ~/data/lens

    docker run -d \
      --name shinzo-host \
      -e DEFRA_KEYRING_SECRET="<your-strong-secret>" \
      -e DEFRA_URL="0.0.0.0:9181" \
      -v "$(pwd)/config.yaml:/app/config.yaml:ro" \
      -v ~/data/defradb:/app/.defra \
      -v ~/data/keys:/app/.defra/keys \
      -v ~/data/lens:/app/.defra/lens \
      -p 9181:9181 \
      -p 9182:9182 \
      -p 9171:9171 \
      -p 8080:8080 \
      shinzo-host-client:multichain-latest
    ```

    The database, identity keys, and Lens files are stored in these directories on your machine, so they remain available when you replace the container. Reuse the same directories and keyring secret when starting a replacement container.

    {% <admonition type="warning"> %}
    The container runs as UID/GID `1001:1001`. The `chown` command gives that user access to the mounted directories. Without the correct ownership, the Host can exit with a `permission denied` error on `.defra/keys`.
    {% </admonition> %}

    {% <admonition type="info"> %}
    **ARM machines (Apple Silicon):** check the finalized image's supported platforms. If it is `linux/amd64` only, add `--platform linux/amd64` to the `pull` and `run` commands to use emulation.
    {% </admonition> %}

1. The remaining settings, including the ShinzoHub endpoint used to fetch View definitions, come from your mounted configuration. The commands above publish these ports:

    | Port | Service | Notes |
    | --- | --- | --- |
    | <code style="white-space: nowrap;">9181</code> | DefraDB GraphQL + REST API | Applications send GraphQL queries to `/api/v0/graphql` on this port. For public access, use a reverse proxy with TLS. |
    | <code style="white-space: nowrap;">9182</code> | GraphQL Playground UI | Open `http://localhost:9182` in your browser to test GraphQL queries. The Playground must be included in the Host build; this port does not need to be publicly accessible. |
    | <code style="white-space: nowrap;">9171</code> | libp2p P2P networking | Must be reachable from the internet. Open or forward this port |
    | <code style="white-space: nowrap;">8080</code> | Health + metrics | Open inbound TCP `8080` in your firewall as well. The public Hosts dashboard probes `http://<your-server-ip>:8080/health` to decide whether your Host shows as online. |

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

1. To return real data, the Host must connect to the Generators configured under `chains`. On startup, the Host retrieves the chain schema from its configured Generators and initializes the corresponding DefraDB collections. Check the connection in the logs:

    ```shell
    docker logs shinzo-host | grep -i peer
    ```

    A healthy connection adds the Generator client's peer and keeps it. You should not see that peer stuck in a loop of `dial backoff` / `all dials failed`. Once it's syncing, query real data from the Playground or the API. See [query examples](/build/how-to/query-data/).

1. Check the status of each configured chain:

    ```shell
    curl -s http://localhost:8080/health | jq '.chains'
    ```

    `/health`, `/registration`, `/stats`, and `/metrics` report per-chain status under `chains`. Update monitoring that reads the removed top-level `current_block` or `last_processed` fields. A responding API alone does not confirm that every configured chain is syncing.

    Views that reference tables without a chain prefix are treated as Ethereum Views and will not load on a Host that does not serve Ethereum.

1. Confirm primitive data is arriving. For an Ethereum Host, query recent logs:

    ```shell
    curl -s http://localhost:9181/api/v0/graphql \
      -H "Content-Type: application/json" \
      -d '{"query":"{ Ethereum__Mainnet__Log(order: {blockNumber: DESC}, limit: 10) { address topics data blockNumber transactionHash } }"}'
    ```

    Returned records confirm that log data is available. An empty result can mean the Host has not received matching data yet; check per-chain health and Generator connections. For another chain, use its schema's collection name.

1. To serve data to the network, register your Host client with ShinzoHub. See [Register a Host](/run/run-a-host/register/).

Production deployments also put an nginx reverse proxy in front for TLS and [CORS](#cors-for-browser-access). The repo has example Compose files you can adapt if you prefer to orchestrate with Compose.

## Build from source

**Prerequisites**

- [Go 1.25+](https://go.dev/dl/)
- Make

When building outside Docker, the Wasmtime and Wasmer WASM runtimes must be on your `LD_LIBRARY_PATH`. The repo's [`Dockerfile`](https://github.com/shinzonetwork/shinzo-host-client/blob/main/Dockerfile) has the exact versions and install steps. The Docker build installs these automatically.

**Build**

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

**Configure and run**

Edit `config/config.yaml` using the `chains:` example and startup compatibility guidance in [Use Docker](#use-docker). Keep the other settings from the default configuration, list every chain to serve, and supply reachable Generator HTTP URLs and P2P addresses. You also need a keyring secret.

1. Export the secret key:

    ```shell
    export DEFRA_KEYRING_SECRET="<your-strong-secret>"
    ```

1. Run the client:

    {{<tab label="Run as a binary" />}}

    ```shell
    make start
    ```

    {{<endtab />}}

    {{<tab label="Without building the binary" />}}

    ```shell
    go run cmd/main.go
    ```

    {{<endtab />}}

1. Check the API, per-chain health status, and Generator connections using the verification steps above.

**Build tags**

| Tag | Effect |
| --- | --- |
| `hostplayground` | Embeds the GraphQL Playground UI (served on port `9182`) |

Ports, verification, and registration are the same as the Docker path above.

## Add or remove a chain

Edit the `chains:` list in your configuration and restart the Host. For Docker, edit the mounted `config.yaml`, then run:

```shell
docker restart shinzo-host
```

For a source build, edit `config/config.yaml` and restart the running process. Keep an entry for every chain you still want to serve, and check per-chain health after restarting. Review the snapshot and event-filter restrictions before changing the list.

Removing a chain stops its subscription after restart but leaves its stored data in place until the store is wiped. It does not reclaim disk space automatically.

## CORS for browser access

A stock Host client sends no CORS headers and it never passes any allowed origins to the embedded DefraDB. Cross-origin browser requests to your Host client will fail unless a reverse proxy in front adds the headers. `curl` requests works either way, so this only shows up in the browser. You only need it when a browser app queries your Host client directly, for example an [Explorer](https://explorer.shinzo.network/shinzohub) pointed at your endpoint.

Server-to-server traffic is unaffected. The Shinzo network explorer and the registration app probe registered Host clients from the server side, and the registration flow is a redirect from your client's `/registration-app` endpoint to `registration.shinzo.network`, so neither needs CORS on your Host.

To serve a browser app, put a reverse proxy in front (the [prod VM example](/run/run-a-host/deployment-examples/prod-vm-nginx-tls/) has a complete nginx config) and allow:

- Origin: the app's origin, echoed back in `Access-Control-Allow-Origin`. For the Shinzo explorer that is `https://explorer.shinzo.network`.
- Paths: `/api/v0/graphql` on the API port, and `/health`, `/metrics`, `/registration`, `/registration-app` on the health server port.
- Methods: `GET, OPTIONS` on the health server paths, and `GET, POST, PUT, DELETE, OPTIONS` on GraphQL.
- Headers: `Authorization, Content-Type, Accept, Origin`.
- Preflight: answer `OPTIONS` requests at the proxy. The reference nginx config returns `204` with the headers above.

If the proxy doesn't handle this, the Host answers `curl` but the browser app can't read it. See [Troubleshooting](/run/operations/troubleshooting/#my-host-client-answers-curl-requests-but-the-explorer-can-t-query-it).

## Need help

{{<need_help client="Host" repo_name="shinzo-host-client" repo="https://github.com/shinzonetwork/shinzo-host-client/issues" />}}
