---
title: Frequently Asked Questions
sidebar_label: Frequently Asked Questions
sidebar_position: 3
description: Frequently Asked Questions for Indexer
---

### What is the GitHub link for the Shinzo Indexer?

https://github.com/shinzonetwork/shinzo-indexer-client

### What hardware is recommended for deploying Shinzo?

Shinzo is lightweight in terms of CPU usage, but **storage performance and host stability are critical** for reliable operation. Based on current production usage:

| Component | Minimum | Recommended |
| --- | --- | --- |
| CPU | 2 vCPUs | 16 vCPUs |
| Memory (RAM) | 16 GB | 32–64 GB |
| Storage | 3 TB NVMe | 4+ TB NVMe |
| OS | Ubuntu 24.04 | Ubuntu 24.04 |

### Which RPC methods are supported?

To ingest data from an EVM chain, the connected RPC node must support the following methods:

- `eth_getTransactionReceipt` **(required)**
- `eth_getBlockByNumber` **(required)**
- `eth_getLogs`
- `eth_call`
- `eth_getBlockByHash`
- `net_version`
- `net_peers`
- `eth_getUncleByBlockHashAndIndex`
- `eth_getBlockByNumber`
- `eth_getBlockReceipts`

> Note: The indexer only actively uses `eth_getBlockByNumber` and `eth_getTransactionReceipt` to ingest data but all listed methods are supported for compatibility.

### What types of data are indexed?

All blockchain data is indexed, including blocks, transactions, logs, and storage access lists. The data is indexed by **hash [block + transaction]**, **block number**, and **document**.

### How much space do I need?

Currently ~100 GB per 10,000 blocks. Storage usage depends on block size and chain activity.

> Optimization improvements are in progress to reduce storage growth.

### How long does it take to sync?

Sync time depends entirely on the chosen start height. The further back the indexer begins, the longer it will take to catch up to the current block height. The indexer processes blocks approximately 2–4 seconds per block, which is faster than Ethereum’s 12-second block time. This allows the indexer to gradually close any sync gap after initial backfilling.

### How do I choose a start height?

The further back you choose, the longer it will take to get to current blocks. However, the further back you index, the more you contribute to the network.

### How often is the indexer updated with new blocks?

The indexer fetches blocks directly by block number from its connected validator or RPC node. As soon as a block becomes available via RPC after being gossiped and finalized on the network, it can be indexed.

### How does storage grow over time?

Storage grows linearly at roughly 10GB/1K full blocks. The first 15M blocks of ethereum are significantly smaller than blocks after the POS migration, math has been done on recent blocks.

Future improvements will allow the indexer to passively prune documents that have already been gossiped, reducing long-term storage pressure.
