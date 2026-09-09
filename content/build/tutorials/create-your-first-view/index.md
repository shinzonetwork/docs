+++
title = "Create your first View"
aliases = ["/views/quickstart", "/views/install", "/build/create-a-view/"]
description = "Tutorial: build, test, and deploy a Shinzo View with Viewkit, from install to querying it on the public testnet."
+++

Viewkit is a CLI tool that helps you initialize, manage, and publish Shinzo views. In this tutorial you will build the `viewkit` executable, assemble a View from its parts, test it locally, and deploy it to the public testnet. If you would rather work from a browser UI instead of the CLI, [Create and deploy Views in Shinzo Studio](/build/how-to/use-shinzo-studio/) covers the same create, deploy, and query flow for Views.

A View is a versioned bundle with three parts: a query (the raw data shape you ingest), an SDL (the GraphQL schema that models the result), and lenses (WebAssembly transforms that filter, decode, or reshape the data). The View you build here decodes fungible token transfer events from raw logs into readable fields.

## Prerequisites

- Git.
- Make.
- Go 1.25 or later.

## Setup

1. Make sure the prerequisites are installed properly:

    ```shell
    git --version && make --version && go version
    ```

    ```output
    git version 2.43.0
    GNU Make 4.3
    [...]
    go version go1.25.12 linux/arm64
    ```

1. Clone the repository:

    ```shell
    git clone https://github.com/shinzonetwork/shinzo-view-creator.git
    cd shinzo-view-creator
    ```

1. Build the Viewkit binary:

    ```shell
    make build
    ```

    You should see a `build` directory.

1. Run Viewkit:

    ```shell
    ./build/viewkit --help
    ```

    ```output
    Viewkit helps you initialize, manage, and publish Shinzo views through a simple CLI interface.

    Usage:
      viewkit [command]

    [...]
    ```

1. Move the `viewkit` executable somewhere on your PATH (optional):

    ```shell
    sudo mv ./build/viewkit /usr/local/bin
    ```

    Now you can run `viewkit` from anywhere.

## Wasmer runtime

Viewkit can execute WebAssembly lenses locally to validate and preview them when you run `view test` or deploy locally.

Under the hood it uses `wasmer-go`, which depends on a native dynamic library (`libwasmer.dylib` on macOS, `libwasmer.so` on Linux). If your system cannot find that library, any command that touches lenses will fail with an error like "image not found" or "library not loaded".

1. Move back into the shinzo-view-creator repo if you moved out of it:

    ```shell
    cd shinzo-view-creator
    ```

1. Install the Wasmer Go module:

    ```shell
    go get github.com/wasmerio/wasmer-go@v1.0.4
    ```

    ```output
    go: downloading github.com/wasmerio/wasmer-go v1.0.4
    go: added github.com/wasmerio/wasmer-go v1.0.4
    ```

    This makes `wasmer-go` and its packaged native libraries available in your `GOPATH`.

### Environment variables

You need to set three environment variables:

- `WASMER_ROOT`: points to the directory where the Wasmer dynamic library lives.
- `WASMER_LIB_PATH`: used by `wasmer-go` to find the dynamic library.
- `DYLD_LIBRARY_PATH` (macOS) or `LD_LIBRARY_PATH` (Linux): the dynamic loader search path. Prepend `WASMER_ROOT` so the loader finds the library when `viewkit` starts.

1. Append these lines to your shell's RC file.

    macOS:

    ```shell
    echo 'export WASMER_ROOT="$(go env GOPATH)/pkg/mod/github.com/wasmerio/wasmer-go@v1.0.4/wasmer/packaged/lib/darwin-aarch64"' >> ~/.zshrc
    echo 'export WASMER_LIB_PATH="$WASMER_ROOT"' >> ~/.zshrc
    echo 'export DYLD_LIBRARY_PATH="$WASMER_ROOT:$DYLD_LIBRARY_PATH"' >> ~/.zshrc
    ```

    Linux:

    ```shell
    echo 'export WASMER_ROOT="$(go env GOPATH)/pkg/mod/github.com/wasmerio/wasmer-go@v1.0.4/wasmer/packaged/lib/linux-amd64"' >> ~/.zshrc
    echo 'export WASMER_LIB_PATH="$WASMER_ROOT"' >> ~/.zshrc
    echo 'export LD_LIBRARY_PATH="$WASMER_ROOT:$LD_LIBRARY_PATH"' >> ~/.zshrc
    ```

1. Reload your shell configuration:

    ```shell
    source ~/.zshrc
    ```

1. Verify the variables are set:

    ```shell
    echo "$WASMER_ROOT"
    ls "$WASMER_ROOT"
    ```

    ```output
    /home/user/go/pkg/mod/github.com/wasmerio/wasmer-go@v1.0.4/wasmer/packaged/lib/linux-amd64
    dummy.go  libwasmer.so
    ```

{% admonition(type="warning") %}
If `libwasmer.dylib` or `libwasmer.so` is missing, re-run the `go get` step and check that `go env GOPATH` returns a valid path. The local `view test` and `view deploy --target local` commands spawn a DefraDB binary that also needs `LD_LIBRARY_PATH` (Linux) or `DYLD_LIBRARY_PATH` (macOS) to be set, so keep these variables set in any shell where you run Viewkit.
{% end %}

## Create a View

1. Initialize the View bundle:

    ```shell
    viewkit view init testdeploy
    ```

    This creates a new View bundle called `testdeploy` on disk and registers internal metadata for queries, SDL, lenses, and versions.

1. Add a query defining the raw data shape to ingest. Here it is raw event logs:

    ```shell
    viewkit view add query \
      "Log {address topics data transactionHash blockNumber}" \
      --name testdeploy
    ```

    This tells Viewkit that `testdeploy` will ingest `Log` objects with the specified fields.

1. Add an SDL describing how the data is modeled and exposed:

    ```shell
    viewkit view add sdl \
      "type FilteredAndDecodedLogs @materialized(if: false) {transactionHash: String}" \
      --name testdeploy
    ```

    {% admonition(type="note") %}
- `@materialized(if: false)`: treat this as a virtual type, computed at query time rather than stored.
- `transactionHash: String`: a minimal example field; real Views define more fields.
    {% end %}

1. Attach a WebAssembly lens that decodes event logs using an ABI:

    ```shell
    viewkit view add lens \
      --args '{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",\"inputs\":[{\"type\":\"address\",\"name\":\"from\",\"indexed\":true},{\"type\":\"address\",\"name\":\"to\",\"indexed\":true},{\"type\":\"uint256\",\"name\":\"value\",\"indexed\":false}]}]"}' \
      --label "decode" \
      --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm" \
      --name testdeploy
    ```

    These are the flags in play:

    - `--args`: JSON passed to the lens. Here it is an ABI definition for a `Transfer` event with `from`, `to`, and `value` fields.
    - `--label "decode"`: a human-readable label for the lens.
    - `--url`: remote URL of the `.wasm` binary.
    - `--name testdeploy`: attaches this lens to the `testdeploy` View.

1. Inspect the bundle once everything is attached:

    ```shell
    viewkit view inspect testdeploy
    ```

    ```output
    📄 View: testdeploy
    🔍 Query:
    Log {address topics data transactionHash blockNumber}

    📐 SDL:
    type FilteredAndDecodedLogs @materialized(if: false) {transactionHash: String}

    🔧 Lenses:
     - decode (assets/decode.wasm)
       Arguments:
         abi: [{"type":"event","name":"Transfer","inputs":[{"type":"address","name":"from","indexed":true},{"type":"address","name":"to","indexed":true},{"type":"uint256","name":"value","indexed":false}]}]

    🗂  Metadata:
     - Version: 3
     - Total: 3
     - Created At: 2026-09-03 11:35:10 +0000 UTC
     - Updated At: 2026-09-03 11:35:28 +0000 UTC
    ```

    Every `view add` command also prints this same summary, so running `inspect` once after all the parts are attached is enough.

{% admonition(type="tip") %}
If you see `libwasmer.dylib` or "image not found" errors, revisit the Wasmer setup.
{% end %}

## Test the View

1. Before deploying, validate that the View builds and compiles successfully:

    ```shell
    viewkit view test testdeploy
    ```

    ```output
    🔍 Loading view...
    ⚙️  Ensuring DefraDB binary...
    📁 Creating temporary root directory...
    🚀 Starting DefraDB...
    ⏳ Waiting for DefraDB to boot...
    ✅ DefraDB booted
    📦 Applying schema...
    ✅ Schema applied
    📨 Inserting test data...
    ⏳ Data Inserting...
    ✅ Data Inserted Successfully
    ✅ Data inserted
    🧠 Applying view...
    ✅ View applied
    🔎 Extracting collection name...
    ♻️  Refreshing view...
    ✅ View refreshed
    ✅ Test flow completed successfully. Shutting down...
    ✅ DefraDB stopped.
    ```

    This spins up a temporary local DefraDB instance, applies the schema, runs the lens, and checks that everything compiles. If it passes, the View is ready to deploy.

## Create a deployment wallet

Deploying to the network registers the View on chain, so you need a wallet to sign that transaction.

1. Generate a wallet:

    ```shell
    viewkit wallet generate
    ```

    ```output
    ✅ Wallet generated
    Mnemonic: document grass code lawn erosion climb people sunset three blame balcony story script hip soup lesson resemble above quiz acid dust salmon plane
    Address: 0x2e4150993E841b38f4780BC158A7dA0d62E22ec9
    ```

1. Treat this wallet like any other secret:

    - Do not commit it to Git.
    - Do not paste the mnemonic in public places.
    - Store it securely.

## Fund the wallet

Registration is an on-chain transaction, so the wallet needs tokens to pay the transaction fee.

1. Open the [Shinzo faucet](https://faucet.shinzo.network/) in your browser.
1. Paste the address from `viewkit wallet generate` into the input.
1. Click **Get 0.001 $SHN**.

The faucet shows the transaction hash once the tokens are sent. You only need to do this once per wallet.

## Deploy locally

The recommended flow is to deploy locally first, verify the View in the DefraDB Playground, then deploy to the network.

1. Deploy locally:

    ```shell
    viewkit view deploy testdeploy --target local
    ```

    ```output
    🚀 DefraDB is running on port 9181
    ⏳ Waiting for DefraDB to boot up...
    ✅ DefraDB booted up
    ⏳ Applying Schemas ...
    ✅ Schema Applied
    ⏳ Data Inserting...
    ✅ Data Inserted Successfully
    ✅ Applying View ...
    ✅ View Successfully Applied
    🧪 Visit the DefraDB GraphQL Playground at http://127.0.0.1:9181/
    📦 Press Ctrl+C to stop...
    ```

    Here's what happens:

    1. A local DefraDB instance starts (the port is in the logs).
    1. The schema for the View is applied.
    1. Test data is inserted.
    1. The View is applied.
    1. A DefraDB GraphQL Playground URL is printed.

### Use the DefraDB GraphQL Playground

This step is optional, but it is a good way to check the View before deploying it anywhere.

1. Open the displayed URL in your browser, usually [127.0.0.1:9181](http://127.0.0.1:9181/).
1. You should see a GraphQL Playground where you can:
    - Inspect the schema (for example, the `FilteredAndDecodedLogs` type).
    - Run test queries against the local View.
    - Confirm the lens decodes logs as expected.

    For example:

    ```graphql
    {
      FilteredAndDecodedLogs {
        transactionHash
      }
    }
    ```

While this process is running, `viewkit` keeps the local DefraDB instance alive. Press `CTRL` + `c` to stop the DefraDB instance.

## Deploy to the public testnet

Once the View behaves correctly locally, deploy it to the public testnet.

1. Check that the wallet has a balance, and fund it from the [faucet](https://faucet.shinzo.network/) if needed.

1. Deploy the View to the network:

    ```shell
    viewkit view deploy testdeploy --target devnet --rpc http://testnet.shinzo.network:8545/
    ```

{% admonition(type="note") %}
The `--target devnet` flag name is historical. In the current Viewkit it is the right target for the public testnet (`--rpc http://testnet.shinzo.network:8545/`). The CLI's `mainnet` target is not supported yet, so `devnet` is the only network target that works.
{% end %}

The deploy command rebuilds and re-tests the View, sends a `register(bytes)` transaction to the View Registry precompile, and prints the result:

```output
🔧 Building and testing view before deployment...
⏳ View built and tested successfully. Deploying...
✅ View deployment successful!
----------------------------------------
🔑 View ID:           FilteredAndDecodedLogs_0x016c19db7f2cf5aa86d34b5779f58de913f92d12ec9ee3642587124ce712c123
🔑 View Key:          0x016c19db7f2cf5aa86d34b5779f58de913f92d12ec9ee3642587124ce712c123
📦 Transaction Hash:  0x7be8a3e99299ed017896ae76fb2811208380a459e36d49a0b4a7ac047747a2df
Wire bytes (tx data):96660
----------------------------------------
```

Registration completes asynchronously, so give it around 20 seconds before the View shows up on chain.

## Query your View

After registration, the View is on chain and any Host that picks it up can serve it.

1. Confirm your View is registered:

    ```shell
    curl "http://testnet.shinzo.network:1317/shinzonetwork/view/v1/views?include_data=false" \
      | jq -r '.views[] | select(.name | contains("FilteredAndDecodedLogs")) | .name, .address'
    ```

    ```output
    FilteredAndDecodedLogs
    0xa1226B03c54789e9Bf8876ac956aBbD1bDf5B654
    ```

1. Query the View against a public Host:

    ```shell
    HOST=$(curl -s "http://testnet.shinzo.network:1317/shinzonetwork/host/v1/hosts" \
      | jq -r '.hosts[0].endpoint_address')

    curl -X POST "$HOST" \
      -H 'Content-Type: application/json' \
      -d '{"query":"{ FilteredAndDecodedLogs(limit: 10) { transactionHash } }"}'
    ```

Until a Host picks up your View, a query against it returns a schema error:

```output
{"errors":[{"message":"Cannot query field \"FilteredAndDecodedLogs\" on type \"Query\"."}],"data":null}
```

Hosts subscribe to a View and serve it once it has a pool; a brand-new tutorial View usually has none yet. Signed querying is covered in [Query your first View](/build/tutorials/query-your-first-view/), and [Find Views and Hosts](/build/how-to/find-views-and-hosts/) shows how to locate Host endpoints and pools. Browse your View in [Shinzo Studio](https://studio.shinzo.network/) or the [Explorer](https://explorer.shinzo.network/).

## More examples

For progressively more complex View examples (decoding multiple event types, transaction-based Views without lenses, materialized versus on-query Views, editing and rolling back Views), see [View recipes](/build/how-to/view-recipes/), which includes both the View definitions and the GraphQL queries you run against them.

For the conceptual overview, see [Views for builders](/build/explanation/views-for-builders/). For the full command list, filter operators, VWL wire format, and deploy internals, see the [Viewkit reference](/reference/components/viewkit/). For a deeper dive on lenses, available modules, and how to chain them, see the [Lens reference](/reference/components/lens/). For troubleshooting and common errors, see [Operations: Troubleshooting](/run/operations/troubleshooting/).

## Need help

{{ need_help(client="Viewkit", repo_name="shinzo-view-creator", repo="https://github.com/shinzonetwork/shinzo-view-creator/issues") }}
