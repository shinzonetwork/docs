+++
title = "ELI5: Shinzo in plain language"
description = "A non-technical explanation of what Shinzo does, for newcomers who don't work with blockchains every day."
aliases = ["/introduction/eli5-architecture"]
+++

If you don't work with blockchains every day, the rest of this section can feel like a lot of jargon. This page explains what Shinzo does without most of it.

## The short version

Blockchains are great at recording data and bad at reading it back. Shinzo is a network that turns on-chain data into something applications can query like a regular database, without relying on a single company to do the reading for you.

## The problem

Imagine a library where every book is a transaction, new books arrive constantly, and they're all stored safely forever. But there's no card catalog and no search. If you want to find every book checked out by a particular person, you have to walk the shelves and open every single one.

That's roughly what reading a blockchain is like. The data is all there, permanently, but it isn't organized for questions like "show me all the USDC transfers from this address."

## The old fix

The standard fix was to hire a single librarian: one company that builds the search system, runs the help desk, and charges you every time you ask a question. It works, but you're trusting that one librarian to be honest, to stay open, and not to quietly change what's available. If their desk closes, your application goes dark, and there's no way to check that the answers they gave you were right until after you've already used them.

## What Shinzo does instead

Shinzo replaces the single librarian with a network of independent operators who each read the chain, organize the data, and cryptographically sign their work. Because every operator signs what they produce, you can check the data yourself rather than taking anyone's word for it.

Three roles make this work.

### Generators

Think of them as the librarians who work right at the printing press. Generators sit next to the machines that produce new blocks (Ethereum validators, to start). As each new block arrives, they copy the data, organize it into structured documents, and sign each one with their identity key.

### Hosts

If Generators are the librarians at the printing press, Hosts are the branch libraries. They receive signed documents from Generators over a peer-to-peer network and keep a running tally of how many distinct Generators signed off on each one. That tally is called an _attestation_, and it's how you later judge how much to trust a given piece of data. Hosts also run Views (described next) and serve the results to applications.

### Views

A View is a reading list. It's a small, versioned bundle that a developer writes. It says, in effect: _"take all the raw documents, filter to the USDC contract, decode the transfer events, and expose them as `TokenTransfer` records with `sender`, `receiver`, and `amount` fields."_ Any Host can pick up a View and run it. Because the transform inside a View is deterministic, every Host running the same View on the same input gets the same answer.

## Where the data ends up

Here's the part that surprises people: your application doesn't call a remote API to fetch data. It embeds a small database locally, subscribes to the Views it cares about, and Hosts push the matching documents to it over the peer-to-peer network. After that, a query is just a local database lookup: no per-read charge, no rate limits, no network round trip.

If you need extra confidence in a particular result, you can ask for an attestation threshold: _"only show me records that at least three independent Generators signed off on."_ That filter runs on the way in, so the data sitting in your local database already meets the bar you set.

## A quick recap

1. A blockchain produces a new block. A Generator sitting next to it copies the data, structures it, and signs it.
1. Hosts receive that signed data over a peer-to-peer network and tally how many Generators agreed on each piece.
1. A developer's View tells Hosts how to filter and reshape that raw data into something an application actually wants.
1. Your application embeds a local database, subscribes to the Views it needs, and Hosts push the results to it.
1. You query your local database. No remote API calls, no per-read fees, and an attestation filter available whenever correctness matters more than speed.

That's the whole idea. If you want the technical detail behind any of these steps, [How it works](../how-it-works/) walks through the same journey with the real component names and a concrete example.
