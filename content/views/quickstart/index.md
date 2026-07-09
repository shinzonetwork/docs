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

    Then you can run `viewkit` from anywhere:

    ```shell
    cd ~
    viewkit --help
    ```

## Wasmer runtime

Viewkit can execute WebAssembly lenses locally to validate and preview them.

Under the hood, it uses `wasmer-go`, which depends on a native dynamic library (`libwasmer.dylib`). If macOS cannot find that library, any command that touches lenses will fail with an error like:

> image not found
> library not loaded: libwasmer.dylib

This section explains how to set that up.

### Install the Wasmer Go module

From the repo root:

```shell
go get github.com/wasmerio/wasmer-go@v1.0.4
```

This ensures `wasmer-go` and its packaged native libraries are present in your `GOPATH`.

### Environment variables

We will use three environment variables:

- `WASMER_ROOT`: points to the directory where `libwasmer.dylib` lives.
- `WASMER_LIB_PATH`: used by `wasmer-go` to find the dynamic library.
- `DYLD_LIBRARY_PATH`: macOS dynamic loader search path. We prepend `WASMER_ROOT` so the loader can find `libwasmer.dylib` when `viewkit` starts.

### Configure the env vars

Append these lines to your `~/.zshrc` if on Apple Silicon:

```shell
echo 'export WASMER_ROOT="$(go env GOPATH)/pkg/mod/github.com/wasmerio/wasmer-go@v1.0.4/wasmer/packaged/lib/darwin-aarch64"' >> ~/.zshrc
echo 'export WASMER_LIB_PATH="$WASMER_ROOT"' >> ~/.zshrc
echo 'export DYLD_LIBRARY_PATH="$WASMER_ROOT:$DYLD_LIBRARY_PATH"' >> ~/.zshrc
```

Otherwise append these lines to your `~/.zshrc` if on Linux:

```shell
echo 'export WASMER_ROOT="$(go env GOPATH)/pkg/mod/github.com/wasmerio/wasmer-go@v1.0.4/wasmer/packaged/lib/linux-amd64"' >> ~/.zshrc
echo 'export WASMER_LIB_PATH="$WASMER_ROOT"' >> ~/.zshrc
echo 'export LD_LIBRARY_PATH="$WASMER_ROOT:$LD_LIBRARY_PATH"' >> ~/.zshrc
```

Reload your shell configuration:

```shell
source ~/.zshrc
```

Verify:

```shell
echo "$WASMER_ROOT"
ls "$WASMER_ROOT"
# you should see libwasmer.dylib here
```

If `libwasmer.dylib` is missing, re-run the `go get` step and ensure `go env GOPATH` returns a valid path.

## Concepts: views, queries, SDL, lenses, wallets

Viewkit revolves around views. Each view is a bundle that includes:

- Metadata: name, version, target info.
- Query: the raw shape of data to ingest (for example: `Log { address topics data transactionHash blockNumber }`).
- SDL (GraphQL): how that data is modeled/exposed (for example: `type FilteredAndDecodedLogs { transactionHash: String }`).
- Lenses (WASM): chained transforms that filter/decode/reshape data.
- Wallet: key used to sign deployments to a target network (`local`, `devnet`, etc.).

Think of the pipeline as:

**raw data -> query -> lenses (WASM) -> GraphQL SDL -> view stored + queryable**

## Quickstart: create and deploy a view

We'll walk end-to-end through an example view named `testdeploy`:

1. Initialize the view bundle.
1. Inspect it.
1. Add a query.
1. Add SDL.
1. Attach a lens.
1. Generate a wallet.
1. Test the view locally.
1. Deploy locally (with DefraDB Playground).
1. Deploy to devnet.

> All commands assume `viewkit` is on your PATH.
> If not, replace `viewkit` with `./build/viewkit`.

### Initialize the view bundle

```shell
viewkit view init testdeploy
```

This:

- Creates a new view bundle called `testdeploy` on disk.
- Registers internal metadata for queries, SDL, lenses, and versions.

### Inspect the bundle

```shell
viewkit view inspect testdeploy
```

You should see something like:

- View name: `testdeploy`
- A version / ID
- Initially empty or default sections for:
    - Queries
    - SDL
    - Lenses

### Add a query (raw ingest shape)

Define the raw data shape to ingest, e.g. basic EVM logs:

```shell
viewkit view add query \
  "Log {address topics data transactionHash blockNumber}" \
  --name testdeploy
```

This tells Viewkit that `testdeploy` will ingest `Log` objects with the specified fields.

Check:

```shell
viewkit view inspect testdeploy
# now the query is attached to the view
```

### Add SDL (GraphQL schema)

Add SDL to describe how the data is modeled/exposed:

```shell
viewkit view add sdl \
  "type FilteredAndDecodedLogs @materialized(if: false) {transactionHash: String}" \
  --name testdeploy
```

Notes:

- `@materialized(if: false)`: treat this as a virtual type, not a persisted table.
- `transactionHash: String`: minimal example field; real views will define more fields.

Inspect again:

```shell
viewkit view inspect testdeploy
# now shows both query and SDL
```

### Attach a lens (WASM transform)

Attach a WebAssembly lens that decodes event logs using an ABI:

```shell
viewkit view add lens \
  --args '{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",\"inputs\":[{\"type\":\"address\",\"name\":\"from\",\"indexed\":true},{\"type\":\"address\",\"name\":\"to\",\"indexed\":true},{\"type\":\"uint256\",\"name\":\"value\",\"indexed\":false}]}]"}' \
  --label "decode" \
  --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm" \
  --name testdeploy
```

Flags:

- `--args`: JSON passed to the lens (here, an ABI definition for the ERC-20 `Transfer` event).
- `--label "decode"`: human-readable label for the lens.
- `--url`: remote URL of the `.wasm` binary.
- `--name testdeploy`: attaches this lens to the `testdeploy` view.

Inspect:

```shell
viewkit view inspect testdeploy
# you should now see:
# - query
# - SDL
# - lens "decode"
```

If you see `libwasmer.dylib` / "image not found" errors, revisit the Wasmer setup.

### Test the view locally

Before deploying, validate that your view builds and compiles successfully:

```shell
viewkit view test testdeploy
```

This spins up a temporary local DefraDB instance, applies your schema, runs the lens, and checks that everything compiles. If it passes, your view is ready to deploy.

## Wallet: create a deployment key

You need a wallet to sign deployments to `devnet`.

Generate one:

```shell
viewkit wallet generate
```

This will:

- Create a new keypair.
- Store it in the wallet directory used by Viewkit.
- Print details such as the address (and possibly a mnemonic/seed).

Treat it like any other wallet:

- Do not commit it to Git.
- Do not paste the mnemonic in public places.
- Store it securely.

## Deploy locally

The recommended flow is to deploy locally first, verify the view in a Playground, then deploy to a shared network like devnet.

Deploy to local:

```shell
viewkit view deploy testdeploy --target local
```

On success, you'll see output similar to:

```plaintext
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

What's happening:

1. A local DefraDB instance is started (port shown in the logs).
1. Schemas for your view are applied.
1. Any seed data (if configured) is inserted.
1. The view is applied.
1. A DefraDB GraphQL Playground URL is printed.

### Use the DefraDB GraphQL Playground

1. Open the displayed URL in your browser, e.g.:

    - `http://127.0.0.1:9181/`

1. You should see a GraphQL Playground / explorer.
1. You can:
    - Inspect the schema (e.g. see `FilteredAndDecodedLogs`).
    - Run test queries against your local view.
    - Verify that your lens is filtering logs as expected.

Example query (adjust to your SDL):

```graphql
{
  filteredAndDecodedLogs {
    transactionHash
  }
}
```

While this process is running, `viewkit` will keep the local DefraDB instance alive. To stop it:

- Go back to the terminal and press Ctrl+C.

To iterate:

- Update your view (queries/SDL/lenses).
- Use `view remove lens --label "decode" --name testdeploy` to detach a lens, then `view add lens` with new arguments to swap it.
- Use `view rollback testdeploy` to revert to a previous version if an edit goes wrong.
- Re-run:

  ```shell
  viewkit view deploy testdeploy --target local
  ```

- Refresh the Playground and test again.

## Deploy to devnet

Once your view behaves correctly locally, you can deploy it to devnet.

Make sure:

- A wallet has been generated: `viewkit wallet generate`
- Any required devnet config/credentials are set

Then:

```shell
viewkit view deploy testdeploy --target devnet --rpc http://34.29.171.79:8545/
```

Conceptually:

1. Viewkit bundles the `testdeploy` view definition (queries, SDL, lenses, metadata).
1. Signs a deployment transaction using your wallet.
1. Sends it to the devnet network.
1. Registers the view on devnet so it can be used and queried there.

On success, you should see:

- A transaction hash or deployment ID
- A status message indicating success

If it fails:

- Confirm your wallet is present and funded (if required)
- Confirm `devnet` is a valid target
- Re-check the view definition with `viewkit view inspect testdeploy`

## Full flow cheat sheet

Here is the entire flow summarized:

```shell
# 0) clone + build
cd ~/code
git clone https://github.com/shinzonetwork/shinzo-view-creator.git
cd shinzo-view-creator
make build
export PATH="$PWD/build:$PATH"

# 1) initialize the view bundle
viewkit view init testdeploy

# 2) inspect the bundle
viewkit view inspect testdeploy

# 3) add a query (raw event shape to ingest)
viewkit view add query \
  "Log {address topics data transactionHash blockNumber}" \
  --name testdeploy

# 4) add SDL (how data is modeled/stored)
viewkit view add sdl \
  "type FilteredAndDecodedLogs @materialized(if: false) {transactionHash: String}" \
  --name testdeploy

# 5) attach a lens (WASM transform to decode Transfer events)
viewkit view add lens \
  --args '{"abi":"[{\"type\":\"event\",\"name\":\"Transfer\",\"inputs\":[{\"type\":\"address\",\"name\":\"from\",\"indexed\":true},{\"type\":\"address\",\"name\":\"to\",\"indexed\":true},{\"type\":\"uint256\",\"name\":\"value\",\"indexed\":false}]}]"}' \
  --label "decode" \
  --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm" \
  --name testdeploy

# 6) create a wallet for deployments (one-time)
viewkit wallet generate

# 7) test the view locally (optional but recommended)
viewkit view test testdeploy

# 8) deploy locally and use the DefraDB Playground
viewkit view deploy testdeploy --target local
# -> follow the printed URL (e.g. http://127.0.0.1:9181/) for the GraphQL Playground
# -> press Ctrl+C in the terminal to stop

# 9) once you're happy, deploy to devnet
viewkit view deploy testdeploy --target devnet --rpc http://34.29.171.79:8545/
```

This gives you a clean path from GitHub clone to a locally tested view and then to a devnet deployment.

## Next steps

- [Examples](/views/examples/): copy-pasteable views from minimal filters to multi-lens decode pipelines, including how to edit and update an existing view.
- [Lenses](/views/lenses/): how WASM transforms work, available lenses, and how to chain them.
- [FAQ](/views/faq/): troubleshooting, common errors, and tips.
- [Building Apps With Shinzo](/guides/building-apps-with-shinzo/): how to query your deployed Views from an application using the app-sdk.
