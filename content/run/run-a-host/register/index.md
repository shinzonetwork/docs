+++
title = "Register"
description = "Check your Host's configured chains and register it with ShinzoHub so it can serve Views publicly."
+++

To participate in the Shinzo Network and make your View publicly available, you need to register your Host. Registration is an on-chain transaction on ShinzoHub, so you need a wallet with a small amount of SHNZ to cover the transaction fee. Get testnet SHNZ from the [faucet](https://faucet.shinzo.network/).

The chains your Host serves are configured in `config.yaml`. Registration on ShinzoHub does not configure Generator connections or enable additional chains. See [Install](/run/run-a-host/install/) to configure the Host before registering it.

## Check your Host before registering

Start the Host and inspect its per-chain status from the machine where it runs:

```shell
curl -s http://localhost:8080/health | jq '.chains'
curl -s http://localhost:8080/registration | jq '.chains'
```

Check that every chain you intend to serve appears and inspect its reported status. If a chain is missing or unavailable, check its `chains:` entry, exact case-sensitive prefix, and Generator HTTP and P2P connections before proceeding. A responding endpoint alone does not confirm that all configured chains are syncing.

The `/health`, `/registration`, `/stats`, and `/metrics` endpoints report per-chain status under `chains`. Update monitoring that reads the removed top-level `current_block` or `last_processed` fields.

## Add the Shinzo Testnet to your wallet

Add the Shinzo Testnet to your browser wallet with the following values:

| Field | Value |
| --- | --- |
| Network name | `Shinzo` |
| Default RPC URL | `http://testnet.shinzo.network:8545` |
| Chain ID | `91273001` |
| Currency symbol | `SHNZ` |

## Register with the hosted app

Use the hosted [Registration app](https://registration.shinzo.network/) for a Host reachable from the public internet. You do not need an SSH tunnel to open the app, but the Host's health endpoint still needs to be publicly reachable.

1. Start your Host client with the health/registration port published (`-p 8080:8080`) and open inbound TCP `8080` in your firewall. The Host exposes health and registration endpoints on port `8080`. The public Hosts dashboard probes `http://<your-server-ip>:8080/health` to decide whether your Host shows as online. If `8080` isn't reachable from the internet, your Host client shows as offline even while it's running fine.
1. Open the [Registration app](https://registration.shinzo.network/) and select **Connect** to connect your wallet.
1. Choose **Host** as the role and fill in the requested details.
1. Submit your registration and confirm the transaction in your browser wallet. You should see a successful registration notification.

## Open registration from your Host

The Host exposes `/registration-app` on port `8080` as an entry point to registration. This redirects to the hosted registration app; it is not a separate offline registration app.

1. Start your Host client with the health/registration port published (`-p 8080:8080`). For the public Hosts dashboard to report it as online, allow inbound TCP `8080` so the dashboard can reach `http://<your-server-ip>:8080/health`.
1. Open the [registration page](http://localhost:8080/registration-app) and select **Connect** to connect your wallet.

    {% <admonition type="info"> %}
    If your Host is running on a remote server (Hetzner, DigitalOcean, GCP, AWS, etc.), use SSH local port forwarding to access the registration page.
    1. On your local machine, run `ssh -L 8080:localhost:8080 user@your-server-ip`.
    1. Open `http://localhost:8080/registration-app` in your browser.
    {% </admonition> %}

1. Click **Register as Host** and fill out all the details.
1. Submit your registration and confirm the transaction in your browser wallet. You should see a successful registration notification.

An SSH tunnel gives your browser access to the Host's local endpoint. It does not make a private Host publicly reachable by the dashboard or applications.

## Check status after changing chains

Adding or removing a chain requires editing `config.yaml` and restarting the Host. After restarting, repeat the per-chain health and registration checks above. See [Add or remove a chain](/run/run-a-host/install/#add-or-remove-a-chain) for the steps and startup restrictions.

Views that reference tables without a chain prefix are treated as Ethereum Views and will not load on a Host that does not serve Ethereum. Check that the Views you intend to serve reference tables available on your configured chains.

## Register with the CLI

We're working on allowing Hosts to register their clients through the CLI using `cast`. We'll announce it once it's available.

## Back up your node identity key

This key is your Host's identity on the network. If you lose it without a backup, you cannot restore your Host with the same identity.

- Store a secure backup of the key.
- In a recovery scenario, restore it to the same path your Host reads keys from: `~/.defra/keys` for a source build, or the directory you mounted to `/app/.defra/keys` for Docker. See [backing up your keys](/run/operations/troubleshooting/) in the FAQ for the details per run mode.
- Use the same keyring secret. Your identity depends on both the key files and the keyring secret, so a backup of the keys alone is not enough to recover it.

{% <admonition type="warning"> %}
If this key is lost with no backup available, you will need to spin up a new Host and re-register with a new identity.
{% </admonition> %}

## Need help

{{<need_help client="Host" repo_name="shinzo-host-client" repo="https://github.com/shinzonetwork/shinzo-host-client/issues" />}}
