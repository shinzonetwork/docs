---
title: Overview
sidebar_label: Overview
sidebar_position: 1
description: Introduction to the Shinzo View Creator
---

View Creator (also referred to as Viewkit) is the developer-facing toolchain for defining, packaging, and deploying Shinzo Views. It provides a workflow for turning raw indexed blockchain data into reusable, versioned data APIs that can be executed and served by Hosts across the Shinzo network.

At a high level, View Creator bridges the gap between indexed primitive data and application-ready data interfaces. It allows developers to declaratively specify what data to ingest, how to transform it, and how to expose it, without managing infrastructure, execution environments, or deployment mechanics directly.

## Purpose and Role in the Stack

Within the Shinzo ecosystem, View Creator sits above the Indexer and alongside Hosts:

- Indexer → produces normalized, deterministic primitive data
- View Creator → defines how that data should be queried, transformed, and exposed
- Host → executes those definitions, serves results, and attests to correctness

Using View Creator, developers write **Views** as versioned bundles that describe a complete data pipeline. These views are then deployed to a target environment (local, devnet, or future networks), where Hosts execute them deterministically against indexed data and serve the results to consumers.

This separation enables:

- Rapid iteration on data models without re-indexing chains
- Deterministic, reproducible data APIs
- Decoupling of data definition from execution and infrastructure
- Portable views that can run on any compliant Host

## Core Concepts

A View is the fundamental unit produced by View Creator. Each view is a self-contained, versioned bundle that may include:

- Queries – declarative definitions of the raw data shape to ingest from indexed primitives
- SDL (GraphQL) – schemas describing how data is modeled, materialized, or exposed to consumers
- Lenses (WASM) – composable WebAssembly transforms for filtering, decoding, enriching, or reshaping data
- Wallet – cryptographic credentials used to sign and authorize deployments to a target network

Conceptually, a view represents the pipeline:

**indexed primitive data → query → lenses (WASM) → GraphQL schema → consumable API**

## Developer Experience

View Creator is distributed as a CLI and is designed for local-first development. It supports:

- Initializing and inspecting view bundles
- Incrementally adding queries, schemas, and lenses
- Executing lenses locally for validation and preview
- Deploying views to a local DefraDB instance with a GraphQL Playground
- Signing and publishing views to shared networks like devnet

By providing strong defaults, explicit versioning, and deterministic behavior, View Creator enables developers to focus on data semantics and transformations, while Shinzo handles execution, distribution, and verification.

In summary, View Creator is the primary interface for developers to turn indexed blockchain data into reliable, composable, and verifiable data products within the Shinzo ecosystem.