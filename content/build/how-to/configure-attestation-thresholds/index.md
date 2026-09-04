+++
title = "Configure attestation thresholds"
description = "How to require a minimum number of Generator attestations before query results are returned in your app."
+++

Shinzo data is signed by the Generator clients that produced it, and Host clients keep attestation records that track how many independent Generator clients signed the same data. With the app-sdk you can set a bar: only return documents whose attestation count meets your threshold. The threshold is a query-time filter, not a system-wide setting, so one app can apply different bars to different queries.

{% admonition(type="warning") %}
The attestation helpers described here live on the `Feature/attestationFilter` branch of the app-sdk and are not merged into `main` yet. They also depend on pushed replication, which is currently blocked by the DefraDB version mismatch described in [Subscribe to Views with the app-sdk](/build/how-to/subscribe-to-views/). This page documents the API as implemented on that branch so you can build against it ahead of the merge.
{% end %}

## Add attestation records for a View

Attestation records are segmented per View, so your app only receives records for the data it cares about. Opt in per View with `AddAttestationRecordCollection`:

```go
import "github.com/shinzonetwork/shinzo-app-sdk/pkg/attestation"

err := attestation.AddAttestationRecordCollection(context.Background(), myNode, myView.Name)
if err != nil {
    if strings.Contains(err.Error(), "collection already exists") {
        // Records for this View were added before. Informational and safe to ignore.
    } else {
        panic(err)
    }
}
```

This works like `SubscribeTo`: it adds an `AttestationRecord_<ViewName>` collection to your embedded DefraDB instance and registers it for passive replication, so Host clients push the View's attestation records alongside its documents. Call it once per View you want to filter, after subscribing to the View itself.

## Choose configured or per-query thresholds

Four helpers cover the two ways to set the bar. All four work like `defra.QuerySingle` and `defra.QueryArray`, except they drop results that fail the attestation check. Your result struct needs a `DocID` field, because the filter matches documents to their attestation records by DocID.

The configured pair reads the threshold from `shinzo.minimum_attestations` in your config:

```go
transfers, err := attestation.QueryArrayWithConfiguredAttestationFilter[Transfer](ctx, myNode, query)
transfer, err := attestation.QuerySingleWithConfiguredAttestationFilter[Transfer](ctx, myNode, query)
```

The per-call pair takes the threshold as an argument:

```go
transfers, err := attestation.QueryArrayWithAttestationFilter[Transfer](ctx, myNode, query, 3)
transfer, err := attestation.QuerySingleWithAttestationFilter[Transfer](ctx, myNode, query, 3)
```

Set the config default in `config.yaml`:

```yaml
shinzo:
  minimum_attestations: 2
```

Which style to use depends on how uniform your trust requirements are:

| Situation | Approach |
| --- | --- |
| One threshold covers the whole app | Configured helpers with `minimum_attestations` |
| A wallet display where showing something fast beats certainty | Per-call threshold of 1 |
| A high-value flow like a settlement or payout | Per-call threshold of 3 or more |
| A mix of casual and critical reads in one app | Configured default, per-call overrides where it matters |

Make sure you added the attestation record collection for any View you query through these helpers. Without it there are no records to filter on, and every result fails the check.

## Debug an empty result set

If a filtered query returns nothing but the unfiltered equivalent has rows, the filter is doing its job and your data is under-attested. Inspect the records directly to see why. An attestation record ties one of your View's documents to the evidence behind it:

- `attested_doc` is the DocID of the View document being attested to.
- `source_doc` links back to the source document the attestation came from.
- `CIDs` are the signed commit CIDs backing the attestation.
- `doc_type` names the attested collection.
- `vote_count` is a CRDT counter that Host clients increment as they observe more Generator clients signing the same data.

Query the records for the document that went missing:

```graphql
{
  <Chain>__<Network>__AttestationRecord(
    filter: { attested_doc: { _eq: "<doc-id>" } }
  ) {
    attested_doc
    source_doc
    CIDs
    doc_type
    vote_count
  }
}
```

If `vote_count` (or the number of records) is below your threshold, the filter correctly excluded the document. Lower the threshold, or wait for more Generator clients to attest. Note that attestations only accumulate while Generator clients are actually signing the underlying data, so a quiet View on a testnet may legitimately sit at a low count.

To check signatures and CIDs by hand, see [Verify data with signatures and CIDs](/build/how-to/verify-data/). For the reasoning behind per-query trust, see [Attestation as a query filter](/build/explanation/attestation-as-a-query-filter/), and [Attestation](/understand/core-concepts/attestation/) for the platform-level picture.

## Need help

{{ need_help(client="app-sdk", repo_name="app-sdk", repo="https://github.com/shinzonetwork/app-sdk/issues") }}
