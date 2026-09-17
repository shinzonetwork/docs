+++
title = "Specs & limits"
description = "Technical specifications, throughput limits, and supported configurations."
+++

What is bounded and what is not when you query Shinzo. The short version: there is no request rate limit on the query path, but request shape, freshness, and response size are all bounded, and public Hosts prune old data.

## Request limits

There is no request rate limit on the Host query path. Nothing in the Host client meters how often a client queries, and you never get a `429`. This is the property the concept pages mean when they say no rate limits: read as often as your app wants to.

The limits that do exist bound request shape and freshness:

| Limit | Value | Past it |
| --- | --- | --- |
| Signed request freshness | Two minutes either side of `request_timestamp`, by default | `403` `forbidden: stale or future request` |
| Billed query scope | One View collection per request | `400` `a billed query may touch only one view` |

The freshness window absorbs client and Host clock skew while bounding how long a captured signature can be replayed, so sign the envelope right before you send it. See [Errors](../errors/) for the full status table.

## Limits behind a network gateway

Some deployments route queries through a network gateway, which fans each request out to several Hosts and returns the agreed answer. This is the deployment the `fanout` extension addresses in [Query your first View](/build/tutorials/query-your-first-view/). A gateway adds these limits on top of the Host's:

| Limit | Value | Past it |
| --- | --- | --- |
| Request body size | 64 KiB | `413` |
| Response size considered for consensus | 1 MiB | The oversized Host response is dropped from consensus |
| `limit` argument | 100,000 maximum | Rejected as an invalid limit |
| `limit` and `order` arguments | Required on every root field | Rejected at parse |
| Root collections | One per query | The query is not routed |
| Upstream Host timeout | 120 seconds | The Host counts as failed |

A gateway samples 3 Hosts per query by default; `extensions.fanout` overrides that. Responses carry a `consensus` extension telling you whether the sampled Hosts agreed: `full`, `partial`, or `none`.

## Data availability

Public Hosts prune old data to keep storage bounded, so a document that resolved yesterday may not resolve today. Fetch a current document and take its DocID or CID from there if an old one stops resolving. See [DefraDB metadata](../data-model/defradb-metadata/).

There is no aggregate count field in the GraphQL API. [Query data](/build/how-to/query-data/#count-the-transactions-in-a-block) shows the workaround when you need a count.

## Supported configurations

The Generator client reads EVM-compatible chains. The shipped config lists Ethereum, Arbitrum, Optimism, and Avalanche, and any other EVM-compatible chain can likely be read by setting `chain.name` and `chain.network` and pointing the Generator at a compatible RPC endpoint. See the [chain config](/run/run-a-generator/config-reference#chain) and [shinzo.network/chains](https://shinzo.network/chains) for the current list, and [Chain abstraction](/reference/components/generator-client#chain-abstraction-in-progress) for the multi-chain work in progress.

Hardware requirements for operators are on their own pages: [Generator](/run/run-a-generator/hardware-requirements/) and [Host](/run/run-a-host/hardware-requirements/).

## Generator-side pacing

The one rate limit in the stack runs the other way: `blocks_per_minute` (default 60 in the shipped config) is a Generator pacing its own reads of the chain, not a limit on callers. Operators who need more throughput can raise or disable it; see [high-throughput tuning](/run/run-a-generator/deployment-examples/high-throughput-tuning/).
