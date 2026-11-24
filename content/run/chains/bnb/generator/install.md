+++
path = "run/bnb/generator/install"
aliases = ["run/chains/bnb/mainnet/generator/install"]
title = "Install a Generator — BNB Smart Chain Mainnet"
description = "Build the Generator, connect it to BSC Mainnet, and start it with the BSC configuration."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Install a Generator"
product = "generator"
task = "install"
+++

This guide runs the Generator from source with the repository's [BSC configuration](https://github.com/shinzonetwork/shinzo-generator-client/blob/main/config/config_bsc.yaml). It uses the EVM adapter binary, but all chain settings and source-node URLs must point to **BNB Smart Chain Mainnet**. Check the [prerequisites](/run/bnb/generator/prerequisites/) first.

## Build the Generator

```shell
git clone https://github.com/shinzonetwork/shinzo-generator-client.git
cd shinzo-generator-client
go mod download
make build
```

The [build guide](https://github.com/shinzonetwork/shinzo-generator-client/blob/main/BUILD.md) requires Go 1.27.3 or newer. `make build` produces `bin/block_poster_evm`, which runs BSC with the EVM adapter. Record the Git commit you built so you can reproduce the deployment.

## Add your BSC endpoints and secrets

Create a `.env` file in the repository root. Replace the example URLs and secret values with your own:

```dotenv
GETH_RPC_URL=https://your-bsc-mainnet-rpc.example
GETH_WS_URL=wss://your-bsc-mainnet-ws.example
GETH_API_KEY=
GETH_API_KEY_TYPE=
DEFRADB_KEYRING_SECRET=replace-with-a-stable-random-secret
SCHEMA_API_KEYS=replace-with-a-separate-random-token
```

Generate the secret and token separately, for example with `openssl rand -hex 32`, and keep secure copies. The secret must remain **unchanged across restarts** or the Generator cannot load its existing identity. Restrict access to the file:

```shell
chmod 600 .env
```

The `GETH_*` names are historical. Enter BSC Mainnet endpoints, not endpoints for another network. Leave `GETH_API_KEY` and `GETH_API_KEY_TYPE` empty only if your provider needs no API-key header; otherwise set the key and the exact header name it requires. The client loads `.env` from its working directory when it reads the config.

The BSC config uses `indexer.schema_auth_mode: token`. `SCHEMA_API_KEYS` must be supplied as an environment variable (comma-separated if using multiple tokens). Adding `schema_api_keys` to YAML has no effect. With token mode and no environment token, all schema requests return `503`.

## Review the BSC configuration

Run with the **full** `config/config_bsc.yaml`, not an excerpt copied into a new file. It sets `chain.name: BSC`, `chain.network: Mainnet`, `chain.chain_id: 56`, and `chain.adapter: evm`; the resulting collection prefix is `BSC__Mainnet`. Confirm that your source RPC reports `0x38` from `eth_chainId`.

| Setting | Supplied BSC value | Meaning |
| --- | --- | --- |
| `indexer.start_height` / `start_buffer` | `0` / `100` | Auto-detect the tip and begin 100 blocks behind it. Set an explicit start height when older data is required. |
| `indexer.concurrent_blocks` | `2` | Blocks processed concurrently. Start with this value. |
| `indexer.receipt_workers` | `16` | Receipt fetchers per block; make sure the RPC provider can handle the requests. |
| `indexer.blocks_per_minute` | `400` | Rate limit, not a promised indexing speed. |
| `pruner.max_blocks` / `max_blocks_per_cycle` | `16000` / `100` | Retention window and maximum blocks pruned in one cycle. |
| `snapshot.blocks_per_file` / `max_snapshots` | `100` / `200` | Snapshot size and maximum retained files. The 20,000-block snapshot coverage exceeds the pruning window. |
| `defradb.store.path` / `snapshot.dir` | `./.defra-bsc` / `./.defra-bsc/snapshots` | Persistent database and snapshot paths, relative to the working directory. |

The supplied P2P settings reserve 10,240 MiB and 8,192 file descriptors for the resource manager. Check that your machine and process limits can support them. The supplied `allowlist_cidrs: ["10.244.0.0/16"]` bypasses P2P resource limits for matching peers. If this is not a trusted pod network in your deployment, remove or replace it in a local copy of the config before starting. Then pass that copy to `--config` in the commands below.

### Optional concurrency tuning

If your node and Generator have capacity, you can increase `indexer.concurrent_blocks` from `2` to **4**, then up to **8**, in your BSC config. Watch block progress, RPC throttling, and DefraDB errors at each step. **Do not raise it above 8 for now:** higher values increase write collisions in DefraDB; the team is working on a fix. More concurrency is not guaranteed to improve throughput.

## Start the Generator

From the repository root, with the original BSC config:

```shell
ulimit -n 8192
GOMEMLIMIT=14GiB ./bin/block_poster_evm --config config/config_bsc.yaml
```

If you made a local copy to change deployment settings, pass its path instead. `GOMEMLIMIT=14GiB` assumes a 16 GB allocation; keep it below the machine or container limit and above the configured P2P memory budget. If `ulimit -n 8192` fails, raise the process limit through your operating system or service manager before starting. Run from the repository root so `.env` and relative data paths resolve correctly.

The command runs in the foreground. For a long-running instance, run it under a service manager and keep the working directory, `.env`, BSC config, database, snapshots, and identity keys persistent.

### Run with systemd

Create a service unit after replacing the user and repository path with values for your machine:

```ini
[Unit]
Description=Shinzo BSC Generator
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=generator-user
WorkingDirectory=/path/to/shinzo-generator-client
Environment=GOMEMLIMIT=14GiB
LimitNOFILE=8192
ExecStart=/path/to/shinzo-generator-client/bin/block_poster_evm --config config/config_bsc.yaml
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Save it as `/etc/systemd/system/shinzo-bsc-generator.service`, then run:

```shell
sudo systemctl daemon-reload
sudo systemctl enable --now shinzo-bsc-generator
sudo journalctl -u shinzo-bsc-generator -f
```

The service user needs read access to `.env` and the config, and write access to the database, snapshot, and identity-key paths. If you use a local copy of the BSC config, change the `--config` path in `ExecStart` too.

## Ports and access

| Port | Purpose | Access |
| --- | --- | --- |
| `8080` | Health, metrics, snapshots, and authenticated schema endpoint. | Allow only the Hosts and operators that need these endpoints; protect the schema token. |
| `9171` | DefraDB P2P, used by Hosts to receive data. | Reachable from the Hosts that connect to this Generator. |
| `9181` | Local DefraDB GraphQL API. | Keep local or on a trusted private network. |

The BSC config enables the health server, P2P, pruning, and snapshots by default. Expose only the endpoints your deployment needs.

## Next steps

Continue to [Verify & troubleshoot](/run/bnb/generator/verify/) to confirm BSC blocks and schemas are advancing. Running the process does not by itself prove that the correct chain is being indexed. [Registration](/run/bnb/generator/register/) is a separate step.
