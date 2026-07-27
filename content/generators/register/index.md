+++
title = "Register"
aliases = ["/generator/register"]
+++

To participate in the Shinzo Network, you must register your node. Registration identifies and authenticates your node so it can replicate data for the network.

## Prerequisites

Running the Generator client only requires an Ethereum execution node (see [Install](../install)). The register a Generator client, however, you must be an active, bonded chain validator. Registration includes an [assertion](/reference/components/outpost#validator-assertions) step in which you prove control of a validator on your source chain. If you are not a validator, you can still run the client, but your node will not be recognized by the network.

Before you start, have the following ready:

1. **An active, bonded chain validator.** The outpost checks that the validator named in your assertion is active and bonded on the source chain.
1. **Your validator's consensus public key.** This is your validator's 48-byte BLS12-381 public key, formatted as a `0x`-prefixed 96-character hex string, used to sign beacon-chain attestations. It is not your withdrawal address or an EVM address. See [Consensus public key](/reference/components/outpost#consensus-public-key) for how to retrieve it.
1. **Access to your validator's withdrawal key.** The assertion is signed with the withdrawal key to prove control of the validator's stake, and the withdrawal address is included in the assertion. See [Validator assertions](/reference/components/outpost#validator-assertions) for the full flow.
1. **A browser wallet** to sign the on-chain registration transaction.

## Register your Generator

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

4. From the Technical Registry homepage, click **Register as Generator** to start the two-step registration flow.

### Assertion

The Assertion step verifies that you control the validator you are registering as a Generator. You'll need to provide:

- **Consensus public key**: The consensus public key of the validator you are registering (see [Consensus public key](/reference/components/outpost#consensus-public-key)).
- **Source chain**: The blockchain your generator monitors (e.g. Ethereum, Bitcoin, etc).

The assertion is authorized by your validator's withdrawal key, which proves control of the validator's stake. See [Validator assertions](/reference/components/outpost#validator-assertions) for how this works end to end.

Click **Sign & Submit** to sign a message with your wallet, proving ownership of the generator's identity.

### Registration (register on-chain)

The Registration step records your generator on-chain. You'll need to provide:

- **Signed message**: The signed payload generated during the Assertion step.
- **Public key**: The public key that identifies your generator node.
- **Signed public key message**: A signature proving ownership of the public key.
- **Connection string**: The endpoint operators and hosts will use to connect to your generator node.
- **Source chain**: Confirm the chain your generator node is monitoring.

After completing all required fields, click **Register** and confirm the transaction in your wallet. Once the transaction is confirmed, your generator is registered on-chain.

## Confirm your registration

Return to the Registry homepage. Your generator should now appear in the **Registered Generators** table, along with its address, DID, chain, connection string and status. Your Generator is now registered and authorized to participate in the Shinzo Network.

## Back up your node identity key

This key defines your node's identity on the network. Back it up so you can restore your node without losing its identity.

- Store a secure backup of the key.
- In a recovery scenario, place it back into the same path (e.g. `/defra/keys`).
- Use the same keyring/secret configuration.

{% admonition(type="warning") %}
If this key is lost, and there is no backup available, you will be unable to restore your node with the same identity.
{% end %}

## Need Help

{{ need_help(client="Generator", repo_name="shinzo-generator-client", repo="https://github.com/shinzonetwork/shinzo-generator-client/issues") }}
