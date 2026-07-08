+++
title = "FAQ"
description = "Troubleshooting and frequently asked questions about Shinzo Views, Viewkit, lenses, and deployment."
weight = 5
+++

## Common errors

### `image not found` / `library not loaded: libwasmer.dylib`

Viewkit uses the Wasmer runtime to execute WASM lenses locally. If the native library can't be found, any command that touches lenses will fail.

Fix: set the `WASMER_ROOT`, `WASMER_LIB_PATH`, and `DYLD_LIBRARY_PATH` (macOS) or `LD_LIBRARY_PATH` (Linux) environment variables. See the [Quick Start](/views/quickstart/#4-wasmer-runtime) for full instructions.

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

## Concepts

### Is there an `Event` collection?

No. Raw event data lives in the `Log` collection, where `topics` holds indexed parameters and `data` holds non-indexed ones. Use the `decode_log` lens to turn raw logs into decoded, structured output. See the [Examples](/views/examples/#example-2-decode-erc-20-transfer-events-canonical) for a complete walkthrough.

### What's the difference between `@materialized(if: true)` and `@materialized(if: false)`?

| `@materialized` | When it computes | Query speed | Storage |
| --- | --- | --- | --- |
| `if: true` | At write time (pre-computed) | Fast | Higher |
| `if: false` | At query time (on the fly) | Slower | Lower |

Use `if: true` for frequently queried data like token transfers in a UI. Use `if: false` during development or for large datasets queried occasionally. See [Example 5](/views/examples/#example-5-materialized-vs-on-query) for details.

### Do I need to prefix my query with `Ethereum__Mainnet__`?

Viewkit lets you use short names like `Log` or `Transaction` in your query. The Host client automatically prepends the chain prefix (`Ethereum__Mainnet__`) at runtime. You can also use the fully-qualified name explicitly. Both work.

### How do Hosts discover my View?

When you deploy a View to devnet, Viewkit submits a transaction to the View Registry precompile at `0x0210` on ShinzoHub. Host clients subscribe to registration events via a CometBFT WebSocket. When a new View is registered, each Host downloads the bundle, loads the WASM lens, and starts transforming data automatically. No restart is needed.

At startup, Hosts also fetch all previously registered Views from the ShinzoHub LCD endpoint, so they pick up Views that were registered while they were offline.

### Can I update a View that's already deployed?

On-chain registrations are permanent. You can't modify a deployed View in place. To ship changes, deploy a new version with the same name. The View ID is deterministic (`keccak256(sender, wireBytes)`), so a changed View produces a new ID and the Host will register it as a separate View.

For local development, you can iterate freely: update the query, SDL, and lenses, then redeploy with `--target local`. Use `view rollback` to revert to a previous local version if needed.

### How do applications query my deployed View?

Applications use the [app-sdk](https://github.com/shinzonetwork/app-sdk) to embed a local DefraDB instance, subscribe to Views, and query them with GraphQL. The app receives pre-processed data pushed from Hosts over P2P, with no per-query API calls. See the [Building Apps With Shinzo](/guides/building-apps-with-shinzo/) guide for details.

### What are attestations and how do they relate to Views?

When a Host receives the same block from multiple Generator clients, it creates an `AttestationRecord` tracking how many independent sources produced identical data. Each View gets its own attestation collection (e.g. `AttestationRecord_UsdcTransfer`). Applications can filter query results by attestation count to only trust data signed off by multiple generators.

See the [Building Apps With Shinzo](/guides/building-apps-with-shinzo/#attestations) guide for how to use attestation filters in queries.

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

## Need help

{{ need_help(client="View Creator", repo_name="shinzo-view-creator", repo="https://github.com/shinzonetwork/shinzo-view-creator/issues") }}
