+++
title = "Lenses"
description = "How WASM lens transforms work in Shinzo Views: available lenses, arguments, chaining, and authoring new ones."
weight = 4
+++

Lenses are WebAssembly (WASM) modules that transform raw primitive data into structured View output. A lens takes a document in (e.g. a raw `Log` with `topics` and `data`) and produces a document out (e.g. an `EthEvent` with decoded `event`, `signature`, and `arguments` fields).

Every Host that runs a View executes the same lens on the same data, so the output is deterministic and verifiable. If two Hosts disagree, something is wrong.

## When you need a lens

| Scenario | Lens needed? |
| --- | --- |
| ABI-decode event logs into named fields | Yes, `decode_log` or `decode_log_str` |
| Decode function calls from transaction `input` data | Yes, `decode_function_call` or `decode_function_call_str` |
| Expose a subset of `Transaction` fields | No, query + SDL is enough |
| Filter transactions by `to` address | No, use a GraphQL filter in the query |
| Filter decoded events by contract address | No, filter on `logAddress` in GraphQL queries |

If your View just selects and renames fields from a primitive collection, you don't need a lens. DefraDB handles that as a virtual projection. You need a lens when the transform requires logic that GraphQL can't express: ABI decoding, hex-to-decimal conversion, or field restructuring.

## Available lenses

Lenses are stored in the [`wasm-bucket`](https://github.com/shinzonetwork/wasm-bucket) repository. Each lens is a compiled `.wasm` binary hosted at a raw GitHub URL.

### `decode_log`

ABI-decodes EVM event logs. Takes a JSON array of Solidity event definitions, matches each log's `topics[0]` against the event signature hash, and decodes the log into structured output.

URL:

```plaintext
https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm
```

Arguments:

| Argument | Type | Description |
| --- | --- | --- |
| `abi` | String (stringified JSON) | Array of event ABI definitions |

Output fields:

| Field | Type | Description |
| --- | --- | --- |
| `hash` | String | Parent transaction hash |
| `from` | String | Parent transaction sender |
| `to` | String | Parent transaction recipient |
| `blockNumber` | Int | Block number |
| `logAddress` | String | Contract that emitted the log |
| `event` | String | Decoded event name (e.g. `"Transfer"`) |
| `signature` | String | Event signature (e.g. `"Transfer(address,address,uint256)"`) |
| `arguments` | [String] | Decoded parameters as JSON array |

The `hash`, `from`, and `to` fields come from the parent transaction. To populate them, include `transaction { hash from to }` in your View's source query.

Example:

```shell
viewkit view add lens \
  --label "decode-transfer" \
  --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm" \
  --args '{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",\"inputs\":[{\"type\":\"address\",\"name\":\"from\",\"indexed\":true},{\"type\":\"address\",\"name\":\"to\",\"indexed\":true},{\"type\":\"uint256\",\"name\":\"value\",\"indexed\":false}]}]"}' \
  --name my-view
```

### `decode_log_str`

Same as `decode_log`, but serializes `arguments` as a JSON string instead of a JSON array. This enables `_like` / `_ilike` filtering on decoded parameter values in DefraDB queries.

URL:

```plaintext
https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log_str/decode_log_str.wasm
```

Arguments: same as `decode_log` (`abi`).

Output fields: same as `decode_log`, except `arguments` is a `String` (JSON string) instead of `[String]`.

When to use: `decode_log_str` when you need to filter query results by decoded parameter values (e.g. "all transfers where a specific address is the sender"). `decode_log` when you only need to read the arguments and don't need server-side filtering on them.

### `decode_function_call`

ABI-decodes function calls from a transaction's `input` data. Useful for Views that track specific contract method calls (e.g. all `transfer` calls to a token contract).

URL:

```plaintext
https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_function_call/decode_function_call.wasm
```

Arguments:

| Argument | Type | Description |
| --- | --- | --- |
| `function_abi` | String (stringified JSON) | Array of function ABI definitions |
| `event_abi` | String (stringified JSON) | Array of event ABI definitions (pass `"[]"` if unused) |

Output fields:

| Field | Type | Description |
| --- | --- | --- |
| `hash` | String | Transaction hash |
| `from` | String | Transaction sender |
| `to` | String | Transaction recipient |
| `blockNumber` | Int | Block number |
| `function` | String | Decoded function name (e.g. `"transfer"`) |
| `signature` | String | Function signature (e.g. `"transfer(address,uint256)"`) |
| `arguments` | [String] | Decoded parameters as JSON array |

Documents whose `input` does not match any ABI function are passed through unchanged.

### `decode_function_call_str`

Same as `decode_function_call`, but serializes `arguments` as a JSON string for `_like` filtering.

URL:

```plaintext
https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_function_call_str/decode_function_call_str.wasm
```

## ABI format

All decode lenses take ABI definitions as stringified JSON arrays. Each event definition follows the standard Solidity ABI format:

| Field | Description |
| --- | --- |
| `type` | `"event"` for events, `"function"` for functions |
| `name` | Event or function name |
| `inputs` | Array of parameter definitions |
| `inputs[].type` | Solidity type (e.g. `"address"`, `"uint256"`) |
| `inputs[].name` | Parameter name |
| `inputs[].indexed` | `true` if the parameter is in `topics`, `false` if in `data` (events only) |

### Common ABI snippets

ERC-20 Transfer:

```json
[{"type":"event","name":"Transfer","inputs":[{"type":"address","name":"from","indexed":true},{"type":"address","name":"to","indexed":true},{"type":"uint256","name":"value","indexed":false}]}]
```

ERC-20 Approval:

```json
[{"type":"event","name":"Approval","inputs":[{"type":"address","name":"owner","indexed":true},{"type":"address","name":"spender","indexed":true},{"type":"uint256","name":"value","indexed":false}]}]
```

ERC-721 Transfer:

```json
[{"type":"event","name":"Transfer","inputs":[{"type":"address","name":"from","indexed":true},{"type":"address","name":"to","indexed":true},{"type":"uint256","name":"tokenId","indexed":true}]}]
```

Multiple events (Transfer + Approval):

```json
[{"type":"event","name":"Transfer","inputs":[{"type":"address","name":"from","indexed":true},{"type":"address","name":"to","indexed":true},{"type":"uint256","name":"value","indexed":false}]},{"type":"event","name":"Approval","inputs":[{"type":"address","name":"owner","indexed":true},{"type":"address","name":"spender","indexed":true},{"type":"uint256","name":"value","indexed":false}]}]
```

When you pass multiple event definitions, `decode_log` matches each log against all of them by comparing `topics[0]` (the event signature hash) and decodes accordingly.

## Lens arguments

Lens arguments are passed as a JSON object via the `--args` flag. All values must be strings:

```shell
--args '{"src":"address", "value":"0x..."}'     # correct
--args '{"count": 5}'                            # incorrect, values must be strings
--args '{"count": "5"}'                          # correct
```

For complex arguments like ABI arrays, pass the inner JSON as a stringified value:

```shell
--args '{"abi":"[{\"type\":\"event\",...}]"}'
```

## Determinism

Lenses must be deterministic: the same input document always produces the same output document. This is what makes Views verifiable. Any Host running the same lens on the same primitive data will produce identical results.

Things to avoid if you write your own lenses:

- Reading the system clock or generating random numbers.
- Making network calls.
- Depending on file system state.
- Using floating-point arithmetic (can vary across WASM runtimes).

## Testing lenses locally

Before deploying, validate that your View (including lenses) compiles and runs:

```shell
viewkit view test my-view
```

This spins up a temporary local DefraDB instance, applies your schema, loads the WASM lens, and checks that everything builds. For a full end-to-end check with a GraphQL Playground, deploy locally:

```shell
viewkit view deploy my-view --target local
```

See the [Quick Start](/views/quickstart/) for Wasmer runtime setup if you encounter `libwasmer` errors during local testing.

## Authoring new lenses

If the available lenses don't cover your use case, you can write your own. Lenses are WASM modules, typically written in Rust or AssemblyScript, that implement a transform function.

### Interface

A lens receives a document as input and returns a document (or `None` to drop it). A simplified Rust sketch for an event decoder:

```rust
fn transform(log: Log) -> Option<DecodedEvent> {
    if log.topics[0] != TRANSFER_SIGNATURE {
        return None;
    }
    Some(DecodedEvent {
        event: "Transfer".to_string(),
        from: decode_address(&log.topics[1]),
        to: decode_address(&log.topics[2]),
        arguments: decode_uint256(&log.data),
    })
}
```

### Language comparison

| Language | Typical WASM size | Notes |
| --- | --- | --- |
| Rust | ~200-300 KB | Preferred for production. Best tooling and optimization. |
| AssemblyScript | ~73 KB | Easier if you know TypeScript. Smaller binaries. |

Smaller binaries mean less P2P overhead when Hosts download the View bundle.

### Where to find SDKs and examples

| Resource | Location |
| --- | --- |
| Rust lens SDK | [source-gh/lens/sdk-rust/](https://github.com/sourcenetwork/lens) |
| AssemblyScript lens example | [source-gh/lens/tests/modules/as_wasm32_simple/](https://github.com/sourcenetwork/lens) |
| WASM runtime implementations | [source-gh/lens/host-go/runtimes/](https://github.com/sourcenetwork/lens) |

The Host client's LensVM runtime does not care what language produced the WASM. Any compliant WASM module will work.

### WASM runtimes

The Host client runs lenses through LensVM, which supports three WASM runtimes:

| Runtime | Language | Used by |
| --- | --- | --- |
| Wazero | Go | Production Host clients (pure Go, no CGo) |
| Wasmtime | Rust | Alternative production runtime |
| Wasmer | Rust | Viewkit local testing |

For deeper technical details on the VWL wire format, view ID computation, and the deploy pipeline, see the [Viewkit reference](/reference/components/viewkit/).

## Need help

{{ need_help(client="View Creator", repo_name="shinzo-view-creator", repo="https://github.com/shinzonetwork/shinzo-view-creator/issues") }}
