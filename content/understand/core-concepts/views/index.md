+++
title = "Views"
+++
A View is a developer-defined data product. It describes what raw blockchain data to pull, how to transform it, and what schema to expose the result as. Once deployed, Hosts run it continuously and push results to any application that subscribes.

## What a View contains

Every View is a versioned bundle with three parts:

- A query that specifies which primitive data to pull from the Generator layer. Today that means blocks, transactions, logs, and access list entries from Ethereum Mainnet.
- A schema, a GraphQL SDL type definition describing the shape of the output. This is what subscribers see and query against.
- One or more Lens transforms, WebAssembly modules that do the actual filtering, decoding, and reshaping work.

## Why it's designed this way

The split between _what data_ (the query), _how to transform it_ (the Lens), and _what shape to expose_ (the schema) is intentional. It keeps the View portable: any compliant Host client can pick it up, run the same deterministic transforms against the same input, and get the same output. Because Lens transforms are WASM and deterministic, any Host client or auditor can re-run them to verify the result independently.

You deploy Views through `viewkit` to ShinzoHub, which validates and registers them. Hosts watch for new View registrations and decide which ones to run.

## View categories

Views fall into three categories depending on what data they touch:

- Primary: derived directly from Generator primitives (e.g. decoded ERC-20 transfers from raw logs).
- Secondary: derived from other Views (e.g. a portfolio view built on top of multiple token transfer Views).
- Tertiary: aggregated or computed across multiple secondary sources.

Most developers today build primary Views. Secondary and tertiary Views become useful once more primary Views exist for them to draw from.
