+++
title = "Find Views and Hosts"
description = "How to discover registered Views, serving Hosts, and pools on the Shinzo network using the Explorer, Studio, the REST API, or the TypeScript SDK."
+++

Views, Hosts, and Generators are all registered on ShinzoHub, so discovery is a matter of reading the registry. There are four ways to do it: the Explorer in a browser, Shinzo Studio, the chain's REST API, or the TypeScript SDK. Pick whichever fits the job; they all read the same on-chain state.

Two fields come up constantly, so get familiar with them first:

- `connection_string` is a libp2p multiaddr, like `/ip4/34.66.172.230/tcp/9171/p2p/12D3KooW...`. It is how peers dial each other. Your local-first app needs it.
- `endpoint_address` is the URL of a Host's GraphQL API, like `http://34.66.172.230/api/v0/graphql`. It is what direct-query apps POST to.

## Browse the Explorer

The [Shinzo Explorer](https://explorer.shinzo.network/shinzohub) renders the registry as web pages. Open it and switch between the **Blocks**, **Transactions**, **Generators**, **Hosts**, and **Validators** tabs.

The **Hosts** tab lists every registered Host client with its connection details, and the **Generators** tab lists the registered Generator clients. Use the Explorer when you want to eyeball the network: who is online, what is registered, and whether anything changed recently.

## Browse the View catalog in Studio

[Shinzo Studio](https://studio.shinzo.network/) shows registered Views in its catalog, each with its definition, pool, and serving Hosts. Studio is the better browser experience when your question is "what Views exist and what do they return", because it shows the View's SDL alongside its network status. You can also deploy your own View from the same UI; see [Create and deploy Views in Shinzo Studio](/build/how-to/use-shinzo-studio/).

## Query the REST API

ShinzoHub exposes a REST API at `http://testnet.shinzo.network:1317`. This is the option for scripts and terminals, and the responses below are real testnet output.

List registered Views:

```shell
curl -s "http://testnet.shinzo.network:1317/shinzonetwork/view/v1/views?include_data=true" \
  | jq -r '.views[] | .name + "  " + .address'
```

```output
Studio_v1_Erc20TransferUSDC  0xD3084cAddCe8E1bab07C6eDd8afb835566904C6B
Erc20Event  0xEAc245f905e0aAcF3b9Fe27153F2AaF485dc1B48
FilteredAndDecodedLogs  0xa1226B03c54789e9Bf8876ac956aBbD1bDf5B654
...
```

List registered Host clients:

```shell
curl -s "http://testnet.shinzo.network:1317/shinzonetwork/host/v1/hosts" \
  | jq -r '.hosts[] | .connection_string + "  " + .endpoint_address'
```

```output
/ip4/34.66.172.230/tcp/9171/p2p/12D3KooWKVCMswzcXYe9kW2z7nSB9YUWjVVLsMbJnBjVPFUQkbQ7  http://34.66.172.230/api/v0/graphql
/ip4/34.63.186.249/tcp/9171/p2p/12D3KooWSqvLctTtcQLvqSVZU4sTCUWxCX9z4NeFpSHnmVWBiFMZ  http://34.63.186.249/api/v0/graphql
...
```

List registered Generator clients:

```shell
curl -s "http://testnet.shinzo.network:1317/shinzonetwork/indexer/v1/indexers" \
  | jq -r '.indexers[] | .operator_address + "  " + .source_chain'
```

List the pools serving a View, with membership and activity:

```shell
curl -s "http://testnet.shinzo.network:1317/shinzonetwork/pool/v1/views/0xEAc245f905e0aAcF3b9Fe27153F2AaF485dc1B48/pools" \
  | jq -c '.details[] | {pool: .pool.pool_address, hosts: (.hosts | length), is_active}'
```

```output
{"pool":"0xDbc3bE7CBd8Dc8901E3BbbeA1A740BE490dAe23B","hosts":3,"is_active":true}
```

A pool becomes active once at least 3 Hosts have joined it, so `is_active` is the quick check for whether a View is being served. The registry moves over time, so expect different names and addresses when you run these.

## Query with the TypeScript SDK

The same registry reads are available from `@shinzo/shinzohub` if your app needs them programmatically. The client extends a viem public client with ShinzoHub actions:

```ts
import { createPublicClient, http } from "viem";
import { shinzoHubActions } from "@shinzo/shinzohub";
import { shinzoHubTestnet } from "@shinzo/shinzohub/chains";

const client = createPublicClient({
  chain: shinzoHubTestnet,
  transport: http(),
}).extend(shinzoHubActions);

const { views } = await client.listViews({ limit: 25, includeMetadata: true });
const { hosts } = await client.listHosts({ limit: 100 });
const pools = await client.listViewPools({ viewAddress: views[0].viewAddress });
```

`listViews` returns registered Views (with the parsed query, SDL, and lens metadata when `includeMetadata` is set), `listHosts` returns Host clients with their `endpointAddress`, and `listViewPools` returns the pools for a View with member Hosts and an `isActive` flag. `getNetworkUnitPrice` reads the network-wide unit price for queries. The [Query your first View](/build/tutorials/query-your-first-view/) tutorial walks through combining these into a full query flow.

## Ask a Host about itself

Any running Host client describes itself over its health server, on port 8080 by default:

```shell
curl -s -H "Accept: application/json" http://<host>:8080/registration | jq .registration
```

```json
{
  "did": "did:key:zQ3shQKyThhTw3M83ZcTobUQER5mxNbSrW3Yrds3if4mPPrje",
  "connection_string": "/ip4/203.0.113.10/tcp/9171/p2p/12D3KooWB1K1k67DNEcxShBq3o15LQrKHcBkRxzv6AuFR8p8idqJ",
  "endpoint_address": "http://203.0.113.10/api/v0/graphql"
}
```

This is the same information a Host publishes to the registry when it registers, so it is the quickest way to check what a specific Host claims to be. See [Connect your app to a Host](/build/how-to/connect-to-a-host/) for the health endpoint and the rest of the port layout.

## What does not exist

Viewkit has no list or discovery commands. It builds and deploys View bundles, and that is all. Discovery happens on-chain through the paths above, or through the Explorer and Studio UIs listed in [Tools](/reference/tools/).

## Where to next

- [Connect your app to a Host](/build/how-to/connect-to-a-host/) to put a `connection_string` or `endpoint_address` to work.
- [Query your first View](/build/tutorials/query-your-first-view/) for the full flow from discovery to a signed query.

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
