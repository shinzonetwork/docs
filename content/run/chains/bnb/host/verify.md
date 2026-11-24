+++
path = "run/bnb/host/verify"
aliases = ["run/chains/bnb/mainnet/host/verify"]
title = "Verify a Host \u2014 BNB Smart Chain Mainnet"
description = "Check the schema, P2P connection, and data served from BNB Smart Chain."
template = "chain-page.html"
[extra]
chain = "bnb"
heading = "Verify a Host"
product = "host"
task = "verify"
+++

## Check health and logs

```shell
docker logs shinzo-host-bnb
curl -fsS http://localhost:8080/health
```

Look for schema initialization and a stable Generator connection. A healthy process without data is not yet a completed setup.

## Query a recent block

```shell
curl -fsS http://localhost:9181/api/v0/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ BSC__Mainnet__Block(limit: 1, order: {number: DESC}) { number hash } }"}'
```

Check for a nonempty `data.BSC__Mainnet__Block` array and absence of GraphQL errors. Repeat after new source blocks and compare the block number and hash with the connected Generator. A generic `__typename` response does not verify ingestion.

## Troubleshooting

- **Schema request returns 401 or 503:** check the Host's `INDEXER_SCHEMA_ENDPOINT_AUTH_TOKEN` against the Generator's accepted token and confirm the Generator actually has keys configured.
- **Wrong or missing collection:** check the exact case-sensitive prefix and Generator source. Inspect the startup logs for schema rejection rather than changing the query to another chain.
- **Peer ID mismatch:** retrieve the actual identity from the Generator's health endpoint and update `chains[].generators[].peer`.
- **Snapshot configuration rejected:** this release only imports snapshots when serving Ethereum Mainnet alone.
- **Event filter rejected on multiple chains:** disable it or use separate single-chain Hosts.

Use the [shared troubleshooting guide](/run/bnb/operations/troubleshooting/) for networking and browser access issues; older examples using only `BOOTSTRAP_PEERS` do not replace the explicit chain/schema configuration here.
