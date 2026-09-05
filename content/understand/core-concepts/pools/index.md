+++
title = "Pools"
description = "Pools bind developer demand for a View to the Hosts willing to serve it. Demand creates a pool; Hosts joining it make it active."
aliases = ["/concepts/pools", "/pools"]
[extra]
mermaid = true
+++

A pool is where developer demand for a View meets the Hosts that serve it. Demand creates a pool; a Host joining it makes that pool active.

{% mermaid() %}
flowchart LR
  Dev["Developer<br/>registers demand + bond"]
  Pool["Pool created"]
  Join["Hosts join"]
  Active["Active<br/>3+ Hosts"]
  Inactive["Inactive<br/>under 3 Hosts"]

  Dev --> Pool
  Pool --> Join
  Join --> Active
  Active --> Inactive
  Inactive --> Active
{% end %}

## Why pools exist

A registered View describes a data product, but registration alone doesn't guarantee anyone will serve it. Without a way to signal real want, a View could sit on the registry with no Hosts running it and no way for a developer to say "I actually need this."

A pool closes that gap. Registering demand for a View, and backing it with a bond, is how a developer puts skin in the game. The pool then gathers the Hosts willing to serve that demand. It's the link between "this View should exist" and "this View is being served."

## How a pool comes into existence

A pool is created the first time someone registers demand for a View through the Pool Registry on ShinzoHub. The demand carries a bond in ushinzo (SHNZ's base unit), which has to be more than zero and is escrowed as a sign of real intent. If no pool exists yet for that View, one is created; later demand for the same View joins the existing pool rather than making a new one.

A pool is identified by two things: the View it serves, and a small config. Today that config is a single field, the pool's `windowSize`. Changing it produces a different pool, so one View can have several pools under different configs. The View has to be registered first; you can't register demand against a View that doesn't exist yet. See [Create your first View](/build/tutorials/create-your-first-view/) for how to get that far.

## Two faces of a pool

A pool has two representations. The real state (which Hosts have joined, the open demands, whether the pool is active) lives on ShinzoHub. Each pool also gets its own contract address on the blockchain that it's connected to so block explorers, other contracts, and off-chain tooling can talk to a specific pool directly. The contract itself is thin: it reads through to ShinzoHub rather than holding state of its own.

## Hosts join to make a pool active

Registering a Host on the Host Registry doesn't mean it's serving anything. It just means the node exists on the network. Joining a pool is what commits a Host to running a particular View.

A Host joins through the pool's own contract, and exits the same way. Joining is a separate, deliberate step from registering the node.

## Active vs inactive

A pool is active when at least 3 Hosts have joined. Drop below that and it goes inactive. Active isn't a permanent state: a pool can go active, inactive, and active again as Hosts come and go.

## Reading a pool

Every pool exposes a snapshot of its current state: the pool's metadata, which Hosts have joined, and the open demands against it. There are also lookups to list every pool created for a View, or to find which View a given pool serves.

## Where to go next

- [Views](/understand/core-concepts/views/): what a View is and what it contains.
- [Run a Host](/run/run-a-host/quickstart/): install and run a Host client, then join a pool.
- [Views for builders](/build/concepts/views-for-builders/): the Viewkit toolchain for defining and deploying Views.
