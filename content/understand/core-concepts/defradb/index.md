+++
title = "DefraDB"
+++
[DefraDB](https://github.com/sourcenetwork/defradb) is the database embedded in every component of the Shinzo stack. Generators, Hosts, and application clients each run their own instance. It's what makes the network peer-to-peer rather than client-server.

## What it is

DefraDB is an open-source document database built by Source Network. It stores data as content-addressed documents, exposes a GraphQL query interface, handles schema definition, and ships with a libp2p networking layer for replication between nodes. A few properties make it a good fit for Shinzo in particular:

- Schema enforcement: primitive documents have defined types that Generator clients write into and Hosts read from.
- P2P replication: documents gossiped between instances are verified by CID before being accepted.
- DID-based access control: read access to any collection can be gated by a DID, which is how subscription access is enforced.
- CRDT support: conflict-free merge semantics for types like the P-counter in Attestation Records.

## How it connects the network

When a Generator client writes a block to its local DefraDB, DefraDB gossips a digest to subscribed peers over libp2p. Those peers (Hosts) request the full document, verify its CID, and store it locally. No broker is involved.

The same thing happens at the other end. When a Host client produces View documents for a subscriber, DefraDB replicates them directly to the subscriber's embedded instance. The app queries its local database. No API call, no round trip.

## Why not a conventional database

A conventional database has a server and a client, which means the server is a single point of failure and the client has no way to verify what it receives. DefraDB gives every participant their own node. Data is addressed by content rather than by location, and access control travels with the data.
