---
title: "View creator (viewkit)"
---

Repo: `shinzo-gh/shinzo-view-creator` (Go)

Viewkit is a CLI tool for creating, testing, and deploying views. It does not process or serve data (hosts do that). It packages a view into a binary bundle on your machine and submits a transaction to ShinzoHub.

## What viewkit does and does not do

What it does:

- Define GraphQL SDL schemas for view output
- Configure WASM lens transforms for data mapping
- Pre-validate transforms locally using Wasmer runtime
- Package everything into a ViewBundle (VWL binary format)
- Deploy to ShinzoHub

What it does not do:

- Process data (hosts do this)
- Store data (DefraDB does this)
- Serve queries (hosts do this)
- Run as a daemon (it is a CLI tool)

## View definition

A view has three pieces:

1. A query -- which primitive data to select (e.g., "all Logs from the USDC contract")
2. An SDL -- GraphQL schema defining the output shape
3. A lens (optional) -- WASM module that transforms the data

### The @materialized directive

In the SDL, `@materialized(if: true)` tells DefraDB to pre-compute and store the view data. `@materialized(if: false)` computes it on query.

`@materialized(if: true)` is recommended for now. Queries are faster because data is already materialized when the query arrives. The tradeoff is more storage on the host.

Important: the `limit` parameter should be on the source query (e.g., `Log(limit: 100)`), not on the materialized view collection.

## CLI commands

```bash
# Initialize a new view
viewkit view create my-usdc-view \
  --query 'Ethereum__Mainnet__Log { address topics data transactionHash blockNumber }'

# Add GraphQL schema
viewkit view add sdl \
  'type USDCTransfer @materialized(if: true) { from: String to: String amount: String blockNumber: Int }' \
  --name my-usdc-view

# Add a WASM lens with arguments
viewkit view add lens \
  --label "decode_transfers" \
  --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm" \
  --args '{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",...}]"}' \
  --name my-usdc-view

# Remove a lens
viewkit view remove lens --label "decode_transfers" --name my-usdc-view

# Inspect the bundle
viewkit view inspect my-usdc-view

# Generate a wallet for deployments
viewkit wallet generate

# Deploy to devnet
viewkit view deploy my-usdc-view \
  --target devnet \
  --rpc http://rpc.devnet.shinzo.network:8545
```

## What happens during deploy

When you run `viewkit view deploy`, the following happens inside `core/service/deploy.go`:

1. Tests the view locally (builds a temporary DefraDB instance, applies the lens, validates output)
2. Derives an ECDSA private key from the wallet
3. For each lens: reads the WASM file and base64-encodes it
4. Calls `viewbundle.NewBundler().BundleView(view)` to produce compressed VWL wire bytes
5. Computes viewID: `keccak256(sender.Bytes(), wireBytes)`
6. ABI-encodes the transaction: method selector `keccak256("register(bytes)")[:4]` + ABI-encoded bytes
7. Sends EVM transaction to `0x0000000000000000000000000000000000000210` (View Registry precompile)
8. Polls for receipt and checks status

## VWL wire format

VWL (View Wire Language) is the binary format for view bundles.

### Byte layout

```plaintext
┌─────────────────────────────────────────────────────────────┐
│  "VWL" (3 bytes)  — Magic bytes                             │
│  Version (1 byte) — Currently 0x01                          │
├─────────────────────────────────────────────────────────────┤
│  Query length (u32)                                         │
│  Query bytes      — GraphQL query string                    │
├─────────────────────────────────────────────────────────────┤
│  SDL length (u32)                                           │
│  SDL bytes        — GraphQL schema string                   │
├─────────────────────────────────────────────────────────────┤
│  Lens count (u16)                                           │
│  Per lens: ID (u32), Args len (u32), Args bytes (JSON)      │
├─────────────────────────────────────────────────────────────┤
│  Codec byte (0=none, 1=zstd)                                │
│  Blob length (u32)                                          │
│  Lens blob: Count (u16), Per WASM: Len (u32) + WASM bytes   │
└─────────────────────────────────────────────────────────────┘
```

WASM binaries can be 70-200+ KB each. zstd compression is applied before the bundle goes on chain. The host decompresses when applying.

Two implementations of the wire format exist:

| Implementation | Language | Side | Used by |
|---------------|----------|------|---------|
| viewbundle-go | Go | Server-side | viewkit, precompile |
| viewbundle | TypeScript | Client-side | Browser-based tooling |

Key functions:

```go
// Encode a view into wire bytes
wireBytes := viewbundle.BundleView(view)

// Decode just the header (without loading the full WASM body)
header := viewbundle.DecodeHeader(encodedBytes)

// Re-encode a modified header
reEncoded := viewbundle.EncodeHeader(decodedValue)
```

There is a known issue with v0.6.2 of the host client: it uses `viewbundle.UnbundleView()` with zstd decompression. Views registered before v0.6.2 may be stored in uncompressed format. If the host tries to decompress an uncompressed payload, it fails.

## View ID computation

View IDs are deterministic. The same computation runs on the client (viewkit) and on chain (precompile):

```
viewID = typeName + "_" + keccak256(senderAddress, wireBytes)
```

Example:

```
TestView_0xae1bd91e83f5a71ed4c34e18470ea3c12b9ba3d4a69cfd98717e23cf27f4eccb
```

Because the same computation runs in both places, the client can predict the view ID before the transaction confirms.

## Lens authoring

Lenses are WASM binaries, typically written in Rust or AssemblyScript, that transform raw primitive data into structured output.

A simplified Rust example:

```rust
fn transform(log: Log) -> Option<USDCTransfer> {
    if log.address != USDC_ADDRESS { return None; }
    if log.topics[0] != TRANSFER_SIG { return None; }
    Some(USDCTransfer {
        from: decode_address(log.topics[1]),
        to: decode_address(log.topics[2]),
        amount: decode_uint256(log.data),
    })
}
```

Lenses must be deterministic. Any host running the same lens on the same data should produce identical results.

LensVM supports bidirectional transforms (the `inverse()` function in the WASM module), though most views use one-way transforms.

### Binary size by language

| Language | Typical WASM size | Notes |
|----------|-------------------|-------|
| Rust | ~200 KB | Preferred for production |
| AssemblyScript | ~73 KB | Easier if you know TypeScript, smaller binary |

Smaller binaries mean less P2P overhead.

### Available lenses

Stored in `shinzo-gh/wasm-bucket`. Currently available:

| Lens | Purpose |
|------|---------|
| `decode_log` | ABI-decodes EVM log events. Takes ABI JSON as argument. |
| `filter_transaction` | Filters by contract address |

### Writing new lenses

- Rust SDK: `source-gh/lens/sdk-rust/`
- AssemblyScript example: `source-gh/lens/tests/modules/as_wasm32_simple/`
- WASM runtime paths: `source-gh/lens/host-go/runtimes/wasmtime/`, `wasmer/`, `wazero/`

AssemblyScript lenses follow the same interface as Rust lenses. The host runtime does not care what language produced the WASM.

## The view lifecycle across repos

Five repos are involved in the lifecycle from creation to query:

```plaintext
Your Machine                ShinzoHub               Host                  User
(shinzo-view-creator)       (shinzohub)         (shinzo-host-client)  (shinzo-app-sdk)
        |                       |                     |                    |
        |  1. viewkit view create                     |                    |
        |     Define query, SDL,                      |                    |
        |     add WASM lens                           |                    |
        |                       |                     |                    |
        |  2. viewkit view deploy                     |                    |
        |     -> encodes VWL                          |                    |
        | ------- EVM tx -----> |                     |                    |
        |                       |                     |                    |
        |       3. View Registry (0x0210)             |                    |
        |          -> validate bundle                 |                    |
        |          -> RegisterObject (ICA)            |                    |
        |          -> deploy SVS-1 contract           |                    |
        |          -> emit Registered event           |                    |
        |                       |                     |                    |
        |                       | -- notification --> |                    |
        |                       |                     |                    |
        |                       |    4. Host detects event                 |
        |                       |       -> downloads bundle                |
        |                       |       -> loads WASM lens                 |
        |                       |       -> starts transforming             |
        |                       |          incoming primitives             |
        |                       |                     |                    |
        |                       |                     | <-- GraphQL query- |
        |                       |                     |  5. query results  |
        |                       |                     | ---- results ----> |
```

Indexers are not involved in the view lifecycle. By the time a view is created and applied, indexers have already delivered raw data to hosts over P2P.

## Key files

| What | Location |
|------|----------|
| View deploy logic | `shinzo-gh/shinzo-view-creator/core/service/deploy.go` |
| VWL encoding/decoding | `shinzo-gh/viewbundle-go/` |
| VWL bundler (compress/decompress) | `shinzo-gh/viewbundle-go/bundler.go` |
| VWL wire codec | `shinzo-gh/viewbundle-go/codec.go` |
| VWL header-only decode | `shinzo-gh/viewbundle-go/header.go` |
| WASM lenses | `shinzo-gh/wasm-bucket/` |
| Precompile (decode/validate) | `shinzohub/app/precompiles/viewregistry/methods.go` |
| Rust lens SDK | `source-gh/lens/sdk-rust/` |
| AssemblyScript lens example | `source-gh/lens/tests/modules/as_wasm32_simple/` |
