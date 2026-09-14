+++
title = "The data journey"
description = "Follow one document from an execution node to your app, collecting signatures and attestations along the way."
+++

Every read in Shinzo travels the same path: out of an execution node, through a Generator client, across the peer-to-peer network to a Host, and into your app. Signatures and attestations attach at each hop, so what arrives can be verified against what the chain actually said.

Scroll to follow one document through the pipeline.

{% journey_scroll() %}
<section class="sj__step">
  <div class="sj__step-inner">
    <h3>It starts at the node</h3>
    <p>A validator's execution node produces a block. The data your app needs is already there — Shinzo reads it at the source instead of asking a third party.</p>
  </div>
</section>

<section class="sj__step">
  <div class="sj__step-inner">
    <h3>The Generator signs it</h3>
    <p>The Generator client next to the node shapes the block into structured documents and signs each one with its identity key. Every document now carries a verifiable signature.</p>
  </div>
</section>

<section class="sj__step">
  <div class="sj__step-inner">
    <h3>Hosts tally attestations</h3>
    <p>Hosts receive signed documents over the peer-to-peer network and check each signature. When three Generator clients independently sign the same data, its attestation record shows three votes.</p>
  </div>
</section>

<section class="sj__step">
  <div class="sj__step-inner">
    <h3>A View shapes the answer</h3>
    <p>The Host runs the View's Lens transform over the verified primitives, decoding raw logs into something an app actually wants — like a <code>TokenTransfer</code>.</p>
  </div>
</section>

<section class="sj__step">
  <div class="sj__step-inner">
    <h3>Your app stays in control</h3>
    <p>The app subscribes to the View and queries its local database with GraphQL. Its attestation threshold decides what counts as trustworthy — here, three votes.</p>
  </div>
</section>
{% end %}

## What to take away

- **The data starts at the source.** Generator clients run alongside validator nodes, so reads begin where blocks are produced.
- **Every document is signed.** A Generator client signs each document it produces, and Hosts verify those signatures before trusting the data.
- **Attestation is a tally.** When several Generator clients independently sign the same document, its attestation record gains a vote for each one.
- **Your app sets the bar.** Attestation thresholds are a query-time filter, so each query decides how many votes are enough.

Want the written version? [How it works](@/understand/how-it-works/index.md) tells the same story in prose.
