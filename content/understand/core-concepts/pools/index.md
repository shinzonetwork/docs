+++
title = "Pools"
description = "Pools bind developer demand for a View to the Hosts willing to serve it. Demand creates a pool; Hosts joining it make it active."
aliases = ["/concepts/pools", "/pools"]
[extra]
mermaid = true
+++

A pool is where developer demand for a View meets the Hosts that serve it. Demand creates a pool; a Host joining it makes that pool active.

## Why pools exist

A registered View describes a data product, but registration alone doesn't guarantee anyone will serve it. Without a way to signal real want, a View could sit on the registry with no Hosts running it and no way for a developer to say _"I actually need this."_

A pool closes that gap. Registering demand for a View, and backing it with a bond, is how a developer puts skin in the game. The pool then gathers the Hosts willing to serve that demand. It's the link between _"this View should exist"_ and _"this View is being served"_.

## Starting a pool

A pool is created the first time someone registers demand for a View. The call is `registerDemandForView(viewAddress, config, bond)` on the Pool Registry precompile at `0x0213`. If no pool exists yet for that `(viewAddress, config)` pair, one is created and `PoolCreated` is emitted; either way, `DemandRegistered` is emitted for the caller. Later demand for the same pair joins the existing pool rather than making a new one.

A pool is identified by two things:

- `viewAddress`: the View the pool serves.
- `config`: a `PoolConfig` struct. Today that's a single field, `windowSize`. Changing any field produces a different pool address, so two pools can serve the same View under different configs.

The `bond` is paid in ushinzo (the base unit of SHNZ), must be greater than zero, and is escrowed from the caller's balance rather than sent as `msg.value`. The View has to be registered first; you can't register demand against a View that doesn't exist yet. See [Create a View](/build/create-a-view/) for how to get that far.

```shell
cast send 0x0000000000000000000000000000000000000213 \
  "registerDemandForView(address,(uint64),uint256)" \
  "<VIEW_ADDRESS>" \
  "(3600)" \
  1000000000000000000 \
  --rpc-url "http://testnet.shinzo.network:8545" \
  --private-key "<your_private_key>"
```

That registers demand for `<VIEW_ADDRESS>` with `windowSize = 3600` and a bond of `1000000000000000000` ushinzo (1 SHNZ).

## Two faces of a pool

A pool has two representations:

- The real state (hosts, demands, stats, the active flag) lives in the `x/pool` Cosmos module on ShinzoHub.
- `Pool.sol` is a thin EVM contract deployed at a deterministic address derived from `(viewAddress, config)`. It holds no operational state of its own; its read methods call through to the precompile, and its `viewAddress` and `registry` are fixed at creation.

The contract exists so each pool has its own EVM-addressable identity that block explorers, other contracts, and off-chain tooling can talk to directly.

## Hosts join to make a pool active

Registering a Host on the Host Registry doesn't mean it's serving anything. It just means the node exists on the network. Joining a pool is what commits a Host to running a particular View.

A Host joins by calling `join()` on the pool's `Pool.sol` contract, not on the registry. The registry only accepts `joinPool` calls from a registered pool contract, so the pool contract is the only way in. `exit()` leaves.

```shell
cast send <POOL_ADDRESS> "join()" \
  --rpc-url "http://testnet.shinzo.network:8545" \
  --private-key "<your_private_key>"
```

## Active vs inactive

A pool is active when at least 3 Hosts have joined. The `isActive` flag flips to true when a join crosses that threshold and back to false when an exit drops below it. Those transitions are emitted by the `x/pool` module as `PoolActivated` and `PoolDeactivated` events, not as EVM logs. Active isn't a permanent state. A pool can go active, inactive, and active again as Hosts come and go.

## Reading a pool

The easiest read is `snapshot()` on the pool contract, which returns a `PoolDetail`: the pool metadata, every host currently joined, every open demand, and the pool's stats. For lookups against the registry, there's `getPool(address)`, `viewOfPool(address)` (which View does this pool serve), and `poolsOf(viewAddress)` (every pool created for a View).

```shell
cast call <POOL_ADDRESS> "snapshot()" \
  --rpc-url "http://testnet.shinzo.network:8545"
```

## Where to go next

- [Views](/understand/core-concepts/views/): what a View is and what it contains.
- [Run a Host](/run/run-a-host/quickstart/): install and run a Host client, then join a pool.
- [Views for builders](/build/concepts/views-for-builders/): the Viewkit toolchain for defining and deploying Views.
