+++
title = "Hardware requirements"
description = "Hardware sizing for a Host client: what drives CPU, RAM, and storage needs, and why a Host never needs the storage a blockchain node does."
+++

These requirements are for the Host client. A Host does not run a blockchain node and has no archival mode, so it never needs the multi-terabyte storage that a full node or archival Generator requires. It receives signed primitive data over P2P from Generator clients, applies Lens transforms, and serves Views to applications.

## Recommended hardware

Host hardware requirements depend on the chains configured, their combined data volume, and the Views served. A Host can serve multiple chains at once. Size multi-chain deployments for the combined workload of all configured chains. See [shinzo.network/chains](https://shinzo.network/chains) for the current list of supported networks.

These figures are a baseline for an Ethereum-only Host. Multi-chain deployments need additional capacity based on their combined workload.

| Resource | Minimum | Recommended |
| --- | --- | --- |
| CPU | 4 cores | 8 cores |
| Memory (RAM) | 8 GB | 16 GB |
| Storage | 300 GB | 500 GB |
| Network | 100 Mbps | 1 Gbps |

{% <admonition type="warning"> %}
Higher throughput across the chains your Host serves increases CPU usage, disk I/O and storage growth. Keeping more blocks increases the disk space required. Size your Host for the combined workload of its configured chains and allow extra capacity when adding chains or increasing retention.
{% </admonition> %}

The 16 GB recommendation assumes a 16g container limit with `GOMEMLIMIT` at 14GiB. Scale the limits along with the RAM. See [memory limits](/run/run-a-host/config-reference#gomemlimit).

## Storage

Host storage depends on the data volume of the configured chains, how many Views you serve, and how aggressively you prune. A Host that accepts all primitive data and serves many materialized Views needs more storage than one serving a few filtered Views with pruning enabled. Chains with higher transaction volume produce more documents per block.

For multi-chain Hosts, storage requirements reflect the combined data retained across all configured chains. Each entry under `chains:` can set its own retention limit using the optional `max_blocks` field in the [config file](https://github.com/shinzonetwork/shinzo-host-client/blob/main/config/config.yaml), which controls how many blocks the Host keeps for that chain.

Removing a chain from the configuration and restarting the Host does not delete that chain's stored data. The data remains until the store is wiped, so removing a chain does not reclaim disk space.

## Network

The Host maintains P2P connections to Generator clients and serves GraphQL queries to applications. Reliable connectivity and low latency matter for both. The 100 Mbps minimum and 1 Gbps recommendation above are an Ethereum-only baseline. For multi-chain Hosts, size bandwidth for primitive replication across all configured chains and for concurrent application subscribers.
