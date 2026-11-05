+++
title = "Key & identity management"
description = "Managing node identity keys across restarts, backups, and recovery."
+++

Every Host and Generator client generates its node identity the first time it runs. What that identity is made of differs between the two clients:

- **Host client:** a 12-word seed phrase. The client derives three keys from it: an operator key (used for on-chain registration, shown as a `shinzo1...` address), an identity key (the node's DefraDB identity, a `did:key`), and a peer key seed (the node's libp2p peer ID).
- **Generator client:** a single identity key, held in an encrypted keyring. The public half is the node's `did:key` identifier, and the libp2p peer ID is derived from the same key.

[DID keys](/understand/core-concepts/did-keys/) covers what that identifier is; this page covers the operational side: where the keys live, how to back them up, and what happens when they're lost.

## Where the keys live

### Host client

The keys live in a single file, `node.key`, in a `keys/` directory under the client's home directory:

- **Build from source:** `~/.shinzo/host/keys/node.key` by default. The home directory defaults to `~/.shinzo/host`; pass `--home` to `host init` and `host start` to use a different one. The keys directory is always `<home>/keys`.
- **Containers:** point `--home` at a mounted volume (for example `host init --home /data/shinzo-host`) so that `node.key` lands on the mount.

The file stores the raw keys as plain hex. It isn't encrypted yet (encryption at rest is planned), so treat it like a password. The client creates it readable only by your own user; keep it that way.

There is no keyring secret to manage for the Host client.

### Generator client

The identity key lives in an encrypted keyring, in a `keys/` directory beside the DefraDB store directory:

- **Build from source:** `./keys` with the default store path `./.defra`.
- **Docker:** `/app/keys` in the container. Mount it separately from the store's volume, for example `-v ~/shinzo-data/keys:/app/keys`.

The keyring is encrypted with a secret you supply at startup: the `DEFRADB_KEYRING_SECRET` environment variable, or `defradb.keyring_secret` in `config.yaml`.

Older Generator releases kept the keyring inside the store (at `.defra/keys`), or as a plaintext `defra_identity.key` in the store directory. On first start the client migrates either layout to the `keys/` directory beside the store automatically. Two things to know before upgrading:

- If you mount only the store directory into the container, add the `/app/keys` mount first, or the migrated keys live only inside the container.
- If different keys exist in both the old and new locations, the client refuses to start with a "conflicting node identity keys" error. Remove one of the copies and start again.

Whichever client you run: with no volume mount, the keys exist only inside the container and are lost when the container is removed. Mount a volume before you rely on a node keeping its identity.

## The Generator client's keyring secret is part of its identity

For the Generator client, the node's identity depends on both the keyring files and the keyring secret. Keep the secret stable across restarts: if it changes, the client can't open the keyring and fails to start. A backup of the key files alone is not enough to recover an identity, so back up the secret along with them. The Host client has no equivalent secret.

Because each client's peer ID is derived from its key material, it stays stable across restarts as long as the same keys load, so peers and dashboards keep seeing the same node.

## Back up your keys

### Host client

The seed phrase is the primary backup. `host init` prints it exactly once, when the keys are first generated, and it is never written to disk or shown again. All three keys are derived from the phrase, so the phrase alone restores the whole node.

You can also back up the key files directly:

```shell
cp -r ~/.shinzo/host/keys /mnt/backup-drive/
```

Adjust the source path if you set `--home` or run in a container.

### Generator client

Copy the keys directory somewhere safe, and record the keyring secret with it. You need both:

```shell
cp -r ./keys /mnt/backup-drive/
```

For Docker, back up the host directory you mount to `/app/keys`.

## Recover a node

### Host client

To recover from the seed phrase, into a fresh home directory:

1. Save the phrase in a file, for example `seed-phrase.txt`.
1. Run `host init` with the recovery flag, then start the client:

    ```shell
    host init --recover-file ./seed-phrase.txt
    host start
    ```

The phrase is validated before anything is written to disk, and `init` refuses to recover over keys that already exist. Use a home directory that doesn't have keys yet.

You can also restore a backed-up `keys/` directory to `<home>/keys` and run `host start`.

Either way, the node comes back with the same operator address, the same `did:key` identity, the same peer ID, and its existing registration. Recovery works only from a seed phrase created by `host init`: identities created by earlier Host client versions didn't have one and can't be imported.

### Generator client

1. Restore the keys directory to its location beside the store: `./keys` for a source build, or the host directory you mount to `/app/keys`.
1. Start the client with the same keyring secret as before.

The node comes back with the same identity, the same peer ID, and its existing registration.

## If the keys are lost

- **Host client:** with the seed phrase, nothing is lost; recover as above. Without the phrase and without a backup of the key files, the identity is permanently gone.
- **Generator client:** without a backup of the keyring and its secret, the identity is permanently gone. There is no seed-phrase recovery.

Either way, the recovery from a total loss is the same: spin up a new client instance, which generates a fresh identity, and register again. The new node may use the same wallet address, but the network treats it as a new identity.

{% <admonition type="warning"> %}
Back up before you need to. For a Host client, that's the seed phrase (or the `keys/` directory). For a Generator client, it's the `keys/` directory plus the keyring secret.
{% </admonition> %}

## This is not your wallet

The node's keys are not a wallet, and they aren't the wallet you connect in the registration app. That wallet pays the registration transaction fee, and for Generators it's recorded as the operator and payout address. The Host client's operator address (`shinzo1...`) identifies the node on-chain, but it isn't an account you manage in a wallet app. The two are unrelated: losing one doesn't affect the other.
