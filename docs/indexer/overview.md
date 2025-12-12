---
title: Overview
sidebar_label: Overview
sidebar_position: 1
description: Introduction to the Shinzo Indexer
---

The Shinzo Indexer is a high-performance, fault-tolerant blockchain indexing engine designed for deterministic, query-friendly extraction of Ethereum data. It sits between an Ethereum execution node and downstream applications, transforming raw chain data into structured, relationally linked documents stored in DefraDB, all while maintaining strong guarantees around consistency, concurrency, and observability.

## Purpose and Role in the Stack

At its core, the indexer continuously consumes blocks, transactions, logs, and EIP-2930 access lists from an Ethereum node and normalizes them into a strongly-typed data model. It exposes this indexed data through Peer-2-Peer Network powered by DefraDB, enabling downstream services to query block-level and transaction-level information without depending directly on JSON-RPC. This separates data access from blockchain node operations, enabling stateless microservices, cheaper infra, and deterministic historical queries.

## Architecture Overview

### 1. Indexer Engine (Go)

The core indexing engine is written in Go and handles concurrent block processing. It connects to managed blockchain nodes via dual WebSocket/HTTP connections and ensures deterministic document IDs, duplicate block protection, and graceful shutdown handling.

### 2. Current Supported Chains

Supports connections to Ethereum Mainnet currently through a Geth client using JSON-RPC and WebSocket endpoints. Handles network-level errors with retries and timeouts.

### 3. DefraDB

Acts as the primary persistence layer, providing a P2P-ready, decentralized document store with GraphQL query capabilities. The indexer uses it to store:

- Blocks
- Transactions
- Logs
- AccessListEntries
- Relationships between blockchain entities

DefraDB provides queryable, P2P-ready storage, which aligns with Shinzo Network’s distributed architecture goals.

### 4. GraphQL API

DefraDB exposes all indexed blockchain data via GraphQL, enabling typed queries for both real-time and historical blockchain data.

### 5. Logging & Error System

- Uber Zap: global structured logging with context (block number, tx hash, etc.)
- IndexerError System: typed errors (NetworkError, DataError, StorageError, SystemError) with severity levels, structured context, and smart retry logic

### 6. Configuration Layer (Viper)

YAML-based configuration with environment variable overrides for:

- Ethereum node endpoints
- DefraDB settings (P2P, keyring, embedded/remote)
- Indexer start height
- Logger configuration

In summary, the Shinzo Indexer serves as a reliable bridge between Ethereum nodes and applications, providing structured, queryable blockchain data. Its design emphasizes concurrency, error handling, and observability, enabling developers to interact with consistent and deterministic data while keeping application logic decoupled from node operations.
