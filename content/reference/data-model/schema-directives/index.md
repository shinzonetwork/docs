+++
title = "Schema directives"
description = "GraphQL SDL directives used in View schemas (@materialized, etc.)."
+++

Shinzo schemas use four SDL directives. Two (`@index` and `@relation`) appear in the primitive schemas, `@crdt` appears on the attestation record, and `@materialized` is the materialization switch on View SDL.

| Directive | Where it appears | What it does |
| --- | --- | --- |
| `@relation(name: "...")` | Primitive schemas | Connects two types so queries can nest across them. |
| `@index` and `@index(unique: true)` | Primitive schemas | Indexes a field for faster filtering; `unique` additionally enforces one document per value. |
| `@crdt(type: pcounter)` | `AttestationRecord.vote_count` | Makes the field a positive-counter CRDT. |
| `@materialized(if: true)` | View SDL | Tells DefraDB to pre-compute and store the View's output documents. |

## @relation

Connects two types into a relation. Both sides declare the same `name`, and queries nest across the relation in one round trip:

```graphql
type <Chain>__<Network>__Block {
    transactions: [<Chain>__<Network>__Transaction] @relation(name: "block_transactions")
}

type <Chain>__<Network>__Transaction {
    block: <Chain>__<Network>__Block @relation(name: "block_transactions")
}
```

[Primitives](../primitives/) lists all four relation names and the fields they connect.

## @index

Marks a field as indexed. Filtering on an indexed field avoids scanning every document in the collection, so the schemas put it on the fields you filter by most: `blockNumber`, `attested_doc`, `doc_type`. With `unique: true`, DefraDB enforces one document per field value. The Host's copy of the schema declares unique indexes on block and transaction hashes, so the same block cannot be stored twice on a Host:

```graphql
hash: String @index(unique: true)
```

## @crdt

Tells DefraDB to merge the field as a conflict-free replicated data type instead of last-write-wins. The one use today is `vote_count` on `AttestationRecord`, a positive counter (`pcounter`): each node tracks its own increments, and merges sum them deterministically. See [AttestationRecord](../attestation-record/) for the merge example.

## @materialized

The View SDL's materialization switch, applied to the View's output type. `@materialized(if: true)` tells DefraDB to pre-compute and store the output documents as the Host processes data. `if: false` leaves them virtual: the View is computed per query instead, which trades query speed for not storing a second copy of the data.

```graphql
type EventView @materialized(if: false) { transactionHash: String }
```

[Choose materialized vs on-query](/build/how-to/view-recipes/#choose-materialized-vs-on-query) covers the trade-off, and [Viewkit](/reference/components/viewkit/) covers the rest of the View bundle format.
