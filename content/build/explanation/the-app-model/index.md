+++
title = "The Shinzo app model"
description = "How Shinzo inverts the traditional data-API model: you define the API, and pre-processed data is pushed to your application as a verifiable local cache."
aliases = ["/guides", "/guides/building-apps-with-shinzo", "/build/build-an-app/"]
[extra]
mermaid = true
+++

Apps that read blockchain data usually get it from a centralized data provider, and the deal is always the same. You choose from a fixed set of APIs the provider offers. The provider builds elaborate caching infrastructure to answer queries over an enormous dataset quickly. Then, in your app, you build a cache of your own on top, tracking recent responses so you can keep latency and per-query costs under control. Freshness means re-querying, or running webhooks that can surprise you with costs. And if the API you actually want does not exist, you pay for a custom endpoint or pipe the raw data yourself.

Shinzo inverts this model.

## You define the API

With Shinzo, the app developer defines the API. A [View](/build/explanation/views-for-builders/) describes exactly the data your app needs: what to pull from the primitive collections, how to transform it, and what schema to expose the result as. Host clients then run that View continuously and push the pre-processed results to every app that subscribes.

So instead of pulling answers out of someone else's cache, your app maintains a local replica of exactly the data it asked for. Queries run against that replica, as often as you like, with no round trip. You do not maintain a separate cache, re-query an API for the latest data, or guess which endpoints exist. And rather than paying per query, you pay for access to the transformed data.

## A cache you can verify

The local copy is not an ordinary cache, and your app does not have to trust the Host clients that fill it. The replica lives in an embedded [DefraDB](https://github.com/sourcenetwork/defradb) instance inside your app, and the data arriving in it carries its own evidence:

- Documents are content-addressed. Every commit has a CID, so what you received can be checked against what was claimed.
- Generator clients sign what they produce, so there is a verifiable record of who said what.
- Attestation records travel alongside your Views, tracking how many independent Generator clients signed the same data, so your app can filter out anything below the bar it sets.

Pushed data that is independently checkable is what makes the inversion safe: the Host client is a delivery mechanism, not an authority. [Attestation as a query filter](/build/explanation/attestation-as-a-query-filter/) goes deeper on the trust side.

Delivery itself is passive replication. Subscribing to a View applies the View's schema to your embedded DefraDB and registers the collection as a replication topic, which tells Host clients to push new documents to you as they process new blocks. From the app's side, data simply appears.

{% mermaid() %}
flowchart LR
    subgraph Network["Shinzo network"]
        Generators["Generator clients<br/>produce and sign primitives"]
        Hosts["Host clients<br/>run your View"]
        Generators --> Hosts
    end

    subgraph App["Your application"]
        Defra["Embedded DefraDB<br/>verifiable local replica"]
        Code["Your app code<br/>local GraphQL queries"]
        Defra --> Code
    end

    Hosts -->|"View documents and attestation records<br/>pushed over P2P"| Defra
{% end %}

Everything left of the arrow is the network's problem. Everything right of it is your process: no API keys, no rate limits, no egress bill per read.

## Worked example: a token supply counter

Say your app shows the current supply of a fungible token like USDC, and assume the contract has no method that returns it. The only way to know the supply is to parse every mint and burn event the contract has ever emitted.

The traditional path is grim: no mainstream data API answers "current supply" directly, so you either paginate through every transfer yourself or pay a provider to build the endpoint. With Shinzo, you write a View instead: filter logs to the token's contract address, decode them against the contract's ABI, keep only mints and burns. Generator and Host clients do the rest, and every app client subscribed to that View receives exactly those events, nothing more. Your app sums them locally, re-running the query as often as it wants, and it never touches the underlying blocks, transactions, or logs.

Two things to notice. The API shape came from you, not from a provider's catalog. And the data arrived with signatures and attestation records, so the count your app displays can be backed by however many independent Generator clients you decide to require.

## What the model asks of you

The inversion comes with real trade-offs, and they are worth naming. Your app is pushed data for the Views it subscribes to rather than pulling arbitrary slices on demand, so you design around subscriptions instead of ad-hoc queries. The subscribed data lives in your process, which costs local storage and bandwidth. And freshness follows block production plus replication, not a per-query fetch of the latest state.

For many apps these are good trades. For some, like a stateless web frontend that needs one occasional lookup, a direct signed query to a Host client fits better, and for privacy-critical work, running your own Host client beats both. [Choosing an app architecture](/build/explanation/choosing-an-architecture/) walks through the decision.

## Where to go next

- [Views for builders](/build/explanation/views-for-builders/): what a View is and how Viewkit packages one.
- [Attestation as a query filter](/build/explanation/attestation-as-a-query-filter/): how per-query trust thresholds work.
- [Choosing an app architecture](/build/explanation/choosing-an-architecture/): this model versus the alternatives.
- [Subscribe to Views with the app-sdk](/build/how-to/subscribe-to-views/): the mechanics of embedding DefraDB and subscribing.
