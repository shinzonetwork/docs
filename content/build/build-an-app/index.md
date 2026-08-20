+++
title = "Build an app"
aliases = ["/guides", "/guides/building-apps-with-shinzo"]
description = "Building dApps with Shinzo App SDK - local-first querying with embedded DefraDB integration"
+++
You can build an app with Shinzo using the [app-sdk](https://github.com/shinzonetwork/app-sdk).

```shell
go get github.com/shinzonetwork/app-sdk
```

## Concepts

When working with a centralized indexing service, you choose from a set of APIs they provide and use them in your application. The centralized indexing service builds complex caching strategies to return responses to your queries (which operate over a very large dataset) as quickly as possible. Then, in your application, you likely create your own cache that tracks the results of recent queries, so you can minimize latency in your app while minimizing API usage costs. Shinzo inverts this model.

With Shinzo, you, the app developer, define the API you want to use. Your application client is then "pushed" the pre-processed result of that API, which forms a verifiably-correct cache for your application clients. Your application can make queries against its local cache of the data. You don't maintain a separate cache, re-query an API for the latest data, or run webhooks that can surprise you with costs. You query the data as frequently as you like. With Shinzo, you don't pay per query. You pay for access to transformed data.

Shinzo uses [DefraDB](https://github.com/sourcenetwork/defradb) for several purposes. Apps built with Shinzo generally also use an embedded DefraDB instance. When working with Shinzo, you create, describe, or find a series of Views. Views are collections of pre-processed data needed by applications. Your application is then "pushed" the pre-processed data from your Views. 

### Example

Consider a simple app to illustrate how Shinzo works. The app displays a counter for the current number of instances of a specified ERC-20 token, such as USDC. For argument's sake, assume the contract has no method to query the current supply of USDC. The only way to determine the supply is to parse the mint and burn events emitted by the contract.

To do this, you first create a View that describes how to transform primitive data (blocks, logs, transactions, etc.) into a format you can use. In this case, you filter logs involving the USDC contract address, decode the logs into events using the contract's ABI, and finally filter for only mint and burn events. The Shinzo Hosts and Generator clients work together to deliver the data you need. Your application client(s) receive all the mint and burn events on that USDC contract. From here, you can make as many GraphQL queries against the events you've received to build your application. Your app client(s) won't receive the underlying primitives (blocks, transactions, logs, etc.), only the filtered and decoded events as described in your View.

## Usage

Before using the app-sdk, [use Viewkit to create the Views](/build/concepts/views-for-builders/) for your app, or build them in the [Shinzo Studio](https://studio.shinzo.network/) browser UI.

Once you've created your Views, the next step is to configure your app.

### Configuration

The app-sdk exposes several configuration options for your application and its embedded Defra instance. Most are only useful in niche power-user cases, but a few are worth calling out.

The most important configuration variable is `minimum_attestations`:

```yaml
shinzo:
  minimum_attestations: 1
```

This sets the default minimum attestations required when querying your Views. See the attestations section for more info.

```yaml
logger:
  development: true 
```
This enables all logs. If excluded, it defaults to false and silences most of the Defra logs. Setting development to false (or omitting it) is recommended for production, since Defra produces a lot of logs otherwise.

Config can be handled in two ways. You can create the config options by hand. The [app-sdk creates a default config](https://github.com/shinzonetwork/app-sdk/blob/main/pkg/defra/defra.go#L23) this way, which is used in place of a nil config. You can also create a config.yaml file ([example](https://github.com/shinzonetwork/app-sdk/blob/main/config.yaml)) and load it with `config.LoadConfig`. To locate your config.yaml file, the `file.FindFile` helper is useful, especially in a test context. For example:

```go
configPath, err := file.FindFile("config.yaml")
if err != nil {
    panic(err)
}

shinzoConfig, err := config.LoadConfig(configPath)
if err != nil {
    panic(err)
}
```

### Starting Defra

Once you've configured your app, you're ready to start your Defra instance.

First, create a `SchemaApplier`.

```go
type SchemaApplier interface {
	ApplySchema(ctx context.Context, defraNode *node.Node) error
}
```

The app-sdk exposes all the `SchemaApplier` implementations you'll need, but you can add new ones if needed.

```go
type SchemaApplierFromFile struct {
	DefaultPath string
}
```
This is useful when you want to provide your schema in a file. The `file.FindFile` helper is useful here, especially in a test context.

```go
type SchemaApplierFromProvidedSchema struct {
	ProvidedSchema string
}

func NewSchemaApplierFromProvidedSchema(schema string) *SchemaApplierFromProvidedSchema {
	return &SchemaApplierFromProvidedSchema{
		ProvidedSchema: schema,
	}
}
```
This is useful when you want to provide your schema as a string.

Finally,

```go
type MockSchemaApplierThatSucceeds struct{}
```
This is what you'd use if you don't have a schema to apply.

If you plan to use DefraDB for other use cases besides Shinzo in your application, provide these other schemas via your `SchemaApplier`. If you're only using Defra for Shinzo, use `MockSchemaApplierThatSucceeds`.

```go
myDefraInstance, err := defra.StartDefraInstance(shinzoConfig, &MockSchemaApplierThatSucceeds{})
if err != nil {
    panic(err)
}
```

Don't forget to close your Defra instance when your app exits.

```go
myDefraInstance.Close(context.Background())
```

### Querying Views

The first step to querying a View is to subscribe to it so that Hosts will begin pushing the View contents to your application client.

Create a View object for each view.

```go
type View struct {
	Name      string    `json:"name"`
	Query     *string   `json:"query"`
	Sdl       *string   `json:"sdl"`
}
```
All other fields in the View struct can be ignored.

Then, call `SubscribeTo` on your Views.

```go
err := myView.SubscribeTo(context.Background(), myDefraInstance)
if err != nil {
    if strings.Contains(err.Error(), "collection already exists") {
		logger.Sugar.Warnf("Error subscribing to view %+v: %w", v, err)
	}else {
        panic(err)
    }
}
```
Note: the "collection already exists" error is common and expected if you have already subscribed to a View. It is informational and can be safely ignored. Other errors should not be ignored.

This adds the View collection's SDL to your Defra instance (allowing you to query the view) and adds the View as a topic of interest for Defra's passive replication system (communicating to the Hosts that they should send you data for the View).

You now begin receiving data and can query against it.

Query with either `QuerySingle` or `QueryArray` for individual objects or arrays. Provide a GraphQL query string and define a struct representing the resulting object you expect to receive.

```go
result, err := defra.QuerySingle[MyResultStruct](ctx, myNode, queryString)
// or
results, err := defra.QueryArray[MyResultStruct](ctx, myNode, queryString)
```

### Attestations

A distinctive feature of Shinzo is that it lets you validate your source data against multiple independent sources. Instead of one Generator providing all the source primitive data, Shinzo uses multiple Generators and lets you validate your source data through "attestation records" signed off by the various Shinzo Generators that wrote the data.

Using the app-sdk, you can filter out query results that do not meet your specified attestation threshold. For example, if you're dealing with high-value transactions, you may want to filter out any query results where the underlying data was signed off by fewer than X Shinzo Generator clients.

Attestation Records, like Views, are pre-processed and pushed to your application client. They are segmented based on the View (or Primitive) they attest to, so you can select which Views (or Primitives) you want to receive Attestation Records for. You will not receive Attestation Records for data you aren't interested in.

To access Attestation Records for a View (or Primitive), use the `AddAttestationRecordCollection` method.

```go
err := attestation.AddAttestationRecordCollection(context.Background(), myDefraInstance, myView.Name)
if err != nil {
    if strings.Contains(err.Error(), "collection already exists") {
		logger.Sugar.Warnf("Error subscribing to view %+v: %w", v, err)
	}else {
        panic(err)
    }
}
```
Note: the "collection already exists" error is common and expected if you have already added Attestation Records for a View (or Primitive). It is informational and can be safely ignored. Other errors should not be ignored.

This method works like `view.SubscribeTo`. It adds the `AttestationRecord_YourView` collection to your Defra instance's SDL so it can be queried against, and adds it as a topic for passive replication so Hosts know to send your app client this data.

The app-sdk can be used to filter out results from queries that do not meet a specified attestation threshold. This can be pre-configured in your config.yaml:

```yaml
shinzo:
  minimum_attestations: 2
```
Once configured, you can use `QuerySingleWithConfiguredAttestationFilter` or `QueryArrayWithConfiguredAttestationFilter` (from the `attestation` package) to query objects or arrays. These work like `QuerySingle` and `QueryArray` (from the `defra` package), except they also filter the results based on the minimum attestation threshold you specified in your config.

Note: make sure you have added the attestation record (using `AddAttestationRecordCollection`) for whatever collections you query using these methods.

Similarly, you can provide a minimum attestation record threshold as a parameter using `QuerySingleWithAttestationFilter` or `QueryArrayWithAttestationFilter` (from the `attestation` package) for objects or arrays respectively.
