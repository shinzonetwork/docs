+++
title = "Overview"
aliases = ["/host", "/hosts"]
description = "Introduction to the Shinzo Host, its role in the network, and how it fits into the Shinzo stack."
[extra]
mermaid = true
+++

The Shinzo Host client is a service that turns indexed blockchain data into Views that applications can query over GraphQL. It receives signed data from one or more Generator clients over a peer-to-peer network, verifies it, runs WebAssembly transforms over it, and stores the results in a local DefraDB instance.

A Host client is not a Generator client. It does not talk to a source-chain execution client and does not pull blocks from Geth, Reth, or the equivalent node on other supported chains. Instead, the Host client consumes primitive documents that Generator clients have already produced and signed (blocks, transactions, logs, and chain-specific extras like EIP-2930 access list entries on Ethereum). The Host client then verifies those documents, runs the transformations defined by registered Views, and makes the results available to applications.

## Purpose and role in the stack

{% mermaid() %}
flowchart LR
  GEN["Generator clients<br/>(signed primitives)"]
  Host["Host clients<br/>(host client + DefraDB)"]
  Views[(View documents<br/>+ AttestationRecords)]
  App["Applications<br/>(GraphQL clients)"]

  GEN -- "P2P replication<br/>(blocks, txs, logs)" --> Host
  Host -- "WASM lens<br/>transforms" --> Views
  Views -- "GraphQL queries" --> App
{% end %}

A Host client does two things.

### Transformations

Developers register Views on ShinzoHub, where each View defines how primitive data should be filtered, decoded, and reshaped. A View might ABI-decode ERC-20 `Transfer` logs from Ethereum into a `USDCTransfer` collection, or decode equivalent token events on another supported chain. The Host client downloads the View's WebAssembly lens, runs it against the primitives it receives from Generator clients, and writes the resulting documents to its local DefraDB. Applications can then query those documents over GraphQL.

### Attestations

When a Host client receives the same block from multiple independent Generator clients, it verifies each signature and creates an `AttestationRecord` that tracks how many Generator clients produced identical data. These records replicate between Host clients using a P-counter CRDT, which lets applications check how many independent sources agree on a piece of data before trusting it.

Generator clients are the write side of the network. Host clients are the read side.

## Supported networks

Host clients can serve data for any chain Shinzo supports. Ethereum Mainnet is live today, and additional chains are being added. Any View registered against a supported source chain can be loaded and served by a Host. The current list of supported chains is at [shinzo.network/chains](https://shinzo.network/chains).

## Running a Host client

The Shinzo team publishes a reference implementation, the [Shinzo Host Client](https://github.com/shinzonetwork/shinzo-host-client), which is the recommended way to participate in the network. You can run it locally for development or deploy it on a virtual machine for production.

See the [Host Quick Start](/hosts/quickstart) to run a Host client locally, [Install](/hosts/install) for production deployment, and [Register](/hosts/register) to join the network.

## Related reading

The [Architecture overview](/reference/architecture-overview/) covers how the Host client connects to the rest of the stack, including the Generator clients P2P layer, ShinzoHub registration, the attestation pipeline, and View distribution. The [Host client reference](/reference/components/host-client/) goes deeper into the client internals.
