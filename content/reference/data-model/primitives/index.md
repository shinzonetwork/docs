+++
title = "Primitives"
description = "The primitive collection types produced by Generator clients."
+++

Generator clients structure every block they read into six primitive collection types. Four come from the chain data itself: blocks, transactions, logs, and access list entries. Two are metadata the Generator client produces about its own output: block signatures and snapshot signatures. Everything else in Shinzo, Views and attestation records included, builds on top of these.

You can query the primitives wherever DefraDB serves the data: through a Host client's `/api/v0/graphql` endpoint, or through the embedded DefraDB instance inside a local-first app. Same collections, same filters, only the transport changes.

Collection names carry a `<Chain>__<Network>__` prefix derived from the `chain.name` and `chain.network` settings of the Generator client that produced the data, so each type below appears as `<Chain>__<Network>__Block` and so on. See [Naming convention](../naming-convention/) for how the prefix is built and what it does not apply to.

The SDL below is what the Generator client writes. Host copies of the schema add unique indexes on block and transaction hashes on top; [Schema directives](../schema-directives/) covers the directives you see here.

## Block

One document per block, with the fields straight from the block header:

```graphql
type <Chain>__<Network>__Block {
    hash: String
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
    transactions: [<Chain>__<Network>__Transaction] @relation(name: "block_transactions")
}
```

## Transaction

One document per transaction, merging fields from the transaction object and its receipt. The receipt-specific fields are `status`, `gasUsed`, `cumulativeGasUsed`, and `effectiveGasPrice`:

```graphql
type <Chain>__<Network>__Transaction {
    hash: String
    blockHash: String
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
    block: <Chain>__<Network>__Block @relation(name: "block_transactions")
    logs: [<Chain>__<Network>__Log] @relation(name: "transaction_logs")
    accessList: [<Chain>__<Network>__AccessListEntry] @relation(name: "transaction_accessList")
}
```

## Log

One document per event log. `topics` is an array of hex-encoded indexed parameters (`topics[0]` is the event signature hash), and `data` is the hex-encoded non-indexed parameters. No ABI decoding happens at this layer: everything is stored as raw hex, and decoding is the job of a View's lens.

```graphql
type <Chain>__<Network>__Log {
    address: String
    topics: [String]
    data: String
    transactionHash: String
    blockHash: String
    blockNumber: Int @index
    transactionIndex: Int
    logIndex: Int
    removed: String
    block: <Chain>__<Network>__Block @relation(name: "block_logs")
    transaction: <Chain>__<Network>__Transaction @relation(name: "transaction_logs")
}
```

## AccessListEntry

EIP-2930 access list entries, one document per entry. Most transactions carry no access list, so this collection is typically sparse:

```graphql
type <Chain>__<Network>__AccessListEntry {
    address: String
    blockNumber: Int @index
    storageKeys: [String]
    transaction: <Chain>__<Network>__Transaction @relation(name: "transaction_accessList")
}
```

## BlockSignature

Written after every document for a block has landed. It carries a Merkle root over all the block's document CIDs, signed with the Generator client's identity key. [Signatures](../signatures/) covers what the signature commits to and how to check it:

```graphql
type <Chain>__<Network>__BlockSignature {
    blockNumber: Int @index
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

## SnapshotSignature

Written once per snapshot file, sealing a range of blocks for faster initial sync. Its Merkle root is computed over the per-block `BlockSignature` Merkle roots, not over individual document CIDs. See [Signatures](../signatures/):

```graphql
type <Chain>__<Network>__SnapshotSignature {
    startBlock: Int
    endBlock: Int
    merkleRoot: String
    blockCount: Int
    signatureType: String
    signatureIdentity: String
    signatureValue: String
    snapshotFile: String
    createdAt: String
    blockSigMerkleRoots: [String]
}
```

## How the types relate

Four relation names connect the types. Both sides of a relation declare the same name, and queries nest across a relation in one round trip:

| Relation name | Fields |
| --- | --- |
| `block_transactions` | `Block.transactions` and `Transaction.block` |
| `transaction_logs` | `Transaction.logs` and `Log.transaction` |
| `transaction_accessList` | `Transaction.accessList` and `AccessListEntry.transaction` |
| `block_logs` | `Log.block` only. The `Block` type has no `logs` field, so reach a block's logs through its transactions or query `Log` directly |

[Query data](/build/how-to/query-data/) shows the nesting in practice, including filters and ordering on nested selections.

## Fetch the live schema from a Generator

The Generator client serves its schema over HTTP from its health server (default port 8080):

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1/schema` | `{"network": "<prefix>", "schema": "<full SDL>"}` |
| `GET /api/v1/schema/{collection}` | One collection's SDL in the same envelope. `{collection}` is the stem name: `block`, `transaction`, `log`, `accessListEntry`, `blockSignature`, or `snapshotSignature`. Unknown names get `404`. |
| `GET /api/v1/schema/collections` | `{"network": "<prefix>", "collections": [{"name": ..., "type_name": ...}]}` |

For example, listing collections:

```shell
curl -s http://<generator>:8080/api/v1/schema/collections | jq
```

```json
{
  "network": "Ethereum__Mainnet",
  "collections": [
    { "name": "block", "type_name": "Ethereum__Mainnet__Block" },
    { "name": "blockSignature", "type_name": "Ethereum__Mainnet__BlockSignature" },
    { "name": "snapshotSignature", "type_name": "Ethereum__Mainnet__SnapshotSignature" },
    { "name": "transaction", "type_name": "Ethereum__Mainnet__Transaction" },
    { "name": "accessListEntry", "type_name": "Ethereum__Mainnet__AccessListEntry" },
    { "name": "log", "type_name": "Ethereum__Mainnet__Log" }
  ]
}
```

The `network` field is the prefix in use, so a Generator configured for another chain returns that chain's names instead.

When the Generator runs with `SCHEMA_AUTH_MODE=token` (the default), these endpoints require a key. Pass it as `Authorization: Bearer <token>` or `X-Api-Key: <key>`. A request with no key gets `401`, a wrong key gets `403`, and a Generator configured with no keys at all fails closed with `503` rather than serving unauthenticated. Operators set the accepted keys via `SCHEMA_API_KEYS`; see the [indexer config](/run/run-a-generator/config-reference#indexer).

Host clients call this same endpoint to keep their embedded schema in sync. A Host that cannot authenticate falls back to the schema copy embedded in its binary, so a Host serving a schema that does not match its Generator usually has an `auth_token` gap. See the [Host config reference](/run/run-a-host/config-reference#schema).
