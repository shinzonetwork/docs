---
title: Glossary
sidebar_label: Glossary
sidebar_position: 7
description: Glossary of terms and definitions for Shinzo Network's decentralized data indexing protocol
---

#### **ACP (Access Control Policy)**
A set of rules defining read, write, query, or update permissions for identities interacting with Shinzo data.

#### **Application Developer**
A developer who builds applications that consume Shinzo data feeds, schemas, or APIs.

#### **Block Data**
Raw blockchain data that includes blocks, transactions, logs, commonly sourced from networks such as Ethereum.

#### **Collection**
A schema-defined document type in defraDB. Collections enforce structure, validation rules, and constraints.

#### **Content Addressable Data**
A storage model where data is addressed by a cryptographic hash of its content. Any modification produces a new hash, ensuring immutability and verifiability.

#### **Content Identifier (CID)**
A hash-based identifier generated from content. Used across IPLD and hash-linked data structures.

#### **Curator**
A developer or entity that creates structured data views, feeds, or SDL-described schemas within Shinzo.

#### **defraDB**
A NoSQL, document-oriented, edge-first database used by Shinzo to store encrypted or schema-defined data.

#### **Digital Identity Key (DID Key)**
A cryptographic key pair representing a user's or device's identity in Shinzo. Used for signing, encrypting, and authenticating operations.

#### **Epoch**
A standardized period of blockchain time determined by a fixed number of blocks.  
Example: On Ethereum, an epoch = 32 blocks.

#### **GraphQL**
A query language and runtime used for retrieving structured data from defraDB, collections, and views within Shinzo.

#### **Host**
The Host is the local Shinzo client that manages identity, encrypted storage, data syncing, and communication with the network from a user’s device.

#### **IBC (Inter-Blockchain Communication)**
A protocol enabling secure messaging between blockchains. Only relevant if Shinzo interacts with IBC-enabled chains.

#### **Indexing**
The process of parsing blockchain data and storing structured, schema-compliant documents in defraDB.

#### **Indexer**
A client that reads blockchain data (blocks, transactions, logs), parses it, and writes normalized documents into defraDB.

#### **IPLD (Interplanetary Linked Data)**
A data model used by decentralized systems (e.g., IPFS) to create verifiable, linkable, content-addressed objects using Merkle DAGs.

#### **Merkle DAG**
A Directed Acyclic Graph where nodes are linked by cryptographic hashes. Nodes may have multiple parents, enabling efficient linking and deduplication of data.

#### **Merkle Tree (Hash Tree)**
A tree structure where each non-leaf node is the hash of its child nodes. Used to verify large datasets efficiently.

#### **Orbis**
Orbis is Shinzo’s key-management component, responsible for generating, storing, and handling cryptographic keys used for identity, encryption, and signing.

#### **Outpost**
The on-chain payment contract for purchasing or enabling access to data on a given blockchain network.

#### **Primitive Prefix**
A prefix used to namespace document data submitted by an indexer per chain or per network (e.g., `eth_mainnet_block`).

#### **Query (Permission)**
Allows a user or device to decrypt document data for executing GraphQL queries.

#### **Read (Permission)**
Allows a device to receive encrypted documents. The data remains encrypted unless paired with Query permission.

#### **Schema Definition Language (SDL)**
A formal language used to define document schemas, data types, constraints, relationships, and validation rules inside Shinzo.

#### **ShinzoHub**
ShinzoHub is the central coordination service that handles data routing, availability, and payment settlement between Hosts, Curators, and blockchain Outposts.

#### **Smart Contract**
Deterministic code deployed on a blockchain. Given the same input, execution always produces the same verifiable output.

#### **SourceHub**
SourceHub is Shinzo’s authorization layer, enforcing role-based access control and ensuring permissions and policies are applied consistently across the network.

#### **Stream ID**
A unique identifier for a curated data feed or stream.

#### **Update (Permission)**
Allows a user or system to modify the contents of an existing document.

#### **View**
A curated representation of defraDB documents defined using SDL. Views transform raw data into structured outputs.
