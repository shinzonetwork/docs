+++
title = "Register"
aliases = ["/generator/register"]
weight = 30
+++

To participate in the Shinzo Network, you must register your node in the **Technical Registry**. Registration identifies and authenticates your node so it can replicate data and earn rewards. Without this step, your node will not be recognized by the network. To register, follow the steps below.

{% admonition(type="info") %}
If you are registering as a **Generator**, registration requires an [assertion](/reference/components/outpost#validator-assertions) step to verify your generator's identity before it is registered on-chain. Assertions require your **consensus public key** for the source chain your generator monitors. See [Consensus public key](/reference/components/outpost#consensus-public-key) for what that is and how to retrieve it.
{% end %}

1. Start your Generator Client.
1. Add the Shinzo Testnet to your browser wallet with the following values:
   - Network name: `Shinzo`
   - Default RPC URL: `http://testnet.shinzo.network:8545`
   - Chain ID: `91273001`
   - Currency symbol: `SHNZ`
1. Go to the [Technical Registry](http://localhost:8080/registration-app) and connect your wallet using the button in the top-right corner.

    {% admonition(type="info") %}
    If your node is running on a remote server (like Hetzner, DigitalOcean, GCP, AWS, etc), you can use SSH local port forwarding to access the registration page.

1. On your local machine, run `ssh -L 8080:localhost:8080 user@your-hetzner-ip`.
1. Open `http://localhost:8080/registration-app` in your browser.
    {% end %}

1. From the Technical Registry homepage, click **Register as Generator** to start the two-step registration flow.

### Step 1: Assertion

The Assertion step verifies ownership of your generator identity.
Provide:

- **Consensus Public Key**: The consensus public key of your generator node.
- **Source Chain**: The blockchain your generator node monitors (e.g. Ethereum).

Click **Sign & Submit** to sign a message with your wallet, proving ownership of the generator's identity.

### Step 2: Registration (register on-chain)

The Registration step records your generator on-chain.
Provide:

- **Signed message**: The signed payload generated during the Assertion step.
- **Public key**: The public key that identifies your generator node.
- **Signed public key message**: A signature proving ownership of the public key.
- **Connection string**: The endpoint operators and hosts will use to connect to your generator node.
- **Source chain**: Confirm the chain your generator node is monitoring.

After completing all required fields, click Register and confirm the transaction in your wallet. Once the transaction is confirmed, your generator is successfully registered on-chain.

## Confirm your registration

Return to the Technical Registry homepage. Your generator should now appear in the **Registered Generators** table, along with its Address, DID, Chain, Connection String and Status.

Your Generator is now registered and authorized to participate in the Shinzo Network.

## Backup your node identity key

This key defines your node's identity on the network. Persisting it ensures your node can be restored without losing identity.

- Store a secure backup of the key.
- In a recovery scenario, place it back into the same path (e.g. `/defra/keys`).
- Use the same keyring/secret configuration.

{% admonition(type="warning") %}
If this key is lost, and there is no backup available, you will be unable to restore your node with the same identity.
{% end %}

## Need Help

{{ need_help(client="Generator", repo_name="shinzo-generator-client", repo="https://github.com/shinzonetwork/shinzo-generator-client/issues") }}
