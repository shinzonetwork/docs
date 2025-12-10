---
title: Quick Start
sidebar_label: Quick Start
sidebar_position: 2
description: Run a Shinzo Host to transform blockchain data into verifiable Views
---

Hosts transform raw blockchain data into structured **Views** and contribute to network security by producing **Attestation Records**. This quick start guide walks you through installing, configuring, and running the Shinzo Host Client.

## 1. Install the Shinzo Host Client

Clone the repository and enter the directory:

```bash
git clone https://github.com/shinzonetwork/shinzo-host-client.git
cd shinzo-host-client
```

## 2. Configuration

The Host Client reads from [config.yaml](https://github.com/shinzonetwork/shinzo-host-client/blob/main/config.yaml) which comes with sensible defaults.
The only field you need to set is **defradb.keyring_secret** which can alternatively be set with the following command in the terminal window.

```bash
export DEFRA_KEYRING_SECRET=<make_a_password>
```

### Key Fields

* **defradb.url** – API endpoint of your local DefraDB node. Defaults work for most setups.
* **defradb.keyring_secret** – Requires a secret to generate your private keys. 
* **p2p.bootstrap_peers** – Seed peers for joining the Shinzo network. Defaults include a reliable bootstrap peer.
* **p2p.listen_addr** – Default is suitable for local runs. Override when containerizing.
* **store.path** – Directory where local DefraDB data is stored.
* **shinzo.web_socket_url** – Defaults to a hosted ShinzoHub node. Only change if connecting to a different node.
* **logger.development** – Set to `false` for production.
* **host.lens_registry_path** – Where received WASM lens files are stored.

### Default Behavior

The included `config.yaml` is ready for most local development workflows. You should only need to modify peer settings or storage paths for advanced setups.

## 3. Running the Host

To start the Host Client:

```bash
go run cmd/main.go
```

### Or Run with Playground Enabled

```bash
make build-with-playground
make start-playground
```

This runs the Host and also exposes a **Playground GUI**. In the output logs, look for the address:

```
🧪 GraphQL Playground available at ...
```

The playground allows you to interactively run GraphQL queries against primitive data and any Views your Host is serving.

## Next Steps

You are now ready to:

* Begin receiving and hosting Views
* Experiment with queries through the playground GUI

