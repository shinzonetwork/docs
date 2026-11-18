+++
path = "run/chains/tron/mainnet/generator/verify"
title = "Verify a Generator \u2014 TRON Mainnet"
description = "Check client health, the correct chain namespace, and advancing data before onboarding."
template = "chain-page.html"
[extra]
chain = "tron"
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
  --data '{"query":"{ Tron__Mainnet__Block(limit: 1, order: {number: DESC}) { number hash } }"}'
```

Expect a nonempty `data.Tron__Mainnet__Block` array and no GraphQL `errors`. Repeat after new blocks arrive and confirm the height advances. Empty results during startup need an ingestion check; the wrong namespace is not solved by falling back to Ethereum.

## Schema access

With the schema token exported in your shell, check:

```shell
curl -fsS -H "Authorization: Bearer $SCHEMA_API_KEYS" \
  http://localhost:8080/api/v1/schema
```

This example assumes one configured token. A 401 indicates missing or incorrect authorization; 503 can indicate token mode without configured keys. Confirm the returned schema belongs to `Tron__Mainnet` before handing the endpoint to a Host.

## Check the source APIs

Run these from a shell with the same TRON endpoint and API-key environment variables exported. The following commands assume a TronGrid-style header; change it for a custom gateway:

```shell
curl -fsS -X POST "$TRON_RPC_URL/wallet/getnowblock" \
  -H 'Content-Type: application/json' \
  -H "TRON-PRO-API-KEY: $TRON_API_KEY" --data '{}'
curl -fsS -X POST "$TRON_SOLIDITY_RPC_URL/walletsolidity/getnowblock" \
  -H 'Content-Type: application/json' \
  -H "TRON-PRO-API-KEY: $TRON_API_KEY" --data '{}'
```

Both should return a block object with `blockID` and `block_header.raw_data.number`. A successful head query does not prove finality; compare against the solidified endpoint. See the [official latest-block API](https://developers.tron.network/reference/wallet-getnowblock).

## TRON-specific failures

An unknown `tron` adapter suggests the EVM binary was started. Use `block_poster_tron` from the pinned branch. A 401/403 response indicates API authorization problems; a 404 can mean a JSON-RPC or method URL was supplied instead of a wallet-API base URL. If the solidified-head request fails, verify the separate SolidityNode URL and provider support.
