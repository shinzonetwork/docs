+++
title = "Quick Start"
description = "View Creator (Viewkit) is a CLI tool that helps you initialize, manage, and publish Shinzo views."
weight = 2
+++

View Creator (Viewkit) is a CLI tool that helps you initialize, manage, and publish Shinzo views.

## Prerequisites

- Git
- Make
- Go 1.25

## Setup

1. Make sure you've got all the prerequisites installed properly:

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

1. Build the viewkit binary:

    ```shell
    make build
    ```

    You should see a `build` directory:

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

1. Move the `viewkit` executable somewhere resonable and (optional):

    ```shell
    sudo mv ./build/viewkit /usr/local/bin
    ```

    Now you can run `viewkit` from anywhere.

## Wasmer runtime

Viewkit can execute WebAssembly lenses locally to validate and preview them.

Under the hood, it uses `wasmer-go`, which depends on a native dynamic library (`libwasmer.dylib`). If your local system cannot find that library, any command that touches lenses will fail with an error like:

> image not found
> library not loaded: libwasmer.dylib

1. Move back into the shinzo-view-creator repo if you moved out of it:

    ```shell
    cd shinzo-view-creator
    ```

1. Install the Wasmer Go module

    ```shell
    go get github.com/wasmerio/wasmer-go@v1.0.4
    ```

    ```output
    go: downloading github.com/wasmerio/wasmer-go v1.0.4
    go: added github.com/wasmerio/wasmer-go v1.0.4
    ```

    This ensures `wasmer-go` and its packaged native libraries are present in your `GOPATH`.

### Environment variables

We need to set three new environment variables:

- `WASMER_ROOT`: points to the directory where `libwasmer.dylib` lives.
- `WASMER_LIB_PATH`: used by `wasmer-go` to find the dynamic library.
- `DYLD_LIBRARY_PATH`: MacOS-specific dynamic loader search path. We prepend `WASMER_ROOT` so the loader can find `libwasmer.dylib` when `viewkit` starts.

1. Append these lines to your shell's RC file. 

    MacOS:

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

1. Verify that the variables are set:

    ```shell
    echo "$WASMER_ROOT"
    ls "$WASMER_ROOT"
    ```

    ```output
    /home/user/go/pkg/mod/github.com/wasmerio/wasmer-go@v1.0.4/wasmer/packaged/lib/linux-amd64
    dummy.go  libwasmer.so
    ```

> [!WARNING]
> If `libwasmer.dylib` is missing, re-run the `go get` step and ensure `go env GOPATH` returns a valid path.

## Create a view

Now that everything is set up, we can start creating and deploying views.

1. Initialize the view bundle:

    ```shell
    viewkit view init testdeploy
    ```

    ```output
    📄 View: testdeploy
    🔍 Query: <none>
    📐 SDL: <none>
    🔧 Lenses:
     - (empty)

    🗂  Metadata:
     - Version: 0
     - Total: 0
     - Created At: 2026-07-09 09:34:27 +0000 UTC
     - Updated At: 2026-07-09 09:34:27 +0000 UTC
    ```

    This:

    - Creates a new view bundle called `testdeploy` on disk.
    - Registers internal metadata for queries, SDL, lenses, and versions.

1. Inspect the bundle:

    ```shell
    viewkit view inspect testdeploy
    ```

    ```output
    📄 View: testdeploy
    🔍 Query: <none>
    📐 SDL: <none>
    🔧 Lenses:
     - (empty)

    🗂  Metadata:
     - Version: 0
     - Total: 0
     - Created At: 2026-07-09 09:34:27 +0000 UTC
     - Updated At: 2026-07-09 09:34:27 +0000 UTC
    ```

1. Next we're going to add a query (raw ingest shape). First, define the raw data shape to ingest, e.g. basic EVM logs:

    ```shell
    viewkit view add query \
      "Log {address topics data transactionHash blockNumber}" \
      --name testdeploy
    ```

    ```output
    📄 View: testdeploy
    🔍 Query:
    Log {address topics data transactionHash blockNumber}

    📐 SDL: <none>
    🔧 Lenses:
     - (empty)

    🗂  Metadata:
     - Version: 1
     - Total: 1
     - Created At: 2026-07-09 09:34:27 +0000 UTC
     - Updated At: 2026-07-09 09:36:32 +0000 UTC
    ```

    This tells Viewkit that `testdeploy` will ingest `Log` objects with the specified fields.

Then, check:

    ```shell
    viewkit view inspect testdeploy
    ```

    ```output
    📄 View: testdeploy
    🔍 Query:
    Log {address topics data transactionHash blockNumber}

    📐 SDL: <none>
    🔧 Lenses:
     - (empty)

    🗂  Metadata:
     - Version: 1
     - Total: 1
     - Created At: 2026-07-09 09:34:27 +0000 UTC
     - Updated At: 2026-07-09 09:36:32 +0000 UTC
    ```

1. Add an SDL to describe how the data is modeled/exposed:

    ```shell
    viewkit view add sdl \
      "type FilteredAndDecodedLogs @materialized(if: false) {transactionHash: String}" \
      --name testdeploy
    ```

    ```output
    📄 View: testdeploy
    🔍 Query:
    Log {address topics data transactionHash blockNumber}

    📐 SDL:
    type FilteredAndDecodedLogs @materialized(if: false) {transactionHash: String}

    🔧 Lenses:
     - (empty)

    🗂  Metadata:
     - Version: 2
     - Total: 2
     - Created At: 2026-07-09 09:34:27 +0000 UTC
     - Updated At: 2026-07-09 09:37:24 +0000 UTC
    ```

    > [!NOTE]
    >  - `@materialized(if: false)`: treat this as a virtual type, not a persisted table.
    > - `transactionHash: String`: minimal example field; real views will define more fields.

1. Inspect the view again:

    ```shell
    viewkit view inspect testdeploy
    # now shows both query and SDL
    ```

    ```output
    📄 View: testdeploy
    🔍 Query:
    Log {address topics data transactionHash blockNumber}

    📐 SDL:
    type FilteredAndDecodedLogs @materialized(if: false) {transactionHash: String}

    🔧 Lenses:
     - (empty)

    🗂  Metadata:
     - Version: 2
     - Total: 2
     - Created At: 2026-07-09 09:34:27 +0000 UTC
     - Updated At: 2026-07-09 09:37:24 +0000 UTC
    ```

    It now shows both the **query** _and_ the **SDL**.

1. Attach a WebAssembly lens that decodes event logs using an ABI. There are the flags we're using:

    - `--args`: JSON passed to the lens (here, an ABI definition for the ERC-20 `Transfer` event).
    - `--label "decode"`: human-readable label for the lens.
    - `--url`: remote URL of the `.wasm` binary.
    - `--name testdeploy`: attaches this lens to the `testdeploy` view.

    ```shell
    viewkit view add lens \
      --args '{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",\"inputs\":[{\"type\":\"address\",\"name\":\"from\",\"indexed\":true},{\"type\":\"address\",\"name\":\"to\",\"indexed\":true},{\"type\":\"uint256\",\"name\":\"value\",\"indexed\":false}]}]"}' \
      --label "decode" \
      --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm" \
      --name testdeploy
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
     - Created At: 2026-07-09 09:34:27 +0000 UTC
     - Updated At: 2026-07-09 09:39:11 +0000 UTC
    ```
1. Inspect the view again:

    ```shell
    viewkit view inspect testdeploy
    # you should now see:
    # - query
    # - SDL
    # - lens "decode"
    ```

    You should now see the **query**, **SDL**, _and_, the lens `decode`:

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
     - Created At: 2026-07-09 09:34:27 +0000 UTC
     - Updated At: 2026-07-09 09:39:11 +0000 UTC
    ```

> ![TIP]
> If you see `libwasmer.dylib` / "image not found" errors, revisit the Wasmer setup.

1. Before deploying, validate that your view builds and compiles successfully:

    ```shell
    viewkit view test testdeploy
    ```

    This spins up a temporary local DefraDB instance, applies your schema, runs the lens, and checks that everything compiles. If it passes, your view is ready to deploy.

## Create a deployment key

You need a wallet to sign deployments to `devnet`.

1. Generate a one:

    ```shell
    viewkit wallet generate
    ```

    ```output
    ✅ Wallet generated
    Mnemonic: document grass code lawn erosion climb people sunset three blame balcony story script hip soup lesson resemble above quiz acid dust salmon plane
    Address: 0x2e4150993E841b38f4780BC158A7dA0d62E22ec9
    ```

1. Treat this wallet like any other secret or asset:

    - Do not commit it to Git.
    - Do not paste the mnemonic in public places.
    - Store it securely.

## Deploy locally

The recommended flow is to deploy locally first, verify the view in a Playground, then deploy to a shared network.

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

    Here's what's happening:
    
    1. A local DefraDB instance is started (port shown in the logs).
    1. Schemas for your view are applied.
    1. Any seed data (if configured) is inserted.
    1. The view is applied.
    1. A DefraDB GraphQL Playground URL is printed.

### Use the DefraDB GraphQL Playground

This section is optional, but it's a good idea to check the View within the built-in GraphQL Playground.

1. Open the displayed URL in your browser, usually [127.0.0.1:9181](http://127.0.0.1:9181/).
1. You should see a GraphQL Playground.
1. Within thie Playground you can:
    - Inspect the schema (e.g. see `FilteredAndDecodedLogs`).
    - Run test queries against your local view.
    - Verify that your lens is filtering logs as expected.

For example, you can run a query like:

```graphql
{
  filteredAndDecodedLogs {
    transactionHash
  }
}
```

While this process is running, `viewkit` will keep the local DefraDB instance alive. Press `CTRL` + `c` to stop the DefraDB instance.

## Deploy to devnet

Once your view behaves correctly locally, you can deploy it to a shared network.

1. Gather an RPC URL.
1. Deploy the view to the network:

    ```shell
    viewkit view deploy testdeploy --target devnet --rpc http://testnet.shinzo.network:8545/
    ```

    You should see a transaction hash or deployment ID, and a status message indicating success.

<!-- If it fails: -->
<!---->
<!-- - Confirm your wallet is present and funded (if required) -->
<!-- - Confirm `devnet` is a valid target -->
<!-- - Re-check the view definition with `viewkit view inspect testdeploy` -->
<!---->
<!-- ## Full flow cheat sheet -->
<!---->
<!-- Here is the entire flow summarized: -->
<!---->
<!-- ```shell -->
<!-- # 0) clone + build -->
<!-- cd ~/code -->
<!-- git clone https://github.com/shinzonetwork/shinzo-view-creator.git -->
<!-- cd shinzo-view-creator -->
<!-- make build -->
<!-- export PATH="$PWD/build:$PATH" -->
<!---->
<!-- # 1) initialize the view bundle -->
<!-- viewkit view init testdeploy -->
<!---->
<!-- # 2) inspect the bundle -->
<!-- viewkit view inspect testdeploy -->
<!---->
<!-- # 3) add a query (raw event shape to ingest) -->
<!-- viewkit view add query \ -->
<!--   "Log {address topics data transactionHash blockNumber}" \ -->
<!--   --name testdeploy -->
<!---->
<!-- # 4) add SDL (how data is modeled/stored) -->
<!-- viewkit view add sdl \ -->
<!--   "type FilteredAndDecodedLogs @materialized(if: false) {transactionHash: String}" \ -->
<!--   --name testdeploy -->
<!---->
<!-- # 5) attach a lens (WASM transform to decode Transfer events) -->
<!-- viewkit view add lens \ -->
<!--   --args '{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",\"inputs\":[{\"type\":\"address\",\"name\":\"from\",\"indexed\":true},{\"type\":\"address\",\"name\":\"to\",\"indexed\":true},{\"type\":\"uint256\",\"name\":\"value\",\"indexed\":false}]}]"}' \ -->
<!--   --label "decode" \ -->
<!--   --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm" \ -->
<!--   --name testdeploy -->
<!---->
<!-- # 6) create a wallet for deployments (one-time) -->
<!-- viewkit wallet generate -->
<!---->
<!-- # 7) test the view locally (optional but recommended) -->
<!-- viewkit view test testdeploy -->
<!---->
<!-- # 8) deploy locally and use the DefraDB Playground -->
<!-- viewkit view deploy testdeploy --target local -->
<!-- # -> follow the printed URL (e.g. http://127.0.0.1:9181/) for the GraphQL Playground -->
<!-- # -> press Ctrl+C in the terminal to stop -->
<!---->
<!-- # 9) once you're happy, deploy to devnet -->
<!-- viewkit view deploy testdeploy --target devnet --rpc http://34.29.171.79:8545/ -->
<!-- ``` -->
<!---->
<!-- This gives you a clean path from GitHub clone to a locally tested view and then to a devnet deployment. -->
<!---->
<!-- ## Next steps -->
<!---->
<!-- - [Examples](/views/examples/): copy-pasteable views from minimal filters to multi-lens decode pipelines, including how to edit and update an existing view. -->
<!-- - [Lenses](/views/lenses/): how WASM transforms work, available lenses, and how to chain them. -->
<!-- - [FAQ](/views/faq/): troubleshooting, common errors, and tips. -->
<!-- - [Building Apps With Shinzo](/guides/building-apps-with-shinzo/): how to query your deployed Views from an application using the app-sdk. -->
