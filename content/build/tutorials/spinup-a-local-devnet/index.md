+++
title = "Spinup a local devnet"
description = "Tutorial: start a devnet locally on your machine to test basic Shinzo and blockchain functionality."
+++

This tutorial walks through spinning up a local Ethereum development network using Geth, deploying an ERC-20 smart contract to it, and connecting the Shinzo Generator client and Host so blockchain data is generated into DefraDB and queryable via GraphQL.

## How it fits together

Here's the basic flow for what we're about to build:

```plaintext
Geth (--dev) → mines blocks on demand
      ↓
Shinzo Generator client → watches for new blocks via HTTP/WS RPC
      ↓
DefraDB (embedded in Generator client) → stores generated block/transaction/log data
      ↓ (P2P passive replication)
DefraDB (embedded in Host) → receives replicated data
      ↓
GraphQL API (port 9182) → query the replicated data
```

### Prerequisites

- A cloud VM running Ubuntu 24.04 on amd64 (e.g. Hetzner CX22 or similar). arm64 won't work as the Generator and Host images are amd64-only.
- A GitHub account with access to the Shinzo container registry.

## Geth

### Install Geth

Add the official Ethereum PPA and install Geth:

```shell
sudo add-apt-repository -y ppa:ethereum/ethereum
sudo apt install -y geth
```

Verify the install:

```shell
geth version
```

### Start Geth in dev mode

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

Things to note from the output:
- Geth logs a pre-funded developer account address and private key. Save these; you'll need them later.
- HTTP RPC listens on `0.0.0.0:8545`.
- WebSocket listens on `0.0.0.0:8546`.
- The chain only mines a block when a transaction is pending, so it won't produce empty blocks.

### Verify Geth is running

In a second terminal, check the chain is responding:

```shell
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

Expected response: `{"jsonrpc":"2.0","id":1,"result":"0x0"}`

`0x0` means the chain is at block zero. That's correct for a fresh devnet.

### Attach the Geth console and test

Attach to the running node:

```shell
geth attach http://localhost:8545
```

Check your dev account and balance:

```javascript
eth.accounts
eth.getBalance(eth.accounts[0])
```

The balance will be an enormous number. That's the pre-funded dev account balance in wei, essentially unlimited play money.

Send a test transaction to trigger block mining:

```javascript
eth.sendTransaction({from: eth.accounts[0], to: eth.accounts[0], value: 1})
```

Confirm the block number advanced:

```javascript
eth.blockNumber
```

## Generator client

### Install Docker

Install Docker and add your user to the docker group. Verify with:

```shell
docker --version
```

### Authenticate with GitHub Container Registry

Generate a GitHub Personal Access Token with the `read:packages` scope, then log in:

```shell
echo YOUR_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### Pull the Shinzo Generator image

Images are published per chain rather than as a single `standard` tag. For Ethereum:

```shell
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest
```

### Run the Generator client

Get your VM's public IP:

```shell
hostname -I
```

Use the first IP in the output. Then run the Generator client, pointing it at your Geth node. Three ports are exposed: `9181` (DefraDB GraphQL API), `9171` (libp2p, for the Host to connect over), and `8080` (health/metrics/registration):

```shell
docker run --rm \
  -e GETH_RPC_URL=http://YOUR_VM_IP:8545 \
  -e GETH_WS_URL=ws://YOUR_VM_IP:8546 \
  -e GETH_API_KEY="" \
  -e INDEXER_START_HEIGHT=0 \
  -e DEFRADB_KEYRING_SECRET=devnet-secret \
  -e DEFRADB_P2P_ENABLED=true \
  -e DEFRADB_P2P_LISTEN_ADDR=/ip4/0.0.0.0/tcp/9171 \
  -e LOGGER_DEBUG=true \
  -p 9181:9181 \
  -p 9171:9171 \
  -p 8080:8080 \
  ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest
```

`INDEXER_START_HEIGHT` keeps its old name deliberately: like the `GETH_*` variables, it's a historical env var name that wasn't renamed when the client itself became the "Generator client." `DEFRADB_P2P_LISTEN_ADDR` tells DefraDB which interface and port to bind libp2p to inside the container; binding to `0.0.0.0:9171` means the Host container, on the same Docker bridge, can reach it.

You should see the Generator client connect to Geth, generate block 0, and then wait for new blocks.

### Get the Generator client's Peer ID

You'll need this to connect the Host. The Peer ID and dialable address both come from the Generator client's `/health` endpoint once it's finished starting up:

```shell
curl -s http://localhost:8080/health | jq '.p2p.self'
```

```output
{
  "id": "12D3KooWK8zmiDmX91PwDV1PsqtgA1UUDuuyipVBVPEjrvwgoFJH",
  "addresses": [
    "/ip4/127.0.0.1/tcp/9171",
    "/ip4/172.17.0.2/tcp/9171"
  ],
  "public_key": "8a7f061eeaaec8b8130ce4b9d6e519bbe76b9a4bc038b7e6743a773ad3915e02"
}
```

`id` is the Generator client's libp2p Peer ID, stable across restarts as long as the keyring secret stays the same. Of the `addresses`, ignore the `127.0.0.1` one. It's loopback and useless to other containers. Use the other one (the Generator client container's IP on the Docker bridge), which is what the Host will dial.

Capture both into shell variables:

```shell
PEER_ID=$(curl -s http://localhost:8080/health | jq -r '.p2p.self.id')

GENERATOR_IP=$(curl -s http://localhost:8080/health \
  | jq -r '[.p2p.self.addresses[] | capture("/ip4/(?<ip>[0-9.]+)/").ip
           | select(. != "127.0.0.1" and . != "0.0.0.0")][0]')

BOOTSTRAP_PEER="/ip4/${GENERATOR_IP}/tcp/9171/p2p/${PEER_ID}"
echo "$BOOTSTRAP_PEER"
```

### Verify data in DefraDB

First check what query fields are available:

```shell
curl -s -X POST http://localhost:9181/api/v0/graphql \
  -H "Content-Type: application/json" \
  --data '{"query":"{ __schema { queryType { fields { name } } } }"}'
```

Then query the generated blocks:

```shell
curl -s -X POST http://localhost:9181/api/v0/graphql \
  -H "Content-Type: application/json" \
  --data '{"query":"{ Ethereum__Mainnet__Block { hash number } }"}'
```

You should see block 0 and block 1 returned with their hashes.

## Smart contract

### Install Foundry

Foundry provides the `forge` and `cast` CLI tools for compiling and deploying smart contracts.

```shell
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
```

Verify the install:

```shell
forge --version
```

### Deploy an ERC-20 token contract

Create a new Foundry project:

```shell
forge init shinzo-token && cd shinzo-token
```

Install the OpenZeppelin contracts library:

```shell
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

Deploy it to the devnet, replacing `YOUR_PRIVATE_KEY` with the key Geth logged on startup:

```shell
forge create src/ShinzoToken.sol:ShinzoToken \
  --rpc-url http://localhost:8545 \
  --private-key YOUR_PRIVATE_KEY \
  --broadcast
```

Note down the `Deployed to` address from the output; you'll need it in the next step.

### Send a token transfer

Use `cast` to call the `transfer` function on the deployed contract. This emits a `Transfer` event which the Generator client will capture:

```shell
cast send YOUR_CONTRACT_ADDRESS \
  "transfer(address,uint256)" \
  YOUR_DEV_ACCOUNT_ADDRESS \
  1000 \
  --rpc-url http://localhost:8545 \
  --private-key YOUR_PRIVATE_KEY
```

Watch the Generator client terminal. You should see it pick up the new block and commit it to DefraDB.

### Query the generated data

Query all generated transactions:

```shell
curl -s -X POST http://localhost:9181/api/v0/graphql \
  -H "Content-Type: application/json" \
  --data '{"query":"{ Ethereum__Mainnet__Transaction { hash blockNumber } }"}'
```

Query the generated logs to see the Transfer events:

```shell
curl -s -X POST http://localhost:9181/api/v0/graphql \
  -H "Content-Type: application/json" \
  --data '{"query":"{ Ethereum__Mainnet__Log { address topics blockNumber } }"}'
```

You should see two `Transfer` events: one from the contract deployment (tokens minted from the zero address to your dev account) and one from the token transfer. The first topic on both (`0xddf252ad...`) is the keccak256 hash of `Transfer(address,address,uint256)`, the standard ERC-20 Transfer event signature, identical across every Ethereum network.

## Host

### Pull the Shinzo Host image

Like the Generator, Host images are published per chain:

```shell
docker pull ghcr.io/shinzonetwork/shinzo-host-client:ethereum-mainnet-latest
```

### Create the Host config

The Host's config format has been simplified: most of the manual tuning fields (batch processing, pruner, snapshot) are no longer part of the base setup. Create the config file:

```shell
cat > ~/host-config.yaml << 'EOF'
defradb:
  url: "localhost:9181"
  keyring_secret: "host-devnet-secret"
  p2p:
    enabled: true
    bootstrap_peers:
      - '${BOOTSTRAP_PEER}'
    listen_addr: "/ip4/0.0.0.0/tcp/9171"
    enable_auto_reconnect: true
  store:
    path: "./.defra"
shinzo:
  hub_base_url: testnet.shinzo.network:26657
  minimum_attestations: 1
  start_height: 0
logger:
  development: true
  level: "info"
host:
  lens_registry_path: "./.defra/lens"
  health_server_port: 8080
EOF
```

A few notes on this:

- `defradb.url: localhost:9181` is the Host's _internal_ DefraDB API, not the Generator's. Inside the Host container, DefraDB binds to `9181` on `localhost`. The Generator's API happens to use the same port number because they're both DefraDB; the published ports are remapped in the next step so they don't collide on the host machine.
- `bootstrap_peers` uses the `$BOOTSTRAP_PEER` value you built in the Generator section above. The Host learns everything else (schemas, signed data) from the Generator over P2P once it connects.
- `minimum_attestations: 1` means the Host will serve data as soon as it has one signature on it. Production setups use higher values to require independent confirmation from multiple Generator clients.
- `hub_base_url` points at ShinzoHub's testnet endpoint. This devnet setup isn't registering with the Hub, but the Host expects the field to be present.

### Run the Host

The Generator is already using `9181`, `9171`, and `8080` on the host machine, so the Host container's ports get bumped by one:

```shell
docker run -d \
  --name shinzo-host \
  -e BOOTSTRAP_PEERS="$BOOTSTRAP_PEER" \
  -v ~/host-config.yaml:/app/config.yaml:ro \
  -p 9182:9181 \
  -p 9172:9171 \
  -p 8081:8080 \
  ghcr.io/shinzonetwork/shinzo-host-client:ethereum-mainnet-latest
```

`BOOTSTRAP_PEERS` is an override; the same value is already in the config file, but some Host builds also read the env var, so it's set in both places.

### Verify the peering

Check the Host's `/health` for the Generator's Peer ID:

```shell
curl -s http://localhost:8081/health | jq '{status, current_block, p2p: {self: .p2p.self.id, peers: [.p2p.peers[].id]}}'
```

The `peers` array should contain the `PEER_ID` value from the Generator section. You can cross-check from the Generator's side too; its peer list should now contain the Host:

```shell
curl -s http://localhost:8080/health | jq '[.p2p.peers[].id]'
```

If both list each other, libp2p is connected and DefraDB is replicating between them.

### Verify data is replicating

Send a transaction from the Geth console to produce a new block:

```javascript
eth.sendTransaction({from: eth.accounts[0], to: eth.accounts[0], value: 1})
```

Once `current_block` is non-zero on the Host's `/health`, query its GraphQL API on the remapped port `9182`:

```shell
curl -s -X POST http://localhost:9182/api/v0/graphql \
  -H "Content-Type: application/json" \
  --data '{"query":"{ Ethereum__Mainnet__Block { hash number } }"}' | jq
```

You should see the new block returned. Passive replication only syncs new documents created after the P2P connection was established, so historical blocks won't appear in the Host's DefraDB.

