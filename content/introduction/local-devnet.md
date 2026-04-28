# Local devnet

This tutorial walks through spinning up a local Ethereum development network using Geth, deploying an ERC-20 smart contract to it, connecting the Shinzo indexer and host so blockchain data is indexed into DefraDB and queryable via GraphQL, and creating a View to transform and expose that data.

### Prerequisites

You will need a cloud VM running Ubuntu 24.04 on amd64. The indexer and host Docker images are amd64-only and will not run on arm64. You will also need a GitHub account with access to the Shinzo container registry, and the following tools installed on your VM:

- Geth
- Go 1.25
- Foundry
- Docker (with your user added to the `docker` group)
- Make

If you've got these installed, you can skip to the next section. Otherwise:

1. Install Geth:

    ```shell
    sudo add-apt-repository -y ppa:ethereum/ethereum
    sudo apt install -y geth
    ```

Install Go 1.25:

```shell
wget https://go.dev/dl/go1.25.4.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.25.4.linux-amd64.tar.gz
export PATH=/usr/local/go/bin:$PATH
```

Install Foundry:

```shell
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
```

Install Docker and Make:

```shell
sudo apt install -y make
```

Follow the [official Docker install guide](https://docs.docker.com/engine/install/ubuntu/) for Ubuntu, then add your user to the `docker` group and log in to the Shinzo container registry using a GitHub Personal Access Token with the `read:packages` scope:

```shell
echo YOUR_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

## Geth

Geth is the Go implementation of an Ethereum node. Running it in `--dev` mode gives you a lightweight, single-node private chain with a pre-funded account and instant block production on demand. This is the foundation everything else connects to: the indexer watches it for new blocks, and the contracts you deploy to it generate the on-chain data that flows through the rest of the stack.

### Start Geth in Dev Mode

Start Geth with HTTP and WebSocket RPC enabled so both the indexer and the Geth console can connect to it.

```shell
geth --dev \
  --http \
  --http.addr 0.0.0.0 \
  --http.api eth,net,web3 \
  --http.vhosts='*' \
  --ws \
  --ws.addr 0.0.0.0 \
  --ws.api eth,net,web3 \
  --verbosity 3
```

Key things to note from the output:

- Geth logs a pre-funded developer account address and private key. Save these, you will need them later.
- HTTP RPC listens on `0.0.0.0:8545`.
- WebSocket listens on `0.0.0.0:8546`.
- The chain only mines a block when a transaction is pending. It will not produce empty blocks.

### Verify Geth is Running

Check the chain is responding by querying the current block number.

```shell
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

```output
{"jsonrpc":"2.0","id":1,"result":"0x0"}
```

`0x0` means the chain is at block zero, which is correct for a fresh devnet.

### Attach the Geth Console and Test

Attach to the running node to confirm the pre-funded account is available and test that transactions trigger block mining.

```shell
geth attach http://localhost:8545
```

```output
Welcome to the Geth JavaScript console!
instance: Geth/v1.17.2-stable-be4dc0c4/linux-amd64/go1.25.7
at block: 0 (...)
modules: eth:1.0 net:1.0 rpc:1.0 web3:1.0
```

Check your dev account and balance:

```javascript
eth.accounts
eth.getBalance(eth.accounts[0])
```

The balance will be an enormous number. That is the pre-funded dev account balance in wei, essentially unlimited play money.

Send a test transaction to trigger block mining:

```javascript
eth.sendTransaction({from: eth.accounts[0], to: eth.accounts[0], value: 1})
```

Confirm the block number advanced:

```javascript
eth.blockNumber
```

```output
1
```

## Indexer

The Shinzo Indexer watches your Geth node for new blocks and writes the raw blockchain data (blocks, transactions, logs) into an embedded DefraDB instance. This is the first layer of the Shinzo stack: it takes on-chain primitives and makes them queryable via GraphQL. It also exposes a P2P endpoint so the Host can replicate data from it.

### Pull the Indexer Image

Pull the pre-built indexer image from the Shinzo container registry.

```shell
docker pull ghcr.io/shinzonetwork/shinzo-indexer-client:standard
```

### Run the Indexer

Get your VM's public IP, then start the indexer pointing it at your Geth node.

```shell
hostname -I
```

```output
49.13.171.210 172.17.0.1 2a01:4f8:...
```

Use the first IP in the output:

```shell
docker run --rm \
  -e GETH_RPC_URL=http://YOUR_VM_IP:8545 \
  -e GETH_WS_URL=ws://YOUR_VM_IP:8546 \
  -e GETH_API_KEY="" \
  -e INDEXER_START_HEIGHT=0 \
  -e DEFRADB_KEYRING_SECRET=devnet-secret \
  -e DEFRADB_PLAYGROUND=true \
  -e DEFRADB_P2P_ENABLED=true \
  -e DEFRADB_P2P_LISTEN_ADDR=/ip4/0.0.0.0/tcp/9174 \
  -e LOGGER_DEBUG=true \
  -p 9181:9181 \
  -p 9174:9174 \
  ghcr.io/shinzonetwork/shinzo-indexer-client:standard
```

You should see the indexer connect to Geth, index block 0, and then wait for new blocks:

```output
INFO    No existing blocks, starting from 0 (chain tip: 0)
INFO    Starting indexer - will process latest blocks from Geth http://YOUR_VM_IP:8545
DEBUG   Block 0: block sig created, 1 CIDs (expected ~1), merkle: ab188cf26947bb53, verified: true
INFO    Committed block 0 (ID: bae-5dda79eb-b0eb-539b-83c5-5c73ab2b8d0d)
INFO    Block 1 not available yet, waiting...
```

### Get the Indexer's Peer ID

Note the indexer's Peer ID so you can connect the Host to it later.

```shell
docker logs $(docker ps --filter "ancestor=ghcr.io/shinzonetwork/shinzo-indexer-client:standard" -q) 2>&1 | grep "PeerId"
```

```output
Apr 23 ...: Created LibP2P host PeerId=12D3KooW... Address=[/ip4/0.0.0.0/tcp/9174]
```

Note down the `PeerId` value.

### Verify Data in DefraDB

Query DefraDB to confirm blocks are being indexed.

First check what query fields are available:

```shell
curl -s -X POST http://localhost:9181/api/v0/graphql \
  -H "Content-Type: application/json" \
  --data '{"query":"{ __schema { queryType { fields { name } } } }"}'
```

Then query the indexed blocks:

```shell
curl -s -X POST http://localhost:9181/api/v0/graphql \
  -H "Content-Type: application/json" \
  --data '{"query":"{ Ethereum__Mainnet__Block { hash number } }"}'
```

```output
{
  "data": {
    "Ethereum__Mainnet__Block": [
      { "hash": "0xfa742c...", "number": 0 },
      { "hash": "0xdba7dc...", "number": 1 }
    ]
  }
}
```

## Smart Contract

Deploying a smart contract gives the indexer something more interesting to capture than plain ETH transfers. An ERC-20 token contract emits a `Transfer` event on every token mint and transfer, which produces log data that flows through the full Shinzo stack and demonstrates the value of the View layer later on.

### Create and Deploy an ERC-20 Token Contract

Create a Foundry project, install OpenZeppelin, write a simple ERC-20 token contract, and deploy it to the devnet.

```shell
forge init shinzo-token && cd shinzo-token
forge install OpenZeppelin/openzeppelin-contracts
```

Create the token contract:

```shell
cat > src/ShinzoToken.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ShinzoToken is ERC20 {
    constructor() ERC20("ShinzoToken", "SHINZO") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
EOF
```

Set up the OpenZeppelin import remapping:

```shell
cat > remappings.txt << 'EOF'
@openzeppelin/=lib/openzeppelin-contracts/
EOF
```

Compile the contract:

```shell
forge build
```

```output
[...] Compiler run successful!
```

Deploy it to the devnet, replacing `YOUR_PRIVATE_KEY` with the key Geth logged on startup:

```shell
forge create src/ShinzoToken.sol:ShinzoToken \
  --rpc-url http://localhost:8545 \
  --private-key YOUR_PRIVATE_KEY \
  --broadcast
```

```output
Deployer: 0x71562b71999873DB5b286dF957af199Ec94617F7
Deployed to: 0xdB7d6AB1f17c6b31909aE466702703dAEf9269Cf
Transaction hash: 0x529f6b...
```

Note down the `Deployed to` address. You will need it in the next step.

### Send a Token Transfer

Send a token transfer to emit a `Transfer` event, which the indexer will capture as a log.

```shell
cast send YOUR_CONTRACT_ADDRESS \
  "transfer(address,uint256)" \
  YOUR_DEV_ACCOUNT_ADDRESS \
  1000 \
  --rpc-url http://localhost:8545 \
  --private-key YOUR_PRIVATE_KEY
```

Watch the indexer terminal. You should see it pick up the new block and commit it to DefraDB.

### Query the Indexed Data

Query transactions and logs from DefraDB to confirm the contract deployment and transfer were captured.

Query all indexed transactions:

```shell
curl -s -X POST http://localhost:9181/api/v0/graphql \
  -H "Content-Type: application/json" \
  --data '{"query":"{ Ethereum__Mainnet__Transaction { hash blockNumber } }"}'
```

```output
{
  "data": {
    "Ethereum__Mainnet__Transaction": [
      { "blockNumber": 1, "hash": "0xf627c0..." },
      { "blockNumber": 2, "hash": "0x529f6b..." },
      { "blockNumber": 3, "hash": "0x79c4dc..." }
    ]
  }
}
```

Query the indexed logs to see the Transfer events:

```shell
curl -s -X POST http://localhost:9181/api/v0/graphql \
  -H "Content-Type: application/json" \
  --data '{"query":"{ Ethereum__Mainnet__Log { address topics blockNumber } }"}'
```

You should see two `Transfer` events. One from the contract deployment, where tokens were minted from the zero address to your dev account, and one from the token transfer. The first topic on both (`0xddf252ad...`) is the keccak256 hash of `Transfer(address,address,uint256)`, which is the standard ERC-20 Transfer event signature identical across every Ethereum network.

## Host

The Shinzo Host receives primitive blockchain data from Indexers via P2P replication and applies Lens transforms to produce Views. It runs its own embedded DefraDB instance and exposes a separate GraphQL API. Connecting the Host to the Indexer completes the data pipeline from chain to queryable View.

### Pull the Host Image

Pull the pre-built host image from the Shinzo container registry.

```shell
docker pull ghcr.io/shinzonetwork/shinzo-host-client:latest
```

### Create the Host Config

Create the data directories and config file the host container expects, replacing `YOUR_INDEXER_PEER_ID` with the PeerId you noted earlier.

```shell
mkdir -p ~/data/defradb ~/data/lens
```

```shell
cat > ~/config.yaml << 'EOF'
defradb:
  url: "localhost:9181"
  keyring_secret: "devnet-secret"
  p2p:
    enabled: true
    bootstrap_peers: ["/ip4/172.17.0.1/tcp/9174/p2p/YOUR_INDEXER_PEER_ID"]
    listen_addr: "/ip4/0.0.0.0/tcp/9171"
    max_retries: 5
    retry_base_delay_ms: 1000
    reconnect_interval_ms: 60000
    enable_auto_reconnect: true
  store:
    path: "./.defra"

shinzo:
  minimum_attestations: 1
  start_height: 0
  hub_base_url: ""
  wait_for_gaps: true
  max_gap_size: 1000
  cache_queue_size: 50000
  view_inactivity_timeout: "24h"
  view_cleanup_interval: "1h"
  view_worker_count: 20
  view_queue_size: 5000
  batch_processing_enabled: true
  batch_max_views_per_job: 50
  batch_query_cache_size: 1000
  batch_writer_count: 8
  batch_size: 500
  batch_flush_interval: 100
  use_block_signatures: true
  doc_worker_count: 32
  doc_queue_size: 50000
  event_filter:
    enabled: false

pruner:
  enabled: false

logger:
  development: true
  level: "info"

host:
  lens_registry_path: "./.defra/lens"
  health_server_port: 8080
  open_browser_on_start: false

snapshot:
  enabled: false
EOF
```

The `172.17.0.1` address is the Docker bridge gateway, reachable from any container on the same host.

### Run the Host

Start the host container, mapping its internal ports to different external ports to avoid conflicts with the indexer.

```shell
docker run --rm \
  -p 9183:9181 \
  -p 9182:9182 \
  -p 9175:9171 \
  -v ~/data/defradb:/app/.defra/data \
  -v ~/data/lens:/app/.lens \
  -v ~/config.yaml:/app/config.yaml:ro \
  ghcr.io/shinzonetwork/shinzo-host-client:latest
```

Look for this line in the output to confirm the host has connected to the indexer:

```output
Connected to peer /ip4/172.17.0.1/tcp/9174/p2p/YOUR_INDEXER_PEER_ID on attempt 1
```

### Verify Data is Replicating

Send a transaction to produce a new block, then query the host to confirm replication is working.

Send a transaction from the Geth console:

```javascript
eth.sendTransaction({from: eth.accounts[0], to: eth.accounts[0], value: 1})
```

Then query the host's GraphQL API on port 9183:

```shell
curl -s -X POST http://localhost:9183/api/v0/graphql \
  -H "Content-Type: application/json" \
  --data '{"query":"{ Ethereum__Mainnet__Block { hash number } }"}' | jq
```

```output
{
  "data": {
    "Ethereum__Mainnet__Block": [
      { "hash": "0xa86835...", "number": 4 }
    ]
  }
}
```

Note that passive replication only syncs new documents created after the P2P connection was established. Historical blocks will not appear in the host's DefraDB.

## View

A View is a versioned bundle that defines what blockchain data you want to expose and how to transform it. It consists of a query (the raw data shape to ingest), an SDL (the GraphQL schema describing the output), and optionally one or more lenses (WASM transforms that filter or decode the raw data). In this section we create a View that decodes raw ERC-20 Transfer log data into structured `from`, `to`, and `amount` fields, demonstrating how Shinzo turns low-level on-chain data into something immediately useful to an application while preserving cryptographic verifiability.

### Install Viewkit

Clone the Viewkit repo and build the CLI.

```shell
git clone https://github.com/shinzonetwork/shinzo-view-creator.git && cd shinzo-view-creator
make build
```

Verify the build:

```shell
./build/viewkit --help
```

```output
Viewkit helps you initialize, manage, and publish Shinzo views through a simple CLI interface.
Usage:
  viewkit [command]
Available Commands:
  completion  Generate the autocompletion script for the specified shell
  help        Help about any command
  tools       Developer tools for working with the Viewkit
  view        Commands for working with views
  wallet      Manage your Shinzo wallet
...
```

### Initialise the View

Create a new versioned view bundle on disk.

```shell
./build/viewkit view init shinzo-token-transfers
```

```output
📄 View: shinzo-token-transfers
🔍 Query: <none>
📐 SDL: <none>
🔧 Lenses:
 - (empty)
🗂  Metadata:
 - Version: 0
```

### Add the Query

Define the raw primitive data shape to ingest from the indexer, in this case the ERC-20 log fields.

```shell
./build/viewkit view add query "Log {address topics data transactionHash blockNumber}" --name shinzo-token-transfers
```

```output
📄 View: shinzo-token-transfers
🔍 Query:
Log {address topics data transactionHash blockNumber}
📐 SDL: <none>
...
```

### Add the SDL

Define the GraphQL type that transformed data will be stored as.

```shell
./build/viewkit view add sdl "type TokenTransfer @materialized(if: false) {from: String, to: String, amount: String, blockNumber: Int, transactionHash: String}" --name shinzo-token-transfers
```

```output
📄 View: shinzo-token-transfers
🔍 Query:
Log {address topics data transactionHash blockNumber}
📐 SDL:
type TokenTransfer @materialized(if: false) {from: String, to: String, amount: String, blockNumber: Int, transactionHash: String}
...
```

### Add the Lens

Attach the `decode_log` WASM lens, passing it the standard ERC-20 Transfer event ABI so it knows how to decode the raw log topics.

```shell
./build/viewkit view add lens \
  --args '{"abi":"[{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"from\",\"type\":\"address\"},{\"indexed\":true,\"name\":\"to\",\"type\":\"address\"},{\"indexed\":false,\"name\":\"value\",\"type\":\"uint256\"}],\"name\":\"Transfer\",\"type\":\"event\"}]"}' \
  --label "decode-transfer-log" \
  --url "https://raw.githubusercontent.com/shinzonetwork/wasm-bucket/main/bucket/decode_log/decode_log.wasm" \
  --name shinzo-token-transfers
```

```output
📄 View: shinzo-token-transfers
🔍 Query:
Log {address topics data transactionHash blockNumber}
📐 SDL:
type TokenTransfer @materialized(if: false) {...}
🔧 Lenses:
 - decode-transfer-log (assets/decode-transfer-log.wasm)
   Arguments:
     abi: [{"anonymous":false,...}]
...
```

### Inspect the View

Confirm the query, SDL, and lens are all present before deploying.

```shell
./build/viewkit view inspect shinzo-token-transfers
```

### Generate a Wallet

Generate a wallet to sign the deployment transaction, and save the mnemonic somewhere safe.

```shell
./build/viewkit wallet generate
```

```output
Mnemonic: word word word ...
Address: 0x...
```

## How it fits together

```
Geth (--dev) → mines blocks on demand
      ↓
Shinzo Indexer → watches for new blocks via HTTP/WS RPC
      ↓
DefraDB (embedded in indexer) → stores indexed block/transaction/log data
      ↓ (P2P passive replication)
DefraDB (embedded in host) → receives replicated data
      ↓
View (lens transform) → decodes raw log data into structured TokenTransfer documents
      ↓
GraphQL API (port 9183) → query the transformed data
```
