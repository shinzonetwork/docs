+++
title = "Register"
weight = 3
+++

To participate in the Shinzo Network, you must register your Indexer. Registration identifies and authenticates your node so it can replicate data and earn rewards. Without this step, your Indexer will not be recognized by the network. To register in ShinzoHub, follow the steps below.

{% admonition(type="info") %}
If you are a validator on a source chain, registration may also prompt you to submit an [assertion](/reference/components/outpost#validator-assertions). Assertions require your **consensus public key** for the chain you validate on. See [Consensus public key](/reference/components/outpost#consensus-public-key) for what that is and how to retrieve it.
{% end %}


1. Start your Indexer.
1. Add the Shinzo Devnet to your browser wallet with the following values:
   - Network name: `Shinzo`
   - Default RPC URL: `http://rpc.devnet.shinzo.network:8545`
   - Chain ID: `91273002`
   - Currency symbol: `SHNZ`
1. Go to [localhost:8080](http://localhost:8080/registration-app) and select **Connect** to connect your wallet.

{% admonition(type="info") %}
If your Indexer is running on a remote server (like Hetzner, DigialOcean, GCP, AWS, etc), you can use SSH local port forwarding to access the registration page.

1. On your local machine, run `ssh -L 8080:localhost:8080 user@your-hetzner-ip`.
1. Open `http://localhost:8080/registration-app` in your browser.
{% end %}

1. Share your wallet address in the [Shinzo Discord](https://discord.com/channels/1444411399882408011/1444411402239344802) channel to request allowlisting as an Indexer.

It may take ~24 hours for your address to be added to the allowlist. Once your address has been added:

1. Return to the [registration page](http://localhost:8080/registration-app), click **Register**, and select **Indexer** as your role.
1. Submit your registration and then confirm the transaction in your browser wallet. You should see a successful registration notification.

Your Indexer is now registered and authorized to participate in the Shinzo Network.

## Backup your node identity key

This key defines your Indexer’s identity on the network. Persisting it ensures your node can be restored without losing identity.

- Store a secure backup of the key.
- In a recovery scenario, place it back into the same path (e.g. `/defra/keys`).
- Use the same keyring/secret configuration.

{% admonition(type="warning") %}
If this key is lost, and there is no backup available, you will be unable to restore your Indexer with the same identity.
{% end %}
