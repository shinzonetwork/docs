---
title: Overview
sidebar_position: 1
---

The Shinzo Indexer is a lightweight sidecar that runs alongside an existing Ethereum execution client and reads from it. It pulls block data out of the node and writes it into a local DefraDB in a shape that is easy to query.

The Indexer is **not** an RPC node. It does not replace Geth, Reth, Nethermind, or any other execution client, and it does not serve JSON-RPC traffic to applications. Instead, the Indexer consumes upstream RPC and WebSocket endpoints from a node you already have access to: a local execution client, a node co-located with your validator, or a managed provider. It transforms the raw chain data those endpoints return into structured, relationally linked documents stored in its local DefraDB instance.

## Purpose and role in the stack

The Indexer continuously pulls blocks, transactions, logs, and EIP-2930 access lists from whichever upstream Ethereum node you point it at, then normalizes them into a strongly-typed data model. It exposes this indexed data through a peer-to-peer network powered by DefraDB, so downstream services can query block-level and transaction-level information without going through JSON-RPC themselves. The execution client still does the work of being an execution client. The Indexer just reads from it and reshapes the data for query.

## Architecture overview

### Indexer engine (Go)

The core indexing engine is written in Go and handles concurrent block processing. It connects to an upstream Ethereum node over HTTP and WebSocket, and provides deterministic document IDs, duplicate block protection, and graceful shutdown handling. The upstream node is supplied by you. The Indexer does not run one.

### Currently supported chains

The Indexer currently supports Ethereum Mainnet. It works with any execution client that exposes a standard Ethereum JSON-RPC and WebSocket interface (Geth, Reth, Nethermind, Erigon, or a managed provider). Network-level errors are handled with retries and timeouts.

### DefraDB

DefraDB is the Indexer's local persistence layer. It is a peer-to-peer document store with GraphQL query capabilities. The Indexer writes the following into its local DefraDB instance:

- Blocks.
- Transactions.
- Logs.
- AccessListEntries.
- Relationships between blockchain entities.

DefraDB provides the queryable, P2P-ready storage that the rest of the Shinzo Network reads from.

### GraphQL API

DefraDB exposes the indexed data via GraphQL for typed queries against both real-time and historical data. This is the Indexer's read interface; it is not an Ethereum JSON-RPC endpoint.

### Logging and error system

- Uber Zap for structured logging with context (block number, tx hash, etc.).
- The IndexerError system: typed errors (NetworkError, DataError, StorageError, SystemError) with severity levels, structured context, and retry logic.

### Configuration layer (Viper)

YAML-based configuration with environment variable overrides for:

- Upstream Ethereum node endpoints (RPC and WebSocket URLs supplied by you).
- DefraDB settings (P2P, keyring, embedded/remote).
- Indexer start height.
- Logger configuration.

The Shinzo Indexer is a client that reads from an Ethereum node you already have and writes structured data into a local DefraDB. It does not replace your execution client, and it does not expose JSON-RPC. Applications query the normalized data instead of talking to the chain directly.
