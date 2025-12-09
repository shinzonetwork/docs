---
title: Quick Start
sidebar_label: Quick Start
sidebar_position: 2
description: xxx
---

Hosts transform raw blockchain data into structured **Views** and contribute to network security by producing **Attestation Records**. This quickstart guides you through running the Host Client.

---

## 1. Install DefraDB (Required for Hosting)

Hosts must run a local **DefraDB** instance to sync and store data.

Below are the minimal installation and startup steps extracted from the official documentation.

### Install DefraDB

```bash
git clone https://github.com/sourcenetwork/defradb.git
cd defradb
make install
export PATH=$PATH:$(go env GOPATH)/bin
```

### Key Management (Initial Setup)

Create a key for signing operations:

```bash
export DEFRA_KEYRING_SECRET=<make_a_password>
defradb keyring generate
```

### Start DefraDB

Start a local node:

```bash
defradb start
```

This will expose the DefraDB API at the default local port.

---

## 2. Install the Shinzo Host Client

Clone the repository and enter the directory:

```bash
git clone https://github.com/shinzonetwork/shinzo-host-client.git
cd shinzo-host-client
```

---

## 3. Configuration

The Host Client reads from `config.yaml`, which comes with sensible defaults.
Only modify values when needed.

### Key Fields

* **defradb.url** – API endpoint of your local DefraDB node. Defaults work for most setups.
* **defradb.keyring_secret** – Optional. Usually provided via the `DEFRA_KEYRING_SECRET` environment variable.
* **p2p.bootstrap_peers** – Seed peers for joining the Shinzo network. Defaults include a reliable bootstrap peer.
* **p2p.listen_addr** – Default is suitable for local runs. Override when containerizing.
* **store.path** – Directory where local DefraDB data is stored.
* **shinzo.web_socket_url** – Defaults to a hosted ShinzoHub node. Only change if connecting to a different node.
* **logger.development** – Set to `false` for production.
* **host.lens_registry_path** – Where received WASM lens files are stored.

### Default Behavior

The included `config.yaml` is ready for most local development workflows. You should only need to modify peer settings or storage paths for advanced setups.

---

## 4. Running the Host

To start the Host Client:

```bash
go run cmd/main.go
```

### Or Run with Playground Enabled

```bash
make build-with-playground
make start-playground
```

This runs the Host and also exposes a **Playground GUI** at:

```
http://192.168.50.33:9182
```

The playground allows you to interactively run GraphQL queries against primitive data and any Views your Host is serving.

---

## Next Steps

You are now ready to:

* Begin receiving and hosting Views
* Experiment with queries through the playground GUI

