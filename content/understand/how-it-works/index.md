+++
title = "How it works"
aliases = ["/introduction/how-it-works", "/understand/data-journey"]
[extra]
mermaid = true
+++

Shinzo has four kinds of moving parts:

1. **Generators** that read the chain.
1. **Hosts** that transform and serve the data.
1. **Applications** that consume that data.
1. **ShinzoHub**, a coordination layer that tells everyone what's going on.

## The data's journey

{% journey_player() %}
<div class="jp__caption" data-title="A block arrives">
  <p>A validator's execution node produces a block. The data your app needs is already there, so Shinzo reads it at the source instead of a third-party service.</p>
</div>

<div class="jp__caption" data-title="The Generator signs it">
  <p>The Generator client next to the node shapes the block into structured documents and signs each one with its identity key. From here on, the document carries a verifiable signature.</p>
</div>

<div class="jp__caption" data-title="The Host verifies">
  <p>The signed document reaches a Host over the peer-to-peer network. The Host checks the signature and opens an attestation record for it: one vote so far.</p>
</div>

<div class="jp__caption" data-title="Attestations tally up">
  <p>Two more Generator clients independently signed the same data. Each verified copy that arrives adds a vote to the attestation record.</p>
</div>

<div class="jp__caption" data-title="A View shapes the answer">
  <p>The Host runs the View's Lens transform over the verified primitives and decodes the raw log into something the app can use: a <code>TokenTransfer</code>.</p>
</div>

<div class="jp__caption" data-title="Your app stays in control">
  <p>The app subscribes to the View and queries its local database with GraphQL. Its attestation threshold decides what counts as trustworthy. Here, that means three votes.</p>
</div>
{% end %}

## The four participants

#### Generator clients

Generator clients are the entry point. Reserved for validators at mainnet launch (and open to any node operator on testnet), they run as a sidecar to an existing execution client. Their only job is to read the chain, produce structured and signed primitives, and hand them off.

#### Hosts

Hosts are the workhorses. They receive primitives, maintain attestation records, run Views, and serve the resulting view documents to subscribers. Anyone can run a Host. See [Run a Host](/run/run-a-host/hardware-requirements/) for operational details and [Host Client reference](/reference/components/host-client/) for internals.

#### Developers

Developers don't run anything on the network. They write Views with `viewkit`, deploy them to ShinzoHub, and build applications that subscribe to the resulting data.

#### Applications

Applications embed DefraDB locally, subscribe to the Views they need, and query the data like a regular database. Devs have the option of filtering results by attestation threshold when correctness matters more than speed.

## The coordination layer

ShinzoHub is a Cosmos SDK chain that sits to the side of the data path. It doesn't carry bulk data itself (that all flows over the P2P network between DefraDB instances). What ShinzoHub does is keep the registry of who's on the network and what they can do.

That means three things in practice:

1. **View registration**: When a developer deploys a View, ShinzoHub validates and registers it, then emits an event that Hosts listen for.
1. **Participant tracking**: Generators and Hosts register themselves on-chain so the rest of the network can discover them.
1. **Access control**: When a user pays for access to a View via the Outpost contract, ShinzoHub broadcasts that grant so Hosts know to start replicating data to that user. Access control is actually enforced through a separate chain called Sourcehub, connected to ShinzoHub via IBC.

## Why it's built this way

Some design choices shape the rest of the stack and are worth understanding upfront.

### Trustless indexing lives at the validator

Validators already run full nodes, already have the block data the moment it's produced, and already have economic skin in the game through their staked collateral. Putting trustless indexing there, rather than in a separate centralized service, shortens the trust path from chain to data and gets you verifiable indexing for free as a byproduct of running infrastructure people are already running.

### Trustless indexing and transformation are separate jobs

Generator clients ingest, Host clients transform and serve. That split means Generator clients can stay small and cheap (so validators will actually run them), while Host clients can specialize. One Host client might process every DeFi View on the network, another might focus on NFTs. It also means scaling consumer demand is a matter of adding more Host clients, not Generator clients.

### Apps query local data not remote APIs

Because application clients embed DefraDB and receive pre-processed view data over P2P, a query is a local database lookup. You don't pay per read, you don't hit rate limits, and you can verify what you got against the attestation record before you trust it. The trade-off is that your app is _pushed_ data for the Views it subscribes to rather than pulling arbitrary slices.
