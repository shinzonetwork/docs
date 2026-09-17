+++
title = "Trust & verification"
description = "What each link in Shinzo's data path actually proves, what it doesn't, and where the remaining trust sits today."
[extra]
mermaid = true
+++

Data in Shinzo crosses several trust boundaries on its way from the chain to your app, and each crossing works differently. Most links are backed by signatures you can verify yourself. One link runs on plain trust, and one has a known gap. This page walks the path hop by hop and says plainly what each hop guarantees and what it doesn't.

{% mermaid() %}
flowchart LR
  Chain["Execution node<br/>(source chain)"] -->|"read-only RPC<br/><b>trusted</b>"| Gen["Generator client"]
  Gen -->|"signed blocks + CIDs<br/><b>verifiable</b>"| Host["Host client"]
  Host -->|"view documents +<br/>attestation records"| App["Your app"]
{% end %}

## The short version

| Hop | What backs it | What it doesn't cover |
| --- | --- | --- |
| Execution node to Generator | Trust (your own node, or your provider's) | Wrong or incomplete source data gets signed as-is |
| Validator and Generator identity each-way | On-chain assertion signed by the withdrawal key | Says nothing about data quality |
| Generator to Host | Per-block signature over a Merkle root of CIDs | Chain-correctness, completeness, freshness |
| Generator Generator each-way | Attestation records and vote counts | Needs thresholds above one to filter a lone bad source |
| Host to App (view data) | Host's signature, deterministic lenses, audit trail | Independent re-verification of the transform itself |

## The execution node to the Generator

The Generator client reads blocks from an execution node over JSON-RPC and does not verify what it gets back. It doesn't re-execute transactions, recompute the block's Merkle roots, or compare responses against a second node. Whatever the node returns is what the Generator signs.

That is safe in the default deployment, where the Generator is a sidecar next to the operator's own node, often on the same machine. You don't need to verify your own infrastructure.

It matters the moment the Generator points at someone else's node, such as a managed RPC provider. In that setup your signature vouches for the provider's data. If the provider ever serves wrong or incomplete data, your signed blocks won't match what other Generator clients sign, they won't accumulate attestations, and apps filtering by attestation threshold will ignore them. The [security guidance](/run/run-a-generator/security/) covers deployment shapes, and the managed-provider guides ([QuickNode](/run/run-a-generator/guides/quicknode-setup/), [GCP](/run/run-a-generator/deployment-examples/managed-gcp-node/)) carry the same warning.

## Who a Generator is

The data link is trusted, but the identity link is not. A Generator client generates its own operator key locally and never touches the validator's consensus or withdrawal keys. During registration, the validator's withdrawal key signs a one-time assertion that ties the operator key to the validator's identity, and that assertion is verified on-chain (through the outpost contract; on the current testnet, through an admin-key approval flow).

So the network can prove which validator stands behind a given Generator, even though nothing checks the data flowing into that Generator. The two questions are separate: "who signed this" is cryptographic, "was their node telling the truth" is not. The next two hops cover how the network deals with the second one.

## What the Generator's signature proves

Signing every document individually would be slow, so Generator clients sign per block. After writing a block's documents (blocks, transactions, logs, access list entries), the Generator computes a Merkle root over all of their CIDs, signs the root with its operator key, and writes a `BlockSignature` document. Snapshot signatures do the same across block ranges, giving you a two-level Merkle structure for fast sync.

Because every document is content-addressed, one signed root covers everything in the block. Alter any document and its CID changes, so it no longer matches the signed root. That gives you two guarantees: origin, because you know which Generator produced the data and which validator it belongs to, and integrity, because nobody altered it in transit.

Just as important is what the signature does _not_ prove. It doesn't prove the data matches the chain, since the Generator faithfully signs whatever its node said. It also doesn't prove completeness (nothing was withheld) or freshness (you're seeing the latest state). Attestation, covered next, closes the first gap. The other two are roadmap work, as noted in [Verify data](/build/how-to/verify-data/).

## Hosts and attestations

When a Host client receives a block from a Generator, it verifies the signature and recomputes the Merkle root from the document CIDs. Only then does it open (or update) an attestation record for that block, keyed by the block height and the signed root.

This is the mechanism that catches a wrong or dishonest data source. Independent Generator clients reading their own nodes sign identical data, and the block's attestation count climbs with each match. A Generator whose node fed it bad data produces a different root and accumulates no corroboration, so any app asking for two or more attestations filters it out. The same math smooths over honest disagreement: chains re-org, and requiring more than one attestation keeps your app from acting on a block that just got reorganized out.

[Attestations](/understand/core-concepts/attestations/) covers the record itself and how the counting works, and [Attestation as a query filter](/build/concepts/attestation-as-a-query-filter/) covers how apps set per-query thresholds.

## The lens gap

When a Host runs a View, the lens transform reshapes primitive documents into view documents. Those outputs are new documents with new CIDs, signed by the Host. The Generator clients' signatures do not carry over, so the cryptographic link back to the primitives breaks at the transform.

If your app pays a third-party Host for view data, you cannot independently verify that the output faithfully derives from the signed primitives, because your app never sees the primitives. You are trusting the Host's computation. A few things blunt that risk today:

- Lens transforms are deterministic WASM, so anyone can re-run them over the same primitives and check the output. Independent verifiers can audit Hosts this way.
- Attestation records keep the verified primitive CIDs as an evidence trail, so there is something concrete to audit against.
- The strongest option is to serve yourself. Running your own Host puts no third party in the path at all. See [Use your own infrastructure](/build/how-to/use-your-own-infrastructure/) and [Privacy](/understand/core-concepts/privacy/).

Policing and economic penalties for manipulative Hosts are part of the protocol design but are not live today. Treat third-party view data as "trusted, auditable later" rather than "verified on receipt."

## Where to go next

- [Attestations](/understand/core-concepts/attestations/): how vote counts on data work.
- [Verify data with signatures and CIDs](/build/how-to/verify-data/): the hands-on queries for checking data yourself.
- [Attestation as a query filter](/build/concepts/attestation-as-a-query-filter/): setting per-query trust thresholds in your app.
- [Generator security](/run/run-a-generator/security/): deployment shapes and key separation for operators.
