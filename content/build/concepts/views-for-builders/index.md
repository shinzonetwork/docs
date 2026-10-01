+++
title = "Views for builders"
description = "What a Shinzo View is: a versioned bundle of query, SDL, and lenses, and how Viewkit turns primitive data into reusable data APIs."
aliases = ["/view-creator", "/views", "/views/overview", "/build/explanation/views-for-builders/"]
[extra]
mermaid = true
+++
Viewkit (also known as View Creator) is the developer-facing toolchain for defining, packaging, and deploying Shinzo Views. It provides a workflow for turning raw primitive blockchain data into reusable, versioned data APIs that can be executed and served by Hosts. The same workflow is also available as a browser UI in [Shinzo Studio](https://studio.shinzo.network/), for developers who prefer not to use the CLI.

Viewkit sits between primitive data and application-ready data interfaces. It lets developers declaratively specify what data to ingest, how to transform it, and how to expose it, without managing infrastructure, execution environments, or deployment mechanics directly.

## Purpose and role in the stack

Within the Shinzo ecosystem, Viewkit sits above the Generator client and alongside Host clients:

- Generator clients produce normalized, deterministic primitive data.
- Viewkit defines how that data should be queried, transformed, and exposed.
- Host clients execute those definitions, serve results, and attest to correctness.

{% player(scene="views") %}
<div class="player__caption" data-title="Primitives flow in">
  <p>Generator clients turn chain data into primitive documents, all normalized and deterministic: blocks, transactions, and logs. They flow to Hosts over the peer-to-peer network, but on their own they're raw material. Nothing about a raw log says how your app wants to read it.</p>
</div>

<div class="player__caption" data-title="A developer writes a View">
  <p>A developer describes the pipeline as code with Viewkit: a query that selects the raw fields, lenses that decode and reshape them, and an SDL that defines the output. A View is pure definition: nothing has executed, and no chain data has been touched.</p>
</div>

<div class="player__caption" data-title="Viewkit versions and signs it">
  <p>Viewkit packages the query, lenses, and SDL into a single versioned bundle and signs it with the developer's wallet. From here on the View carries a version: change any piece and the bundle becomes a new version.</p>
</div>

<div class="player__caption" data-title="ShinzoHub registers it">
  <p>The developer deploys the bundle to the target network, local or devnet today. ShinzoHub validates it, registers it in the View registry, and emits an event that Hosts listen for.</p>
</div>

<div class="player__caption" data-title="A Host executes it">
  <p>A Host picks up the registered View and runs it over the primitives as they arrive: the query selects, the lens decodes, the SDL materializes. Execution is deterministic, so every compliant Host produces the same view documents from the same primitives. Here, that output is a <code>TokenTransfer</code>.</p>
</div>

<div class="player__caption" data-title="Your app queries locally">
  <p>The Host serves the view documents to subscribers, and your app receives them over P2P into its embedded DefraDB. A query is a local database lookup with GraphQL. When the data model needs to change, the developer ships v2 of the View and iterates without reprocessing the chain.</p>
</div>
{% end %}

Using Viewkit, developers write Views as versioned bundles that describe a complete data pipeline. These Views are then deployed to a target environment where Hosts execute them deterministically against primitive data and serve the results to consumers.

This separation enables:

- Rapid iteration on data models without reprocessing the chain.
- Deterministic, reproducible data APIs.
- Decoupling of data definition from execution and infrastructure.
- Portable Views that can run on any compliant Host client.

## Core concepts

A View is the fundamental unit produced by Viewkit. Each View is a self-contained, versioned bundle that may include:

- Queries: declarative definitions of the raw data shape to ingest from the primitive collections.
- SDL (GraphQL): schemas describing how data is modeled, materialized, or exposed to consumers.
- Lenses (WASM): composable WebAssembly transforms for filtering, decoding, enriching, or reshaping data.
- Wallet: cryptographic credentials used to sign and authorize deployments to a target network.

Conceptually, a View represents the pipeline:

{% mermaid() %}
flowchart TD 
  Prim["Primitive data<br/>(Generator)"]
  Q["Query<br/>select raw fields"]
  Lens["Lenses (WASM)<br/>filter · decode · reshape"]
  SDL["SDL<br/>output schema"]
  API["Consumable API<br/>(GraphQL)"]

  Prim --> Q --> Lens --> SDL --> API
{% end %}

## Primitive data Views operate on

Generator clients produce six primitive collection types, all prefixed with `<Chain>__<Network>__` (derived from the Generator's `chain.name` and `chain.network` settings):

| Collection | Key fields | What it represents |
| --- | --- | --- |
| `Block` | `number`, `hash`, `timestamp`, `miner`, `gasUsed`, `gasLimit` | Block headers |
| `Transaction` | `hash`, `from`, `to`, `value`, `blockNumber`, `status`, `gasUsed` | Transactions with receipt data |
| `Log` | `address`, `topics`, `data`, `transactionHash`, `blockNumber` | Event logs |
| `AccessListEntry` | `address`, `storageKeys`, `blockNumber` | EIP-2930 access list entries |
| `BlockSignature` | `blockNumber`, `blockHash`, `merkleRoot`, `signatureValue` | Per-block aggregate signatures |
| `SnapshotSignature` | `startBlock`, `endBlock`, `merkleRoot`, `signatureValue` | Range-level snapshot signatures |

The `Log` collection is the primary source for event-based Views. There is no `Event` collection. Raw event data lives in `Log`, where `topics` holds indexed parameters and `data` holds non-indexed ones. A lens (typically `decode_log`) turns those raw fields into decoded, structured output. For copy-pasteable View examples that query each of these collections, see the [View recipes](/build/how-to/view-recipes/).

## What you can build with Views

- ERC-20 transfer feeds: filter logs by a token contract address, ABI-decode `Transfer` events, expose `from`/`to`/`amount` as a queryable collection.
- NFT trade trackers: decode marketplace events (e.g. OpenSea Seaport) into structured sale records with price, buyer, seller, and token ID.
- Governance monitors: decode `VoteCast` events from a DAO's governance contract into a tally of votes per proposal.
- Transaction analytics: query `Transaction` documents directly (no lens needed) to expose filtered subsets like "all transactions to a specific contract above a given value."
- Multi-event decoders: chain a filter lens with a decode lens to watch multiple event types from one contract in a single View.

## Developer experience

Viewkit is a local-first CLI: you initialize a View bundle, incrementally add or update its query, SDL, and lenses, test it locally against a throwaway DefraDB instance, then deploy to local or devnet. Strong defaults, explicit versioning, and deterministic behavior mean developers focus on data semantics and transformations; Shinzo handles execution, distribution, and verification.

For the hands-on walkthrough, see [Create your first View](/build/tutorials/create-your-first-view/). For the full command list, filter operators, and deploy internals, see the [Viewkit reference](/reference/components/viewkit/).

## Where to go next

- [Create your first View](/build/tutorials/create-your-first-view/): step-by-step tutorial for building and deploying your first View.
- [Pools](/understand/core-concepts/pools/): how developer demand for a View meets the Hosts that serve it.
- [Subscribe to Views with the app-sdk](/build/how-to/subscribe-to-views/): receive View data pushed to your app and query it locally.
- [Query data](/build/how-to/query-data/): GraphQL query patterns for deployed Views.
- [Lens reference](/reference/components/lens/): how WASM transforms work, available lenses, and how to chain them.
- [Viewkit reference](/reference/components/viewkit/): full command list, filter operators, VWL wire format, and deploy internals.
