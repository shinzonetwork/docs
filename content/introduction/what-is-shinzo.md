# What is Shinzo?

Shinzo is a decentralized indexing network for blockchains. It takes raw on-chain data and turns it into structured datasets that any application can query, without having to go through a centralized indexing service to get them.

If you've built any kind web3 app before, you know the usual pattern: you pick a hosted indexer, pay per API call, cache the results locally, and hope the provider doesn't go down or quietly change what's available. Shinzo replaces that setup with a network of independent operators that index the chain at the source and share the results peer to peer.

## The problem Shinzo solves

Blockchains are good at writing data and bad at reading it. If you want to show a user all their previous transactions, or count token transfers for a given contract, you can't just ask the chain. The raw data isn't organized for questions like that. So the industry bolted centralized indexing services onto the side of every chain, and those services now sit in the trust path between your app and the data.

This setup is expensive, incredibly rigid, and introduces a significant trust-gap.

The goal of Shinzo is to make reading blockchain data as decentralized and verifiable as writing to it.

## How it works

Three kinds of participants run the network.

**Indexers** sit next to blockchain nodes and turn new blocks into structured documents as they arrive. They cryptographically sign everything they produce, so anyone downstream can check that the data came from a real indexer (and ideally several of them).

**Hosts** receive that primitive data over a peer-to-peer network and apply user-defined transforms called _Views_. They also keep attestation records**, which count how many different indexers signed off on each piece of data. Applications can use those counts to set their own trust thresholds.

**Developers** define the Views. A View is basically a way to say _"here's the raw data I care about, here's how I want it filtered and decoded, and here's the schema I want it exposed as."_ Once a View is deployed, Hosts pick it up, run it, and push the results to whoever subscribes.

Underneath all of this is [DefraDB](https://github.com/sourcenetwork/defradb), a peer-to-peer document database that handles replication, access control, and GraphQL queries. Applications embed DefraDB locally and query it the way they'd query any other database, which means no per-read round trip to an external API.

<!-- TODO: add this link once the page has been written. -->
<!-- For a more detailed architecture walkthrough, go read [How it works](#). -->
<!---->
## How to get involved

There are two ways to participate today.

### Run an Indexer

If you already operate an Ethereum node, adding a Shinzo Indexer is cheap. It's a sidecar, not a separate heavyweight service. It attaches to your existing execution client (currently only Geth, but support for other clients and chains is planned), reads blocks as they come in, signs them, and gossips them out over P2P. Recommended extra resources are around 4 CPU cores, 8 GB of RAM, and 100 GB of storage with pruning on, on top of whatever the node itself needs.

<!-- TODO: Add link once page exists. -->
<!-- You don't have to be a validator to run one on devnet. The [Run an Indexer](#) guide has the details. -->
<!---->
### Build a View

If you're a developer working on a dapp, wallet, or any kind of web3 app, Views are where you'll spend your time. A View is a versioned bundle that contains:

- A **query** describing the primitive data you want.
- A **schema** (GraphQL SDL) describing the shape you want to expose.
- One or more **Lens transforms** (WASM modules) that do the filtering and decoding.

<!-- TODO: link to viewkit page, once it exists. -->
You build Views with `viewkit`, Shinzo's CLI, and deploy them to the network. Any Host can then pick up the View, run it, and serve the results. Your application subscribes through the [app-sdk](https://github.com/shinzonetwork/app-sdk) and queries the resulting data locally.

<!-- TODO: link to viewkit page, once it exists. -->
<!-- Start with [Build a View](#), or skip straight to the [building-apps-with-shinzo](./guides/building-apps-with-shinzo.md) guide. -->

## Where the project is today

Shinzo is in active development on devnet. These core pieces work end to end:

- The **Indexer** ingests Ethereum Mainnet from a Geth node, signs documents, and replicates them over DefraDB's libp2p layer.
- The **Host client** receives that data, builds attestation records, applies Lens transforms, and serves Views to subscribers.
- **Viewkit** is usable for defining, packaging, and deploying Views to devnet today.
- **ShinzoHub** (built on the Cosmos SDK) handles view registration and access control, and talks to Sourcehub over IBC to gate subscriptions behind payment.
- The **app-sdk** lets Go applications embed DefraDB and run attestation-filtered queries against it.

Anyone can join the current Indexer cohort or the devnet program using the links at the bottom of this page.

## Where it's going next

A few larger pieces are still in design and should land over the coming quarters.

<!-- TODO: Add link once page exists. -->
The **Scheduler** will match Indexers with Hosts, handle payments between them, and verify that data was actually delivered, without either side being able to just claim so. The [Roadmap](#) covers the design in more depth.

The **Network Gateway** is a routing layer that helps applications figure out which Hosts serve a given View. It uses verifiable random host selection and fan-out validation so that no single Host, or cluster of Sybils, can dominate routing.

**Shinzo Studio** is a product UI for browsing, composing, and subscribing to Views without writing code. It's aimed at less technical users who still want to build on Shinzo data.

Beyond those, support for chains other than Ethereum Mainnet, a finalized `SHNZ` token design, and staking plus slashing rules for Hosts are all in progress.
