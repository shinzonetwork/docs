+++
title = "Hardware requirements"
weight = 3
+++

These requirements are for the Generator client itself. It runs as a sidecar next to an Ethereum execution node (currently Geth), so size the machine for the node first and add the Generator overhead on top.

## Recommended hardware

{{ hardware(component="generator") }}

Storage figures assume pruning is enabled. The Generator client prunes by default and retains roughly the last 1,000 blocks, which keeps disk usage bounded. Without pruning, storage grows linearly with chain history (see the [FAQ](../faq/) for details on growth rate).

## Sizing for Geth

The numbers above do not include the execution node. Geth has its own, much larger footprint: a snap-synced full node needs over 650 GB of fast SSD storage and at least 16 GB of RAM, and an archive node can exceed 12 TB. See the [Geth hardware requirements](https://geth.ethereum.org/docs/getting-started/hardware-requirements) for current guidance, and provision accordingly.

## Network

A stable connection matters more than raw bandwidth. The Generator client reads new blocks from the execution node as they arrive, so latency to that node and uptime are more important than peak throughput. 100 Mbps is enough to keep up; 1 Gbps gives headroom for serving snapshots and P2P replication to Hosts.
