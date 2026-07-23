+++
title = "Troubleshooting"
aliases = ["/generator/faq", "/generators/frequently-asked-questions", "/generators/faq", "/hosts/faq", "/hosts/frequently-asked-questions", "/views/faq"]
description = "Common errors, troubleshooting steps, and frequently asked questions for Generator clients, Host clients, and Viewkit."
+++

## Generator client

### What is the GitHub link for the Shinzo Generator client?

https://github.com/shinzonetwork/shinzo-generator-client

### Does the Generator client replace my Ethereum node?

No. The Generator client is a sidecar that connects to an existing Ethereum execution node. It does not run an execution client, expose a JSON-RPC interface, or replace the execution node used by your validator. Instead, you configure it to connect to an upstream JSON-RPC and WebSocket endpoint (Geth is supported). The Generator client reads block data from that execution node and stores it in its local DefraDB instance.

### What hardware is recommended for deploying Shinzo?

The Generator client is lightweight on CPU, but storage performance and host stability matter for reliable operation. See the [hardware requirements page](/run/run-a-generator/hardware-requirements/) for the full table.

### Which RPC methods does the Generator client call on the upstream node?

The Generator client reads from whatever execution node you point it at. That upstream node must support these methods:

- `eth_getTransactionReceipt` (required)
- `eth_getBlockByNumber` (required)
- `eth_getLogs`
- `eth_call`
- `eth_getBlockByHash`
- `net_version`
- `net_peers`
- `eth_getUncleByBlockHashAndIndex`
- `eth_getBlockReceipts`

> Note: The Generator client only actively calls `eth_getBlockByNumber` and `eth_getTransactionReceipt` to ingest data. The other methods are listed for compatibility.

### What happens if I lose my node-identity-key? Can I regenerate it?

If you lose your `node-identity-key`, your node's identity is permanently lost.

- The key cannot be regenerated
- You must spin up a new instance of the Generator client
- You must register again with a new identity
- The new node may use the same EVM address, but it will be treated as a new identity

To avoid this, always back up your node-identity-key.

### How can I backup my keys?

By default your DefraDB keys are stored in `~/.defra/keys`. To back them up, simply copy them from that location to another. For example, if you were backing up your keys to a mounted external drive, you would run:

```shell
cp -r ~/.defra/keys /mnt/backup-drive/
```

### What types of data are indexed?

All blockchain data is indexed, including blocks, transactions, logs, and storage access lists. The data is indexed by hash (block and transaction), block number, and document.

### How much space do I need?

With pruning enabled (the default), the Generator's own data stays bounded at roughly 50 to 100 GB; we recommend provisioning 300–500 GB to leave headroom (see [hardware requirements](/run/run-a-generator/hardware-requirements/)). The pruner retains the last 1,000 blocks by default and reclaims older ones. Without pruning, storage grows with chain history.

### How long does it take to sync?

Sync time depends entirely on the chosen start height. The further back the Generator client begins, the longer it will take to catch up to the current block height. The Generator client processes blocks approximately 2–4 seconds per block, which is faster than Ethereum's 12-second block time. This allows the Generator client to gradually close any sync gap after initial backfilling.

### How do I choose a start height?

The further back you choose, the longer it will take to get to current blocks. However, the further back you index, the more you contribute to the network.

### How often is the Generator client updated with new blocks?

The Generator client fetches blocks by block number from the upstream Ethereum node it is configured to read from. As soon as a block becomes available on that node after being gossiped and finalized on the network, the Generator client can pull it in. The Generator client does not participate in consensus or gossip itself; it just reads from a node that does.

### How does storage grow over time?

Without pruning, storage grows linearly at roughly 10 GB per 1,000 full blocks. The first 15M blocks of Ethereum are significantly smaller than blocks after the proof-of-stake migration.

With pruning enabled (the default), the pruner removes documents for blocks older than the configured retention window, keeping disk usage bounded. You can also passively prune documents that have already been gossiped, which clears up old blocks and reduces long-term storage pressure.

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

The Generator client falls back to HTTP polling. Check that `GETH_WS_URL` is correct and the port is reachable. HTTP-only mode works but is slightly slower.

## Host client

### What is the GitHub link for the Shinzo Host?

[github.com/shinzonetwork/shinzo-host-client](https://github.com/shinzonetwork/shinzo-host-client)

### What is the difference between a Host and a Generator?

Generator clients are the write side: they read raw blocks from an Ethereum execution node, sign the data, and gossip it over P2P. Host clients are the read side: they receive those signed primitives, verify them, run WebAssembly lens transforms to build Views, and serve the results to applications over GraphQL. A Generator client talks to a source-chain node; a Host client never does. See the [Run a Host](/run/run-a-host/) overview for more.

### Do I need to run my own Generator client to run a Host client?

No, but you do need access to at least one working Generator client. A Host client doesn't read the source chain itself; it receives signed primitives from Generator clients over P2P, so it needs at least one reachable Generator client to sync from. That Generator client doesn't have to be _yours_, you can point at any one you can reach. The image ships with default peers, but they aren't guaranteed to be live, so in practice set `BOOTSTRAP_PEERS` to a Generator client you know is up (see [Install](/run/run-a-host/install/)).

A public Generator client you can point at is planned; this page will link it once it's live.

### Can I connect my Host client to my own Generator client?

Yes, this is the normal way to run a Host client. Point it at your Generator client's libp2p multiaddr.

With Docker, pass it as an environment variable:

```shell
-e BOOTSTRAP_PEERS="/ip4/<generator-ip>/tcp/9171/p2p/<generator-peer-id>"
```

When building from source, set `defradb.p2p.bootstrap_peers` in your `config.yaml` instead.

The multiaddr must end in the Generator client's peer ID, because libp2p authenticates the connection against it, so a bare IP won't connect. Read the IP and peer ID from the Generator client's health endpoint:

```shell
curl -s http://<generator-host>:8080/health | jq -r '.p2p.self'
```

The peer ID is derived from the Generator client's keyring secret, so it's stable across restarts as long as that secret doesn't change. If you run the Host client and Generator client on the same machine, remap the Host client's published ports (the `-p` flags, or `defradb.url` and the P2P ports for a source build) so they don't collide with the Generator client's `9181` and `9171`.

### What hardware is recommended for running a Host client?

See [Hardware requirements](/run/run-a-host/hardware-requirements/) for a detailed rundown of hardware recommendations.

### How do Views and lenses arrive on my Host client?

Developers register Views on ShinzoHub. Each View defines a WebAssembly lens that filters, decodes, and reshapes primitive data. Your Host client queries ShinzoHub for registered Views, downloads the lens for each, runs it against the primitives it receives from Generator clients, and writes the results to its local DefraDB. Applications query those documents over GraphQL. The ShinzoHub connection and the Generator client connection are separate: the Host client learns _which_ Views exist from ShinzoHub, but the raw data to run them on comes from a Generator client, so registered Views will appear before any data does if no Generator client is connected.

### What are attestation records?

When a Host client receives the same block from multiple independent Generator clients, it verifies each signature and creates an `AttestationRecord` that tracks how many Generator clients produced identical data. These records replicate between Host clients using a P-counter CRDT, which lets applications check how many independent sources agree on a piece of data before trusting it.

### Which ports does the Host client use?

| Port | Service |
| --- | --- |
| `9181` | DefraDB GraphQL + REST API. |
| `9182` | GraphQL Playground UI (the DefraDB GraphQL port + 1). |
| `9171` | libp2p P2P networking. Must be reachable for the Host client to connect to Generator clients. |
| `8080` | Health (`/health`) and metrics (`/metrics`) server. |

### How do I back up my keys?

Your node identity key is your Host's identity on the network. Lose it without a backup and you can't restore the same identity.

Where it lives depends on how you run the Host client:

- **Build from source:** `~/.defra/keys` by default.
- **Docker with persistence:** the host directory you mounted to `/app/.defra/keys` (for example `~/data/keys`).
- **Docker without volume mounts:** the key only exists inside the container and is lost when the container is removed. Mount a volume before you rely on a Host keeping its identity.

Copy the directory somewhere safe:

```shell
cp -r ~/.defra/keys /mnt/backup-drive/   # adjust the source path to match your setup
```

See [Register](/run/run-a-host/register/#back-up-your-node-identity-key) for more.

### My Host client starts but connects to no peers. What's wrong?

The Host client is running but can't sync from a Generator client. Check `docker logs shinzo-host` (or the process output for a source build) for the specific cause:

- `peer id mismatch: expected <A>, but remote key matches <B>` means the peer ID in your multiaddr is wrong or out of date. The Generator client at that address is running a different identity than the multiaddr claims; get the current one from its `/health` endpoint (`.p2p.self.id`). This also happens when you rely on the image's built-in default peers and they've gone stale; set `BOOTSTRAP_PEERS` to a current Generator client instead.
- `all dials failed` / `no route to host` / `i/o timeout` all mean that the address is unreachable. Confirm the Generator client is up and that outbound port `9171` is open from your machine.
- `dial tcp4 ... i/o timeout` usually indicates that you're running the Host client on an IPv6-only machine. The IPv4 peers are unreachable. Run on a dual-stack host, or enable NAT64/DNS64.

See [Install](/run/run-a-host/install/#use-docker) for how to confirm a healthy connection.

## Viewkit

### image not found / library not loaded: libwasmer.dylib

Viewkit uses the Wasmer runtime to execute WASM lenses locally. If the native library can't be found, any command that touches lenses will fail.

Fix: set the `WASMER_ROOT`, `WASMER_LIB_PATH`, and `DYLD_LIBRARY_PATH` (macOS) or `LD_LIBRARY_PATH` (Linux) environment variables. See [Create a View](/build/create-a-view/#wasmer-runtime) for full instructions.

Quick check:

```shell
echo "$WASMER_ROOT"
ls "$WASMER_ROOT"
# you should see libwasmer.dylib (macOS) or libwasmer.so (Linux)
```

If the file is missing, re-run `go get github.com/wasmerio/wasmer-go@v1.0.4` and ensure `go env GOPATH` returns a valid path.

### `invalid target 'testnet'. Must be one of: local, devnet, mainnet`

The `--target` flag only accepts `local`, `devnet`, or `mainnet`. There is no `testnet` target.

Fix: use `--target devnet`:

```shell
viewkit view deploy my-view --target devnet --rpc http://34.29.171.79:8545/
```

`mainnet` is not yet supported and will return an error.

### `--rpc is required when --target is devnet`

Devnet deployments require an RPC endpoint.

Fix: add the `--rpc` flag:

```shell
viewkit view deploy my-view --target devnet --rpc http://34.29.171.79:8545/
```

### `either --path or --url must be provided`

The `view add lens` command requires either `--path` (local WASM file) or `--url` (remote URL), and `--label` is always required.

Fix:

```shell
# from a URL (recommended)
viewkit view add lens \
  --label "decode" \
  --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm" \
  --args '{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",...}]"}' \
  --name my-view

# from a local file
viewkit view add lens \
  --label "filter" \
  --path ./my-lens.wasm \
  --name my-view
```

### `invalid --args JSON`

Lens arguments must be a valid JSON object where all values are strings.

Fix: ensure all values are strings, not numbers or nested objects:

```shell
# correct
--args '{"src":"address", "value":"0x..."}'

# incorrect, value is a number
--args '{"count": 5}'

# correct, number as string
--args '{"count": "5"}'
```

For ABI arguments, pass the ABI array as a stringified JSON string:

```shell
--args '{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",...}]"}'
```

### `collection already exists`

This error can appear when deploying a View whose output collection already exists in the local DefraDB instance (e.g. from a previous deployment). It is informational and can be safely ignored. The existing collection will be used.

If you need a clean slate, stop the local DefraDB instance (Ctrl+C), delete the local data directory, and redeploy.

### Is there an `Event` collection?

No. Raw event data lives in the `Log` collection, where `topics` holds indexed parameters and `data` holds non-indexed ones. Use the `decode_log` lens to turn raw logs into decoded, structured output. See the [View examples](/build/create-a-view/examples/) for a complete walkthrough.

### What's the difference between `@materialized(if: true)` and `@materialized(if: false)`?

| `@materialized` | When it computes | Query speed | Storage |
| --- | --- | --- | --- |
| `if: true` | At write time (pre-computed) | Fast | Higher |
| `if: false` | At query time (on the fly) | Slower | Lower |

Use `if: true` for frequently queried data like token transfers in a UI. Use `if: false` during development or for large datasets queried occasionally.

### Do I need to prefix my query with `Ethereum__Mainnet__`?

Viewkit lets you use short names like `Log` or `Transaction` in your query. The Host client automatically prepends the chain prefix (`Ethereum__Mainnet__`) at runtime. You can also use the fully-qualified name explicitly. Both work.

### How do Hosts discover my View?

When you deploy a View to devnet, Viewkit submits a transaction to the View Registry precompile at `0x0210` on ShinzoHub. Host clients subscribe to registration events via a CometBFT WebSocket. When a new View is registered, each Host downloads the bundle, loads the WASM lens, and starts transforming data automatically. No restart is needed.

At startup, Hosts also fetch all previously registered Views from the ShinzoHub LCD endpoint, so they pick up Views that were registered while they were offline.

### Can I update a View that's already deployed?

On-chain registrations are permanent. You can't modify a deployed View in place. To ship changes, deploy a new version with the same name. The View ID is deterministic (`keccak256(sender, wireBytes)`), so a changed View produces a new ID and the Host will register it as a separate View.

For local development, you can iterate freely: update the query, SDL, and lenses, then redeploy with `--target local`. Use `view rollback` to revert to a previous local version if needed.

### How do applications query my deployed View?

Applications use the [app-sdk](https://github.com/shinzonetwork/app-sdk) to embed a local DefraDB instance, subscribe to Views, and query them with GraphQL. The app receives pre-processed data pushed from Hosts over P2P, with no per-query API calls. See [Build an app](/build/build-an-app/) for details.

### What are attestations and how do they relate to Views?

When a Host receives the same block from multiple Generator clients, it creates an `AttestationRecord` tracking how many independent sources produced identical data. Each View gets its own attestation collection (e.g. `AttestationRecord_UsdcTransfer`). Applications can filter query results by attestation count to only trust data signed off by multiple generators.

See [Build an app](/build/build-an-app/#attestations) for how to use attestation filters in queries.

## Tips

### Always test before deploying

```shell
viewkit view test my-view
```

This catches schema errors, invalid lens configurations, and compile failures before you deploy. It's faster than deploying and debugging in the Playground.

### Use `--verbose` to see revision history

```shell
viewkit view inspect my-view --verbose
```

Every `add` and `remove` creates a new revision. `--verbose` shows the full history, which helps when deciding which version to roll back to.

### Keep the full SDL when updating

`view add sdl` replaces the entire SDL. It does not merge with the previous one. Always provide the complete type definition, including all existing fields plus any new ones.

### Use labels to manage lenses

Lens labels (`--label`) are how you identify and remove individual lenses in a chain. Use descriptive labels like `filter-usdc` or `decode-transfer` rather than generic ones like `lens1`.
