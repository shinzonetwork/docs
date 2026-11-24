+++
path = "run/bnb/generator/verify"
aliases = ["run/chains/bnb/mainnet/generator/verify"]
title = "Verify a Generator — BNB Smart Chain Mainnet"
description = "Confirm the BSC source chain, health, schema, and advancing block data."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Verify a Generator"
product = "generator"
task = "verify"
+++

Run these checks after [starting the BSC Generator](/run/bnb/generator/install/) and before connecting a Host or requesting registration. A running process alone does not prove that it is indexing the correct chain.

## Check the source chain

Query the same HTTP RPC endpoint supplied in `GETH_RPC_URL`:

```shell
curl -fsS "$GETH_RPC_URL" \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

The result must be `0x38` (chain ID `56`). If it differs, correct the source endpoint before continuing. The BSC config's `chain.chain_id: 56` should also prevent startup against a mismatched EVM chain.

## Check health and progress

```shell
curl -fsS -H 'Accept: application/json' http://localhost:8080/health
```

Look for `status: healthy`, `defradb_connected: true`, and a `current_block` that advances as BSC Mainnet produces blocks. Repeat the check after a short interval. A recent `last_processed` value and advancing block height matter more than the process simply staying up. If `/health` responds with `503`, inspect the response and Generator logs for the failing check.

## Check the BSC schema

Use a token from `SCHEMA_API_KEYS` in your `.env` file:

```shell
curl -fsS http://localhost:8080/api/v1/schema/collections \
  -H 'Authorization: Bearer REPLACE_WITH_YOUR_SCHEMA_TOKEN'
```

The JSON response should identify `BSC__Mainnet` in its `network` field and list BSC collections. The BSC config enables token authentication by default. A `401` means the supplied token is missing or invalid; `503` can mean token mode was started without any `SCHEMA_API_KEYS` value. Do not move the token into YAML: the client reads it only from the environment.

## Check stored blocks

Query the local DefraDB GraphQL endpoint:

```shell
curl -fsS http://localhost:9181/api/v0/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ BSC__Mainnet__Block(limit: 1) { number hash } }"}'
```

Expect a nonempty `data.BSC__Mainnet__Block` array and no GraphQL `errors`. The query's HTTP status can be successful even when its JSON body contains errors, so inspect the body. Compare the returned block number or `/health`'s `current_block` again after more blocks arrive. An empty collection immediately after startup may simply mean the first block is still being processed; if it stays empty, inspect logs and the source RPC.

## Check Host connectivity

The supplied config listens for P2P traffic on TCP `9171`. Confirm that the intended Host can reach that port and that the Generator's Peer ID and connection address match what you gave the Host. Keep the local DefraDB GraphQL API on `9181` private. If Hosts need the authenticated schema endpoint, allow them to reach `8080` and give them a valid schema token.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Chain ID mismatch at startup | Check the BSC Mainnet RPC URL and `chain.chain_id: 56`. |
| `BSC__Mainnet__Block` missing or empty | Confirm `--config config/config_bsc.yaml` (or your BSC copy), inspect startup/schema errors, then check block and receipt RPC responses. |
| Schema endpoint returns `401` or `503` | Verify the bearer token and `SCHEMA_API_KEYS` environment value. |
| WebSocket dial fails | Check `GETH_WS_URL` and provider access. The client can continue with HTTP polling if HTTP connected successfully. |
| Blocks stop advancing or the provider throttles requests | Check source-node availability and receipt rate limits before increasing concurrency. |
| DefraDB reports write collisions after tuning | Restore `indexer.concurrent_blocks: 2`; keep any trial value at or below `8` while the collision issue is being resolved. |
| Startup reports file-descriptor or memory limits | Check the 8,192-descriptor process limit, the P2P resource budget, and `GOMEMLIMIT`. |

Once ingestion is stable, proceed to [registration](/run/bnb/generator/register/) if BSC onboarding is open for your operator role.

## Need help

{{<need_help client="Generator" repo_name="shinzo-generator-client" repo="https://github.com/shinzonetwork/shinzo-generator-client/issues" />}}
