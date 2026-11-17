+++
path = "run/chains/bnb/mainnet/generator/install"
title = "Install a Generator \u2014 BNB Smart Chain Mainnet"
description = "Build the BSC-capable Generator and start it with its BSC configuration."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Install a Generator"
product = "generator"
task = "install"
+++

## Check out the reviewed source

```shell
git clone https://github.com/shinzonetwork/shinzo-generator-client.git shinzo-generator-bsc
cd shinzo-generator-bsc
git checkout 855509506246cc84062ca306e58309854a52691c
make build
```

Use the toolchain from [Prerequisites](../prerequisites/). This pins the commands to the source reviewed here instead of assuming a BSC release image.

## Configure the connection and secrets

Create `.env` in this dedicated checkout and restrict its permissions. Replace the endpoint values and both secret placeholders before starting:

```dotenv
GETH_RPC_URL=https://your-bsc-mainnet-endpoint
GETH_WS_URL=wss://your-bsc-mainnet-endpoint
GETH_API_KEY=
GETH_API_KEY_TYPE=
DEFRADB_KEYRING_SECRET=replace-with-a-generated-stable-secret
SCHEMA_AUTH_MODE=token
SCHEMA_API_KEYS=replace-with-a-generated-schema-token
GOMEMLIMIT=14GiB
```

Generate each secret separately with `openssl rand -hex 32`, save it, and do not regenerate the identity secret on restart. `GOMEMLIMIT=14GiB` assumes a 16 GB allocation; size it together with the P2P and database budgets. Export `GOMEMLIMIT` to the shell when starting directly rather than through Make.

```shell
chmod 600 .env
```

Leave API-key values empty only if your source endpoint does not require authentication. Set the provider's required header name in `GETH_API_KEY_TYPE`.

## Select the BSC configuration

The checked-in `config/config_bsc.yaml` defines:

```yaml
chain:
  name: BSC
  network: Mainnet
  chain_id: 56
  adapter: evm
```

Keep the full supplied configuration; this excerpt is not a replacement file. It sets the database path to `./.defra-bsc`, retention to 16,000 blocks, and source pacing to 400 blocks per minute. Reassess throughput and retention against your workload rather than treating those defaults as guarantees.

```shell
make start-bsc
```

This runs `./bin/block_poster -config config/config_bsc.yaml` in the foreground. Run only this deployment in this checkout: its identity keys are in the sibling `keys/` directory. Back up both the stable secret and keys. Use separate directories and ports if running another chain on the same machine.

## Verify before registration

Continue to [Verify & troubleshoot](../verify/). A running process alone does not establish correct BSC ingestion or registry eligibility.
