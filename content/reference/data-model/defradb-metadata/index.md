+++
title = "DefraDB metadata"
description = "Metadata fields managed by DefraDB (_docID, _version, CID, etc.)."
+++

Every document in every collection carries two metadata fields that DefraDB manages for you. They select like any other field, and several query arguments key off them.

## _docID

The document's stable identifier, assigned when the document is created and unchanged across updates. The format is a `bae-` prefixed string. Select it in any query, or fetch one document directly with the `docID` argument:

```graphql
{
  <Chain>__<Network>__Transaction(docID: "bae-6ab5ece1-26a9-529d-a8af-3d10557672af") {
    _docID
    hash
    from
    to
  }
}
```

## _version

An array of the document's commits. Each entry carries a `cid`, the content-addressed identifier of that commit, and a `signature` field that is part of the schema but null today, because signing happens at the block level. See [Signatures](../signatures/).

```json
{
    "_version": [
        {
            "cid": "bafyreih4...",
            "signature": null
        }
    ]
}
```

## Content addressing

Because commits are content-addressed, a CID pins an exact version of a document. The `cid` argument returns the document as of that commit:

```graphql
{
  <Chain>__<Network>__Transaction(cid: "bafyreifaiu62wsgf64tdgdeejyvnhuwio7yvkxfufadxe5yfjaf5w4cf6u") {
    _docID
    hash
    from
    to
  }
}
```

You usually get a CID from `_version` or from an attestation record's `CIDs` list. [Verify data with signatures and CIDs](/build/how-to/verify-data/) covers resolving a CID in both directions, to the commit and to the document, and [Query data](/build/how-to/query-data/#fetch-a-document-by-docid-or-cid) shows the addressing arguments in context.

Hosts prune old data over time, so a DocID or CID that resolved yesterday may not resolve today on a public Host. If one stops resolving, fetch a current document first and take its identifiers from there.
