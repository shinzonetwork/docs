+++
title = "Register"
aliases = ["/hosts/register"]
+++

To participate in the Shinzo Network and make your View publicly available, you need to register your Host. Registration is an on-chain transaction on ShinzoHub, so you need a wallet with a small amount of SHNZ to cover the transaction fee. Get testnet SHNZ from the [faucet](https://faucet.shinzo.network/).

## Add the Shinzo Testnet to your wallet

| Field | Value |
| --- | --- |
| Network name | `Shinzo` |
| Default RPC URL | `http://testnet.shinzo.network:8545` |
| Chain ID | `91273001` |
| Currency symbol | `SHNZ` |

## Register with the hosted app

The hosted [Registration app](https://registration.shinzo.network/) runs from any browser and doesn't require port forwarding, so it's the easiest path for Hosts reachable from the public internet.

1. Start your Host client and confirm it's online.
1. Open the [Registration app](https://registration.shinzo.network/) and select **Connect** to connect your wallet.
1. Choose **Host** as the role and fill in the requested details.
1. Submit your registration and confirm the transaction in your browser wallet. You should see a successful registration notification.

## Register with the local registration app

If your Host is on a private network or you'd rather not route registration through the hosted app, the Host client serves its own registration app on port `8080`.

1. Start your Host with the health/registration port published (`-p 8080:8080`). The default command in [Install](/run/run-a-host/install/) does not publish it.
1. Open the [registration page](http://localhost:8080/registration-app) and select **Connect** to connect your wallet.

    {% admonition(type="info") %}
    If your Host is running on a remote server (Hetzner, DigitalOcean, GCP, AWS, etc.), use SSH local port forwarding to access the registration page.
    1. On your local machine, run `ssh -L 8080:localhost:8080 user@your-server-ip`.
    1. Open `http://localhost:8080/registration-app` in your browser.
    {% end %}

1. Click **Register as Host** and fill out all the details.
1. Submit your registration and confirm the transaction in your browser wallet. You should see a successful registration notification.

## Register with the CLI

We're working on allowing Hosts to register their clients through the CLI using `cast`. We'll announce it once it's available.

## Back up your node identity key

This key is your Host's identity on the network. If you lose it without a backup, you cannot restore your Host with the same identity.

- Store a secure backup of the key.
- In a recovery scenario, restore it to the same path your Host reads keys from: `~/.defra/keys` for a source build, or the directory you mounted to `/app/.defra/keys` for Docker. See [backing up your keys](/run/operations/troubleshooting/) in the FAQ for the details per run mode.
- Use the same keyring secret. Your identity depends on both the key files and the keyring secret, so a backup of the keys alone is not enough to recover it.

{% admonition(type="warning") %}
If this key is lost with no backup available, you will need to spin up a new Host and re-register with a new identity.
{% end %}

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
