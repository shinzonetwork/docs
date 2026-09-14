+++
title = "The data journey"
description = "Watch the loop every read makes: from an execution node to your app, collecting signatures and attestations along the way."
+++

Every read in Shinzo travels the same path: out of an execution node, through a Generator client, across the peer-to-peer network to a Host, and into your app. Signatures and attestations attach at each hop, so what arrives can be verified against what the chain actually said.

The loop below runs that journey over and over — the way the network does, for every block, whether anyone is watching or not.

{% journey_loop() %}
<p>One document's trip through the Shinzo read path, on repeat:</p>
<ol>
  <li><strong>Execution node</strong> — a validator's node produces a block. The data your app needs starts here.</li>
  <li><strong>Generator client</strong> — shapes the block into structured documents and signs each one with its identity key.</li>
  <li><strong>Host</strong> — receives signed documents over the peer-to-peer network, verifies the signatures, and keeps an attestation record: one vote per Generator client that signed the same data.</li>
  <li><strong>Lens transform</strong> — the View's transform decodes raw logs into something an app actually wants, like a <code>TokenTransfer</code>.</li>
  <li><strong>Your app</strong> — subscribes to the View and queries its local database with GraphQL. Its attestation threshold decides what counts as trustworthy.</li>
</ol>
{% end %}

## What to take away

- **The data starts at the source.** Generator clients run alongside validator nodes, so reads begin where blocks are produced.
- **Every document is signed.** A Generator client signs each document it produces, and Hosts verify those signatures before trusting the data.
- **Attestation is a tally.** When several Generator clients independently sign the same document, its attestation record gains a vote for each one.
- **Your app sets the bar.** Attestation thresholds are a query-time filter, so each query decides how many votes are enough.

Want the written version? [How it works](@/understand/how-it-works/index.md) tells the same story in prose.
