+++
path = "run/chains/bnb/mainnet/generator/verify"
title = "Verify a Generator \u2014 BNB Smart Chain Mainnet"
description = "Check client health, the correct chain namespace, and advancing data before onboarding."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Verify a Generator"
product = "generator"
task = "verify"
+++

## Health and identity

```shell
curl -fsS http://localhost:8080/health
```

Check logs for successful block commits, not only a running process. Record the client version and Peer ID for the Host connection. A container health check alone does not establish that the expected chain is being indexed.

## Query the correct namespace

```shell
curl -fsS http://localhost:9181/api/v0/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ BSC__Mainnet__Block(limit: 1, order: {number: DESC}) { number hash } }"}'
```

Expect a nonempty `data.BSC__Mainnet__Block` array and no GraphQL `errors`. Repeat after new blocks arrive and confirm the height advances. Empty results during startup need an ingestion check; the wrong namespace is not solved by falling back to Ethereum.

## Schema access

Use one of the tokens configured in `SCHEMA_API_KEYS` in your `.env` file:

```shell
curl -fsS -H 'Authorization: Bearer REPLACE_WITH_YOUR_SCHEMA_TOKEN' \
  http://localhost:8080/api/v1/schema
```

Replace the placeholder before running the command. A 401 indicates missing or incorrect authorization; 503 can indicate token mode without configured keys. Confirm the returned schema belongs to `BSC__Mainnet` before handing the endpoint to a Host.

## BSC-specific failures

A chain-ID mismatch means the configured source is not BSC Mainnet; verify `eth_chainId` returns `0x38`. A missing `BSC__Mainnet__Block` collection usually means the wrong config was selected or schema initialization failed. Provider throttling requires checking receipt access and request capacity before raising concurrency.

If DefraDB reports write collisions after increasing `indexer.concurrent_blocks`, restore the supplied value of `2` and recheck progress. Keep the value at or below `8` while the collision issue is being addressed.
