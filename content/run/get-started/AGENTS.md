# Shinzo quickstart: run a Generator client and a Host on one machine

These instructions are for an AI agent. Your goal: start one Shinzo Generator client and one Host client on this machine, peer them over libp2p, and finish by running one GraphQL query that returns real chain data through the Host. Run the steps in order, verify each step's output before moving on, and report the final query results to the user.

The human-facing guide with full explanations of each step is at https://docs.shinzo.network/run/get-started/ . If a step fails, its troubleshooting section is the first place to look.

## What you need

Before starting, confirm the machine has:

- Docker, installed and running.
- `curl` and `jq`.

You also need a live execution node exposing JSON-RPC and WebSocket. The Generator client reads from that node; it does not run one itself. Acceptable sources: a node the user self-hosts, a node co-located with a validator, GCP Blockchain Node Engine, or any managed node provider. Ask the user for:

- The node's RPC URL.
- The node's WebSocket URL.
- The API key, if the node requires authentication.

No wallet, funds, or ShinzoHub registration are needed for this. If the user has no execution node available, stop here and tell them what is missing.

## 1. Set the execution node endpoint

Export the values the user gave you. The `GETH_*` names are historical; the Generator client accepts any compatible JSON-RPC and WebSocket endpoint, and auto-detects the right auth header (`X-goog-api-key` for GCP Blockchain Node Engine, `X-Api-Key` for most self-hosted Nginx setups) from the URL.

```shell
export GETH_RPC_URL="<rpc-url>"
export GETH_WS_URL="<ws-url>"
export GETH_API_KEY="<api-key>"   # leave empty if the node has no auth
```

## 2. Start the Generator client

```shell
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest

docker run -d \
  --name shinzo-generator \
  -e GETH_RPC_URL="$GETH_RPC_URL" \
  -e GETH_WS_URL="$GETH_WS_URL" \
  -e GETH_API_KEY="$GETH_API_KEY" \
  -e INDEXER_START_HEIGHT=0 \
  -e DEFRADB_KEYRING_SECRET=testnet-secret \
  -e DEFRADB_PLAYGROUND=true \
  -e DEFRADB_P2P_ENABLED=true \
  -e DEFRADB_P2P_LISTEN_ADDR=/ip4/0.0.0.0/tcp/9171 \
  -e LOGGER_DEBUG=true \
  -p 9181:9181 \
  -p 9171:9171 \
  -p 8080:8080 \
  ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest
```

`DEFRADB_KEYRING_SECRET=testnet-secret` is fine for this quickstart; anything in production needs a stronger secret. `INDEXER_START_HEIGHT=0` starts at the current chain tip with no historical backfill.

## 3. Wait for startup, then read the P2P address

The Generator client takes a moment to start. Poll its health endpoint (up to about a minute) until the P2P identity appears:

```shell
for _ in $(seq 1 30); do
  curl -s http://localhost:8080/health | jq -e '.p2p.self.id' > /dev/null && break
  sleep 2
done
curl -s http://localhost:8080/health | jq '.p2p.self'
```

If the Peer ID never appears, run `docker logs --tail 50 shinzo-generator`. The usual cause is the Generator client unable to reach the execution node: re-check the URL and API key from step 1.

Then capture the identity and the non-loopback container IP into shell variables:

```shell
PEER_ID=$(curl -s http://localhost:8080/health | jq -r '.p2p.self.id')

INDEXER_IP=$(curl -s http://localhost:8080/health \
  | jq -r '[.p2p.self.addresses[] | capture("/ip4/(?<ip>[0-9.]+)/").ip
           | select(. != "127.0.0.1" and . != "0.0.0.0")][0]')

BOOTSTRAP_PEER="/ip4/${INDEXER_IP}/tcp/9171/p2p/${PEER_ID}"
echo "$BOOTSTRAP_PEER"
```

`echo "$BOOTSTRAP_PEER"` must print a multiaddr like `/ip4/172.17.0.2/tcp/9171/p2p/12D3KooW...`. Do not use a `127.0.0.1` address: the Host container cannot reach the Generator container's loopback.

## 4. Write the Host client config

Create `~/host-config.yaml` with the bootstrap peer filled in:

```shell
cat > ~/host-config.yaml <<EOF
defradb:
  url: "localhost:9181"
  keyring_secret: "host-testnet-secret"
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

## 5. Start the Host client

The Generator client already occupies `9181`, `9171`, and `8080` on the host, so the Host container's ports are bumped by one:

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

## 6. Verify the peering

Both clients must list each other as peers. Check the Host side:

```shell
curl -s http://localhost:8081/health | jq '{status, current_block, p2p: {self: .p2p.self.id, peers: [.p2p.peers[].id]}}'
```

The Generator client's Peer ID (the `$PEER_ID` from step 3) must appear in `peers`. Then check the Generator side:

```shell
curl -s http://localhost:8080/health | jq '[.p2p.peers[].id]'
```

If the Host never lists the Generator client, the usual cause is a bootstrap multiaddr built from a loopback or wrong IP; re-check step 3. If both sides list each other, data flows from the Generator client to the Host within a few seconds.

## 7. Query the Host client

Wait until `current_block` in the Host's health output is non-zero, then run:

```shell
curl -s -X POST http://localhost:9182/api/v0/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"query { Ethereum__Mainnet__Log(order: { blockNumber: DESC }, limit: 5) { address topics blockNumber transactionHash logIndex } }"}' \
  | jq
```

Show the returned rows to the user. Those rows were logs on the source chain, pulled in by the Generator client over the node's WebSocket, signed, gossiped over libp2p to the Host, and now served over GraphQL. The collection prefix (`Ethereum__Mainnet__` here) follows the chain the Generator client image was built for.

## 8. Report, then offer cleanup

Tell the user what is running: two containers (`shinzo-generator`, `shinzo-host`), the Host's GraphQL API on `http://localhost:9182`, and both health endpoints (`8080` for the Generator client, `8081` for the Host). Useful next steps for them: browse the data in the Explorer at https://explorer.shinzo.network/ , more queries at https://docs.shinzo.network/build/how-to/query-data/ , and, when they want to participate in the network and earn rewards, the registration guides at https://docs.shinzo.network/run/run-a-generator/register/ and https://docs.shinzo.network/run/run-a-host/register/ .

Only if the user confirms, tear it all down:

```shell
docker rm -f shinzo-generator shinzo-host
rm ~/host-config.yaml
```
