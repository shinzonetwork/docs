# Hosts

Hosts play a very important role in the Shinzo ecosystem. The Host's role is primarily as a data transformer and data availability layer. Hosts are responsible for transforming primitive data (blocks, logs, transactions, etc.) into useful "Views" of data. 

"Views" can be thought of as user-defined APIs. The user/developer is responsible for defining how to retrieve the primitive data, how to transform the data, and finally how to serve the data. The Host is responsible for providing the infrastructure, compute, and memory required to actually perform those transactions and to deliver the View output to the users that need it.

Hosts also play an integral role in the security of the Shinzo network. They are responsible for creating "Attestation Records" which are used to propogate sign-offs from Indexer(s) on primitive data; users have the option to validate the source data against what other Indexers have posted, providing a means for data self-verification.

To help facilitate the Host role, the Shinzo team provides a Host application client that we highly recommend using.

## Setup

First, clone the Host client app repo.

```bash
git clone https://github.com/shinzonetwork/shinzo-host-client.git
cd shinzo-host-client
```

Open the `config.yaml` file at the root of the project, here we will place some config values.

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
