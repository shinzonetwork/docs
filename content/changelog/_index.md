+++
title = "Changelog"
description = "Developer updates for the Shinzō network, SDKs, tools, and documentation."
template = "changelog.html"
sort_by = "date"
weight = 7
page_template = "changelog.html"
+++

Track what's new across the Shinzō developer platform: network releases, SDK changes, tooling updates, and documentation improvements.

## July 16, 2026 {#07-16-2026}

### 🐳 Upgrade

**Generator Client**

```bash
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:v0.6.5.2-ethereum-mainnet
```

**Host Client**

```bash
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.6.5.2-ethereum-mainnet
```

### 🚀 Improvements

- **[Storage]** Improved pruning reliability when new data is written during concurrent operations. _(PR)_
- **[Storage]** Large deletion operations are now processed in smaller batches for better stability. _(PR)_
- **[Storage]** Deleting documents now also removes their associated index entries. _(PR)_
- **[Storage]** Improved pruning performance by reducing unnecessary ownership scans. _(PR)_
- **[Generator]** Blocks are now signed only after all required block data has been received. _(PR)_
- **[Generator]** Pruning now skips invalid or incomplete records instead of stopping the entire process. _(PR)_
- **[Host] [Generator]** Updated status pages to point to the correct hub. _(PR)_
- **[Host]** Billing now validates against the pool included in each signed request. Queries without a pool are rejected. _(PR)_
- **[Host]** Failed pruning jobs are now automatically retried instead of being discarded. _(PR)_
- **[Host]** History pruning is now disabled by default. _(PR)_
_____

## July 16, 2026 {#07-16-2026}

Host Client

Upgrade:

```bash
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.6.5.2-ethereum-mainnet
```

What’s Changed

* Pool-based billing: Billing now uses the pool specified in each signed request. Requests without a pool are rejected.
* Reliable deletion retries: Failed cleanup jobs are automatically retried instead of being discarded.
* History pruning disabled by default: History pruning is now opt-in.
* Updated status page: Now points to the correct live testnet hub.

Generator Client

Upgrade:

```bash
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:v0.6.5.2-ethereum-mainnet
```

What’s Changed

* Complete block validation before signing: Blocks are only signed after all required data has been received.
* More resilient pruning: Invalid or incomplete records are skipped without interrupting the pruning process.
* Updated status page: Now points to the correct hub.