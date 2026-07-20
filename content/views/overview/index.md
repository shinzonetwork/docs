+++
title = "Overview"
aliases = ["/view-creator", "/views"]
description = "Introduction to Shinzo Viewkit"
[extra]
mermaid = true
+++

Viewkit (also known as View Creator) is the developer-facing toolchain for defining, packaging, and deploying Shinzo Views. It provides a workflow for turning raw indexed blockchain data into reusable, versioned data APIs that can be executed and served by Hosts.

Viewkit sits between indexed primitive data and application-ready data interfaces. It lets developers declaratively specify what data to ingest, how to transform it, and how to expose it, without managing infrastructure, execution environments, or deployment mechanics directly.

## Purpose and role in the stack

Within the Shinzo ecosystem, Viewkit sits above the Generator client and alongside Host clients:

- Generator clients produce normalized, deterministic primitive data.
- Viewkit defines how that data should be queried, transformed, and exposed.
- Host clients execute those definitions, serve results, and attest to correctness.

Using Viewkit, developers write Views as versioned bundles that describe a complete data pipeline. These views are then deployed to a target environment (local or devnet, with mainnet support planned), where Hosts execute them deterministically against indexed data and serve the results to consumers.

This separation enables:

- Rapid iteration on data models without re-indexing chains.
- Deterministic, reproducible data APIs.
- Decoupling of data definition from execution and infrastructure.
- Portable views that can run on any compliant Host client.

## Core concepts

A View is the fundamental unit produced by Viewkit. Each view is a self-contained, versioned bundle that may include:

- Queries: declarative definitions of the raw data shape to ingest from indexed primitives.
- SDL (GraphQL): schemas describing how data is modeled, materialized, or exposed to consumers.
- Lenses (WASM): composable WebAssembly transforms for filtering, decoding, enriching, or reshaping data.
- Wallet: cryptographic credentials used to sign and authorize deployments to a target network.

Conceptually, a view represents the pipeline:

**indexed primitive data → query → lenses (WASM) → GraphQL schema → consumable API**

{% mermaid() %}
flowchart LR
  Prim["Primitive data<br/>(Generator)"]
  Q["Query<br/>select raw fields"]
  Lens["Lenses (WASM)<br/>filter · decode · reshape"]
  SDL["SDL<br/>output schema"]
  API["Consumable API<br/>(GraphQL)"]

  Prim --> Q --> Lens --> SDL --> API
{% end %}

## Primitive data Views operate on

Generator clients produce six primitive collection types, all prefixed with `Ethereum__Mainnet__` (or the equivalent chain/network prefix):

| Collection | Key fields | What it represents |
| --- | --- | --- |
| `Block` | `number`, `hash`, `timestamp`, `miner`, `gasUsed`, `gasLimit` | Block headers |
| `Transaction` | `hash`, `from`, `to`, `value`, `blockNumber`, `status`, `gasUsed` | Transactions with receipt data |
| `Log` | `address`, `topics`, `data`, `transactionHash`, `blockNumber` | EVM event logs |
| `AccessListEntry` | `address`, `storageKeys`, `blockNumber` | EIP-2930 access list entries |
| `BlockSignature` | `blockNumber`, `blockHash`, `merkleRoot`, `signatureValue` | Per-block aggregate signatures |
| `SnapshotSignature` | `startBlock`, `endBlock`, `merkleRoot`, `signatureValue` | Range-level snapshot signatures |

The `Log` collection is the primary source for event-based Views. There is no `Event` collection. Raw event data lives in `Log`, where `topics` holds indexed parameters and `data` holds non-indexed ones. A lens (typically `decode_log`) turns those raw fields into decoded, structured output.

## What you can build with Views

- ERC-20 transfer feeds: filter logs by a token contract address, ABI-decode `Transfer` events, expose `from`/`to`/`amount` as a queryable collection.
- NFT trade trackers: decode marketplace events (e.g. OpenSea Seaport) into structured sale records with price, buyer, seller, and token ID.
- Governance monitors: decode `VoteCast` events from a DAO's governance contract into a tally of votes per proposal.
- Transaction analytics: query `Transaction` documents directly (no lens needed) to expose filtered subsets like "all transactions to a specific contract above a given value."
- Multi-event decoders: chain a filter lens with a decode lens to watch multiple event types from one contract in a single View.

## Developer experience

Viewkit is distributed as a CLI and is designed for local-first development. It supports:

- Initializing and inspecting view bundles.
- Incrementally adding queries, schemas, and lenses.
- Removing and updating individual components (query, SDL, lenses) without starting over.
- Rolling back to a previous version of a view.
- Testing views locally before deployment.
- Deploying views to a local DefraDB instance with a GraphQL Playground.
- Signing and publishing views to shared networks like devnet.

Viewkit provides strong defaults, explicit versioning, and deterministic behavior. Developers focus on data semantics and transformations; Shinzo handles execution, distribution, and verification.

## Where to go next

- [Quick Start](/views/quickstart/): build and deploy your first view end-to-end.
- [Examples](/views/examples/): copy-pasteable views from minimal filters to multi-lens decode pipelines.
- [Lenses](/views/lenses/): how WASM transforms work, available lenses, and how to chain them.
- [FAQ](/views/faq/): troubleshooting, common errors, and tips.
