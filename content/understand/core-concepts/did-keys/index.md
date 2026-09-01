+++
title = "DID keys"
description = "What a DID key is, how Shinzo uses it for node identity, and how it differs from the other keys a node holds."
+++

Every Shinzo Host and Generator has an identity. That identity is a DID key, a string that looks like this:

```plaintext
did:key:zQ3shND2BaSKQLTBTPrvGa5i3EdVnnAFzfJ8oLXa9aG8zWY1B
```

You'll see these strings in config output, in SourceHub authorization tuples, and stamped onto every document a node signs. This page covers what they are, why Shinzo uses them, and what they're not.

## What a DID key is

A DID key is an identifier built directly from a cryptographic public key. The key pair is generated first; the public half is then encoded into a self-describing string that anyone can read back into the same public key without asking a server, a registry, or a blockchain.

The format is a W3C standard called `did:key`. Breaking the example apart:

```plaintext
did:key:zQ3shND2BaSKQLTBTPrvGa5i3EdVnnAFzfJ8oLXa9aG8zWY1B
       └─ multibase-encoded public key
```

The `did:key:` prefix says "what follows is a public key encoded in a particular way." After it comes a [multibase](https://github.com/multiformats/multibase) string. The leading `z` means base58btc encoding. Decode those bytes and you get two things glued together:

1. A short multicodec prefix that names the key type.
1. The raw public key bytes for that type.

For the `zQ3s...` identifiers Shinzo uses, the prefix is `0xe7 0x01`, the multicodec code for a secp256k1 public key, followed by 33 bytes of compressed key. So the whole identifier is just `multibase(multicodec(secp256k1-pub) + 33 compressed bytes)`. The `z6Mk...` form you'll meet in `did:key` examples elsewhere is the same idea with the multicodec prefix for an Ed25519 key.

A DID key is a single public key wearing a standard, self-describing wrapper. That's the whole thing.

## Why it's useful

The payoff is that the identifier and the verification key are the same object. A verifier who has the DID string has everything they need to check a signature. There's no second step where they look up a document on a network, fetch a key from a registry, or trust a third party to tell them which key belongs to which identity.

This matters for Shinzo because nodes sign data constantly. Every block a Generator produces carries a `BlockSignature`, a signature over a Merkle root of the block's document CIDs, and each document gets a `_version` entry recording who signed it. A Host that receives that data, or an app reading it later, can verify those signatures with nothing more than the signer's public key — the same key the DID encodes — without a round-trip to an identity service.

It also means the identifier is portable and stable. The same key produces the same DID everywhere, so a node's identity follows it across restarts, networks, and deployments as long as the key material survives.

## Why Shinzo uses it instead of other key types

A node holds several keys, and they do different jobs. DID keys are the identity layer; the others are not.

| Key | Job | Why it's not the identity |
| --- | --- | --- |
| Node identity key (DID key) | Signs documents, registers the node, is the node's name on the network | This _is_ the identity. |
| Consensus key | Validator duties on the source chain | Tied to consensus slots, not to Shinzo document signing. |
| Operator / withdrawal keys | Acting on a validator's behalf on ShinzoHub; controlling stake withdrawals | About the source-chain validator role and its funds, not about who produced a document. |

You could imagine identifying nodes by their consensus address or their wallet address instead. Neither works well here. A consensus address describes a validator's role on one chain, but a Shinzo node can read from many chains and shouldn't be pinned to one validator identity. A wallet address is for moving value and changes for unrelated reasons (rotation, sweeping funds). Document signing needs an identifier that is cheap to verify, tied to the signing key itself, and not overloaded with a second meaning.

`did:key` gives you exactly that. It's a pure signing identity: one key, one identifier, verifiable offline, with no dependency on the chain the node reads from.

## What a DID key is not

It's worth being clear about the edges, because the name invites a few wrong assumptions.

### It's not a wallet address

A DID key can sign data, but it isn't an account you send tokens to and it has nothing to do with balances. ShinzoHub uses separate bech32 addresses (`shinzo1...`) for anything value-related.

### It's not stored on a blockchain

Some DID methods publish a DID document to a ledger or registry that can be updated over time. `did:key` doesn't. The DID document is derived from the key on demand, so there's nothing on chain to resolve and nothing to update. The trade-off is in the next section.

### It's not rotatable

Because the identifier _is_ the key, changing the key changes the identity. If a node's key is lost or compromised, you can't swap in a new key and keep the same DID. You get a new DID, which is a new identity. This is why backing up the keyring secret matters: the key, the keyring, and the DID are one unit. Lose the key and the identity is gone. See the backup guidance on the [Generator](/run/run-a-generator/register/#back-up-your-node-identity-key) and [Host](/run/run-a-host/register/#back-up-your-node-identity-key) registration pages.

### It's not encryption

The key in a DID key is for signing and verification, not for encrypting data. Confusing the two is how private keys leak.

## How Shinzo generates and uses one

When a Host or Generator starts for the first time, it generates a secp256k1 key pair and stores it in the DefraDB keyring, encrypted with the keyring secret you provide (`DEFRA_KEYRING_SECRET` for the Host client, `DEFRADB_KEYRING_SECRET` for the Generator client). On every later startup it loads that same identity back out of the keyring — in the Generator client, via `GetIdentityContext()`. The public key becomes the node's `did:key` identifier; the private key stays on the node, and only the public key and signatures ever leave it.

That DID then shows up in three places:

- Every document a Generator writes carries a `_version` signature with the signer's identity.
- Each `BlockSignature` is the Generator's identity key signing a Merkle root over the block.
- Registration and access control on SourceHub use ACP tuples like `group:host#guest@did:key:zQ3s...`, where the DID is the subject being granted a relation.
