+++
title = "Overview"
aliases = ["/generator", "/generator", "/indexers", "/indexer"]
weight = 1
[extra]
mermaid = true
+++
The Shinzo Generator client is a lightweight sidecar that runs alongside an existing Ethereum execution client and reads from it. It pulls block data out of the node and writes it into a local DefraDB in a shape that is easy to query.

The Generator client is **not** an RPC node. It does not replace Geth, Reth, Nethermind, or any other execution client, and it does not serve JSON-RPC traffic to applications. Instead, the Generator client consumes upstream RPC and WebSocket endpoints from a node you already have access to: a local execution client, a node co-located with your validator, or a managed provider. It transforms the raw chain data those endpoints return into structured, relationally linked documents stored in its local DefraDB instance.

## Purpose and role in the stack

{% mermaid() %}
flowchart LR
  EC["Ethereum node<br/>(Geth)"]
  GEN["Generator client"]
  DB[(DefraDB)]
  Host["Hosts / downstream services"]

  EC -- "blocks, txs,<br/>logs, access lists<br/>(RPC + WebSocket)" --> GEN
  GEN -- "structured<br/>documents" --> DB
  DB -- "P2P replication" --> Host
{% end %}

The Generator client continuously pulls blocks, transactions, logs, and EIP-2930 access lists from whichever upstream Ethereum node you point it at, then normalizes them into a strongly-typed data model. It exposes this indexed data through a peer-to-peer network powered by DefraDB, so downstream services can query block-level and transaction-level information without going through JSON-RPC themselves. The execution client still does the work of being an execution client. The Generator client just reads from it and reshapes the data for query.

## Supported chains

The Generator client currently supports Ethereum Mainnet via Geth, exposing a standard Ethereum JSON-RPC and WebSocket interface. Other execution clients (Reth, Nethermind, Erigon) and managed providers may work but haven't been tested. Supported chains can also be found at [shinzo.network/chains](https://shinzo.network/chains).

## How it fits together

For details on how the Generator connects to the rest of the Shinzo stack, including DefraDB, the signing and attestation pipeline, and the P2P replication layer, see the [Architecture overview](/reference/architecture-overview/).
