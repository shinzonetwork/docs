+++
title = "Key & identity management"
description = "Where the node identity keys live, and how to back them up and recover them."
+++

Every Generator and Host client generates a node identity the first time it runs. The identity is a DefraDB signing key held in an encrypted keyring. The public half is the node's `did:key` identifier, and the libp2p peer ID is derived from the same key, so peers and dashboards keep seeing the same node as long as the key survives restarts.

[DID keys](/understand/core-concepts/did-keys/) explains what that identifier is. This page covers the operational side: where the keys live, and how to back them up and recover them.

## Where the keys live

Both clients store the identity as a keyring entry named `node-identity-key`, in an encrypted file keyring under a `keys/` directory. Where that directory sits differs between the clients.

### Host client

The keyring lives inside the DefraDB store, at `.defra/keys`:

- Build from source: `.defra/keys` under the directory you start the client from, so `~/.defra/keys` when that's your home directory.
- Docker: `/app/.defra/keys` in the container. The install guides mount a host directory over it, for example `-v ~/data/keys:/app/.defra/keys`.

The keyring is encrypted with the `defradb.keyring_secret` from your `config.yaml`.

### Generator client

The keyring lives in a `keys/` directory beside the DefraDB store, not inside it, so wiping or restoring the store can't take the identity with it:

- Build from source: `./keys`, next to the default store path `./.defra`.
- Docker: `/app/keys` in the container. It needs its own volume mount, separate from the store's, for example `-v ~/shinzo-data/keys:/app/keys`.

The keyring is encrypted with a secret you supply: the `DEFRADB_KEYRING_SECRET` environment variable, or `defradb.keyring_secret` in your `config.yaml`.

Older Generator releases kept the keyring inside the store at `.defra/keys`, or stored the identity as a plaintext `defra_identity.key` in the store directory. On first start the client migrates both layouts to the `keys/` directory beside the store, and leaves the originals in place. Two things to check when upgrading:

- If you only mount the store directory into the container, add the `/app/keys` mount first, or the migrated keys exist only inside the container.
- If a `node-identity-key` exists in both the old and the new location with different contents, the client refuses to start with a `conflicting node identity keys` error. Remove one copy and start again.

Whichever client you run: with no volume mount, the keys exist only inside the container and are lost when the container is removed. Mount a volume before you rely on a node keeping its identity.

## The keyring secret is part of the identity

The identity depends on both the keyring files and the keyring secret. Keep the secret stable across restarts: if it changes, the client can't decrypt the keyring and fails to start. A backup of the key files alone is not enough to recover an identity, so record the secret alongside them.

## Back up your keys

Copy the keys directory somewhere safe, and record the keyring secret with it.

Build from source:

```shell
cp -r ~/.defra/keys /mnt/backup-drive/   # Host client
cp -r ./keys /mnt/backup-drive/          # Generator client
```

For Docker, back up the host directories you mount into the container: the one mounted to `/app/.defra/keys` for the Host client, and the one mounted to `/app/keys` for the Generator client.

## Recover a node

1. Restore the keys directory to where the client reads it: `~/.defra/keys` for a Host built from source, `./keys` beside the store for a Generator built from source, or the host directories you mount into the containers.
1. Start the client with the same keyring secret as before.

The node comes back with the same `did:key` identity, the same peer ID, and its existing registration. There is no other recovery path: the published images have no seed phrase and no export command.

## If the keys are lost

Without a backup of the keyring and its secret, the identity is permanently gone. The key cannot be regenerated. The way back is always the same:

1. Spin up a new client instance, which generates a fresh identity.
1. Register again.

The new node may use the same wallet address, but the network treats it as a new identity.

{% <admonition type="warning"> %}
Back up before you need to. For either client, that means the `keys/` directory plus the keyring secret.
{% </admonition> %}

## Seed-phrase recovery is on the way

The Host client has a new CLI in development that builds the node identity from a 12-word seed phrase. The phrase is printed once when the keys are first created, and the whole node can be recovered from it. It is not in the published images yet, so until it ships, the keyring steps on this page are what the clients use.

## This is not your wallet

The node's keys are not a wallet, and they aren't the wallet you connect in the registration app. That wallet pays the registration transaction fee, and for Generators it's recorded as the operator and payout address. The two are unrelated: losing one doesn't affect the other.
