+++
title = "Register"
aliases = ["/generator/register", "/generators/register"]
+++

To participate in the Shinzo Network, you must register your node. Registration identifies and authenticates your node so it can replicate data for the network.

## Prerequisites

Running the Generator client only requires an execution node (see [Install](../install)). To register a Generator client, however, you must be an active, bonded chain validator. Registration includes an [assertion](/reference/components/outpost#validator-assertions) step that ties your generator's operator key to your validator identity. If you are not a validator, you can still run the client, but your node will not be recognized by the network.

Before you start, have the following ready:

1. **An active, bonded chain validator.** On the current testnet, the assertion is approved through an admin-key flow rather than an on-chain contract check. The planned outpost contract will verify validator status on-chain once deployed.
1. **Your validator's consensus public key.** The key type, format, and lookup tooling are chain-specific. See [Consensus public key](/reference/components/outpost#consensus-public-key) for how to retrieve it on your chain. It is not your withdrawal address or an EVM address.
1. **Your validator's withdrawal address.** This is included in the assertion to identify your validator. On the current testnet you only need the address itself (the assertion is admin-key-approved). The planned contract-based flow will require the withdrawal key to sign the assertion. See [Validator assertions](/reference/components/outpost#validator-assertions) for the full flow.
1. **A browser wallet** to sign the on-chain registration transaction.

## Register your Generator

1. Start your Generator Client.
1. Add the Shinzo Testnet to your browser wallet with the following values:
   - Network name: `Shinzo`
   - Default RPC URL: `http://testnet.shinzo.network:8545`
   - Chain ID: `91273001`
   - Currency symbol: `SHNZ`

   You need a small amount of SHNZ to cover the registration transaction fee. Get testnet SHNZ from the [faucet](https://faucet.shinzo.network/).
1. Open the [Technical Registry](https://registration.shinzo.network/) and connect your wallet using the button in the top-right corner.

    {% admonition(type="info") %}
    The Technical Registry is hosted at [registration.shinzo.network](https://registration.shinzo.network/). If your node is on a private network or you'd rather use the registration app bundled with the Generator client, it's also served locally at `http://localhost:8080/registration-app`. For a remote node, use SSH local port forwarding to reach it: run `ssh -L 8080:localhost:8080 user@your-node-ip` on your local machine, then open `http://localhost:8080/registration-app` in your browser.
    {% end %}

1. From the Technical Registry homepage, click **Register as Generator** to start the two-step registration flow.

### Assertion

The Assertion step ties your validator identity to your generator's operator key so ShinzoHub knows who you are. You'll need to provide:

- **Consensus public key**: The consensus public key of the validator you're registering (see [Consensus public key](/reference/components/outpost#consensus-public-key)).
- **Withdrawal address**: The withdrawal address for your validator on the source chain.
- **Source chain**: The blockchain your generator monitors (see [shinzo.network/chains](https://shinzo.network/chains) for supported chains).

On the current testnet, the assertion goes through an admin-key approval flow rather than a smart contract. Your connected wallet address gets recorded as the generator's operator and payout address. The withdrawal-key signature and on-chain validator-status check described in [Validator assertions](/reference/components/outpost#validator-assertions) are part of the planned contract-based flow and aren't live on testnet yet.

Click **Sign & Submit** to submit the assertion.

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

## Need help

{{ need_help(client="Generator", repo_name="shinzo-generator-client", repo="https://github.com/shinzonetwork/shinzo-generator-client/issues") }}
