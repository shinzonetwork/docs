+++
title = "Build a local-first app"
description = "Tutorial: build a Go app that embeds DefraDB via the app-sdk, subscribes to a View, and queries pushed data locally."
+++

A local-first app gets its blockchain data pushed to it. You embed a DefraDB instance inside your Go app with the app-sdk, subscribe to a View, and Host clients push the View's pre-processed data to your app over P2P. After that, queries run against your local copy: no per-query API calls, and the data is verifiable because every document carries signatures from the Generator clients that wrote it. For the reasoning behind this model, see [The Shinzo app model](/build/explanation/the-app-model/).

By the end of this tutorial you have a running Go program that subscribes to a View hosted on the public testnet and answers queries locally. You do not need a wallet, and you do not run a Generator or Host client yourself. The only setup is the Go toolchain.

{% admonition(type="warning") %}
Pushed replication is currently blocked by a version mismatch. The app-sdk pins DefraDB v0.20 while public Host clients run DefraDB v1.0, and documents published by a v1.0 Host cannot be parsed by a v0.20 app, so nothing arrives yet. Every step below is correct against the current app-sdk: your app connects and subscribes successfully, and its queries return empty until the SDK ships a compatible DefraDB. If you need data in a Go app today, query a Host directly instead, as described in [Query data](/build/how-to/query-data/).
{% end %}

## Before you start

- Go 1.25 or later.
- A C compiler such as gcc. DefraDB pulls in a native module, so builds need CGO enabled. On macOS and most Linux machines with a standard Go install this works out of the box.
- About 15 minutes.

## Scaffold the app

1. Create a new module and pull the app-sdk:

    ```shell
    mkdir shinzo-app
    cd shinzo-app
    go mod init shinzo-app
    go get github.com/shinzonetwork/shinzo-app-sdk
    ```

    {% admonition(type="note") %}
`go get github.com/shinzonetwork/app-sdk` fails with a module path error. The repository was renamed and the module now declares `github.com/shinzonetwork/shinzo-app-sdk`.
    {% end %}

1. Create `main.go` with the imports the rest of the tutorial uses:

    ```go
    package main

    import (
      "context"
      "strings"

      "github.com/shinzonetwork/shinzo-app-sdk/pkg/config"
      "github.com/shinzonetwork/shinzo-app-sdk/pkg/defra"
      "github.com/shinzonetwork/shinzo-app-sdk/pkg/views"
    )
    ```

## Configure the app

The app-sdk loads a `config.yaml` at startup. Create one with these contents:

```yaml
defradb:
  url: "http://localhost:9181"
  keyring_secret: "dev-secret"
  p2p:
    enabled: true
    bootstrap_peers: []
    listen_addr: "/ip4/127.0.0.1/tcp/9171"
  store:
    path: "./.defra"

shinzo:
  minimum_attestations: 1

logger:
  development: true
```

A few keys matter more than the rest:

- `defradb.keyring_secret` is required. It encrypts the local keyring that holds your node's identity, so your app keeps the same P2P identity across restarts. You can also set it through the `DEFRA_KEYRING_SECRET` environment variable instead of the file.
- `defradb.p2p.enabled` must be `true`. Without it the SDK starts with networking off and no data can be pushed to you.
- `shinzo.minimum_attestations` sets the default attestation threshold used when filtering queries. The tutorial does not use attestation filtering, so this only needs a syntactically valid value.
- `logger.development` keeps DefraDB's logs visible while you learn. Set it to `false` in production.

## Connect to a Host

Your embedded DefraDB instance discovers Host clients by dialing bootstrap peers. Registered Host clients publish their connection strings on-chain, and the testnet registry exposes them over REST.

1. List the registered Host clients:

    ```shell
    curl -s http://testnet.shinzo.network:1317/shinzonetwork/host/v1/hosts | jq -r '.hosts[].connection_string'
    ```

    ```output
    /ip4/34.63.186.249/tcp/9171/p2p/12D3KooWSqvLctTtcQLvqSVZU4sTCUWxCX9z4NeFpSHnmVWBiFMZ
    /ip4/65.109.106.214/tcp/9171/p2p/12D3KooWCZgmwi1Kz6Sjqkpm4b8b4D5Hvb82KwyFPpGRZPuhFENB
    ...
    ```

1. Pick one or two connection strings and add them to `bootstrap_peers` in your `config.yaml`:

    ```yaml
    defradb:
      p2p:
        enabled: true
        bootstrap_peers:
          - "/ip4/34.63.186.249/tcp/9171/p2p/12D3KooWSqvLctTtcQLvqSVZU4sTCUWxCX9z4NeFpSHnmVWBiFMZ"
        listen_addr: "/ip4/127.0.0.1/tcp/9171"
    ```

The registry moves over time, so if dialing fails, pull the list again and swap in a current Host. For more ways to find Hosts and what each field in the registry means, see [Find Views and Hosts](/build/how-to/find-views-and-hosts/) and [Connect your app to a Host](/build/how-to/connect-to-a-host/).

{% admonition(type="tip") %}
Running your own Generator client and Host client locally for development? Point `bootstrap_peers` at your Host instead, for example `/ip4/127.0.0.1/tcp/9171/p2p/<your-host-peer-id>`.
{% end %}

## Start the embedded DefraDB instance

Add the startup code to `main.go`:

1. Load the config you wrote:

    ```go
    shinzoConfig, err := config.LoadConfig("config.yaml")
    if err != nil {
      panic(err)
    }
    ```

1. Start DefraDB and close it when the program exits:

    ```go
    myNode, _, err := defra.StartDefraInstance(
      shinzoConfig,
      &defra.MockSchemaApplierThatSucceeds{},
      nil,
      nil,
    )
    if err != nil {
      panic(err)
    }
    defer myNode.Close(context.Background())
    ```

    `MockSchemaApplierThatSucceeds` is the schema applier to use when DefraDB only holds Shinzo data. If your app also stores its own documents in DefraDB, use `SchemaApplierFromFile` or `SchemaApplierFromProvidedSchema` instead, and put your schema there. The two `nil` arguments are optional node options and a replication filter, which this tutorial does not need, and the second return value is the network handler, which you can ignore here.

## Subscribe to the View

Subscribing does two things: it applies the View's SDL to your embedded DefraDB instance so the collection exists locally, and it registers that collection with Defra's passive replication so Host clients know to push its documents to you.

The tutorial uses `Studio_v1_Erc20TransferUSDC`, a View already registered on the public testnet. It decodes Transfer events from a token contract and exposes them as documents with token address, sender, recipient, amount, and block number. If you already finished [Create your first View](/build/tutorials/create-your-first-view/), you can substitute that View instead.

1. Define the View and subscribe to it:

    ```go
    sdl := `type Studio_v1_Erc20TransferUSDC {
      tokenAddress: String
      hash: String
      blockNumber: Int
      from: String
      to: String
      amount: String
    }`

    view := views.View{
      Name: "Studio_v1_Erc20TransferUSDC",
      Sdl:  &sdl,
    }

    err = view.SubscribeTo(context.Background(), myNode)
    if err != nil {
      if strings.Contains(err.Error(), "collection already exists") {
        // You have subscribed before. The error is informational and safe to ignore.
      } else {
        panic(err)
      }
    }
    ```

    {% admonition(type="note") %}
The View's SDL as registered on the hub includes the directive `@materialized(if: false)`, which tells the Host client to compute results on query instead of storing them. The DefraDB version the app-sdk embeds rejects that directive, so the app applies the SDL without it and stores pushed documents locally. Only the `Name`, `Sdl`, and optionally `Query` fields of the View struct matter for subscribing.
    {% end %}

## Query your data

Host clients push the View's documents into your local collection as they process new blocks. Once subscribed, you query the collection with the SDK's helper and a Go struct that matches the fields.

1. Describe the result type:

    ```go
    type Transfer struct {
      TokenAddress string `json:"tokenAddress"`
      From         string `json:"from"`
      To           string `json:"to"`
      Amount       string `json:"amount"`
      BlockNumber  int    `json:"blockNumber"`
    }
    ```

1. Query with `defra.QueryArray`:

    ```go
    transfers, err := defra.QueryArray[Transfer](
      context.Background(),
      myNode,
      `query { Studio_v1_Erc20TransferUSDC(limit: 10) { tokenAddress from to amount blockNumber } }`,
    )
    if err != nil {
      panic(err)
    }
    ```

Until pushed replication works across the DefraDB version gap described at the top, this returns an empty slice. Once a compatible app-sdk release lands, you will see the slice fill with transfers a few moments after subscribing, and the same program keeps receiving new data as long as the Host clients keep running. For richer querying, `defra.QuerySingle` fetches one document. For all the GraphQL filters and ordering you can use here, see [Query data](/build/how-to/query-data/).

That is the whole local-first flow: subscribe once, then treat the embedded DefraDB instance as your read model.

## Where to next

- [Create your first View](/build/tutorials/create-your-first-view/) to define your own data instead of using a public View.
- [Subscribe to Views with the app-sdk](/build/how-to/subscribe-to-views/) for the full configuration surface, including schema appliers and clean shutdown.
- [The Shinzo app model](/build/explanation/the-app-model/) for the concepts behind pushed data and local querying.
- [Choosing an app architecture](/build/explanation/choosing-an-architecture/) to compare this with direct signed queries and running your own Host.

## Need help

{{ need_help(client="app-sdk", repo_name="app-sdk", repo="https://github.com/shinzonetwork/app-sdk/issues") }}
