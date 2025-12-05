---
title: Quick Start
sidebar_label: Quick Start
sidebar_position: 2
description: View Creator (**Viewkit**) is a CLI tool that helps you initialize, manage, and publish **Shinzo vie...
---


# View Creator

View Creator (**Viewkit**) is a CLI tool that helps you initialize, manage, and publish **Shinzo views**.

A **view** is a versioned bundle that can include:

- **Queries** – the raw data shape you want to ingest
- **SDL** – a GraphQL schema describing how data is modeled or materialized
- **Lenses** – WebAssembly transforms for filtering, decoding, or reshaping data
- **Wallet** – credentials used to sign deployments to a target network

This README walks you from **cloning the repo** to **deploying a view locally and on devnet**, including how to use the local DefraDB GraphQL Playground.

## 1. Prerequisites

**OS**

- macOS on Apple Silicon (M1/M2/M3) for the Wasmer setup below  
  (Linux/Intel will use a different Wasmer library path)

**Tools**

- `git`
- `make`
- **Go** 1.23+ installed and on your PATH

Check Go:

```bash
go version
# expect something like: go version go1.23.x ...
```

Optional but helpful:

- A code editor (VS Code, GoLand, etc.)
- Basic comfort with terminal commands

## 2. Clone the repository

From the directory where you keep your projects:

```bash
cd ~/code   # or any directory you prefer

git clone https://github.com/shinzonetwork/view-creator.git
cd view-creator
```

You are now at the **repo root** of `view-creator`.

## 3. Build the `viewkit` binary

From the repo root:

```bash
# from the repo root
make build
```

If the build is successful, you should see a `build` directory:

```bash
ls build
# viewkit  (plus any other build artifacts)
```

You can now run Viewkit via:

```bash
./build/viewkit --help
```

### Optional: add `viewkit` to your PATH

So you don’t have to type `./build` each time:

```bash
# assuming you're in the repo root
echo 'export PATH="$PWD/build:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Then you can run:

```bash
viewkit --help
```

from anywhere.

## 4. Wasmer runtime on macOS (Apple Silicon)

Viewkit can execute WebAssembly **lenses** locally to validate and preview them.

Under the hood, it uses `wasmer-go`, which depends on a native dynamic library (`libwasmer.dylib`). If macOS cannot find that library, any command that touches lenses will fail with an error like:

> image not found  
> library not loaded: libwasmer.dylib

This section explains how to set that up.

### 4.1 Install the Wasmer Go module

From the repo root:

```bash
go get github.com/wasmerio/wasmer-go@v1.0.4
```

This ensures `wasmer-go` and its packaged native libraries are present in your `GOPATH`.

### 4.2 Environment variables

We will use three environment variables:

- `WASMER_ROOT`  
  Points to the directory where the Apple Silicon `libwasmer.dylib` lives.

- `WASMER_LIB_PATH`  
  Used by `wasmer-go` to find the dynamic library.

- `DYLD_LIBRARY_PATH`  
  macOS dynamic loader search path. We prepend `WASMER_ROOT` so the loader can find `libwasmer.dylib` when `viewkit` starts.

### 4.3 Configure the env vars (Apple Silicon)

Append these lines to your `~/.zshrc`:

```bash
echo 'export WASMER_ROOT="$(go env GOPATH)/pkg/mod/github.com/wasmerio/wasmer-go@v1.0.4/wasmer/packaged/lib/darwin-aarch64"' >> ~/.zshrc
echo 'export WASMER_LIB_PATH="$WASMER_ROOT"' >> ~/.zshrc
echo 'export DYLD_LIBRARY_PATH="$WASMER_ROOT:$DYLD_LIBRARY_PATH"' >> ~/.zshrc
```

Reload your shell configuration:

```bash
source ~/.zshrc
```

Verify:

```bash
echo "$WASMER_ROOT"
ls "$WASMER_ROOT"
# you should see libwasmer.dylib here
```

If `libwasmer.dylib` is missing, re-run the `go get` step and ensure `go env GOPATH` returns a valid path.

## 5. Concepts: Views, queries, SDL, lenses, wallets

Viewkit revolves around **views**. Each view is a bundle that includes:

- **Metadata** – name, version, target info
- **Query** – the raw shape of data to ingest  
  (for example: `Log { address topics data transactionHash blockNumber }`)
- **SDL (GraphQL)** – how that data is modeled/exposed  
  (for example: `type FilteredAndDecodedLogs { transactionHash: String }`)
- **Lenses (WASM)** – chained transforms that filter/decode/reshape data
- **Wallet** – key used to sign deployments to a target network (`local`, `devnet`, etc.)

Think of the pipeline as:

> raw data → query → lenses (WASM) → GraphQL SDL → view stored + queryable

## 6. Quickstart: create and deploy a view (`testdeploy`)

We’ll walk end-to-end through an example view named **`testdeploy`**:

1. Initialize the view bundle
2. Inspect it
3. Add a query
4. Add SDL
5. Attach a lens
6. Generate a wallet
7. Deploy locally (with DefraDB Playground)
8. Deploy to devnet

> All commands assume `viewkit` is on your PATH.  
> If not, replace `viewkit` with `./build/viewkit`.

### 6.1 Initialize the view bundle

```bash
viewkit view init testdeploy
```

This:

- Creates a new **view bundle** called `testdeploy` on disk
- Registers internal metadata for queries, SDL, lenses, and versions

### 6.2 Inspect the bundle

```bash
viewkit view inspect testdeploy
```

You should see something like:

- View name: `testdeploy`
- A version / ID
- Initially empty or default sections for:
    - Queries
    - SDL
    - Lenses

### 6.3 Add a query (raw ingest shape)

Define the raw data shape to ingest, e.g. basic EVM logs:

```bash
viewkit view add query \
  "Log {address topics data transactionHash blockNumber}" \
  --name testdeploy
```

This tells Viewkit that `testdeploy` will ingest `Log` objects with the specified fields.

Check:

```bash
viewkit view inspect testdeploy
# now the query is attached to the view
```

### 6.4 Add SDL (GraphQL schema)

Add SDL to describe how the data is modeled/exposed:

```bash
viewkit view add sdl \
  "type FilteredAndDecodedLogs @materialized(if: false) {transactionHash: String}" \
  --name testdeploy
```

Notes:

- `@materialized(if: false)`  
  Treat this as a virtual type, not a persisted table.
- `transactionHash: String`  
  Minimal example field; real views will define more fields.

Inspect again:

```bash
viewkit view inspect testdeploy
# now shows both query and SDL
```

### 6.5 Attach a lens (WASM transform)

Attach a WebAssembly lens that filters logs by a specific address:

```bash
viewkit view add lens \
  --args '{"src":"address", "value":"0x1e3aA9fE4Ef01D3cB3189c129a49E3C03126C636"}' \
  --label "filter" \
  --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/filter_transaction/filter_transaction.wasm" \
  --name testdeploy
```

Flags:

- `--args` – JSON passed to the lens
- `--label "filter"` – human-readable label for the lens
- `--url` – remote URL of the `.wasm` binary
- `--name testdeploy` – attaches this lens to the `testdeploy` view

Inspect:

```bash
viewkit view inspect testdeploy
# you should now see:
# - query
# - SDL
# - lens "filter"
```

If you see `libwasmer.dylib` / “image not found” errors, revisit the Wasmer setup.

## 7. Wallet: create a deployment key

You need a wallet to sign deployments to `local` and `devnet`.

Generate one:

```bash
viewkit wallet generate
```

This will:

- Create a new keypair
- Store it in the wallet directory used by Viewkit
- Print details such as the address (and possibly a mnemonic/seed)

Treat it like any other wallet:

- Do not commit it to Git
- Do not paste the mnemonic in public places
- Store it securely

## 8. Deploy locally with `--target local`

The recommended flow is to deploy **locally** first, verify the view in a Playground, then deploy to a shared network like `devnet`.

Deploy to local:

```bash
viewkit view deploy testdeploy --target local
```

On success, you’ll see output similar to:

```text
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

What’s happening:

1. A local DefraDB instance is started (port shown in the logs).
2. Schemas for your view are applied.
3. Any seed data (if configured) is inserted.
4. The view is applied.
5. A **DefraDB GraphQL Playground URL** is printed.

### 8.1 Use the DefraDB GraphQL Playground

1. Open the displayed URL in your browser, e.g.:

    - `http://127.0.0.1:9181/`

2. You should see a GraphQL Playground / explorer.
3. You can:
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

- Go back to the terminal and press **Ctrl+C**.

To iterate:

- Update your view (queries/SDL/lenses).
- Re-run:

  ```bash
  viewkit view deploy testdeploy --target local
  ```

- Refresh the Playground and test again.

## 9. Deploy to devnet with `--target devnet`

Once your view behaves correctly locally, you can deploy it to **devnet**.

Make sure:

- A wallet has been generated: `viewkit wallet generate`
- Any required devnet config/credentials are set

Then:

```bash
viewkit view deploy testdeploy --target devnet
```

Conceptually:

1. Viewkit bundles the `testdeploy` view definition (queries, SDL, lenses, metadata).
2. Signs a deployment transaction using your wallet.
3. Sends it to the `devnet` network.
4. Registers the view on devnet so it can be used and queried there.

On success, you should see:

- A transaction hash or deployment ID
- A status message indicating success

If it fails:

- Confirm your wallet is present and funded (if required)
- Confirm `devnet` is a valid target
- Re-check the view definition with `viewkit view inspect testdeploy`

## 10. Full flow cheat sheet

Here is the entire flow summarized:

```bash
# 0) clone + build
cd ~/code
git clone https://github.com/shinzonetwork/view-creator.git
cd view-creator
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

# 5) attach a lens (WASM transform to filter by address)
viewkit view add lens \
  --args '{"src":"address", "value":"0x1e3aA9fE4Ef01D3cB3189c129a49E3C03126C636"}' \
  --label "filter" \
  --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/filter_transaction/filter_transaction.wasm" \
  --name testdeploy

# 6) create a wallet for deployments (one-time)
viewkit wallet generate

# 7) deploy locally and use the DefraDB Playground
viewkit view deploy testdeploy --target local
# -> follow the printed URL (e.g. http://127.0.0.1:9181/) for the GraphQL Playground
# -> press Ctrl+C in the terminal to stop

# 8) once you're happy, deploy to devnet
viewkit view deploy testdeploy --target devnet
```

This gives you a clean path from **GitHub clone** to a **locally tested view** and then to a **devnet deployment**.
