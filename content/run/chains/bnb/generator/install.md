+++
path = "run/bnb/generator/install"
aliases = ["run/chains/bnb/mainnet/generator/install"]
title = "Install a Generator \u2014 BNB Smart Chain Mainnet"
description = "Build the EVM Generator and run it with the BSC configuration and source-node credentials."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Install a Generator"
product = "generator"
task = "install"
+++

## Build the Generator

```shell
git clone https://github.com/shinzonetwork/shinzo-generator-client.git
cd shinzo-generator-client
make build
```

Use the toolchain from [Prerequisites](../prerequisites/). The current build produces `bin/block_poster_evm`, which handles BSC through the EVM adapter. Record and pin the source commit you deploy so that a future change to `main` does not silently change your running version. This guide does not assume a published BSC Docker image.

## Configure the connection and secrets

Create `.env` in this checkout and restrict its permissions. The Generator loads this file when it reads the configuration. Replace the endpoint values and both secret placeholders before starting:

```dotenv
GETH_RPC_URL=https://your-bsc-mainnet-endpoint
GETH_WS_URL=wss://your-bsc-mainnet-endpoint
GETH_API_KEY=
GETH_API_KEY_TYPE=
DEFRADB_KEYRING_SECRET=replace-with-a-generated-stable-secret
SCHEMA_API_KEYS=replace-with-a-generated-schema-token
```

Generate each secret separately with `openssl rand -hex 32`, save it, and do not regenerate the identity secret on restart. The BSC file already sets schema authentication to `token`; `SCHEMA_API_KEYS` **must** be supplied through the environment, not as a YAML key. Without a key, schema requests return 503.

```shell
chmod 600 .env
```

Leave API-key values empty only if your source endpoint does not require authentication. Set the provider's required header name in `GETH_API_KEY_TYPE`. The `GETH_*` names are historical; the values must point to **BSC Mainnet**, not Ethereum. The config's `chain_id: 56` identifies BSC, and the source endpoint should report `0x38` from `eth_chainId`.

## Select the BSC configuration

Use the full [BSC configuration](https://github.com/shinzonetwork/shinzo-generator-client/blob/main/config/config_bsc.yaml) supplied with the Generator. Its chain identity is:

```yaml
chain:
  name: BSC
  network: Mainnet
  chain_id: 56
  adapter: evm
```

The excerpt is **not** a replacement config file. Keep the other sections of `config/config_bsc.yaml` and review these BSC defaults before starting:

| Setting | Supplied value | What to check |
| --- | --- | --- |
| `defradb.store.path` | `./.defra-bsc` | Keep this directory persistent and back it up with the identity keys. |
| `indexer.start_height` / `start_buffer` | `0` / `100` | An automatic start begins near the chain tip, 100 blocks back; set an explicit height if you need older data. |
| `indexer.concurrent_blocks` | `2` | Start with this value. See the tuning note below. |
| `indexer.receipt_workers` | `16` | Confirm that your RPC provider can serve the resulting receipt traffic. |
| `indexer.blocks_per_minute` | `400` | This is a rate limit, not a throughput guarantee. |
| `pruner.max_blocks` | `16000` | Retention is measured in BSC blocks, not Ethereum blocks. |
| `snapshot.enabled` | `true` | Keep snapshot storage available if you keep pruning enabled. |

The supplied P2P memory budget assumes a 16 GB deployment and sets `resource_file_descriptors: 8192`; the process file-descriptor limit must support that value. The example `allowlist_cidrs: ["10.244.0.0/16"]` is for a particular Kubernetes pod network and bypasses P2P resource limits for matching peers. Remove or replace it unless that CIDR is trusted in your deployment.

### Optional block concurrency

The config starts at `indexer.concurrent_blocks: 2`. If your source endpoint and machine have capacity, operators can try **4 to 8** concurrent blocks by editing that value in the full BSC config. Increase gradually while watching block progress and DefraDB errors. **Do not set it above 8 for now:** higher concurrency increases DefraDB write collisions; the team is working on that issue. More concurrency is not a guaranteed speedup.

## Start with the BSC config

```shell
GOMEMLIMIT=14GiB ./bin/block_poster_evm --config config/config_bsc.yaml
```

Run this from the repository root so the relative config and data paths resolve as written. The command runs in the foreground. `GOMEMLIMIT=14GiB` assumes a 16 GB allocation; set it below the machine or container limit and above the supplied P2P memory budget. Keep BSC in its own checkout and data directory; back up both the stable secret and identity keys. Use separate directories and ports if running another chain on the same machine.

## Verify before registration

Continue to [Verify & troubleshoot](../verify/). A running process alone does not establish correct BSC ingestion or registry eligibility.
