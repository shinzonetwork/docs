+++
title = "Verify data with signatures and CIDs"
description = "How to verify who signed your data and navigate attestations, commits, and documents via CIDs."
+++

Every document a Shinzo client serves is content-addressed, and every block of documents is signed by the Generator client that produced it, so you can check where a piece of data came from instead of just trusting the server that returned it. This page covers the verification queries: reading block signatures, tracing documents back to their attestations, and resolving CIDs to commits and documents.

The examples query primitive collections through a Host client, and the same queries work in a local-first app's embedded DefraDB instance. Both surfaces share the query language, as covered in [Query data](/build/how-to/query-data/).

{% admonition(type="note") %}
Collection names are prefixed with `<Chain>__<Network>__`, derived from the `chain.name` and `chain.network` settings of the Generator client that indexed the data. Substitute the prefix that matches your chain.
{% end %}

## Check who signed a document

Each document exposes the CIDs of its commits in `_version`. The `signature` field on those entries is part of the schema but is not populated today: Generator clients sign per block rather than per document. Treat `_version` as a source of CIDs:

```graphql
{
  <Chain>__<Network>__Block(limit: 1, order: { number: DESC }) {
    number
    _docID
    _version {
      cid
      signature {
        identity
        value
        type
      }
    }
  }
}
```

```json
{
  "data": {
    "<Chain>__<Network>__Block": [
      {
        "number": 25938061,
        "_docID": "bae-5053a533-80a4-52ec-b6ef-2908369dac26",
        "_version": [
          {
            "cid": "bafyreih4na577644dgr5537nfoojhmpxlm35mfqsbyj5mf3mgvl4wf6hbi",
            "signature": null
          }
        ]
      }
    ]
  }
}
```

The signature you can check today lives at the block level. Every block of documents comes with a `BlockSignature` document: `signatureIdentity` is the public key of the Generator client that produced the block, `signatureType` is the scheme (`ES256K`), and `signatureValue` signs the block's `merkleRoot`:

```graphql
{
  <Chain>__<Network>__BlockSignature(limit: 1, order: { blockNumber: DESC }) {
    blockNumber
    blockHash
    merkleRoot
    signatureType
    signatureIdentity
    signatureValue
  }
}
```

```json
{
  "data": {
    "<Chain>__<Network>__BlockSignature": [
      {
        "blockNumber": 25938055,
        "blockHash": "0x12e96fba0f8c4baf209baee487b20233776c7c69deb0208e22c2f6c6534aa788",
        "merkleRoot": "7989b9049a5a87f2bea62f8ccf48e90a272ed952d10f93e260fd1628d04410d3",
        "signatureType": "ES256K",
        "signatureIdentity": "025b33affa6b716c8fd6ac8c176c9dde5fac85aa222b0d6a3c58a6283bdf042c8b",
        "signatureValue": "3045022100bc7fcc72a8e33332a56dd84a720a04752d179a74a8426b5cd1efcb509b01fac102202dfa24bd7cfc28afe162e4e3a7477d13e9115f8483b0e55c278f92dc2bf8aa7b"
      }
    ]
  }
}
```

Comparing `signatureIdentity` across blocks tells you whether two blocks came from the same Generator client. To check a specific document, filter `BlockSignature` on its block's `blockNumber`. [Verify a whole block at once](#verify-a-whole-block-at-once) explains what one block-level signature covers.

## Trace a block back to its attestations

Host clients maintain attestation records that track which Generator clients signed off on each block. Records are keyed by block, not by document DocID: `attested_doc` holds `block:<height>:<merkleRoot>`, where the hash is the same signed Merkle root the block's [`BlockSignature`](#check-who-signed-a-document) carries. Filter by that key:

```graphql
{
  <Chain>__<Network>__AttestationRecord(
    filter: { attested_doc: { _eq: "block:25938055:7989b9049a5a87f2bea62f8ccf48e90a272ed952d10f93e260fd1628d04410d3" } }
  ) {
    attested_doc
    source_doc
    doc_type
    vote_count
  }
}
```

```json
{
  "data": {
    "<Chain>__<Network>__AttestationRecord": [
      {
        "attested_doc": "block:25938055:7989b9049a5a87f2bea62f8ccf48e90a272ed952d10f93e260fd1628d04410d3",
        "source_doc": ["025b33affa6b716c8fd6ac8c176c9dde5fac85aa222b0d6a3c58a6283bdf042c8b"],
        "doc_type": "Block",
        "vote_count": 1
      }
    ]
  }
}
```

The fields tie the record back to the block's signature. `source_doc` lists the public keys of the Generator clients that signed the block, the same keys that appear as `signatureIdentity` on the block's `BlockSignature` document. `doc_type` names what was attested, `Block` on Hosts today. `vote_count` is a CRDT counter that goes up as more Generator clients are seen signing the same data, so it tells you how much independent agreement the block has. The record also carries `CIDs`, the commit CIDs covered by the signed Merkle root; the list runs to hundreds of entries per block, so the query above leaves it out. To filter query results by vote count automatically, see [Configure attestation thresholds](/build/how-to/configure-attestation-thresholds/).

## Resolve a CID to its commit or document

A CID from `_version` or from an attestation record resolves in two directions.

Query `_commits` for the commit-level metadata:

```graphql
{
  _commits(cid: "bafyreibtbym4uht5dppohohg4wg66tdg4r253ws2i4wshc2gtwje6e25sy") {
    cid
    docID
    fieldName
    collectionVersionId
  }
}
```

Or pass the same CID as the `cid` argument on the collection to resolve the document at that version:

```graphql
{
  <Chain>__<Network>__Transaction(cid: "bafyreibtbym4uht5dppohohg4wg66tdg4r253ws2i4wshc2gtwje6e25sy") {
    _docID
    blockNumber
    hash
    to
    from
    value
  }
}
```

Because the CID is derived from the content, the document it resolves to is exactly the version that was committed. A Host that altered the data would produce a different CID, which would no longer match the block's signed Merkle root.

## Verify a whole block at once

Signing every document individually would be slow, so Generator clients sign per block. After writing a block's documents, the Generator client computes a Merkle root over their CIDs, signs the root, and writes a `BlockSignature` document. Snapshot signatures do the same across block ranges for faster initial sync. Verifying one block-level signature covers every primitive document in that block. The two-level Merkle structure is laid out in the [architecture reference](/reference/architecture/), and [Attestation](/understand/core-concepts/attestation/) explains how Host clients turn these signatures into attestation records.

{% admonition(type="note") %}
Signatures and CIDs prove who produced your data and that it was not altered in transit. They do not prove completeness (that no matching documents were withheld from your result) or freshness (that you are seeing the latest state). Closing those gaps is roadmap work; see [Privacy](/understand/core-concepts/privacy/) for how Shinzo frames the remaining trust assumptions.
{% end %}

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
