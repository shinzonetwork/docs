+++
title = "Signatures"
description = "How documents are cryptographically signed and verified in Shinzo."
+++

Signing in Shinzo happens at the block level, not the document level. After a Generator client writes every document for a block, it computes a Merkle root over all their CIDs, signs that root with its identity key, and writes the result as a `BlockSignature` document in the same batch. The signature travels with the data over P2P, so a Host, or your app, can check who vouches for a block without trusting the connection it arrived on.

The SDL for both signature types lives in [Primitives](../primitives/). This page covers what the fields mean.

## What a BlockSignature covers

| Field | Meaning |
| --- | --- |
| `blockNumber`, `blockHash` | The block the signature covers. |
| `merkleRoot` | Merkle root over the CIDs of every document in the block: the block itself, its transactions, logs, and access list entries. |
| `cids`, `cidCount` | The document CIDs under that root, and how many there are. |
| `signatureType` | The signature scheme in use. |
| `signatureIdentity` | The public key of the Generator client that signed. |
| `signatureValue` | Its ES256K signature over `merkleRoot`. |
| `createdAt` | When the signature was written. |

To check who signed a block, query `BlockSignature` filtered by `blockNumber`. [Check who signed a document](/build/how-to/query-data/#check-who-signed-a-document) shows the query, and [Verify data with signatures and CIDs](/build/how-to/verify-data/) walks the full verification flow, including tracing attestations and resolving CIDs.

## Per-document signatures are null today

Each document's `_version` entries carry a `signature` field, but it is not populated today: the signature that exists is the block-level one. [DefraDB metadata](../defradb-metadata/) covers what `_version` does carry.

## What a SnapshotSignature covers

`SnapshotSignature` seals a snapshot file that bundles a range of blocks for faster initial sync. Its `merkleRoot` is computed over the per-block `BlockSignature` Merkle roots in the range, not over individual document CIDs. `startBlock` and `endBlock` bound the range, `blockCount` counts the blocks, `blockSigMerkleRoots` lists the per-block roots, and `snapshotFile` names the file.

Because the root is over signed per-block roots, two Generator clients that agree on a range produce the same value. That is what cross-generator attestation and snapshot exchange build on.

## Who signs

The signing key is a persistent identity the Generator client loads from the DefraDB keyring at startup. Signing is opt-in for the Generator operator, and Hosts can disable signature verification with `--no-signing`. For the signing flow inside the Generator client, see [Document signing](/reference/components/generator-client#document-signing).
