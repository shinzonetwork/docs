+++
title = "Changelog"
description = "Developer updates for the Shinzo network, SDKs, tools, and documentation."
template = "changelog.html"
sort_by = "date"
weight = 7
page_template = "changelog.html"
+++

Track what's new across the Shinzo developer platform: network releases, SDK changes, tooling updates, and documentation improvements.

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

- {{ tag(name="Generator") }} Blocks are now signed only after all required block data has been received. ([PR #293](https://github.com/shinzonetwork/shinzo-generator-client/pull/293))
- {{ tag(name="Generator") }} Pruning now skips invalid or incomplete records instead of stopping the entire process. ([PR #287](https://github.com/shinzonetwork/shinzo-generator-client/pull/287))
- {{ tag(name="Host") }}{{ tag(name="Generator") }} Updated status pages to point to the correct hub. ([PR #319](https://github.com/shinzonetwork/shinzo-host-client/pull/319)) ([PR #302](https://github.com/shinzonetwork/shinzo-generator-client/pull/302))
- {{ tag(name="Host") }} Billing now validates against the pool included in each signed request. Queries without a pool are rejected. ([PR #314](https://github.com/shinzonetwork/shinzo-host-client/pull/314))
- {{ tag(name="Host") }} Failed pruning jobs are now automatically retried instead of being discarded. ([PR #316](https://github.com/shinzonetwork/shinzo-host-client/pull/316))
- {{ tag(name="Host") }} History pruning is now disabled by default. ([PR #317](https://github.com/shinzonetwork/shinzo-host-client/pull/317))
- {{ tag(name="Storage") }} Improved pruning reliability when new data is written during concurrent writes.
- {{ tag(name="Storage") }} Large deletion operations are now processed in smaller batches for better stability.
- {{ tag(name="Storage") }} Deleting documents now also removes their associated index entries.
- {{ tag(name="Storage") }} Improved pruning performance by reducing unnecessary ownership scans.

## July 08, 2026 {#07-08-2026}

### 🐳 Upgrade

**Generator Client**

```bash
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest
```

**Host Client**

```bash
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.6.5-ethereum-mainnet
```

### 🎉 Highlights

- Shinzō Testnet is now live.
- {{ tag(name="Generator") }} Generator Client is available for Shinzo Testnet deployments. Installation instructions: [Generator Installation Guide](https://docs.shinzo.network/generator/install/)
- {{ tag(name="Host") }} Host Client is available for Shinzo Testnet deployments. Installation instructions: [Host Installation Guide](https://docs.shinzo.network/hosts/install/)