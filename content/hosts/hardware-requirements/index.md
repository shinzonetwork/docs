+++
title = "Hardware requirements"
weight = 3
+++

These requirements are for the Host client. A Host does not run a blockchain node, so it does not need the large NVMe footprint that an execution client or Generator machine requires. It receives signed primitive data over P2P from Generator clients, applies Lens transforms, and serves Views to applications.

## Recommended hardware

{{ hardware(component="host") }}

## Storage

Host storage depends almost entirely on how many Views you serve and how aggressively you prune. A Host serving a few filtered Views with pruning enabled stays close to the minimum. A Host that accepts all primitive data and serves many materialized Views will trend toward the recommended figure and beyond. Pruning is enabled by default and retains roughly the last 2,000 blocks.

## Network

The Host maintains P2P connections to Generator clients and serves GraphQL queries to applications. Both are sensitive to latency and uptime rather than peak bandwidth. 100 Mbps keeps up with primitive replication; 1 Gbps gives headroom when serving many concurrent application subscribers.
