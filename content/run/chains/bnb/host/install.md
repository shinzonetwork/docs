+++
path = "run/chains/bnb/mainnet/host/install"
title = "Install a Host \u2014 BNB Smart Chain Mainnet"
description = "Connect the released Host to BNB Smart Chain Generators with an explicit chain configuration."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Install a Host"
product = "host"
task = "install"
+++

## Create an isolated deployment

This guide targets the Host's `v0.7.2-ethereum-mainnet` artifact. Its suffix is historical; the reviewed release accepts the explicit `BSC__Mainnet` chain configuration below. This recipe is source-reviewed, not a live deployment certification.

```shell
mkdir shinzo-host-bnb
cd shinzo-host-bnb
mkdir -p data
sudo chown 1001:1001 data
```

## Save the configuration

Create `config.yaml` with the following content. Replace the Generator URL and full peer multiaddr with your BNB Smart Chain Generator's actual connection details. `url` is the HTTP API **base URL**, not the schema method itself.

```yaml
defradb:
  url: localhost:9181
  p2p:
    enabled: true
    bootstrap_peers: []
    listen_addr: /ip4/0.0.0.0/tcp/9171
  store:
    path: ./.defra
chains:
  - prefix: BSC__Mainnet
    generators:
      - url: https://your-generator.example
        peer: /dns4/your-generator.example/tcp/9171/p2p/REPLACE_WITH_PEER_ID
shinzo:
  hub_base_url: testnet.shinzo.network
  event_filter:
    enabled: false
host:
  health_server_port: 8080
  lens_registry_path: ./.defra/lens
  snapshot:
    enabled: false
schema:
  indexer_schema_endpoint: /api/v1/schema
  http_client_timeout_secs: 30
pruner:
  enabled: true
  max_blocks: 2000
  interval_seconds: 30
logger:
  development: false
```

`max_blocks` is a retention policy in **source-chain blocks**, not hours. Review the desired history and storage before choosing a production value. All Generators listed under one prefix must serve that same chain and network. Keep `bootstrap_peers` empty to avoid inheriting unrelated Ethereum peers from older examples.

## Configure secrets

Create `.env` with a generated stable Host secret and the single schema token supplied by your Generator operator:

```dotenv
DEFRA_KEYRING_SECRET=replace-with-a-generated-stable-secret
INDEXER_SCHEMA_ENDPOINT_AUTH_TOKEN=replace-with-your-generator-schema-token
GOMEMLIMIT=14GiB
```

Generate the Host secret with `openssl rand -hex 32` and preserve it with your identity backup. The schema token must match an accepted Generator token; generating an unrelated value will not authenticate. Omit the schema-token line only if the Generator uses no token authentication.

```shell
chmod 600 .env
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.7.2-ethereum-mainnet
docker run -d --name shinzo-host-bnb \
  --env-file .env --memory 16g \
  -v "$PWD/config.yaml:/app/config.yaml:ro" \
  -v "$PWD/data:/app/.defra" \
  -p 127.0.0.1:9181:9181 \
  -p 9171:9171 -p 8080:8080 \
  ghcr.io/shinzonetwork/shinzo-host-client:v0.7.2-ethereum-mainnet
```

The 16 GB container limit and 14 GiB runtime budget form a consistent example allocation, not a measured minimum. Change both together when sizing the machine. This example binds GraphQL to localhost; public browser access requires the [proxy and CORS setup](/run/run-a-host/install/#cors-for-browser-access).

If running a Generator on the same machine, select unused host-side port mappings and update your checks and registered endpoint accordingly. The container paths remain unchanged.

## Confirm the configuration was loaded

```shell
docker logs shinzo-host-bnb
curl -fsS http://localhost:8080/health
```

The config mount is required; merely creating `config.yaml` does not make Docker read it. Continue to [Verify & troubleshoot](../verify/) before [registration](../register/).
