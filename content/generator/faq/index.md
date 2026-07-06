+++
title = "Frequently Asked Questions"
weight = 4
+++

### What is the GitHub link for the Shinzo Generator client?

https://github.com/shinzonetwork/shinzo-generator-client

### Does the Generator client replace my Ethereum node?

No. The Generator client is a sidecar that connects to an existing Ethereum execution node. It does not run an execution client, expose a JSON-RPC interface, or replace the execution node used by your validator. Instead, you configure it to connect to an upstream JSON-RPC and WebSocket endpoint (Geth is supported). The Generator client reads block data from that execution node and stores it in its local DefraDB instance.

### What hardware is recommended for deploying Shinzo?

Shinzo is lightweight on CPU, but storage performance and host stability matter for reliable operation. Based on current production usage:

| Component | Minimum | Recommended |
| --- | --- | --- |
| CPU | 2 vCPUs | 16 vCPUs |
| Memory (RAM) | 16 GB | 32–64 GB |
| Storage | 3 TB NVMe | 4+ TB NVMe |
| OS | Ubuntu 24.04 | Ubuntu 24.04 |

### Which RPC methods does the Generator client call on the upstream node?

The Generator client reads from whatever execution node you point it at. That upstream node must support these methods:

- `eth_getTransactionReceipt` (required)
- `eth_getBlockByNumber` (required)
- `eth_getLogs`
- `eth_call`
- `eth_getBlockByHash`
- `net_version`
- `net_peers`
- `eth_getUncleByBlockHashAndIndex`
- `eth_getBlockReceipts`

> Note: The Generator client only actively calls `eth_getBlockByNumber` and `eth_getTransactionReceipt` to ingest data. The other methods are listed for compatibility.


### What happens if I lose my node-identity-key? Can I regenerate it?

If you lose your `node-identity-key`, your node’s identity is permanently lost.

- The key cannot be regenerated
- You must spin up a new instance of the Generator client
- You must register again with a new identity
- The new node may use the same EVM address, but it will be treated as a new identity

To avoid this, always back up your node-identity-key.

### How can I backup my keys?

By default your DefraDB keys are stored in `~/.defra/keys`. To back them up, simply copy them from that location to another. For example, if you were backing up your keys to a mounted external drive, you would run:

```shell
cp -r ~/.defra/keys /mnt/backup-drive/
```

### What types of data are indexed?

All blockchain data is indexed, including blocks, transactions, logs, and storage access lists. The data is indexed by hash (block and transaction), block number, and document.

### How much space do I need?

Currently ~100 GB per 10,000 blocks. Storage usage depends on block size and chain activity.

> Optimization improvements are in progress to reduce storage growth.

### How long does it take to sync?

Sync time depends entirely on the chosen start height. The further back the Generator client begins, the longer it will take to catch up to the current block height. The Generator client processes blocks approximately 2–4 seconds per block, which is faster than Ethereum’s 12-second block time. This allows the Generator client to gradually close any sync gap after initial backfilling.

### How do I choose a start height?

The further back you choose, the longer it will take to get to current blocks. However, the further back you index, the more you contribute to the network.

### How often is the Generator client updated with new blocks?

The Generator client fetches blocks by block number from the upstream Ethereum node it is configured to read from. As soon as a block becomes available on that node after being gossiped and finalized on the network, the Generator client can pull it in. The Generator client does not participate in consensus or gossip itself; it just reads from a node that does.

### How does storage grow over time?

Storage grows linearly at roughly 10GB/1K full blocks. The first 15M blocks of ethereum are significantly smaller than blocks after the POS migration, math has been done on recent blocks.

You can passively prune documents that has already been gossiped, reducing long-term storage pressure and clearing up old blocks.
