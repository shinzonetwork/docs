+++
title = "The data journey"
description = "One document's path from an execution node to your app, with signatures and attestations at every hop."
+++

Every read in Shinzo travels the same path: out of an execution node, through a Generator client, across the peer-to-peer network to a Host, and into your app. Signatures and attestations attach at each hop, so you can verify what arrives against what the chain said.

Step through it below: press play, or move at your own pace.

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

## What to take away

- Generator clients run alongside validator nodes, so reads begin where blocks are produced.
- Every document a Generator client produces is signed, and Hosts verify those signatures before trusting the data.
- Attestation is a tally: one vote per Generator client that independently signed the same document.
- Attestation thresholds are a query-time filter, so each query decides how many votes are enough.

Prefer prose? [How it works](@/understand/how-it-works/index.md) covers the same ground.
