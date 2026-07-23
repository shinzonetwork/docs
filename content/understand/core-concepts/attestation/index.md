+++
title = "Attestations"
+++
Attestation is how Shinzo tracks how much of the network has independently agreed on a piece of data.

## The problem it solves

With a centralized indexing service, you trust the provider because you have no other option. You can't verify[^1] the data you got matches what's actually on chain. In Shinzo, Generators cryptographically sign every document they produce, so there's a verifiable record of who said what. But a single signature only goes so far. You still need to know whether multiple independent Generators saw the same thing.

Attestation answers that question.

## How it works

When a Host client receives a document from a Generator client, it checks the signature and creates (or updates) an attestation record for that document. The record tracks which Generators client signed off and maintains a running vote count.

```graphql
type Ethereum__Mainnet__AttestationRecord {
    attested_doc: String
    source_doc: String
    CIDs: [String]
    doc_type: String
    vote_count: Int  # CRDT P-counter — only goes up
}
```

The `vote_count` field is a CRDT P-counter: it only ever increments, and multiple Hosts merging their counts never produce conflicts. If three Generator clients all sign the same block, the attestation record for that block has a vote count of three.

## What applications do with it

Apps set their own attestation threshold depending on how much they care about correctness versus speed. A wallet showing recent transfers might accept data with a count of one. A DeFi protocol acting on that data might wait for five. The threshold is a query-time filter, not a system-wide setting, so different queries in the same app can use different thresholds.

## Batch signatures

Rather than signing every document individually, Generator clients produce a `BatchSignature` per block: a single document committing to a Merkle root that covers every primitive in that block (transactions, logs, access list entries, and the block itself). A Host client can then create a single attestation covering the entire block in one step.

[^1]: Technically you can verify that the data you're getting is correct. But you'd have to sign up to multiple APIs, request the same data from each, work it into the same schema, and then compare between them. This is obviously a huge hassle, and incredibly costly.
