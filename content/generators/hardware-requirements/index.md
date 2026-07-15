+++
title = "Hardware requirements"
aliases = ["/generator/hardware-requirements"]
+++

These requirements are for the Generator client itself. It runs as a sidecar next to an Ethereum execution node (currently Geth), so size the machine for the node first and add the Generator overhead on top.

## Recommended hardware

{{ hardware(component="generator") }}

With pruning enabled (the default), the Generator retains roughly the last 1,000 blocks, so its own data stays bounded at roughly 50 to 100 GB. The 300–500 GB figures above are the recommended provisioned disk — the headroom covers growth, snapshot serving, and P2P replication. In archival mode (pruning disabled), storage grows linearly with chain history and can exceed 3 TB (see the [FAQ](../faq/) for details on growth rate).

## Sizing for Geth

The numbers above do not include the execution node. Geth has its own, much larger footprint: a snap-synced full node needs over 650 GB of fast SSD storage and at least 16 GB of RAM, and an archive node can exceed 12 TB. See the [Geth hardware requirements](https://geth.ethereum.org/docs/getting-started/hardware-requirements) for current guidance, and provision accordingly.

## Network

A stable connection matters more than raw bandwidth. The Generator client reads new blocks from the execution node as they arrive, so latency to that node and uptime are more important than peak throughput. 100 Mbps is enough to keep up; 1 Gbps gives headroom for serving snapshots and P2P replication to Hosts.
