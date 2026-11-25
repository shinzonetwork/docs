+++
path = "run/bnb/generator/register"
aliases = ["run/chains/bnb/mainnet/generator/register"]
title = "Register"
description = "How to register your Generator on the Shinzo Network"
+++

To participate in the Shinzo Network, your BSC Generator must be registered on ShinzoHub. Registration associates your Generator’s node identity with its operator and records the connection details required for network participation.

## Register Your Generator

**Step 1: Check Generator connectivity**

Confirm that your Generator is running and its health endpoint is reachable:

```bash
curl http://<your-server-ip>:8080/health
```

The default Docker command in [Install & Configure](../install) publishes port `8080`. If your Generator runs behind a firewall, allow the required inbound traffic. The public Generators dashboard also uses this endpoint to determine whether your node appears online.

**Step 2: Add Shinzo Testnet to your wallet**

Configure your browser wallet with the following network details:

| Setting | Value |
| --- | --- |
| Network name | `Shinzo` |
| RPC URL | `http://testnet.shinzo.network:8545` |
| Chain ID | `91273001` |
| Currency symbol | `SHNZ` |

Get testnet SHNZ from the [faucet](https://faucet.shinzo.network/) to cover the registration transaction fee.

**Step 3: Open the Technical Registry**

Open the [Shinzo Technical Registry](https://registration.shinzo.network/) and connect your browser wallet.

{% <admonition type="info"> %}
The Technical Registry is hosted at [registration.shinzo.network](https://registration.shinzo.network/). If your node is on a private network or you'd rather use the registration app bundled with the Generator client, it's also served locally at `http://localhost:8080/registration-app`. For a remote node, use SSH local port forwarding to reach it: run `ssh -L 8080:localhost:8080 user@your-node-ip` on your local machine, then open `http://localhost:8080/registration-app` in your browser.
{% </admonition> %}

Select **Register as Generator** to begin registration.

**Step 4: Complete the validator assertion**

Select **BSC Mainnet** as the source chain and provide the BSC validator information requested by the Registry.

The assertion associates the Generator operator with a validator identity. On the current testnet, assertions use an administrative approval flow; automated on-chain validator verification is not yet active. Follow the fields and prompts displayed in the Registry, then select **Sign & Submit**.

{% <admonition type="warning"> %}
Do not use Ethereum validator withdrawal credentials or Ethereum consensus public keys for a BSC registration. BSC validator identification is chain-specific.
{% </admonition> %}

**Step 5: Register on ShinzoHub**

Complete the registration form using the information produced by the assertion and your running Generator, including its node public key, ownership signature, connection string, and **BSC Mainnet** as the source chain.

Select **Register** and confirm the transaction in your browser wallet. Wait for the transaction to be confirmed on ShinzoHub.

## Confirm Your Registration

Return to the Technical Registry homepage and locate your Generator in the **Registered Generators** table. Check that the displayed source chain, node identity, connection string and status match your deployment.

If the Generator appears offline, verify that it is running and that the public health endpoint on port `8080` is reachable.

## Back Up Your Node Identity

Your Generator's DefraDB identity key identifies the node on the Shinzo network. Back up the identity and preserve its associated data and keyring configuration before replacing or migrating the deployment.

- Back up the identity key from the Generator's persistent DefraDB data directory. The BSC configuration uses `.defra-bsc/` for storage.
- Restore the key to its original location and preserve the required file ownership and permissions.
- Keep `DEFRADB_KEYRING_SECRET` unchanged across restarts, upgrades, and restores.

{% <admonition type="warning"> %}
If you lose the identity key without a backup, you cannot restore the Generator with the same node identity. Changing the keyring secret can also prevent the client from loading its existing identity.
{% </admonition> %}

## Need Help

{{<need_help client="Generator" repo_name="shinzo-generator-client" repo="https://github.com/shinzonetwork/shinzo-generator-client/issues" />}}
