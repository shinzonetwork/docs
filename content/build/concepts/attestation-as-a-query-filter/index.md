+++
title = "Attestation as a query filter"
description = "Why attestation thresholds are a per-query trust dial, and how pushed attestation records let each app set its own bar for accepting data."
aliases = ["/build/explanation/attestation-as-a-query-filter/"]
+++

When a Host client serves your app a piece of data, why believe it? With a traditional data provider the answer is "because it's them": you trust the provider's reputation, or you don't use them. Shinzo replaces that up-front trust with evidence that travels with the data. Every document originates from a Generator client that cryptographically signed it, and Host clients keep a running count of how many independent Generator clients signed the same thing. Your app reads that count and decides, at the moment it queries, whether the evidence is strong enough.

That decision is the attestation threshold, and it is a query-time filter, not a system-wide setting. There is no network-wide bar for "correct". Each app, and each query inside each app, sets its own.

## What an attestation record is

When a Host client receives a document from a Generator client, it verifies the signature and creates or updates an attestation record for that data. The record captures which document is being attested to, which source documents back it, the CIDs of the signed commits behind it, and a vote count: how many distinct Generator clients have signed off on the same data.

The CIDs do the heavy lifting. A commit CID is the hash of a document's contents including its signatures, so it works as a condensed attestation: the Host client validates the Generator clients' signatures when it builds the record, then passes the CIDs along instead of the raw signatures. Your app gets compact, checkable evidence without needing to hold the underlying primitive data itself.

One honest caveat about that design: because your app never sees the primitives, it cannot re-verify the Generator clients' signatures on its own. It trusts the Host clients to have validated them. That trust is not blind. Host onboarding is vetted while the network is young, and the protocol is designed so independent verifiers can audit Host behavior using the same attestation records, with policing and economic penalties for manipulation. The threshold dial is what lets your app express how much of that stack it wants to lean on for any given read.

## Why a counter and not a list

The vote count is a CRDT P-counter: it only ever increments, and copies of the record maintained by different Host clients merge without conflicts. If three Generator clients sign the same block, the record for that block converges to a count of three no matter how many Hosts your app heard it from or in what order. There is no coordination step between Hosts and no way for a merge to lose an attestation.

That matters because your app may peer with several Host clients at once. A mergeable counter means the count you see always reflects every attestation any of them has observed, and it never goes backwards.

## Records arrive segmented by View

Attestation records are pushed to your app the same way View data is, over the same replication channel, and they are segmented: you receive records only for the Views you subscribe to and explicitly opt into. An app that does not care about attestation counts is not saddled with anyone else's evidence; an app that does care pays the extra data and query cost only for the Views where it matters.

## Why different apps set different bars

Raising the threshold buys accuracy and costs you two things: availability, because data becomes usable only once enough Generator clients have signed it, and query speed, because filtering means consulting the attestation records alongside the results. How much that trade is worth depends entirely on the app:

- A game or a social feed lives on freshness. Waiting for five signatures on data that will be stale in seconds is a bad trade, and micro-transactions rarely justify the wait. A threshold of one is fine.
- A wallet showing recent transfers wants to display something quickly, but the numbers should be right. A low threshold, with a higher one on the flow that actually moves funds.
- A settlement or payout flow acts on data where a wrong read is expensive. Waiting for three or more independent Generator clients is cheap insurance.

There is also a mundane reason thresholds help even when nobody is malicious. Generator clients sit close to the chain's validators, and chains re-org. Two honest Generator clients can briefly disagree about the tip. Requiring more than one attestation smooths over that noise before your app acts on it.

## Where the signatures come from

Signing every document individually would be slow, so Generator clients sign per block: a `BlockSignature` document commits to a Merkle root covering every primitive in the block, and snapshot signatures do the same across block ranges for faster sync. One block-level signature vouches for everything in that block, which is what lets attestation records stay small. For the platform-level picture, see [Attestation](/understand/core-concepts/attestation/).

## Where to go next

- [Configure attestation thresholds](/build/how-to/configure-attestation-thresholds/): the mechanics of setting thresholds and filtering queries with the app-sdk.
- [Verify data with signatures and CIDs](/build/how-to/verify-data/): check individual documents, commits, and records by hand.
- [The Shinzo app model](/build/concepts/the-app-model/): why pushed, verifiable data is the default way to build on Shinzo.
