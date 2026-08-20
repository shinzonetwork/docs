+++
title = "Assert ownership of a validator"
description = "Assert validator ownership before registering as a Generator. Covers the assertion flow, the keys involved, and rotating them."
aliases = ["/generator/assert", "/generators/assert", "/generator/assertion", "/generators/assertion"]
[extra]
mermaid = true
+++

Before a Generator can register on ShinzoHub, its operator has to prove they control a validator on the source chain. That proof is the assertion. It happens once, on the source chain, and it is what lets ShinzoHub trust that the Generator client belongs to a real validator.

This page walks through the user-facing flow in the Technical Registry. For the on-chain mechanism, how the outpost verifies the validator, and the exact fields that go into the signed digest, see [Validator assertions](/reference/components/outpost#validator-assertions).

## Prerequisites

Have the following ready before you start. They are the same as the registration prerequisites, restated here because the assertion depends on them.

1. **An active, bonded chain validator.** The outpost checks that the validator named in the assertion is active and bonded on the source chain. If you are not a validator, you can still run the client, but you cannot assert or register.
1. **Your validator's consensus public key.** This names the validator being asserted. The key type, format, and lookup tooling are chain-specific; see [Consensus public key](/reference/components/outpost#consensus-public-key) for how to retrieve it on your chain. It is not your withdrawal address or an EVM address.
1. **Access to your validator's withdrawal key.** The assertion is signed with the withdrawal key to prove control of the validator's stake, and the withdrawal address is included in the assertion. See [Validator assertions](/reference/components/outpost#validator-assertions) for the full flow.
1. **A browser wallet** to sign the assertion message.

## The keys involved

Three keys appear in the assertion, and keeping their roles straight avoids most of the confusion around this step.

- **Operator (delegate) key.** The account the Generator uses for ShinzoHub operations. Authority over the validator is delegated _to_ this key. It is generated or imported when the Generator client starts, and it does not change unless you rotate it or move machines.
- **Withdrawal key.** Signs the assertion. Proving control of the withdrawal key is how the outpost confirms you control the validator's stake.
- **Consensus public key.** Names the validator. It is read from the assertion so the outpost knows which validator to check, then verified against the source chain's staking state. It does not sign anything here.

The consensus public key and the withdrawal key are different things, even though both relate to the same validator. The consensus key identifies the validator on the consensus layer; the withdrawal key controls where its rewards and stake go.

## Assertion flow

You complete the assertion in the Technical Registry at [registration.shinzo.network](https://registration.shinzo.network/), the same app used for registration. If your node is on a private network or you would rather use the registration app bundled with the Generator client, it is also served locally at `http://localhost:8080/registration-app`. For a remote node, reach it over SSH local port forwarding: run `ssh -L 8080:localhost:8080 user@your-node-ip` on your local machine, then open `http://localhost:8080/registration-app` in your browser.

1. Start your Generator client.
1. Add the Shinzo Testnet to your browser wallet with the following values:
   - Network name: `Shinzo`
   - Default RPC URL: `http://testnet.shinzo.network:8545`
   - Chain ID: `91273001`
   - Currency symbol: `SHNZ`

   You need a small amount of SHNZ to cover the on-chain transaction. Get testnet SHNZ from the [faucet](https://faucet.shinzo.network/).
1. Open the [Technical Registry](https://registration.shinzo.network/) and connect your wallet using the button in the top-right corner.
1. From the homepage, click **Register as Generator** to start the two-step flow. The first step is the assertion.
1. In the assertion step, provide:
   - **Consensus public key**: the consensus public key of the validator you are registering (see [Consensus public key](/reference/components/outpost#consensus-public-key)).
   - **Source chain**: the blockchain your Generator monitors (see [shinzo.network/chains](https://shinzo.network/chains) for supported chains).
1. Click **Sign & Submit** to sign the assertion digest with your withdrawal key.

What happens next, on-chain, is what makes the assertion trustworthy. The outpost contract verifies that the signing key controls the validator and that the validator is active and bonded, stores the signed assertion, and emits an `AssertionSigned` event. A relayer picks up the event and forwards the assertion to ShinzoHub, which verifies it again and records an authorization slip for the operator key. At that point the operator key is cleared to register a Generator client.

{% mermaid() %}
sequenceDiagram
  participant U as You<br/>(withdrawal key)
  participant R as Technical Registry
  participant O as Outpost contract<br/>on source chain
  participant L as Relayer
  participant H as ShinzoHub

  U->>R: provide consensus pubkey<br/>+ source chain
  R->>O: open assertion,<br/>request digest
  O-->>R: assertion ID + EIP-712 digest
  U->>R: Sign & Submit<br/>(withdrawal key)
  R->>O: submitAssertionSignature
  O->>O: verify withdrawal key<br/>controls validator
  O-->>L: emit AssertionSigned
  L->>H: MsgGeneratorAssertion
  H->>H: verify assertion,<br/>record operator-key slip
{% end %}

The diagram shows the EVM path. Other chain types use a different verification mechanism, but the shape is the same: prove control of the validator on its own chain, relay the result to ShinzoHub. See [Validator assertions](/reference/components/outpost#validator-assertions) for the per-chain detail.

## After the assertion

With the operator key authorized, the assertion step is done. Move on to registration, which records the Generator on-chain. See [Register](../register/) for the on-chain registration step and how to confirm it succeeded.

The assertion step is a one-time action per machine. You only repeat it when the validator key changes (see below) or you rotate the operator key.

## Key rotation

If you move machines or rotate the operator key, the assertion and registration have to be redone. The old operator and withdrawal authorizations are revoked, and the new key pair is bound back to the validator on-chain when the new assertion is submitted.

1. Generate or import the new operator key on the new machine.
1. If the validator's withdrawal key or consensus key has changed, complete a new assertion with the new validator details.
1. Re-submit the Generator registration request using the new operator key (see [Register](../register/)).

The window between shutdown and re-registration is a gap in submissions. It does not affect the integrity of data the Generator already produced. During the downtime no one else can submit or spoof your operator key, because it is tied to the private key in your environment, and no one else can assert your validator, because that requires the withdrawal key.

If the operator key is lost with no backup, you will be unable to re-register the same identity until you complete a new assertion from the validator's withdrawal key. Back up the operator key the same way you back up your node identity key.

{% admonition(type="info") %}
This covers the operator and validator assertion keys only. General node identity key management, including backups and restores, is tracked separately and will live on the [Key and identity management](/run/operations/key-and-identity-management/) page.
{% end %}
