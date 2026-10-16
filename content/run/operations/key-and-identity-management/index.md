+++
title = "Key & identity management"
description = "Managing node identity keys across restarts, backups, and recovery."
+++

Every Host and Generator has a node identity key: a secp256k1 key pair the client generates the first time it starts. The public half becomes the node's `did:key` identifier; the private half stays on the node, and only the public key and signatures ever leave it. [DID keys](/understand/core-concepts/did-keys/) covers what that identifier is; this page covers the operational side: where the key lives, how to back it up, and what happens when it's lost.

## Where the key lives

The identity key is stored in the DefraDB keyring, encrypted with a keyring secret you supply at startup:

- Host client: the `DEFRA_KEYRING_SECRET` environment variable (or `defradb.keyring_secret` in `config.yaml`).
- Generator client: the `DEFRADB_KEYRING_SECRET` environment variable (or the same config field).

Where the keyring sits on disk depends on how you run the client:

- **Build from source:** `~/.defra/keys` by default.
- **Docker with persistence:** the host directory you mounted to `/app/.defra/keys` (for example `~/data/keys`).
- **Docker without volume mounts:** the key exists only inside the container and is lost when the container is removed. Mount a volume before you rely on a node keeping its identity.

## The keyring secret is part of the identity

Your node's identity depends on both the key files and the keyring secret. Keep the secret stable across restarts: if it changes, the client can't decrypt the keyring and fails to start with `Failed to load existing DefraDB identity`. A backup of the key files alone is not enough to recover an identity, so back up the secret along with them.

Because the libp2p peer ID is derived from the identity key, it stays stable across restarts as long as the identity loads, so peers and dashboards keep seeing the same node.

## Back up your keys

Copy the keys directory somewhere safe:

```shell
cp -r ~/.defra/keys /mnt/backup-drive/   # adjust the source path to match your setup
```

## Recover a node

1. Restore the keys directory to the same path the client reads from: `~/.defra/keys` for a source build, or the directory you mount to `/app/.defra/keys` for Docker.
1. Start the client with the same keyring secret as before.

The node comes back with the same identity, the same peer ID, and its existing registration.

## If the key is lost

A lost identity key cannot be regenerated. With no backup:

- The node's identity is permanently gone.
- You must spin up a new client instance, which generates a fresh identity.
- You must register again with the new identity. The new node may use the same wallet address, but the network treats it as a new identity.

{% admonition(type="warning") %}
There is no recovery path for a lost identity key. If you run a registered node, back up the keys directory and the keyring secret before you need them.
{% end %}

## This is not your wallet

The node identity key is not a wallet. It holds no funds, and it isn't the wallet you connect in the registration app. That wallet pays the registration transaction fee, and for Generators it's recorded as the operator and payout address. The two are unrelated: losing one doesn't affect the other.
