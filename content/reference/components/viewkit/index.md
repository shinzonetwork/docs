+++
title = "Viewkit"
[extra]
mermaid = true
+++

Viewkit is the local CLI tool for creating, testing, and deploying Shinzo Views. It packages a view into a binary bundle (VWL) and submits a deploy transaction to ShinzoHub. It does not process, store, or serve data.

This page is the technical reference for Viewkit: the full command list, filter operators, the deploy pipeline, the VWL wire format, view ID computation, and the on-disk layout of the source repo. For a hands-on walkthrough of building and deploying your first view, see the [Create a View](/build/create-a-view/) quickstart. For the conceptual overview of what Viewkit is and where it sits in the stack, see [Views for builders](/build/concepts/views-for-builders/).

## Command reference

| Command | Purpose |
| --- | --- |
| `viewkit view init <name>` | Create a new view bundle |
| `viewkit view inspect <name>` | Show the current view definition |
| `viewkit view inspect <name> --verbose` | Show full revision history |
| `viewkit view add query '<q>' --name <name>` | Set or update the query |
| `viewkit view add sdl '<sdl>' --name <name>` | Set or update the SDL |
| `viewkit view add lens --label <l> --url <u> --args '<a>' --name <n>` | Attach a WASM lens |
| `viewkit view remove query --name <name>` | Remove the query |
| `viewkit view remove sdl --name <name>` | Remove the SDL |
| `viewkit view remove lens --label <l> --name <n>` | Remove a lens by label |
| `viewkit view test <name>` | Validate the view compiles locally |
| `viewkit view deploy <name> --target local` | Deploy to a local DefraDB instance |
| `viewkit view deploy <name> --target devnet --rpc <url>` | Deploy to devnet |
| `viewkit view rollback <name>` | Revert to the previous version |
| `viewkit view rollback <name> --version <N>` | Revert to a specific version |
| `viewkit view delete <name>` | Delete the local view bundle |
| `viewkit wallet generate` | Create a new signing wallet |
| `viewkit wallet inspect` | Show the current wallet address |
| `viewkit wallet import <mnemonic>` | Import a wallet from a mnemonic |

## Filter operators

When querying a deployed view's output collection, DefraDB supports these filter operators:

| Operator | Meaning | Example |
| --- | --- | --- |
| `_eq` / `_neq` | Equal / not equal | `{ logAddress: { _eq: "0x..." } }` |
| `_gt` / `_geq` | Greater than / greater than or equal | `{ blockNumber: { _geq: 19540000 } }` |
| `_lt` / `_leq` | Less than / less than or equal | `{ blockNumber: { _leq: 19541000 } }` |
| `_in` / `_nin` | In / not in a list of values | `{ event: { _in: ["Transfer", "Approval"] } }` |
| `_and` | Logical AND | `{ _and: [{ logAddress: { _eq: "0x..." } }, { event: { _eq: "Transfer" } }] }` |
| `_or` | Logical OR | `{ _or: [{ from: { _eq: "0x..." } }, { to: { _eq: "0x..." } }] }` |
| `_like` / `_ilike` | Substring match, case-sensitive / case-insensitive (strings) | `{ arguments: { _like: "%0xAddress%" } }` |

## What happens during deploy

When you run `viewkit view deploy`, the following happens inside `core/service/deploy.go`:

1. Tests the view locally (builds a temporary DefraDB instance, applies the lens, validates output).
1. Derives an ECDSA private key from the wallet.
1. For each lens: reads the WASM file and base64-encodes it.
1. Calls `viewbundle.NewBundler().BundleView(view)` to produce compressed VWL wire bytes.
1. Computes viewID: `keccak256(sender.Bytes(), wireBytes)`.
1. ABI-encodes the transaction: method selector `keccak256("register(bytes)")[:4]` + ABI-encoded bytes.
1. Sends EVM transaction to `0x0000000000000000000000000000000000000210` (View Registry precompile).
1. Polls for receipt and checks status.

## VWL wire format

VWL (View Wire Language) is the binary format for view bundles.

### Byte layout

The bundle is a single byte stream written in the order below. Each section is appended directly after the previous one.

| # | Section | Contents |
| --- | --- | --- |
| 1 | Header | `"VWL"` magic (3 bytes), version (1 byte, currently `0x01`) |
| 2 | Query | length (`u32`), GraphQL query string |
| 3 | SDL | length (`u32`), GraphQL schema string |
| 4 | Lens metadata | count (`u16`); for each lens: ID (`u32`), args length (`u32`), JSON args bytes |
| 5 | Lens blob | codec byte (`0` = none, `1` = zstd), blob length (`u32`), WASM count (`u16`); for each WASM: length (`u32`) and bytes |

WASM binaries can be 70-200+ KB each. zstd compression is applied before the bundle goes on chain. The Host client decompresses when applying.

Two implementations of the wire format exist:

| Implementation | Language | Side | Used by |
| --- | --- | --- | --- |
| viewbundle-go | Go | Server-side | Viewkit, precompile |
| viewbundle | TypeScript | Client-side | Shinzo Studio (browser UI) |

Key functions:

```go
// Encode a view into wire bytes
wireBytes := viewbundle.BundleView(view)

// Decode just the header (without loading the full WASM body)
header := viewbundle.DecodeHeader(encodedBytes)

// Re-encode a modified header
reEncoded := viewbundle.EncodeHeader(decodedValue)
```

There is a known issue with v0.6.2 of the Host client: it uses `viewbundle.UnbundleView()` with zstd decompression. Views registered before v0.6.2 may be stored in uncompressed format. If the Host client tries to decompress an uncompressed payload, it fails.

## View ID computation

View IDs are deterministic. The same computation runs on the client (Viewkit) and on chain (precompile):

```plaintext
viewID = typeName + "_" + keccak256(senderAddress, wireBytes)
```

Example:

```plaintext
TestView_0xae1bd91e83f5a71ed4c34e18470ea3c12b9ba3d4a69cfd98717e23cf27f4eccb
```

Because the same computation runs in both places, the client can predict the view ID before the transaction confirms.

## Lenses

Lenses are the WASM transforms that turn raw primitive data into a View's structured output. For the available lenses, their arguments and output fields, lens argument format, determinism requirements, and how to author your own, see the [Lens reference](/reference/components/lens/).

## The view lifecycle across repos

Five repos are involved in the lifecycle from creation to query:

{% mermaid() %}
sequenceDiagram
  participant Dev as Your machine<br/>(viewkit)
  participant SH as ShinzoHub<br/>(View Registry)
  participant Host as Host<br/>(host client)
  participant User as User<br/>(app SDK)

  Note over Dev: 1. viewkit view init + add<br/>(define query, SDL, add lens)
  Dev->>SH: 2. viewkit view deploy<br/>(encode VWL, send EVM tx)
  Note over SH: 3. validate bundle,<br/>compute view ID,<br/>RegisterObject (ICA)
  SH-)Host: emit Registered event
  Note over Host: 4. download bundle,<br/>load WASM lens,<br/>transform primitives
  User->>Host: 5. GraphQL query
  Host->>User: view documents
{% end %}

Generator clients are not involved in the View lifecycle. By the time a View is created and applied, the Generator client has already delivered raw data to the Host clients over P2P.

## Key files

| What | Location |
| --- | --- |
| View deploy logic | `shinzo-gh/shinzo-view-creator/core/service/deploy.go` |
| VWL encoding/decoding | `shinzo-gh/viewbundle-go/` |
| VWL bundler (compress/decompress) | `shinzo-gh/viewbundle-go/bundler.go` |
| VWL wire codec | `shinzo-gh/viewbundle-go/codec.go` |
| VWL header-only decode | `shinzo-gh/viewbundle-go/header.go` |
| WASM lenses | `shinzo-gh/wasm-bucket/` |
| Precompile (decode/validate) | `shinzohub/app/precompiles/viewregistry/methods.go` |
