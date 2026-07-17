+++
title = "Host client"
aliases = ["/reference/components"]
[extra]
mermaid = true
+++

The Host client receives indexed blockchain data from multiple Generator clients over P2P. It verifies the data using attestation records, runs WASM lens transforms to produce view documents, and serves those documents over GraphQL.

If Generator clients are data producers, Host clients are consumers and servers. The separation lets you scale serving independently from indexing.

## Architecture

{% mermaid() %}
flowchart LR
  subgraph Generators["Generators"]
    direction TB
    subgraph VM1["Validator machine 1"]
      I1["Generator client"]
    end
    subgraph VM2["Validator machine 2"]
      I2["Generator client"]
    end
    subgraph VM3["Validator machine 3"]
      I3["Generator client"]
    end
  end

  subgraph HOST["Host process"]
    direction TB
    subgraph Pipeline["Pipeline"]
      direction LR
      S1["1. Verify<br/>signatures"] --> S2["2. Create<br/>attestations"]
      S2 --> S3["3. Apply<br/>WASM lens"]
      S3 --> S4["4. Write view<br/>documents"]
      S4 --> S5["5. Serve<br/>GraphQL"]
    end
    subgraph Ports["Exposed ports"]
      direction TB
      P444["444: Playground"]
      P9181["9181: Internal API"]
      P8080["8080: Metrics"]
    end
    Pipeline --> Ports
  end

  Generators -- "P2P (DefraDB)" --> HOST
{% end %}

### Components

| Component | What it does |
| --- | --- |
| ShinzoHub Listener | Subscribes to ShinzoHub events over a CometBFT WebSocket. Watches for `Registered` (new Views) and `EntityRegistered` (new Generator clients/Hosts). |
| DefraDB | Embedded database. Handles storage, P2P replication, content addressing, CRDT merging, and query serving. |
| Attestation Handler | Listens to DefraDB's event bus for new BlockSignature documents. Verifies signatures and creates AttestationRecords with P-counter vote counts. |
| View Processor | Downloads WASM lens binaries, runs Lens transforms on primitives, writes view documents. |
| NetworkHandler | Manages P2P peer connections through DefraDB's node abstraction. |

### Key source files

| Component | File |
| --- | --- |
| Main host logic | `pkg/host/host.go` |
| ShinzoHub event subscription | `pkg/shinzohub/events.go` |
| Attestation processing | `pkg/attestation/attestationRecordService.go` |
| View management | `pkg/view/viewManager.go` |
| Network handler | `shinzo-app-sdk/pkg/defra/network_handler.go` |

## ShinzoHub event subscription

No webhooks. The host opens a persistent WebSocket connection to ShinzoHub's CometBFT node and subscribes to transaction events:

```go
cancel, channel, err := shinzohub.StartEventSubscription(wsURL)
```

This subscribes to two query filters:

- `"tm.event='Tx' AND Registered.key EXISTS"`: view registration events.
- `"tm.event='Tx' AND EntityRegistered.key EXISTS"`: new Generator or Host joining.

Events arrive on the returned channel. The Host client's main loop reads from this channel and dispatches to the view processor or network handler as appropriate.

## Attestation system

When a host receives data from multiple Generator clients for the same block, it creates an `AttestationRecord` using a P-counter CRDT.

### AttestationRecord schema

```graphql
type Ethereum__Mainnet__AttestationRecord {
    attested_doc: String @index
    source_doc: String
    CIDs: [String]
    doc_type: String @index
    vote_count: Int @crdt(type: pcounter)
}
```

The `@crdt(type: pcounter)` annotation tells DefraDB to use a Positive Counter merge strategy. Each node tracks its own increments separately, and merges are deterministic:

```plaintext
Host A: {A: 1, B: 0}    (saw 1 generator)
Host B: {A: 0, B: 1}    (saw 1 generator)
Merge:  {A: 1, B: 1} -> total = 2
```

### Attestation flow

{% mermaid() %}
sequenceDiagram
  participant IA as Generator A
  participant IB as Generator B
  participant H as Host
  participant H2 as Other hosts

  IA->>H: Block #1000 + BlockSignature<br/>(P2P)
  Note over H: verify signature,<br/>create AttestationRecord<br/>(vote_count = 1)
  IB->>H: Block #1000 + BlockSignature<br/>(P2P)
  Note over H: verify signature,<br/>upsert AttestationRecord<br/>(vote_count → 2)
  H<<->>H2: P2P replication
  Note over H,H2: P-counter merges automatically<br/>all hosts agree: vote_count = 2
{% end %}

The upsert pattern in GraphQL:

```graphql
mutation {
    upsert_AttestationRecord(
        create: { vote_count: 1 },
        update: { vote_count: 1 },
        filter: { attested_doc: { _eq: "block_1000" } }
    ) { _docID }
}
```

### View-specific attestation collections

The Host client creates separate attestation collections per view:

```go
collectionName := fmt.Sprintf("Ethereum__Mainnet__AttestationRecord_%s", viewName)
```

So you get `AttestationRecord_Block` for primitive attestations and `AttestationRecord_TokenTransfer` for a specific view.

### CID array merging doesn't work right

When multiple hosts create AttestationRecords for the same document but with different CID sets, they may create separate documents instead of merging. The P-counter for `vote_count` merges correctly, but the CID array (`[]string`) has no CRDT merge strategy. Documented in the host-client ADR-03.

### Re-org handling

When a blockchain re-org happens, different Generator clients may briefly have different versions of the same block:

```plaintext
Generator A: Block #1000 with hash 0xaaa (pre-reorg)
Generator B: Block #1000 with hash 0xbbb (post-reorg)
```

These produce separate documents (different CIDs), each with its own AttestationRecord. The post-reorg version accumulates more votes as Generator clients converge, and applications pick the one with higher consensus.

## View discovery

Hosts watch for view registrations through two paths.

At startup, the Host client calls `FetchAllRegisteredViews()`, which queries CometBFT with `tx_search?query="Registered.key EXISTS"`, paginates through all historical registration transactions, and processes each view bundle.

At runtime, the Host client subscribes to `tm.event='Tx' AND Registered.key EXISTS` over WebSocket. When a new event arrives, it extracts the `key`, `creator`, and `view` attributes and processes the bundle.

There is a known bug here: the View Registry precompile emits `"ViewRegistered"` with attributes `view_address`/`view_name`/`creator`/`data`, but the Host client subscribes to `"Registered"` and expects attributes `key`/`creator`/`view`. Neither event type nor attribute names match. Fixed in ShinzoHub v2.

## View processing pipeline

When the Host client receives a view bundle (from either discovery path):

1. `ProcessViewFromWireFormat()`: base64-decodes the wire bytes, parses VWL format, extracts the view name from SDL via regex.
1. `PostWasmToFile()`: for each lens, base64-decodes the WASM bytes, validates the WASM magic number (`0x00 0x61 0x73 0x6D`), and writes to disk with a sha256-derived filename.
1. `SetupLensInDefraDB()`: builds a LensConfig (source collection, destination, lens path, arguments) and calls `defraNode.DB.AddLens()` to register with LensVM.
1. `ConfigureLens()`: calls `defraNode.DB.AddView()` with or without a transform CID, auto-corrects field names for schema compatibility.
1. `SubscribeTo()`: enables P2P replication for the view's collection via `CreateP2PCollections()`.
1. `SaveViewToRegistry()`: persists view metadata to `views.json` in the lens registry directory so the Host client can recover on restart.

## Lens transforms

The Host client runs LensVM (`source-gh/lens`) to execute WASM modules that transform primitives into view documents.

{% mermaid() %}
flowchart LR
  In["Raw Log documents<br/>(from generator)"]
  Lens["<b>WASM Lens</b><br/>filter address · ABI-decode<br/>· map to view schema"]
  Out["View documents<br/>(USDCTransfer, …)"]

  In --> Lens --> Out
{% end %}

WASM runtimes in use:

| Runtime | Language | Where |
| --- | --- | --- |
| Wasmtime | Rust | Primary runtime in production hosts |
| Wasmer | Rust | viewkit local testing |
| Wazero | Go | Pure Go alternative, no CGo dependency |

Lens binary size varies by source language. AssemblyScript produces ~73 KB WASM. Rust produces ~200 KB.

## GraphQL serving

| Port | Purpose |
| --- | --- |
| 444 | GraphQL Playground (interactive query UI) |
| 9181 | Internal DefraDB API |
| 8080 | Health endpoint, Prometheus metrics |

Example query:

```graphql
{
  USDCTransfer(filter: { blockNumber: { _gte: 19540000 } }) {
    from
    to
    amount
    blockNumber
  }
}
```

## Earnings

Hosts receive the Compute Factor component of view pricing. There is an immediate payment per query served, plus a potential bonus at epoch end if the Host client's coverage (uptime and data availability) exceeds the network average.

## Document filtering

Hosts can filter incoming documents by contract address, event type, or function signature. A host running only ERC-20 transfer views does not need to store every log from every contract.

## Metrics

Port 8080 exposes Prometheus metrics: block processing rates, attestation counts, view status (active, syncing, errored), and P2P peer counts.

## Resource requirements

See the [hardware requirements page](/hosts/hardware-requirements/) for current minimum and recommended specs. Host storage depends mainly on the number of Views served and whether pruning is enabled (the default).

## Key files

| Path | Purpose |
| --- | --- |
| `cmd/main.go` | Entry point |
| `pkg/host/` | Core host logic |
| `pkg/shinzohub/` | WebSocket watcher for ShinzoHub events |
| `pkg/attestation/` | Attestation record creation and management |
| `pkg/view/` | View lifecycle (discovery, loading, execution) |
| `pkg/graphql/` | GraphQL serving configuration |
| `pkg/playground/` | GraphQL Playground UI |
| `pkg/schema/` | DefraDB collection schemas |

Lens integration is imported from `source-gh/lens`. DefraDB configuration comes from `shinzo-gh/shinzo-app-sdk`.
