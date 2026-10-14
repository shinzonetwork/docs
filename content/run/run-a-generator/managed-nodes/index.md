+++
title = "Managed nodes"
description = "What a managed node provider buys you, what it costs, and what it leaves untouched, compared to running your own execution node."
aliases = ["/generator/managed-nodes", "/generators/managed-nodes"]
+++

There are three ways to feed a Generator client: run an execution node on your own hardware, run one on hardware you rent, or point the client at a managed node provider like QuickNode and let someone else run the node. All three are supported. The client treats every endpoint the same way: it reads blocks from one JSON-RPC endpoint, signs whatever comes back, and never asks who runs the node behind it.

What changes between the three is what your signature stands behind, and how much of your data path sits inside infrastructure you control.

## Three ways to feed a Generator

Running your own node on your own hardware is the default shape: the Generator sits next to the execution node, often on the same machine, and nothing stands between the chain and your signature except your own software. The [Validator with Geth](../deployment-examples/validator-with-geth/) example shows this setup end to end.

Running your own node on rented hardware is the same trust with someone else's rack. You hold every key and config file; the node just lives on a VM you pay for. The data you sign still comes from software you control. The [separate-machine deployment](../security/#separate-machine-deployment) advice on the security page covers the networking.

A managed node provider runs the node for you. You point `GETH_RPC_URL` at their endpoint, put the access token in `GETH_API_KEY`, and name the header to send it in with `GETH_API_KEY_TYPE`. The provider keeps the node synced, patched, and online. The [QuickNode setup guide](../guides/quicknode-setup/) walks through this path end to end.

Two kinds of companies will sell you a chain endpoint. Node providers like QuickNode run an actual node for you: you pick the chain and region, they keep it synced and patched, and you get a dedicated endpoint speaking standard JSON-RPC. RPC providers like Alchemy and Infura sell access to shared infrastructure: requests are metered by quota and served through their own API layer, which can cache or augment data on its way back to you. The Generator client can't tell the difference. It makes standard JSON-RPC calls to one endpoint and signs whatever comes back, so the trust analysis is the same for both: your signature vouches for the provider's data. What differs is operational: dedicated capacity versus metered shared capacity.

## What stays the same

Most of the trust machinery doesn't care where the blocks come from:

- Your Generator generates and holds its own operator key locally and signs every block with it. A `BlockSignature` commits to a Merkle root covering every document in the block, whatever endpoint the blocks arrived from.
- Registration still ties your operator key to your validator identity through the assertion step. Whoever runs the node behind your Generator, the network still knows which validator stands behind it. See [Registration](../register).
- Your validator's consensus and withdrawal keys never touch the Generator client or the provider. The client only ever holds its own operator key and its DefraDB keyring secret. See [Key separation](../security/#key-separation).
- Host clients verify every block signature and recompute the Merkle root from the document CIDs before recording anything. Attestation records are keyed by block height and signed root, and the vote count only climbs. See [Attestations](/understand/core-concepts/attestations/).

What changes is the first hop, the one from the node into your Generator, and what that link is worth.

## What your signature vouches for

The Generator client does not verify what it reads. It doesn't re-execute transactions, recompute the block's Merkle roots, or compare responses against a second node. It reads from exactly one endpoint with no failover to a second source, and whatever that endpoint returns is what gets signed.

With your own node, wrong data can only start inside your own boundary: a bug, a misconfiguration, a stuck sync. Honest failures like that are what attestation thresholds smooth over anyway, since two honest Generators can disagree about the chain tip while it re-orgs.

With a managed provider, your signature vouches for someone else's data. If the provider ever serves wrong or incomplete data, your signed blocks won't match what other Generator clients sign for the same heights. Your attestation records sit at a vote count of one while the correct data clusters at higher counts, and apps that filter by attestation threshold stop reading you.

Two details worth knowing:

- Nothing alerts you when this happens. The Generator is a write-only producer: it doesn't read attestation counts and never learns that its blocks stopped accumulating corroboration. To notice, you'd have to check your blocks' attestation records yourself. [Verify data](/build/how-to/verify-data/) shows the queries.
- The failure lands on your contribution, not on apps. An app with its threshold above one simply reads the sources that agree and never sees your divergent data. That filtering is the reason a managed node is a workable choice at all.

## What a managed node doesn't put at risk

The tradeoff is real, but it's narrower than it looks:

- Your validator. A compromised provider endpoint is a data problem, not a key problem. The provider never sees your consensus or withdrawal keys.
- The apps reading the network. Thresholds above one never see divergent data; they read the sources that agree.
- The network's data. One provider going wrong can't move what apps read, because Generators on their own infrastructure sign what they actually saw. A divergent source ends up alone at a vote count of one, not in the majority.
- Your identity. Registration ties the Generator to your validator through the assertion whoever ran the node. Switching your data source later doesn't change who stands behind your data.

## The trade in practice

What you get with a managed node:

- No node hardware. A snap-synced full execution node typically wants over 650 GB of fast SSD storage and at least 16 GB of RAM, before you count the Generator's own needs. The managed path runs on a small VM: the QuickNode guide uses about 8 GB of RAM and 30 GB of disk. See the [hardware requirements](../prerequisites#hardware-requirements) table for the numbers.
- No babysitting. Syncing, upgrading, and keeping a node online at 3am is the provider's job.
- A fast start. Most providers have a free tier for testing, and the QuickNode guide takes you from account to signed blocks in one sitting.

What you give:

- Your signature rides on the provider's data quality. If they serve something wrong, you sign it, and the attestation counts tell the story.
- The provider's outage is your outage. One endpoint, no failover: if it goes down, your Generator stops until it's back.
- The node's health, sync state, and configuration are the provider's to manage, and you see only what they expose.

{% admonition(type="info") %}
The middle path is worth naming: rent a VM, run the node yourself, hold all the keys. You keep the control boundary around the software that feeds your signature, and you skip the rack in the closet.
{% end %}

## Picking a setup

- Trying Shinzo out? A managed provider's free tier is the cheapest way to see the pipeline work end to end. The Generator reads, signs, and commits blocks the same as anywhere else.
- Running steady in production? A managed node provider with an SLA is a reasonable default. Check your blocks' attestation counts now and then so you'd notice if the provider's data ever diverged. [Verify data](/build/how-to/verify-data/) shows how.
- Want maximum control over what your signature stands behind? Run the node yourself, on your own hardware or rented, and keep every key.

## Where to go next

- [QuickNode setup](../guides/quicknode-setup/): the worked example for the managed path.
- [Validator with Geth](../deployment-examples/validator-with-geth/): the worked example for your own node.
- [Security](../security/): deployment shapes, key separation, and port exposure.
- [Trust and verification](/understand/core-concepts/trust-verification/): every hop in the data path and what it proves.
- [Attestations](/understand/core-concepts/attestations/) and [Attestation as a query filter](/build/concepts/attestation-as-a-query-filter/): how vote counts work and how apps use them.

## Need help

{{ need_help(client="Generator", repo_name="shinzo-generator-client", repo="https://github.com/shinzonetwork/shinzo-generator-client/issues") }}
