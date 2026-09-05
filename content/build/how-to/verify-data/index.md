+++
title = "Verify data with signatures and CIDs"
description = "How to verify who signed your data and navigate attestations, commits, and documents via CIDs."
+++

Every document a Shinzo client serves is content-addressed and signed, so you can check where a piece of data came from instead of trusting the server that returned it. This page covers the verification queries: reading signatures off documents, tracing documents back to their attestations, and resolving CIDs to commits and documents.

The examples query primitive collections through a Host client, and the same queries work in a local-first app's embedded DefraDB instance. Both surfaces share the query language, as described in [Query data](/build/how-to/query-data/).

{% admonition(type="note") %}
Collection names are prefixed with `<Chain>__<Network>__`, derived from the `chain.name` and `chain.network` settings of the Generator client that indexed the data. Substitute the prefix that matches your chain.
{% end %}

## Check who signed a document

Every document carries signed commits in its `_version` field. Each entry has the commit's `cid` and a `signature` with the signer's `identity` (a public key), the signature `value`, and the signature `type`.

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
        "number": 23902272,
        "_docID": "bae-91bd3f16-ccb1-5c35-b098-45672ee6fd48",
        "_version": [
          {
            "cid": "bafyreibtbym4uht5dppohohg4wg66tdg4r253ws2i4wshc2gtwje6e25sy",
            "signature": {
              "identity": "0348621aed3cb78ade074e86a3d650dfdfad0c110b274c0633b331d1b0a41ddd99",
              "type": "ES256K",
              "value": "MEUCIQCjfh3m0RNv4j094aW5YPEeF+GCMFWEGy0hiAcga7HKbQIgc54AV7WSdXZVyGH7jOuLcXJ6w5fDQSUdrlzgZhDkBTw="
            }
          }
        ]
      }
    ]
  }
}
```

The `identity` is the public key of the Generator client that signed the commit. Comparing identities across documents tells you whether two pieces of data came from the same Generator client.

## Trace a document back to its attestations

Host clients maintain attestation records that track which Generator clients signed off on a document. Query the `AttestationRecord` collection and filter by the document you care about:

```graphql
{
  <Chain>__<Network>__AttestationRecord(
    filter: { attested_doc: { _eq: "bae-91bd3f16-ccb1-5c35-b098-45672ee6fd48" } }
  ) {
    attested_doc
    source_doc
    CIDs
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
        "attested_doc": "bae-91bd3f16-ccb1-5c35-b098-45672ee6fd48",
        "source_doc": ["bae-25fb059c-f232-5305-8a5d-0162f01e43e6"],
        "CIDs": ["bafyreibtbym4uht5dppohohg4wg66tdg4r253ws2i4wshc2gtwje6e25sy"],
        "doc_type": "<Chain>__<Network>__Block",
        "vote_count": 1
      }
    ]
  }
}
```

The fields matter for different reasons. `CIDs` links the record to the signed commits it attests to. `doc_type` names the attested collection. `vote_count` is a CRDT counter that goes up as more Generator clients are observed signing the same data, so it tells you how much independent agreement the document has. To filter query results by that count automatically, see [Configure attestation thresholds](/build/how-to/configure-attestation-thresholds/).

## Resolve a CID to its commit or document

A CID from `_version` or from an attestation record resolves in two directions.

Query `_commits` for the commit-level metadata, including the signature over that exact commit:

```graphql
{
  _commits(cid: "bafyreibtbym4uht5dppohohg4wg66tdg4r253ws2i4wshc2gtwje6e25sy") {
    cid
    docID
    fieldName
    schemaVersionId
    signature {
      type
      value
      identity
    }
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

Because the CID is derived from the content, the document it resolves to is exactly the version that was signed. A Host that altered the data would produce a different CID.

## Verify a whole block at once

Signing every document individually would be slow, so Generator clients also sign per block. After writing a block's documents, the Generator client computes a Merkle root over their CIDs, signs the root, and writes a `BlockSignature` document. Snapshot signatures do the same across block ranges for faster initial sync. Verifying one block-level signature covers every primitive document in that block. The two-level Merkle structure is described in the [architecture reference](/reference/architecture/), and [Attestation](/understand/core-concepts/attestation/) explains how Host clients turn these signatures into attestation records.

{% admonition(type="note") %}
Signatures and CIDs prove who produced your data and that it was not altered in transit. They do not prove completeness (that no matching documents were withheld from your result) or freshness (that you are seeing the latest state). Closing those gaps is roadmap work; see [Privacy](/understand/core-concepts/privacy/) for how Shinzo frames the remaining trust assumptions.
{% end %}

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
