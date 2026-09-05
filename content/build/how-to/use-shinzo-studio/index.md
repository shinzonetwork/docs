+++
title = "Create and deploy Views in Shinzo Studio"
description = "How to create, deploy, and query Views from your browser with Shinzo Studio, without installing the CLI."
+++

[Shinzo Studio](https://studio.shinzo.network/) covers the same create, deploy, and query flow as Viewkit for developers who prefer a browser UI. Nothing installs locally; you need a browser wallet and some testnet SHNZ.

## Connect your wallet

1. Get testnet SHNZ from the [faucet](https://faucet.shinzo.network/) if you do not have any. Deploying a View and funding a query balance are on-chain transactions, so the wallet needs a small balance for network fees on top of whatever you spend.
1. Open [studio.shinzo.network](https://studio.shinzo.network/) and click **Connect Wallet**.
1. Choose a wallet from the list and approve the connection.
1. Studio asks you to switch to the Shinzo network. Confirm the network change in your wallet when prompted. The network uses chain ID 91273001; depending on the Studio deployment, your wallet may label it Shinzo testnet or Shinzo devnet.

Once connected, Studio shows your wallet balance and query balance, and the View catalog becomes available.

## Create a View

1. Start a new View from the catalog. Studio offers templates for the common cases, built on the same prebuilt lenses the CLI uses: **Decode Contract Events** (decodes verified event logs for one contract on Ethereum mainnet), **ERC20 Transfers** (normalized transfer rows for one token contract), and **ERC20 Balances** (account balances and transfer counts for one token contract).
1. Enter what the template asks for. For the decode template that is the contract address, for example `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` for USDC. Studio fetches the contract's verified ABI from Sourcify and picks out the event definitions, so the ABI has to be verified there. If Sourcify has no verified ABI for the contract, Studio tells you and stops.
1. Review the generated View definition: the source query, the SDL, and the lens definition with its arguments. This is exactly the bundle Viewkit would produce for the same inputs, and it is worth reading before you sign anything.

## Deploy the View

1. Click **Deploy View**. Studio validates the definition, builds the View bundle, and asks your wallet to sign the registration transaction.
1. Confirm in your wallet. Studio sends the transaction and waits for confirmation.
1. Wait for registration to complete. Registration on ShinzoHub finishes asynchronously, so Studio polls until the View reaches REGISTERED status. This can take a short while; you can inspect the View definition in the meantime.

After registration, Studio prompts you to back the View with demand. Creating demand bonds SHNZ to the View's pool and is how Host clients see that the View should be served. The first demand creates the pool, and the pool becomes active once at least 3 Hosts have joined it. Until then Studio shows the pool as waiting for Hosts.

## Fund your query balance

1. Open your View and click **Add query funds** (also shown as **Add to query balance**).
1. Enter an amount of SHNZ and approve the deposit transaction in your wallet.
1. Wait for the **Query balance funded** confirmation.

{% admonition(type="warning") %}
Query billing is still being finalized on the testnet, and the details here may change. Fund small amounts for now, and expect the metering rules to evolve. There is no dedicated billing guide yet.
{% end %}

## Query the View

1. Open the View and click **Query this view**.
1. Pick a Host with **Select direct query host**. Studio lists the Hosts currently serving the View's pool, so choose one of those; a Host outside the pool does not have the View's data.
1. Write or adjust the GraphQL query in the editor and run it. Each run asks your wallet for one signature and spends from your prepaid query balance, so keep an eye on the balance Studio shows. If it runs out, Studio refuses to send and tells you to add funds first.

The results come straight from the Host you picked. To script the same flow outside the browser, see [Query your first View](/build/tutorials/query-your-first-view/). To build the same View from the terminal instead, see [Create your first View](/build/tutorials/create-your-first-view/).

## Need help

{{ need_help(client="Shinzo SDK", repo_name="web", repo="https://github.com/shinzonetwork/web/issues") }}
