+++
title = "The data journey"
description = "Step through one document's path from an execution node to your app, collecting signatures and attestations along the way."
+++

Every read in Shinzo travels the same path: out of an execution node, through a Generator client, across the peer-to-peer network to a Host, and into your app. Signatures and attestations attach at each hop, so what arrives can be verified against what the chain actually said.

Step through the journey below — press play, or move at your own pace.

{% journey_player() %}
<div class="jp__caption" data-title="A block arrives">
  <p>A validator's execution node produces a block. The data your app needs is already there — Shinzo reads it at the source instead of asking a third party.</p>
</div>

<div class="jp__caption" data-title="The Generator signs it">
  <p>The Generator client next to the node shapes the block into structured documents and signs each one with its identity key. From here on, the document carries a verifiable signature.</p>
</div>

<div class="jp__caption" data-title="The Host verifies">
  <p>The signed document reaches a Host over the peer-to-peer network. The Host checks the signature and opens an attestation record for it — one vote so far.</p>
</div>

<div class="jp__caption" data-title="Attestations tally up">
  <p>Two more Generator clients independently signed the same data. As their copies arrive and verify, the attestation record gains a vote for each of them.</p>
</div>

<div class="jp__caption" data-title="A View shapes the answer">
  <p>The Host runs the View's Lens transform over the verified primitives, decoding the raw log into something an app actually wants — a <code>TokenTransfer</code>.</p>
</div>

<div class="jp__caption" data-title="Your app stays in control">
  <p>The app subscribes to the View and queries its local database with GraphQL. Its attestation threshold decides what counts as trustworthy — here, three votes.</p>
</div>
{% end %}

## What to take away

- **The data starts at the source.** Generator clients run alongside validator nodes, so reads begin where blocks are produced.
- **Every document is signed.** A Generator client signs each document it produces, and Hosts verify those signatures before trusting the data.
- **Attestation is a tally.** When several Generator clients independently sign the same document, its attestation record gains a vote for each one.
- **Your app sets the bar.** Attestation thresholds are a query-time filter, so each query decides how many votes are enough.

Want the written version? [How it works](@/understand/how-it-works/index.md) tells the same story in prose.
