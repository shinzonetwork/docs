+++
path = "run/tron/generator/install"
aliases = ["run/chains/tron/mainnet/generator/install"]
title = "Install a Generator \u2014 TRON Mainnet"
description = "Build the TRON-specific executable from the reviewed integration branch."
template = "chain-page.html"
[extra]
chain = "tron"
heading = "Install a Generator"
product = "generator"
task = "install"
+++

{% <admonition type="info"> %}
**Integration preview:** pinned to `0df7592`. The EVM executable and Ethereum install script are not substitutes for this build.
{% </admonition> %}

## Build the TRON executable

```shell
git clone --branch aleks/tron-integration https://github.com/shinzonetwork/shinzo-generator-client.git shinzo-generator-tron
cd shinzo-generator-tron
git checkout 0df7592fcf1a18ce9fdcbe44da82d3afea9e074b
make tron-build
```

The output is `bin/block_poster_tron`. The branch has separate EVM and TRON build targets.

## Configure the source APIs

Create `.env` in the checkout. Use HTTP **base URLs**, without appending a `/wallet/...` method. Replace the secret values before running:

```dotenv
TRON_RPC_URL=https://your-tron-mainnet-fullnode
TRON_SOLIDITY_RPC_URL=https://your-tron-mainnet-solidity-api
TRON_API_KEY=
TRON_API_KEY_TYPE=TRON-PRO-API-KEY
TRON_DIAL_TIMEOUT_SECONDS=10
DEFRADB_KEYRING_SECRET=replace-with-a-generated-stable-secret
SCHEMA_AUTH_MODE=token
SCHEMA_API_KEYS=replace-with-a-generated-schema-token
GOMEMLIMIT=14GiB
```

For a gateway serving both wallet APIs, set the two URLs to the same base URL. Leave the API key empty only for an unauthenticated endpoint. The standard TronGrid header is `TRON-PRO-API-KEY`; use your gateway's header if different.

Generate the identity secret and schema token separately with `openssl rand -hex 32`, and preserve them. Restrict the environment file:

```shell
chmod 600 .env
```

The memory limit above assumes a 16 GB allocation. Keep the supplied resource budgets consistent with the actual machine.

## Start the adapter

The full `config/config_tron.yml` selects `name: Tron`, `network: Mainnet`, and `adapter: tron`. It uses `./.defra-tron` for the store and a sibling `keys/` directory for identity. Preserve both the keys and secret across restarts.

```shell
make tron-start
```

This invokes `./bin/block_poster_tron -config config/config_tron.yml` in the foreground. Use a separate working directory and non-conflicting ports if another client runs on the same machine. The defaults use health port 8080, GraphQL port 9181, and P2P port 9171.

## Configuration boundaries

The branch config retains 1,000 blocks and paces reads at 20 blocks per minute. Those are supplied defaults, not performance targets validated by this guide. Generator snapshot production does not mean the released Host can import TRON snapshots.

Proceed to [verification](../verify/). Do not interpret successful indexing as approved registry participation.
