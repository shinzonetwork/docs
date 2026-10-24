+++
title = "Managed nodes"
description = "What a managed node provider buys you, what it costs, and what it leaves untouched, compared to running your own execution node."
+++

There are three ways to feed a Generator client: run an execution node on your own hardware, run one on hardware you rent, or have a managed node provider like QuickNode operate a dedicated node for you. All three are supported, and all three keep the node inside your own infrastructure. The client treats every endpoint the same way: it reads blocks from one JSON-RPC endpoint, signs whatever comes back, and never asks who operates the machine behind it.

What changes between the three is who operates the node and how much of the day-to-day work stays on your plate. What your signature stands behind doesn't move: in all three setups, you vouch for the data your node serves.

## Three ways to feed a Generator

{% player(scene="feeds") %}
<div class="player__caption" data-title="Own node, own hardware">
  <p>The Generator sits next to your execution node on the same machine. Every key inside that boundary is yours, and wrong data can only start inside it: a bug, a misconfiguration, a stuck sync.</p>
</div>

<div class="player__caption" data-title="Own node, rented hardware">
  <p>Same trust, someone else's rack. The node's software, keys, and config stay yours, so the blocks you sign still come from software you control.</p>
</div>

<div class="player__caption" data-title="Managed node provider">
  <p>The provider operates a dedicated node for you on their platform. It's your node, provisioned for your validator alone. You hold the access token and your operator key, and the signature on the data stays yours; the syncing and patching is their job.</p>
</div>
{% end %}

Running your own node on your own hardware is the default shape: the Generator sits next to the execution node, often on the same machine, and nothing stands between the chain and your signature except your own software. The [Validator with Geth](../deployment-examples/validator-with-geth/) example shows this setup end to end.

Running your own node on rented hardware is the same trust with someone else's rack. You hold every key and config file; the node just lives on a VM you pay for. The data you sign still comes from software you control. The [separate-machine deployment](../security/#separate-machine-deployment) advice on the security page covers the networking.

A managed node provider operates the node for you. They provision a dedicated node for your validator, keep it synced, patched, and online, and hand you an endpoint. You point `GETH_RPC_URL` at that endpoint, put the access token in `GETH_API_KEY`, and name the header to send it in with `GETH_API_KEY_TYPE`. The node is still yours: it's dedicated to your validator, and nobody else reads through it. The [QuickNode setup guide](../guides/quicknode-setup/) walks through this path end to end.

One distinction matters when you pick a provider. Node providers like QuickNode run an actual node for you: you choose the chain and region, they keep it synced and patched, and you get a dedicated endpoint speaking standard JSON-RPC. Other companies sell metered access to shared infrastructure instead, where requests are served through the provider's own API layer and responses can be cached or augmented on the way back. A dedicated node is the expected setup for a Generator. A shared endpoint isn't, because what your signature vouches for is whatever that API layer decides to serve.

## What stays the same

Most of the trust machinery doesn't care where the blocks come from:

- Your Generator generates and holds its own operator key locally and signs every block with it. A `BlockSignature` commits to a Merkle root covering every document in the block, whatever endpoint the blocks arrived from.
- Registration still ties your operator key to your validator identity through the assertion step. Whoever operates your node, the network still knows which validator stands behind it. See [Registration](../register).
- Your validator's consensus and withdrawal keys never touch the Generator client or the provider. The client only ever holds its own operator key and its DefraDB keyring secret. See [Key separation](../security/#key-separation).
- Host clients verify every block signature and recompute the Merkle root from the document CIDs before recording anything. Attestation records are keyed by block height and signed root, and the vote count only climbs. See [Attestations](/understand/core-concepts/attestations/).

What changes with a managed provider is who keeps the node healthy, and what that hands over.

## What your signature vouches for

The Generator client does not verify what it reads. It doesn't re-execute transactions, recompute the block's Merkle roots, or compare responses against a second node. It reads from exactly one endpoint with no failover to a second source, and whatever that endpoint returns is what gets signed.

With your own node, wrong data can only start inside your own boundary: a bug, a misconfiguration, a stuck sync. Honest failures like that are what attestation thresholds smooth over anyway, since two honest Generators can disagree about the chain tip while it re-orgs.

With a managed provider, the node is yours but the operations are theirs. If the node they run for you ever serves wrong or incomplete data, your signed blocks won't match what other Generator clients sign for the same heights. Your attestation records sit at a vote count of one while the correct data clusters at higher counts, and apps that filter by attestation threshold stop reading you.

Two details worth knowing:

- Nothing alerts you when this happens. The Generator is a write-only producer: it doesn't read attestation counts and never learns that its blocks stopped accumulating corroboration. To notice, you'd have to check your blocks' attestation records yourself. [Verify data](/build/how-to/verify-data/) shows the queries.
- The failure lands on your contribution, not on apps. An app with its threshold above one simply reads the sources that agree and never sees your divergent data. That filtering is the reason a managed node is a workable choice at all.

## The trade in practice

What you get is simplicity. A snap-synced full execution node typically wants over 650 GB of fast SSD storage and at least 16 GB of RAM, before you count the Generator's own needs. The managed path runs on a small VM instead: the QuickNode guide uses about 8 GB of RAM and 30 GB of disk. The [hardware requirements](../prerequisites#hardware-requirements) table has the full numbers. Syncing, upgrading, and keeping a node online at 3am is the provider's job. Most providers have a free tier for testing, and the QuickNode guide takes you from account to signed blocks in one sitting.

What you give is the flip side. Your signature rides on the provider's data quality: if they serve something wrong, you sign it, and the attestation counts tell the story. The provider's outage is your outage: if the endpoint goes down, your Generator stops until it's back. And the node's health, sync state, and configuration become the provider's to manage, so you see only what they expose.

{% admonition(type="info") %}
The middle path is worth naming: rent a VM, run the node yourself, hold all the keys. You keep the control boundary around the software that feeds your signature, and you skip the rack in the closet.
{% end %}

## Need help

{{ need_help(client="Generator", repo_name="shinzo-generator-client", repo="https://github.com/shinzonetwork/shinzo-generator-client/issues") }}
