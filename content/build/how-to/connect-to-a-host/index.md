+++
title = "Connect your app to a Host"
description = "How to connect an application to a Shinzo Host: P2P connection strings for embedded Go apps and GraphQL endpoints for direct-query TypeScript apps."
+++

How you connect to a Host depends on your architecture. A local-first Go app embeds DefraDB and peers with Hosts over libp2p, so it needs connection strings. A direct-query TypeScript app talks to a Host's GraphQL endpoint over HTTP, so it needs an endpoint URL. Both start with the discovery step in [Find Views and Hosts](/build/how-to/find-views-and-hosts/), which explains where each value comes from.

A Host client exposes four interfaces:

| Port | Interface |
| --- | --- |
| 9181 | GraphQL API at `/api/v0/graphql` |
| 9182 | GraphQL playground, when enabled |
| 9171 | libp2p peering |
| 8080 | Health and self-description endpoints |

Public Hosts vary in how they publish these, so always read the actual `connection_string` and `endpoint_address` from the registry rather than assuming ports.

## Check a Host's health first

Before wiring a Host into your app, check that it is alive and processing data:

```shell
curl -s -H "Accept: application/json" http://<host>:8080/health | jq '{status, current_block}'
```

```json
{
  "status": "healthy",
  "current_block": 25903651
}
```

The `Accept: application/json` header asks for the JSON form; a browser gets an HTML status page instead. A `healthy` status with a recent `current_block` means the Host is peered and syncing. The same server answers `GET /registration` with the Host's DID, `connection_string`, and `endpoint_address`, which is handy for confirming a Host's identity before you trust its data.

## Embedded app (Go)

A local-first app receives pushed data over libp2p, so the connection happens in the app-sdk config. Take the Host's `connection_string` from the registry:

```shell
curl -s http://testnet.shinzo.network:1317/shinzonetwork/host/v1/hosts \
  | jq -r '.hosts[].connection_string'
```

Add one or more of them to `defradb.p2p.bootstrap_peers` in your `config.yaml`:

```yaml
defradb:
  p2p:
    enabled: true
    bootstrap_peers:
      - "/ip4/34.66.172.230/tcp/9171/p2p/12D3KooWKVCMswzcXYe9kW2z7nSB9YUWjVVLsMbJnBjVPFUQkbQ7"
    listen_addr: "/ip4/127.0.0.1/tcp/9171"
```

The full multiaddr form `/ip4/<ip>/tcp/9171/p2p/<peerID>` always works, but it is not required. Bare IPs (`34.66.172.230`) and `ip:port` pairs (`34.66.172.230:9171`) also work, because the client discovers the peer ID during the connection handshake and fills it in for you. Listing several bootstrap peers makes the first connection more reliable, since registered Hosts come and go on a testnet.

Once peered, subscribe to a View and data starts arriving. [Subscribe to Views with the app-sdk](/build/how-to/subscribe-to-views/) covers that flow.

## Direct-query app (TypeScript)

A direct-query app never peers with anything. It reads the Host's `endpoint_address` from the registry and POSTs signed GraphQL requests to it:

```shell
curl -s http://testnet.shinzo.network:1317/shinzonetwork/host/v1/hosts \
  | jq -r '.hosts[].endpoint_address'
```

The endpoint already includes the API path, so you POST straight to it:

```shell
curl -s -X POST "http://34.66.172.230/api/v0/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ Erc20Event(limit: 1) { blockNumber } }", "extensions": { ... } }'
```

View queries carry a signature in the `extensions` envelope, and one billed query maps to one pool: a request may touch only one View collection, and its `pool_address` extension names the pool it bills to. When a Host enforces billing, rejections come back as plain errors: `403` if the request signature is missing, stale, or fails verification, and `402` if the signer's query balance is too low. [Query your first View](/build/tutorials/query-your-first-view/) builds the signing flow end to end.

{% admonition(type="note") %}
Billing enforcement is rolling out on the testnet, so some Hosts still answer unsigned queries. Signed requests are the supported interface either way; treat unsigned access as a convenience that will go away.
{% end %}

## Prefer your own Host

Public Hosts are shared infrastructure. If you want guaranteed availability, or you do not want a third party to see your queries at all, you can point everything above at a Host you run yourself. See [Use your own infrastructure](/build/how-to/use-your-own-infrastructure/).

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
