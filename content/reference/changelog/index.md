+++
title = "Changelog"
aliases = ["/changelog"]
description = "Developer updates for the Shinzo network, SDKs and tools"
template = "changelog.html"
sort_by = "date"
weight = 7
page_template = "changelog.html"
+++

Track what's new across the Shinzo developer platform: network releases, SDK changes, tooling updates and documentation improvements.

## Sep 16, 2026 {#09-16-2026}

### Upgrade

#### Generator client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:v0.6.5.4-ethereum-mainnet
```

#### Host client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.6.5.4-ethereum-mainnet
```

### 💡 Improvements

- {{ tag(name="Generator") }} Improved indexing and pruning performance to reduce chain lag and help Generators stay closer to the chain tip. ([PR #333](https://github.com/shinzonetwork/shinzo-generator-client/pull/333)) ([PR #335](https://github.com/shinzonetwork/shinzo-generator-client/pull/335))
- {{ tag(name="Generator") }} Secondary indexes are now rebuilt correctly after importing data, improving data consistency after restores or migrations. ([PR #338](https://github.com/shinzonetwork/shinzo-generator-client/pull/338))
- {{ tag(name="Generator") }} Chain configuration has been generalized to improve support for different chain configurations. ([PR #329](https://github.com/shinzonetwork/shinzo-generator-client/pull/329))
- {{ tag(name="Generator") }}{{ tag(name="Host") }} Health checks now actively probe DefraDB, providing a more accurate indication of client health. ([PR #364](https://github.com/shinzonetwork/shinzo-generator-client/pull/364)) ([PR #382](https://github.com/shinzonetwork/shinzo-host-client/pull/382))
- {{ tag(name="Generator") }}{{ tag(name="Host") }} Registration no longer suggests addresses that are unreachable by other network participants. ([PR #366](https://github.com/shinzonetwork/shinzo-generator-client/pull/366)) ([PR #367](https://github.com/shinzonetwork/shinzo-host-client/pull/367))
- {{ tag(name="Host") }} Improved pruning behavior with cleaner shutdown handling and bounded pruning cycles. ([PR #357](https://github.com/shinzonetwork/shinzo-host-client/pull/357)) ([PR #360](https://github.com/shinzonetwork/shinzo-host-client/pull/360))
- {{ tag(name="Host") }} Added a warning state to Host metrics for better operational visibility. ([PR #370](https://github.com/shinzonetwork/shinzo-host-client/pull/370))
- {{ tag(name="Host") }} Fixed registration to preserve the forwarded Host port correctly. ([PR #383](https://github.com/shinzonetwork/shinzo-host-client/pull/383))

**⚠️ Generator Upgrade Note**

Generator operators upgrading to `v0.6.5.4-ethereum-mainnet` need to reset their DefraDB data.

Back up your node identity key before removing the existing DefraDB directory. If the key is not preserved, you will need to register the Generator again.

```bash
# Back up the identity key
cp shinzo-data/defradb/keys/node-identity-key ./path/to/new/location

# Reset DefraDB
rm -rf shinzo-data/defradb

# Recreate the keys directory
mkdir -p shinzo-data/defradb/keys

# Restore the identity key
cp ./path/to/new/location/node-identity-key shinzo-data/defradb/keys/
```

Once the existing identity key has been restored, you can start the upgraded Generator without re-registering.

## Aug 06, 2026 {#08-06-2026}

### 🐳 Upgrade

#### Generator client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:v0.6.5.3-ethereum-mainnet
```

#### Host client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.6.5.3-ethereum-mainnet
```

### 💡 Improvements

- {{ tag(name="Generator") }} Improved block signing performance by signing batched blocks directly from collected CIDs instead of performing a read-back query. ([PR #308](https://github.com/shinzonetwork/shinzo-generator-client/pull/308))
- {{ tag(name="Generator") }} Fixed a hardcoded Shinzo Hub URL used during testnet deployments. ([PR #313](https://github.com/shinzonetwork/shinzo-generator-client/pull/313))
- {{ tag(name="Host") }} History pruning is now enabled by default. ([PR #326](https://github.com/shinzonetwork/shinzo-host-client/pull/326))
- {{ tag(name="Host") }} Fixed a hardcoded Shinzo Hub URL in the health server. ([PR #351](https://github.com/shinzonetwork/shinzo-host-client/pull/351))
- {{ tag(name="Generator") }}{{ tag(name="Host") }} Updated dependencies, including Go Ethereum, GitHub Actions, gRPC, and other internal libraries for improved stability and maintenance.


## July 16, 2026 {#07-16-2026}

### 🐳 Upgrade

#### Generator client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:v0.6.5.2-ethereum-mainnet
```

#### Host client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.6.5.2-ethereum-mainnet
```

### 💡 Improvements

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

#### Generator client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest
```

#### Host client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.6.5-ethereum-mainnet
```

### ✨ Highlights

- Shinzō Testnet is now live.
- {{ tag(name="Generator") }} Generator Client is available for Shinzo Testnet deployments. Installation instructions: [Generator Installation Guide](https://docs.shinzo.network/run/run-a-generator/install/)
- {{ tag(name="Host") }} Host Client is available for Shinzo Testnet deployments. Installation instructions: [Host Installation Guide](https://docs.shinzo.network/run/run-a-host/install/)
