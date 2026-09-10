+++
title = "Choosing an app architecture"
description = "Trade-offs between the three ways to build on Shinzo: direct signed queries to Hosts, an embedded local-first client, or your own private Host."
aliases = ["/build/explanation/choosing-an-architecture/"]
+++

There are three ways to build an app on Shinzo, and they all read the same signed, verifiable data produced by the same Views. What changes is where the data sits relative to your app and who gets to observe your reads:

1. **Direct signed queries**: your app sends signed GraphQL requests to a public Host client over HTTP. This is the model Shinzo Studio uses.
1. **Embedded local-first**: your Go app embeds DefraDB through the app-sdk and receives View data pushed to it over P2P.
1. **Your own Host**: you run a Host client as a private Direct Client, and your app queries infrastructure you control.

Because Views are architecture-neutral, this is not a one-way door. A View you deploy serves direct-query apps and embedded apps equally well, and moving between models means changing your client, not your data layer.

## At a glance

| | Direct signed query | Embedded local-first | Your own Host |
| --- | --- | --- | --- |
| Latency profile | Network round trip per query | Local database read | Round trip to your own infrastructure |
| Operational footprint | None; npm packages | An embedded library in your Go process, plus local storage | You run Generator and Host clients |
| Trust posture | Results you can verify against signatures and attestation records | The same evidence, with attestation thresholds enforced automatically at query time | No third party in the path at all |
| Data freshness | Whatever the Host has processed when you ask | Follows pushed replication as Host clients process new blocks | As fresh as your own pipeline |
| Best fit | Dashboards, serverless functions, prototypes | Stateful apps with heavy local querying | Privacy-critical or compliance-bound apps |

## Direct signed queries

Your app signs each GraphQL request (the `@shinzo/querysig` and `@shinzo/shinzohub` packages handle the envelope) and POSTs it to a Host client's endpoint. Nothing runs locally except your code, which makes this the fastest way to start and the natural fit for request-response environments like web frontends and serverless functions. The cost is a round trip per query, dependence on a public Host's availability, and the fact that the Host operator sees what you ask. Verification is manual: you fetch signatures and attestation records alongside your data and check them yourself.

## Embedded local-first

Your app embeds a DefraDB instance via the app-sdk, subscribes to Views, and Host clients push pre-processed documents to it as new blocks land. After that, queries are local reads: no round trip, no rate limits, and attestation thresholds can filter results automatically so under-attested data never reaches your logic. The costs are real: your app holds the subscribed data in-process, keeps P2P connections open, and designs around subscriptions rather than ad-hoc queries. [The Shinzo app model](/build/concepts/the-app-model/) explains why this inversion exists.

## Your own Host

Running a Host client as a private Direct Client gives you the strongest privacy and control available today, at the cost of operating a node: a synced chain source for the Generator client, disk, and monitoring. Your app then queries your own Host exactly as it would a public one. There are two tiers of private setup, from a Host that still follows the public View registry to a fully air-gapped one that contacts nothing but your own Generator client. [Privacy](/understand/core-concepts/privacy/) covers the tiers; [Use your own infrastructure](/build/how-to/use-your-own-infrastructure/) is the bridge to setting one up.

## Privacy is a dial, not a switch

These architectures are not three separate products but three points on a privacy dial, and the layers are opt-in. Query a public Host and the operator sees your queries. Embed the client and Hosts see only which Views you subscribe to, not what you read. Run your own Host and there is no third party in the path at all, which is the only configuration today where nobody can observe your reads. Pick the point on the dial your app actually needs; you can move it later without redefining your Views.

Pricing and metering are deliberately out of scope here. The comparison above is about architecture, not billing.

## Decide in ten seconds

- Prototyping a web frontend or adding a dashboard: start with [Query your first View](/build/tutorials/query-your-first-view/).
- A stateful service that reads the same data constantly: [Build a local-first app](/build/tutorials/build-a-local-first-app/).
- Regulated, compliance-bound, or privacy-sensitive work: [Use your own infrastructure](/build/how-to/use-your-own-infrastructure/).
