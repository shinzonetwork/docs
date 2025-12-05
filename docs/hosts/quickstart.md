---
title: Quick Start
sidebar_label: Quick Start
sidebar_position: 2
description: xxx
---

A go based application for a shinzo host to run

## Installation

Clone the Host Client repository and navigate to the project directory:

```bash
git clone https://github.com/shinzonetwork/shinzo-host-client.git
cd shinzo-host-client
```

## Configuration

The Host Client uses a `config.yaml` file for configuration. Open it in your editor:

- `defradb`
    - `url` - you can modify this if you wish to expose a different API url. You may find that you want to change this if you plan on running the Host on your machine directly and you would like to expose a different port. The base URL is expected to be "localhost" or another loopback address or your machine's IP address. If running in a container, make sure to expose this port.
    - `keyring_secret` - can sometimes be useful for tests. Instead, it is generally recommended to set an environment variable `DEFRA_KEYRING_SECRET` to a keyring secret. This secret can be any secure passcode - it is recommended to use a secure password generator to create one. The `DEFRA_KEYRING_SECRET` will overwrite any `keyring_secret` provided in config.yaml - you are welcome to remove this field from config altogether.
    - `p2p` *Very important - if not done correctly your Host will not receive primitive data from Indexers*
        - `bootstrap_peers` - these nodes will be your initial connection point to the network. By default, we will provide at least one bootstrap peer for you to connect with so that you can join the Shinzo network. However, if you can grab some peer info for reliable Indexers from the Shinzo block explorer and include them here, it can really boost the speed with which your Host gets connected to Shinzo and starts hosting Views.
            - `peers` You will need the peer's IP_ADDRESS and PEER_ID to complete the connection string: ['/ipv4/\<IP_ADDRESS\>/tcp/9171/p2p/\<PEER_ID\>']
        - `listen_addr` - the default value of "/ip4/0.0.0.0/tcp/0" should be sufficient when running locally. If running in a container, you'll want to manually choose a port "/ip4/0.0.0.0/tcp/\<your port here\>" so that you can expose that port in your container.

- `store`
    - `path` - with this, you can change where your Host's embedded defra instance stores data. In general, the default should be fine.

- `shinzo` *Very important - if not done correctly your Host will not receive View definitions and will have nothing to Host*
    - `web_socket_url` - here you must provide a valid websocket url for Shinzohub, we will use this to subscribe to new View events emitted by Shinzohub. At time of writing, the Host will begin hosting any View it receives via this event subscription

- `logger`
    - `development` - leave this as true if doing any kind of testing. Otherwise, make this false - this will quiet the Defra logs which can quickly fill up your memory if you aren't careful.

- `host`
    - `lens_registry_path` - with this, you can change where your Host stores the Lens wasm files it receives. In general, the default should be fine.

## Running Locally

Once configured, you can run the Host client app locally with

```bash
go run cmd/main.go
```

Or, you can also run it with

```bash
make build-with-playground
make start-playground
```

This will run the Host and also expose a playground GUI on `localhost:<whatever port you configured for defradb.url + 1>` where you can experiment with GraphQL queries against your Host, querying primitive data and any hosted Views.
