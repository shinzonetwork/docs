+++
title = "Query your first View"
description = "Tutorial: query a live View on the Shinzo testnet from a TypeScript app. Discover a View, pick a Host, sign a request, and print results."
+++

In this tutorial you'll query a live View on the Shinzo testnet from a small TypeScript script. By the end, the script prints the 10 most recent rows of `Erc20Event`, a registered View that decodes `Transfer` events from fungible token contracts on Ethereum mainnet. Everything runs against public testnet infrastructure; the only things you install on your machine are npm packages.

The script we're about to create does four things: 

1. Find the View in ShinzoHub's registry.
1. Pick a Host that serves it.
1. Sign the GraphQL request.
1. POST it to the Host's endpoint.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or later.
- NPM, which comes with Node.js anyway.

You don't need a wallet, tokens, or any local infrastructure.

## Set up the project

1. Check your Node.js version:

    ```shell
    node --version
    ```

    ```output
    v22.22.1
    ```

1. Create a project folder and install the dependencies:

    ```shell
    mkdir query-view && cd query-view
    npm init -y
    npm pkg set type=module
    npm install @shinzo/shinzohub @shinzo/querysig viem
    npm install --save-dev tsx
    ```

    `@shinzo/shinzohub` reads the ShinzoHub registry (Views, Hosts, and pools). `@shinzo/querysig` builds the signed request envelope a Host expects. `viem` creates the signing key and produces signatures. `tsx` runs TypeScript files directly. The `npm pkg set` line marks the project as ESM so the script can use top-level `await`.

## Connect to ShinzoHub

1. Create a file called `query.ts` with the imports and a client:

    ```ts
    import { createPublicClient, http } from "viem";
    import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
    import { shinzoHubActions } from "@shinzo/shinzohub";
    import { shinzoHubTestnet } from "@shinzo/shinzohub/chains";
    import { normalizeShinzoAddress, shinzoAddressToHex } from "@shinzo/shinzohub/addresses";
    import { sign } from "@shinzo/querysig";

    const client = createPublicClient({
      chain: shinzoHubTestnet,
      transport: http(),
    }).extend(shinzoHubActions);
    ```

    `shinzoHubTestnet` carries the testnet chain ID (91273001) and its public endpoints. Extending the client with `shinzoHubActions` adds the registry read methods used below.

## Find a View

1. Add the discovery step to `query.ts`:

    ```ts
    const { views } = await client.listViews({ limit: 25, includeMetadata: true });
    const view = views.find((v) => v.name === "Erc20Event");
    if (!view) {
      throw new Error("Erc20Event is not registered");
    }
    console.log(`View: ${view.name} at ${view.viewAddress}`);
    console.log(`SDL: ${view.metadata?.sdl}`);
    ```

    `listViews` reads the View registry. Each entry has a `name`, a deterministic `viewAddress`, and, when `includeMetadata` is set, the parsed bundle: the source query, the SDL, and lens details. The script picks `Erc20Event` by name and prints its SDL, which lists the fields a query can ask for.

    You can also browse registered Views in the [Shinzo Explorer](https://explorer.shinzo.network/shinzohub).

## Pick a Host

A View is served by a pool of Hosts. `listViewPools` returns the pools that exist for a View, and a pool becomes active once at least 3 Hosts have joined it. Each registered Host advertises an `endpointAddress`, the full URL of its GraphQL API.

1. Add the Host selection step:

    ```ts
    const pools = await client.listViewPools({ viewAddress: view.viewAddress });
    const pool = pools.find((p) => p.isActive) ?? pools[0];
    if (!pool) {
      throw new Error("No pool exists yet for this View");
    }
    console.log(`Pool: ${pool.poolAddress} with ${pool.hosts.length} Hosts (active: ${pool.isActive})`);

    const { hosts } = await client.listHosts({ limit: 100 });
    const members = new Set(pool.hosts.map((h) => h.hostAddress.toLowerCase()));
    const endpoints = hosts.flatMap((h) => {
      if (!h.endpointAddress) return [];
      try {
        const hex = shinzoAddressToHex(normalizeShinzoAddress(h.address)).toLowerCase();
        return [{ endpoint: h.endpointAddress, inPool: members.has(hex) }];
      } catch {
        return [];
      }
    });
    const candidates = [
      ...endpoints.filter((e) => e.inPool),
      ...endpoints.filter((e) => !e.inPool),
    ];
    ```

    Pools track their members by EVM hex address, while the Host registry uses Shinzo bech32 addresses, so the script converts with `shinzoAddressToHex` before matching. The result is a candidate list with pool members first.

    {% admonition(type="note") %}
    Registered endpoints can go stale on a testnet. The script tries pool members first, then falls back to any other registered Host that answers. Hosts replicate the Views they subscribe to, so the data is the same either way.
    {% end %}

## Sign the query

Hosts expect every View query to carry a signature. The `sign` function from `@shinzo/querysig` hashes your query (canonical JSON plus keccak256), builds an EIP-712 `QueryRequest` over the query hash, a nonce, a timestamp, and the pool address, then asks your signer for a signature. Here the signer is a freshly generated key wrapped in viem's `signTypedData`; in a browser app the same call goes to the user's wallet.

1. Add the query and the signing step:

    ```ts
    const account = privateKeyToAccount(generatePrivateKey());
    const query = `query LatestEvents {
      Erc20Event(filter: { event: { _eq: "Transfer" } }, limit: 100) {
        blockNumber
        event
        logAddress
        arguments
      }
    }`;
    const signed = await sign(
      { chainId: shinzoHubTestnet.id, pool: pool.poolAddress, query },
      (typedData) => account.signTypedData(typedData),
    );
    console.log("Signed request extensions:");
    console.log(JSON.stringify(signed.extensions, null, 2));
    ```

    The query asks for the block number, the event name, the contract that emitted the log (`logAddress`), and `arguments`, where the View's lens puts the decoded event parameters. The SDL also lists `hash`, `from`, and `to`, but this version of the View leaves those empty.

    The result is the query plus an `extensions` envelope: `request_signature` is the EIP-712 signature, `query_hash` binds the signature to this exact query, `nonce` and `request_timestamp` keep the request fresh, and `pool_address` names the pool the query bills to. `fanout` is only read by the network gateway; Hosts ignore it.

    {% admonition(type="note") %}
    Query billing is not enforced on the testnet yet, so a freshly generated key with no funds is enough here. Signed requests are still the supported interface: once Hosts enforce billing, they will reject unsigned View queries and check the signer's query balance.
    {% end %}

## Send the query

1. Add the send loop:

    ```ts
    let answered = false;
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            query: signed.query,
            variables: signed.variables,
            extensions: signed.extensions,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) continue;
        const body = await response.json();
        const rows = body.data?.Erc20Event;
        if (!rows?.length) continue;
        console.log(`Answer from ${candidate.endpoint}:`);
        const latest = rows
          .sort((a: { blockNumber: number }, b: { blockNumber: number }) => b.blockNumber - a.blockNumber)
          .slice(0, 10);
        for (const row of latest) {
          const arg = (name: string) =>
            row.arguments?.find((a: { name: string }) => a.name === name)?.value ?? "";
          console.log(`${row.blockNumber} ${row.event} from=${arg("from")} to=${arg("to")} value=${arg("value")}`);
        }
        answered = true;
        break;
      } catch {
        // This endpoint did not answer; try the next one.
      }
    }
    if (!answered) {
      throw new Error("No Host answered. Wait a minute and run the script again.");
    }
    ```

    The request body is standard GraphQL-over-HTTP plus the `extensions` envelope. The script POSTs to each candidate until one answers, sorts the returned rows by `blockNumber`, and prints the 10 most recent. Sorting locally keeps the request to one bounded page; [Query data](/build/query-data/) covers the server-side `filter` and `order` arguments if you want the Host to do that work.

## Run the script

1. Run it:

    ```shell
    npx tsx query.ts
    ```

    ```output
    View: Erc20Event at 0xEAc245f905e0aAcF3b9Fe27153F2AaF485dc1B48
    SDL: type Erc20Event @materialized(if: false) { hash: String blockNumber: Int from: String to: String logAddress: String event: String signature: String arguments: String }
    Pool: 0xDbc3bE7CBd8Dc8901E3BbbeA1A740BE490dAe23B with 3 Hosts (active: true)
    Signed request extensions:
    {
      "request_signature": "0x7af2957e06e2a8077b881b18bb2d00b2adce8a5f8ebed78f15f5f85ac1684e5a5e2443384d353efac483e3c15dc45d9f2f9c72559c820b5a5a697aaa18521a611c",
      "nonce": "0xfa7ee71bd179843e04944a083c999ba32805f758cdae2699f604c9c9928c2219",
      "query_hash": "0xfa3ec6d0ff7e89a1bea76e1042b12d4e89366f13efaf935217f7331c8a44a8c2",
      "request_timestamp": 1788433155,
      "pool_address": "0xDbc3bE7CBd8Dc8901E3BbbeA1A740BE490dAe23B",
      "fanout": 1
    }
    Answer from http://51.178.74.112:9181/api/v0/graphql:
    25806062 Transfer from=0xcdb71d4c6b3a0d470201f848e50c7411a521ee04 to=0xc1d13492285eb664951e201bf7c80c7c6318a1b5 value=2000000000
    25806062 Transfer from=0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb to=0xd226997439ecfbeff8e110c8c78c8a7eefd19f89 value=102876390302159
    25806062 Transfer from=0xd226997439ecfbeff8e110c8c78c8a7eefd19f89 to=0xdcef968d416a41cdac0ed8702fac8128a64241a2 value=421000000
    25806062 Transfer from=0x09fc9b7545020f6a51d113e495e0a451597969d3 to=0xf8e349d1d827a6edf17ee673664cfad4ca78c533 value=374880000
    25806062 Transfer from=0x9642b23ed1e01df1092b92641051881a322f5d4e to=0x89df61e9ae683899d376ed60964d9e8c3fb27160 value=25265642000
    25806062 Transfer from=0x22ec88b9ff78c6f2458ab1a7aa8bb99d84bd4b86 to=0x003896387666c5c11458eeb3f927b72a11b19783 value=2212522960
    25805853 Transfer from=0x3416cf6c708da44db2624d63ea0aaef7113527c6 to=0xace0fabed501e819ecc15e67c7ed3a67c2f67e91 value=629288918
    25805853 Transfer from=0xace0fabed501e819ecc15e67c7ed3a67c2f67e91 to=0x2c158bc456e027b2affccadf1bdbd9f5fc4c5c8c value=628725538
    25805853 Transfer from=0x2c158bc456e027b2affccadf1bdbd9f5fc4c5c8c to=0x3312cc371fe0dd5171878630a1e5cf69778e8fa5 value=628725538
    25805153 Transfer from=0xe0554a476a092703abdb3ef35c80e0d76d32939f to=0xa0f1c3ad83e07d97b5e7030e177718be175275ea value=3741969400
    ```

    Registered Hosts, pool membership, and the rows themselves change as the network moves, so your addresses and values will differ.

## Where to next

- [Create your first View](/build/tutorials/create-your-first-view/) to own the data: build and deploy a View of your own, then query it with this same script.
- [Build a local-first app](/build/tutorials/build-a-local-first-app/) for the embedded version: subscribe to a View and query pushed data locally instead of per request.
- [Choosing an app architecture](/build/explanation/choosing-an-architecture/) for the trade-offs between the two models.

## Need help

{{ need_help(client="Shinzo SDK", repo_name="web", repo="https://github.com/shinzonetwork/web/issues") }}
