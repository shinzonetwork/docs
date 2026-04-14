---
title: "Indexer client"
---

Repo: `shinzo-gh/shinzo-indexer-client` (Go)

The indexer client is a standalone Go process that runs as a sidecar alongside an Ethereum validator node. It connects to the validator's Geth node, fetches every new block (with transactions, receipts, and logs), structures them into DefraDB documents, signs the batch, and publishes everything over P2P.

Indexers are write-only data producers. They push data out and reject all incoming replication.

## Architecture

```plaintext
┌─────────────────── VALIDATOR MACHINE ───────────────────────┐
│                                                             │
│  ┌─── Geth Node ───────┐    ┌─── Indexer Client ─────────┐ │
│  │                     │    │                            │ │
│  │  Port 8545 (HTTP) --+----+--> RPC Client              │ │
│  │  Port 8546 (WS)   --+----+--> Block Handler           │ │
│  │                     │    │    Signing                 │ │
│  └─────────────────────┘    │    Embedded DefraDB        │ │
│                             └────────────────────────────┘ │
└─────────────────────────────────────────┬───────────────────┘
                                          |
                                    P2P (libp2p)
                                          |
                                          v
                                       Host(s)
```

The indexer connects to Geth over two channels:

- WebSocket (port 8546): subscribes to new block headers for real-time feed
- HTTP JSON-RPC (port 8545): fetches full block details, fills gaps on restart, handles historical ranges

## Data processing pipeline

Each block goes through six stages:

```plaintext
  1. RECEIVE  — Block header arrives via WebSocket subscription
        |
        v
  2. FETCH    — Full block: header, transactions, receipts, logs, access lists
        |
        v
  3. STRUCTURE — Transform into 6 document types
        |
        v
  4. SIGN     — Compute Merkle root over all document CIDs, sign with identity key
        |
        v
  5. STORE    — Write all documents to local embedded DefraDB
        |
        v
  6. PUBLISH  — DefraDB P2P layer broadcasts to subscribed peers (hosts)
```

## Document types

The indexer produces six document types per block. The first four come directly from on-chain data. The last two are metadata that the indexer itself produces.

Collection names use a chain prefix: `Ethereum__Mainnet__Block`, `Optimism__Mainnet__Block`, etc. Schema definitions live in `pkg/schema/schema_standard.graphql`. There are two schema variants:

- Standard: parallel transaction processing (default build)
- Branchable: sequential processing, uses `@branchable` decorator. Built with `TAGS=branchable`.

### Block

```graphql
type Ethereum__Mainnet__Block {
    hash: String @index(unique: true)
    number: Int @index
    timestamp: String
    parentHash: String
    difficulty: String
    totalDifficulty: String
    gasUsed: String
    gasLimit: String
    baseFeePerGas: String
    nonce: String
    miner: String
    size: String
    stateRoot: String
    sha3Uncles: String
    transactionsRoot: String
    receiptsRoot: String
    logsBloom: String
    extraData: String
    mixHash: String
    uncles: [String]
    transactions: [Ethereum__Mainnet__Transaction] @relation(name: "block_transactions")
}
```

### Transaction

Merges fields from both the transaction object and its receipt. Receipt-specific fields: `status`, `gasUsed`, `cumulativeGasUsed`, `effectiveGasPrice`.

```graphql
type Ethereum__Mainnet__Transaction {
    hash: String @index(unique: true)
    blockHash: String @index
    blockNumber: Int @index
    from: String
    to: String
    value: String
    gas: String
    gasPrice: String
    gasUsed: String
    maxFeePerGas: String
    maxPriorityFeePerGas: String
    input: String
    nonce: String
    transactionIndex: Int
    type: String
    chainId: String
    v: String
    r: String
    s: String
    status: Boolean
    cumulativeGasUsed: String
    effectiveGasPrice: String
    block: Ethereum__Mainnet__Block @index @relation(name: "block_transactions")
    logs: [Ethereum__Mainnet__Log] @relation(name: "transaction_logs")
    accessList: [Ethereum__Mainnet__AccessListEntry] @relation(name: "transaction_accessList")
}
```

### Log

Event logs emitted during transaction execution. `topics` is an array of hex-encoded indexed parameters (topic[0] is the event signature hash). `data` is the hex-encoded non-indexed parameters. No ABI decoding happens at this layer; everything is stored as raw hex.

```graphql
type Ethereum__Mainnet__Log {
    address: String @index
    topics: [String]
    data: String
    transactionHash: String @index
    blockHash: String @index
    blockNumber: Int @index
    transactionIndex: Int @index
    logIndex: Int @index
    removed: String
    block: Ethereum__Mainnet__Block @index @relation(name: "block_logs")
    transaction: Ethereum__Mainnet__Transaction @index @relation(name: "transaction_logs")
}
```

### AccessListEntry

EIP-2930 access list entries. Most transactions do not have access lists, so this collection is typically sparse.

```graphql
type Ethereum__Mainnet__AccessListEntry {
    address: String
    storageKeys: [String]
    blockNumber: Int
    transaction: Ethereum__Mainnet__Transaction @index @relation(name: "transaction_accessList")
}
```

### BlockSignature

Created after all documents for a block are written. Contains a Merkle root computed over all document CIDs for that block, signed with the indexer's identity key.

```graphql
type Ethereum__Mainnet__BlockSignature {
    blockNumber: Int
    blockHash: String
    merkleRoot: String
    cidCount: Int
    cids: [String]
    signatureType: String
    signatureIdentity: String
    signatureValue: String
    createdAt: String
}
```

### SnapshotSignature

Seals a range of blocks into a single signed snapshot. The `merkleRoot` is computed over the per-block `BlockSignature` Merkle roots within the range, not over individual document CIDs.

```graphql
type Ethereum__Mainnet__SnapshotSignature {
    startBlock: Int
    endBlock: Int
    merkleRoot: String
    blockCount: Int
    signatureType: String
    signatureIdentity: String
    signatureValue: String
    createdAt: String
    snapshotFile: String
    blockSigMerkleRoots: [String]
}
```

## Document signing

Signing is opt-in and configured by the indexer operator. Hosts disable it with `--no-signing`.

The signing flow:

1. At startup, the indexer loads a persistent identity from the DefraDB keyring using `GetIdentityContext()` (in `shinzo-app-sdk/pkg/defra/defra.go`).
2. The identity is injected into the Go context via `node.ContextWithBlockSigning(ctx, collector)`, which enables CID collection.
3. As the block handler writes documents, DefraDB collects the CID of each document written.
4. After all documents for a block are written, the indexer calls `node.SignBlock`, which computes a Merkle root over the collected CIDs, signs it, and writes the `BlockSignature` document.
5. Each individual document also gets a `_version` entry with identity and signature:

```json
{
    "_version": [
        {
            "cid": "bafyreig5...",
            "height": 1,
            "signature": {
                "identity": "did:key:z6Mk...",
                "value": "0x3045022100..."
            }
        }
    ]
}
```

## Pruning

Code: `shinzo-app-sdk/pkg/pruner/`

The pruner removes old data to keep storage bounded. It uses a queue-based system and persists its state to `{storePath}/prune_queue.gob`.

Two queue implementations exist:

- IndexerQueue: tracks document IDs at creation time. When it prunes, it removes entire blocks at once (Block + all its Transactions, Logs, AccessListEntries, and BlockSignature).
- EventQueue: FIFO queue for P2P replication events. Drains documents as they arrive. Used by hosts, not indexers.

If the queue is empty (first run or after restart with no persisted state), the pruner falls back to filter-based pruning, querying DefraDB directly for old documents.

Note: `BlockSignature` is referenced as `BatchSignature` in parts of the app-sdk code. This is a naming inconsistency, not a separate type.

## Snapshots

Code: `shinzo-indexer-client/pkg/snapshot/snapshot.go`

Snapshots bundle multiple blocks into a single signed file for faster initial sync.

| Parameter | Default | Notes |
|-----------|---------|-------|
| `BlocksPerFile` | 1000 | Blocks per snapshot file. Some docs reference 100, but that value is the pagination size for querying blocks from DefraDB. |
| `IntervalSeconds` | 60 | How often the snapshot loop checks for new blocks |

Environment variables: `SNAPSHOT_ENABLED`, `SNAPSHOT_BLOCKS_PER_FILE`, `SNAPSHOT_INTERVAL_SECONDS`.

## P2P data distribution

The indexer does not manage P2P connections directly. DefraDB handles all of that through libp2p.

```
Indexer writes doc -> DefraDB computes digest -> gossips to peers
                                                  -> peer requests full content
                                                  -> DefraDB sends full document
```

This is unidirectional. The replication filter in `pkg/indexer/replication_filter.go` rejects all inbound documents. Indexers only push.

Bootstrap peers are configured in the DefraDB config. Peers are also discovered through `EntityRegistered` events from ShinzoHub.

## Resource requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Storage | 50 GB (with pruning) | 100 GB (with pruning) |
| Network | 100 Mbps | 1 Gbps |

## Configuration

```
GETH_RPC_URL=https://json-rpc.example.com
GETH_WS_URL=ws://ws.example.com
GETH_API_KEY=your_api_key
INDEXER_START_HEIGHT=0
SNAPSHOT_ENABLED=false
SNAPSHOT_BLOCKS_PER_FILE=1000
SNAPSHOT_INTERVAL_SECONDS=60
LOG_LEVEL=error
```

`INDEXER_START_HEIGHT` is the block number to start indexing from on first run with no existing data.

## Chain abstraction (in progress)

Branch: `tzdybal/chain_adapter`

The codebase is being refactored from EVM-only to support multiple chains. The approach splits the current monolithic logic into a `Chain` interface with three parts:

- Fetcher: retrieves raw block data from the chain-specific RPC
- Converter: transforms chain-specific data into Shinzo's canonical document types
- BlockHandler: writes documents to DefraDB (chain-agnostic)

## Key files

| Path | Purpose |
|------|---------|
| `cmd/block_poster/main.go` | Entry point |
| `pkg/rpc/ethereum_client.go` | Geth RPC client (WebSocket + HTTP) |
| `pkg/defra/block_handler.go` | Block processing and document creation |
| `pkg/indexer/replication_filter.go` | Rejects all incoming P2P replication |
| `pkg/snapshot/snapshot.go` | Snapshot signature creation |
| `pkg/schema/schema_standard.graphql` | Collection schemas for the 6 doc types |
| `pkg/constants/collections.go` | Collection name constants (chain-prefixed) |
