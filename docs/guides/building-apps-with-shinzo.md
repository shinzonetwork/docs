---
sidebar_position: 5
---

# Building Apps with Shinzo

Building an app with Shinzo is made easy using our [app-sdk](https://github.com/shinzonetwork/app-sdk)!

`go get github.com/shinzonetwork/app-sdk`

## Concepts

First, let's review some basic concepts behind working with Shinzo.

When working with a centralized indexing service, you must choose a from a set of APIs they provide to leverage in your application. The centralized indexing service will work to create complex caching strategies to provide you with responses to your queries (which operate over a very large datset) as quickly as possible. Then, in your application, you'll likely want to create a cache of your own that keeps track of the result of recent queries - that way you can work to minimize latency in your app while also, and importantly, minimizing API usage costs. Shinzo flips this script rather significantly.

With Shinzo, you, the app developer, essentially define the API you want to use. Then, your application client is "pushed" the pre-processed result of that API - this essentially forms a verifiably-correct cache to your application clients. Now, your application can simply make queries against its local cache of the data. No need to maintain a separate cache. No need to re-query an API in order to get the latest data. No need to worry about running webhooks that may end up surprising you with their costs. You simply query the data as frequently as you like. With Shinzo, you don't pay per query, you pay for access to transformed data.

Shinzo leverages [DefraDB](https://github.com/sourcenetwork/defradb) for a number of purposes. In general, it is expected that apps built using Shinzo will also leverage an embedded instance of Defra in their application. When working with Shinzo, you will create/describe or find a series of View(s). View(s) are collections of pre-processed data needed by applications. Then, your application will be "pushed" the pre-processed data from your View(s). 

### Example

Let's propose a simple app as an example to illustrate how Shinzo works. This application will simply display a counter for the current number of instances of a specified ERC20 token, let's say USDC on Ethereum mainnet. Let's also say, for arguments sake, that there does not exist a method on the contract where we can query to get the current supply of USDC - instead, the only way to determine this is to parse through the mint and burn events emitted by the contract.

To do this, you would first create a View, describing how to transform primitive data (blocks, logs, transactions, etc.) into a format that works for you. In this case, you would filter logs based on those involving the USDC contract address, decode the logs into events using the contracts ABI, and finally filter for only mint and burn events. The Shinzo Hosts and Indexers will work together to get you the data you need. Your application client(s) will receive all the mint and burn events on that USDC contract. From here, you can make as many GraphQL queries against those events you've received in order to build your application. Your app client(s) won't receive the underlying primitives (blocks, transactions, logs, etc.), only the filtered and decoded events as described in your View.

## Usage

Before using the app-sdk, you'll want to [use the view-creator to create the View(s)](here would be a really great place to link to view-creator's documentation) for your app.

Once you've created your Views, the next step is to configure your app.

### Configuration

The app-sdk exposes a variety of configuration options for your application and its embedded Defra instance. While most of these config options will only be useful in some niche cases for power users, some of them are worth calling out directly.

By far the most important configuration variable is `minimum_attestations`:

```yaml
shinzo:
  minimum_attestations: 1
```

This will set the default minimum attestations required when querying your View(s). Please see the attestations section for more info.

```yaml
logger:
  development: true 
```
This will enable all logs; if excluded, this defaults to false and will silence most of the Defra logs. In general, setting development to false (or omitting it) is highly recommended for production as Defra will produce a lot of logs otherwise.

Config can be handled in two different ways. You can simply create the config options by hand - the [app-sdk actually creates a default config](https://github.com/shinzonetwork/app-sdk/blob/main/pkg/defra/defra.go#L23) via this manner that is used in place of a nil config. You can also create a config.yaml file ([example](https://github.com/shinzonetwork/app-sdk/blob/main/config.yaml)) and load it with `config.LoadConfig`. To locate your config.yaml file, you may find `file.FindFile` to be really helpful, especially if working in a test context. e.g.

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

First, you'll need to create a `SchemaApplier`.

```go
type SchemaApplier interface {
	ApplySchema(ctx context.Context, defraNode *node.Node) error
}
```

The app-sdk exposed all the implementations of `SchemaApplier` that we imagine you'll ever need, but you're of course welcome to add any new ones if needed.

```go
type SchemaApplierFromFile struct {
	DefaultPath string
}
```
Is really useful if you'd like to provide your schema in a file. Again, you may find using `file.FindFile` to be really helpful with this, especially if working in a test context.

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
Is useful if you want to simply provide your schema as a string.

Finally,

```go
type MockSchemaApplierThatSucceeds struct{}
```
This is what you'd use if you don't have a schema to apply.

If you're planning to use DefraDB for other use cases besides Shinzo in your application, it is recommended that you provide these other schemas via your `SchemaApplier`. Otherwise, if you're only using Defra for Shinzo, you should use `MockSchemaApplierThatSucceeds`.

```go
myDefraInstance, err := defra.StartDefraInstance(shinzoConfig, &MockSchemaApplierThatSucceeds{})
if err != nil {
    panic(err)
}
```

Don't forget to close your Defra instance when your app exits!

```go
myDefraInstance.Close(context.Background())
```

### Querying Views

The first step to querying a View is to subscribe to it so that Hosts will begin pushing the View contents to your application client.

You'll need to create View objects for each view.

```go
type View struct {
	Name      string    `json:"name"`
	Query     *string   `json:"query"`
	Sdl       *string   `json:"sdl"`
}
```
All other fields in the View struct can be ignored.

Then, call `SubscribeTo` on your View(s).

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
Note: the "collection already exists" error is common and expected if you have already subscribed to a View. It is for informational purposes and can be safely ignored. Other errors should not be ignored.

This will add the View collection's SDL to your Defra instance (allowing you to query the view) and will add the View as a topic of interest for Defra's passive replication system (communicating to the Hosts that they should send you data for the View).

You'll now begin receiving data and can start to query against it.

Query with either `QuerySingle` or `QueryArray` for individual objects or arrays. You'll need to provide a graphql query string and you'll need to define a struct representing the resulting object you hope to receive.

```go
result, err := defra.QuerySingle[MyResultStruct](ctx, myNode, queryString)
// or
results, err := defra.QueryArray[MyResultStruct](ctx, myNode, queryString)
```

### Attestations

Perhaps one of the most unique features of Shinzo is that it allows you to validate your source info against multiple independent sources; instead of having one indexer/entity who provides all the source primitive data, Shinzo uses multiple and allows you to validate your source data through "attestation records" that are signed off by the various Shinzo Indexer's who wrote the data. 

Using the app-sdk, you can filter out query results that do not meet your specified attestation threshold. For example, if you're dealing with high value transaction(s), you may want to filter out any query results where the underlying data was signed off by less than X Shinzo Indexers.

Attestation Records, like Views, are pre-processed and pushed to your application client. Attestation Records are segmented based on the View (or Primitive) they are attesting to; this means that you can select which Views (or Primitives) you want to receive Attestation Records for. You will not receive Attestation Records for data you aren't interested in.

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
Note: the "collection already exists" error is common and expected if you have already added Attestation Records for a View (or Primitive). It is for informational purposes and can be safely ignored. Other errors should not be ignored.

This method works very similar to `view.SubscribeTo` - it will add the `AttestationRecord_YourView` collection to your Defra instance's SDL so that it can be queried against and it will add it as a topic for passive replication so that Hosts know to send your app client this data.

The app-sdk can be used to filter out results from queries that do not meet a specified attestation threshold. This can be pre-configured in your config.yaml:

```yaml
shinzo:
  minimum_attestations: 2
```
Once configured, you can use `QuerySingleWithConfiguredAttestationFilter` or `QueryArrayWithConfiguredAttestationFilter` (from the `attestation` package) to query objects or arrays respectively. These work similarly to `QuerySingle` and `QueryArray` (from the `defra` package) respectively except they will also filter the results based on that minimum attestation record filter you specified in your config. 

*Please make sure you have added the attestation record (using `AddAttestationRecordCollection`) for whatever collections you query using these methods!*

Similarly, you can provide a minimum attestation record threshold as a parameter using `QuerySingleWithAttestationFilter` or `QueryArrayWithAttestationFilter` (from the `attestation` package) for objects or arrays respectively.
