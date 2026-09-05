+++
title = "Add the Shinzo testnet to your wallet"
description = "Connect MetaMask, Trust Wallet, and other browser wallets to the Shinzo testnet with the correct network parameters."
aliases = ["/wallets/add-testnet"]
+++

To interact with the Shinzo testnet from a browser wallet, you add it as a custom network. This page lists the values every wallet needs, then steps through adding the network in MetaMask and Trust Wallet, with a generic method for any other EVM-compatible wallet at the end.

You need testnet SHNZ to pay for transactions such as registering a Host or Generator. Get it from the [testnet faucet](https://faucet.shinzo.network/), and track on-chain activity on the [Explorer](https://explorer.shinzo.network/).

## Network parameters

Every wallet asks for the same set of fields. Use these values for the testnet:

| Field | Value |
| --- | --- |
| Network name | Shinzo |
| RPC URL | `http://testnet.shinzo.network:8545` |
| Chain ID | `91273001` |
| Currency symbol | `SHNZ` |
| Block explorer URL | `https://explorer.shinzo.network` |

The block explorer URL field is optional in some wallets. Fill it in when the field is there, so transaction hashes and addresses link out to the Explorer.

{% admonition(type="warning", title="HTTP RPC caveat") %}
The testnet RPC endpoint uses plain HTTP rather than HTTPS. Some wallets refuse to add an HTTP endpoint for security reasons, and others add it but mark the network as untrusted. We are tracking the HTTPS work in [shinzohub#97](https://github.com/shinzonetwork/shinzohub/issues/97). Until that lands, use a wallet that accepts HTTP endpoints. MetaMask and Trust Wallet both do, and both are known to work with the testnet.
{% end %}

## Add the network to MetaMask

1. Open the MetaMask extension and click the network selector at the top.
1. Click **Add network** and choose **Add a network manually**.
1. Enter the values from the [network parameters](#network-parameters) table. The Chain ID field accepts the decimal form `91273001`.
1. Click **Save**. MetaMask warns that the RPC endpoint is not HTTPS. Review the warning and confirm to continue.
1. Switch to the Shinzo network from the network selector.

## Add the network to Trust Wallet

Trust Wallet runs as both a mobile app and a browser extension. The fields are the same in each.

On mobile:

1. Open the Trust Wallet app and tap the asset management icon in the top right of the main wallet screen.
1. Tap the **+** button and switch to the **Network** tab.
1. Select **EVM** as the network type and tap **Add custom network**.
1. Enter the values from the [network parameters](#network-parameters) table.
1. Tap **Save**.

On the browser extension:

1. Open the extension and select the **Settings** icon.
1. Go to **Network** and click **Add custom network**.
1. Enter the values from the [network parameters](#network-parameters) table.
1. Save the network and switch to it from the network selector.

## Add the network to any other EVM-compatible wallet

If your wallet is not listed above, add the network manually from its custom-network or add-chain screen. The field names vary, but every EVM-compatible wallet asks for the same four required values plus an optional block explorer URL. Copy them from the [network parameters](#network-parameters) table.

Wallets that expose the standard `wallet_addEthereumChain` method can also pick up the network from a dApp that calls it. Shinzo does not host that flow yet, so add the values by hand for now.

## Next steps

Once your wallet is connected, you can register as a Host or Generator on the [Registration app](https://registration.shinzo.network/). See the [Host quickstart](/run/run-a-host/quickstart/) and [Generator registration](/run/run-a-generator/register/) guides for the full registration flow.
