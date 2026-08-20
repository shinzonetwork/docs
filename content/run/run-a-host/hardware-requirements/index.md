+++
title = "Hardware requirements"
aliases = ["/hosts/hardware-requirements"]
+++

These requirements are for the Host client. A Host does not run a blockchain node and has no archival mode, so it never needs the multi-terabyte storage that a full node or archival Generator requires. It receives signed primitive data over P2P from Generator clients, applies Lens transforms, and serves Views to applications.

## Recommended hardware

The Host client has specific hardware requirements depending on the linked Generator's chain. See [shinzo.network/chains](https://shinzo.network/chains) for the current list of supported networks.

### Ethereum mainnet

| Resource | Minimum | Recommended |
| --- | --- | --- |
| CPU | 4 cores | 8 cores |
| Memory (RAM) | 8 GB | 16 GB |
| Storage | 300 GB | 500 GB |
| Network | 100 Mbps | 1 Gbps |

## Storage

Host storage depends almost entirely on how many Views you serve and how aggressively you prune. A Host serving a few filtered Views with pruning enabled stays close to the minimum. A Host that accepts all primitive data and serves many materialized Views will trend toward the recommended figure and beyond. Pruning is enabled by default and retains roughly the last 2,000 blocks. Because the Host receives primitives from Generator clients, its storage growth tracks the throughput of the source chain. Chains with higher transaction volume produce more documents per block. See [shinzo.network/chains](https://shinzo.network/chains) for the chains Shinzo supports.

## Network

The Host maintains P2P connections to Generator clients and serves GraphQL queries to applications. Both are sensitive to latency and uptime rather than peak bandwidth. 100 Mbps keeps up with primitive replication; 1 Gbps gives headroom when serving many concurrent application subscribers.
