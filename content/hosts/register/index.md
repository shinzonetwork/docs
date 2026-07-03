+++
title = "Register"
weight = 4
+++

To participate in the Shinzo Network and make your view publically available, you need to register your Host.

## Use the GUI

1. Start your Host with the health/registration port published (`-p 8080:8080`). The registration app is served on port `8080`, and the default command in [Install](/hosts/install) does not publish it.
1. Add the Shinzo Devnet to your browser wallet with the following values:
   - Network name: `Shinzo`
   - Default RPC URL: `http://rpc.devnet.shinzo.network:8545`
   - Chain ID: `91273002`
   - Currency symbol: `SHNZ`
1. Open the [registration page](http://localhost:8080/registration-app) and select **Connect** to connect your wallet.

    {% admonition(type="info") %}
    If your Host is running on a remote server (Hetzner, DigitalOcean, GCP, AWS, etc.), use SSH local port forwarding to access the registration page.
    1. On your local machine, run `ssh -L 8080:localhost:8080 user@your-server-ip`.
    1. Open `http://localhost:8080/registration-app` in your browser.
    {% end %}

1. Click **Register** and select **Host** as your role.
1. Submit your registration and confirm the transaction in your browser wallet. You should see a successful registration notification.

## Use the CLI

You can register by submitting the registration transaction directly with Foundry's `cast` CLI.

```shell
cast send "0x0000000000000000000000000000000000000211" \
  "register(bytes,bytes,bytes,bytes,bytes,uint8)" \
  "<public_key>" \
  "<public_key_signedMessage>" \
  "<peer_id>" \
  "<peer_id_signedMessage>" \
  "<signed_message>" \
  "1" \
  --rpc-url "http://rpc.devnet.shinzo.network:8545" \
  --from "<your_address>" \
  --private-key "<your_private_key>" \
  --gas-limit 100000
```

Replace each placeholder with your actual registration values.

{% admonition(type="warning") %}
Do not commit your private key to source control, paste it in public channels, or store it in shell history on shared machines.
{% end %}

Your Host is now registered and authorized to participate in the Shinzo Network.

## Back up your node identity key

This key is your Host's identity on the network. If you lose it without a backup, you cannot restore your Host with the same identity.

- Store a secure backup of the key.
- In a recovery scenario, restore it to the same path your Host reads keys from: `~/.defra/keys` for a source build, or the directory you mounted to `/app/.defra/keys` for Docker.
- Use the same keyring secret. Your identity depends on both the key files and the keyring secret, so a backup of the keys alone is not enough to recover it.

{% admonition(type="warning") %}
If this key is lost with no backup available, you will need to spin up a new Host and re-register with a new identity.
{% end %}

Where the key lives depends on how you run the Host client:

- **Build from source:** `~/.defra/keys` by default.
- **Docker with persistence:** the host directory you mounted to `/app/.defra/keys` (for example `~/data/keys`).
- **Docker without volume mounts:** the key only exists inside the container and is lost when the container is removed. Mount a volume before you rely on a Host keeping its identity.

Copy the directory somewhere safe:

```shell
cp -r ~/.defra/keys /mnt/backup-drive/
```
