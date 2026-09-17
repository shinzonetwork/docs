+++
title = "AttestationRecord"
description = "The attestation record type, its fields, and CRDT semantics."
+++

When a Host receives the same block from multiple Generator clients, it records how many independent sources vouch for it in an `AttestationRecord`. The count is a CRDT counter, so Hosts that replicate with each other converge on the same number with no coordinator in the middle. [Attestations](/understand/core-concepts/attestations/) covers the concept; this page is the type reference.

## Schema

Block attestations live in the base collection:

```graphql
type <Chain>__<Network>__AttestationRecord {
    attested_doc: String @index
    source_doc: [String]
    CIDs: [String]
    doc_type: String @index
    vote_count: Int @crdt(type: pcounter)
}
```

## Fields

| Field | Meaning |
| --- | --- |
| `attested_doc` | What was attested, as a lookup key. For block attestations the format is `block:<height>:<merkleRoot>`, where the hash is the same signed Merkle root the block's `BlockSignature` carries. |
| `source_doc` | Public keys of the Generator clients seen signing the data, the same keys that appear as `signatureIdentity` on their `BlockSignature` documents. |
| `CIDs` | The commit CIDs covered by the signed Merkle root. The list runs to hundreds of entries per block. |
| `doc_type` | What kind of document was attested. `Block` on Hosts today. |
| `vote_count` | How many Generator clients have been seen signing the same data. |

[Trace a block back to its attestations](/build/how-to/verify-data/#trace-a-block-back-to-its-attestations) shows the query in context.

## How vote_count merges

`@crdt(type: pcounter)` makes `vote_count` a positive counter: each node tracks its own increments, and merges are deterministic.

```plaintext
Host A: {A: 1, B: 0}    (saw generator A)
Host B: {A: 0, B: 1}    (saw generator B)
Merge:  {A: 1, B: 1} -> total = 2
```

One caveat: the `CIDs` array has no CRDT merge strategy, so Hosts that see different CID sets for the same document can end up with separate records instead of one merged record. The counter itself merges correctly. This is a known limitation, documented in the Host client's ADR-03.

## View-specific attestation collections

Attestations for a View's output documents go in their own collection, named `<Chain>__<Network>__AttestationRecord_<ViewName>`. A View named `TokenTransfer` gets `AttestationRecord_TokenTransfer`, while block attestations stay in the base collection above.

To filter query results by vote count automatically, see [Configure attestation thresholds](/build/how-to/configure-attestation-thresholds/).
