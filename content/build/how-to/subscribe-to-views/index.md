+++
title = "Subscribe to Views with the app-sdk"
description = "How to configure and start an embedded DefraDB instance, subscribe to Views, and receive pushed data in a Go application."
+++

A local-first app embeds a DefraDB instance through the [app-sdk](https://github.com/shinzonetwork/shinzo-app-sdk), subscribes to Views, and lets Host clients push pre-processed data to it over P2P. This page covers the mechanics: configuration, startup and shutdown, subscribing, and querying what arrives. For why the model works this way, see [The Shinzo app model](/build/explanation/the-app-model/). For filtering results by Generator attestations, see [Configure attestation thresholds](/build/how-to/configure-attestation-thresholds/).

Install the SDK with Go modules:

```shell
go get github.com/shinzonetwork/shinzo-app-sdk
```

{% admonition(type="warning") %}
Pushed replication is currently blocked by a version mismatch. The app-sdk pins DefraDB v0.20 while public Host clients run DefraDB v1.0, and documents published by a v1.0 Host cannot be parsed by a v0.20 app, so nothing arrives yet. Everything on this page is correct against the current app-sdk: your app connects and subscribes successfully, and its queries return empty until the SDK ships a compatible DefraDB. If you need data in a Go app today, query a Host directly instead, as described in [Query data](/build/how-to/query-data/).
{% end %}

## Configure the SDK

The SDK loads a YAML config file. A minimal one for an app that only holds Shinzo data:

```yaml
defradb:
  url: "http://localhost:9181"
  keyring_secret: "dev-secret"
  p2p:
    enabled: true
    bootstrap_peers:
      - "/ip4/34.66.172.230/tcp/9171/p2p/12D3KooWKVCMswzcXYe9kW2z7nSB9YUWjVVLsMbJnBjVPFUQkbQ7"
    listen_addr: "/ip4/127.0.0.1/tcp/9171"
  store:
    path: "./.defra"

shinzo:
  minimum_attestations: 1

logger:
  development: true
```

Three keys deserve attention:

- `defradb.keyring_secret` encrypts the local keyring that holds your node's identity, so the app keeps the same P2P identity across restarts. It can also come from the `DEFRA_KEYRING_SECRET` environment variable.
- `defradb.p2p.enabled` must be `true`, or the instance starts with networking off and nothing can be pushed to it. `defradb.p2p.bootstrap_peers` lists the Host clients to dial; [Connect your app to a Host](/build/how-to/connect-to-a-host/) shows where to get theirs.
- `shinzo.minimum_attestations` sets the default attestation threshold for filtered queries. It only needs a valid value until you start using the attestation query helpers.
- `logger.development` keeps DefraDB's logs visible while you develop. Set it to `false` in production; DefraDB logs a lot.

Load the file with `config.LoadConfig`:

```go
shinzoConfig, err := config.LoadConfig("config.yaml")
if err != nil {
    panic(err)
}
```

In tests, where the working directory is unpredictable, the `file.FindFile` helper locates the config by walking up from the current directory:

```go
configPath, err := file.FindFile("config.yaml")
if err != nil {
    panic(err)
}
shinzoConfig, err := config.LoadConfig(configPath)
```

If you pass `nil` instead of a loaded config, the SDK builds a default config for you. That is fine for a quick experiment, but real apps should manage a file: the defaults cannot know your bootstrap peers.

## Start and stop the embedded instance

`defra.StartDefraInstance` boots the embedded DefraDB node. Its second argument is a `SchemaApplier`, which decides what non-View schema gets applied at startup:

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

The two `nil` arguments are optional node options and a replication filter, which most apps do not need. The second return value is the network handler, which you can ignore for basic subscriptions.

Pick the `SchemaApplier` that matches how you use DefraDB:

- `MockSchemaApplierThatSucceeds` applies nothing. Use it when DefraDB only holds Shinzo data, which is the common case.
- `SchemaApplierFromFile` reads a schema from a file, and `SchemaApplierFromProvidedSchema` takes a schema string. Use either when your app also stores its own documents in the same DefraDB instance; your collections go in the schema, and View collections arrive later through subscriptions.

Whatever you start, close it. `myNode.Close(context.Background())` shuts the node down cleanly, and `defer` is the easiest way to guarantee it runs.

## Subscribe to a View

Subscribing is what turns a registered View into pushed data. Define the View and call `SubscribeTo`:

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

Only the `Name`, `Sdl`, and optionally `Query` fields of the `View` struct matter for subscribing. The `Query` field is not shown here because the SDL alone is enough to receive and store documents.

`SubscribeTo` does two things. It applies the View's SDL to your embedded instance, so the collection exists locally and can be queried. And it registers that collection as a topic in DefraDB's passive replication, which is the signal that tells connected Host clients to push the View's documents to you.

The "collection already exists" error is common and expected: it means you have subscribed to this View before, so the collection is already in place. It is informational and safe to ignore. Other errors are real and should not be swallowed.

## Query the pushed data

Once subscribed, Host clients push the View's documents into your local collection as they process new blocks. Query the collection with the SDK's generic helpers and a Go struct that matches the fields:

```go
type Transfer struct {
    TokenAddress string `json:"tokenAddress"`
    From         string `json:"from"`
    To           string `json:"to"`
    Amount       string `json:"amount"`
    BlockNumber  int    `json:"blockNumber"`
}

transfers, err := defra.QueryArray[Transfer](
    context.Background(),
    myNode,
    `query { Studio_v1_Erc20TransferUSDC(limit: 10) { tokenAddress from to amount blockNumber } }`,
)
if err != nil {
    panic(err)
}
```

`defra.QueryArray[T]` returns a slice of `T`, and `defra.QuerySingle[T]` returns one document when you expect exactly one. The GraphQL itself is the same language you would run against a Host's endpoint, so [Query data](/build/how-to/query-data/) applies here too.

Until the DefraDB version gap described at the top is closed, these queries return empty results. Once a compatible app-sdk release lands, the same code starts returning rows a few moments after subscribing.

## Need help

{{ need_help(client="app-sdk", repo_name="app-sdk", repo="https://github.com/shinzonetwork/app-sdk/issues") }}
