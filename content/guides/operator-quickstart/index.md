+++
title = "Operator Quickstart"
description = "Bring up an Generator and a Host on one machine, peer them over libp2p, and query the result."
weight = 3
[extra]
mermaid = true
+++

Run a Shinzo Generator and a Host on the same machine, peer them over libp2p, and query indexed Ethereum data through the Host's GraphQL API. If your Geth node is already reachable, the whole thing takes about ten minutes.

When you're done you'll have:

- A running Generator pulling blocks from a Geth node and signing them.
- A running Host receiving those blocks over P2P and serving them.
- A GraphQL query returning real Ethereum data through the Host.
- A understanding of how the two main Shinzo infrastructure pieces fit together.

## What you're building

{% mermaid() %}
flowchart LR
  Geth["Geth (your node)"] -->|RPC + WS| Generator
  Generator -->|libp2p| Host
  Host -->|GraphQL| You["You (curl)"]
{% end %}

Two containers through one shared Docker bridge. Both containers run on the same VM. The Host dials the Generator's libp2p port directly over the bridge using the Generator's published Peer ID.

## Prerequisites

- Docker. 
- Both `curl` and `jq`.
- A reachable Ethereum execution node (Geth or compatible) exposing JSON-RPC and WebSocket. The Generator reads from this node; it does not run one for you. Acceptable sources include a node you self-host, a node co-located with a validator, GCP Blockchain Node Engine, or a managed provider like Alchemy or QuickNode. If your node is behind authentication, see the [Generator install guide's notes on API keys](/generator/install#do-you-need-an-api-key).

You don't need a wallet, funds, or a ShinzoHub registration for this quickstart. Registration is what lets your operators participate in the network and earn rewards. It's covered on the [Generator registration](/generator/register) and [Host registration](/hosts/quickstart#shinzohub-registration) pages.

## Set your Geth endpoint

Export the URL and (optionally) the API key for your Geth node. The rest of the quickstart references these variables.

```shell
export GETH_RPC_URL="<your-rpc-url>"
export GETH_WS_URL="<your-ws-url>"
export GETH_API_KEY="<your-api-key>"   # leave empty if your node has no auth
```

{% admonition(type="tip") %}
The Generator auto-detects the right header (`X-goog-api-key` for GCP Blockchain Node Engine, `X-Api-Key` for most self-hosted Nginx setups) based on the URL. If the node is on your private network and unauthenticated, leave `GETH_API_KEY` empty.
{% end %}

## Start the Generator

The Generator sits next to a blockchain node, subscribes to new blocks, and turns them into signed structured documents. Run it as a single container with three ports exposed:

| Host port | Container port | What it is |
| --- | --- | --- |
| `9181` | `9181` | DefraDB GraphQL API. The query interface for raw indexed data. |
| `9171` | `9171` | libp2p P2P port. How Hosts subscribe to this Generator. |
| `8080` | `8080` | Health, metrics, and registration endpoints. |

Run everything with:

```shell
docker pull ghcr.io/shinzonetwork/shinzo-generator-client:standard

docker run -d \
  --name shinzo-generator \
  -e GETH_RPC_URL="$GETH_RPC_URL" \
  -e GETH_WS_URL="$GETH_WS_URL" \
  -e GETH_API_KEY="$GETH_API_KEY" \
  -e INDEXER_START_HEIGHT=0 \
  -e DEFRADB_KEYRING_SECRET=devnet-secret \
  -e DEFRADB_PLAYGROUND=true \
  -e DEFRADB_P2P_ENABLED=true \
  -e DEFRADB_P2P_LISTEN_ADDR=/ip4/0.0.0.0/tcp/9171 \
  -e LOGGER_DEBUG=true \
  -p 9181:9181 \
  -p 9171:9171 \
  -p 8080:8080 \
  ghcr.io/shinzonetwork/shinzo-generator-client:standard
```

`DEFRADB_KEYRING_SECRET` is the password that protects the Generator's signing key. The Generator uses this key to sign every document it produces, which gives downstream consumers a way to verify the data came from a real Generator. The `devnet-secret` password is fine for this quickstart, but remember use something more secure for anything in a production environment.

`DEFRADB_P2P_LISTEN_ADDR` tells DefraDB which interface and port to bind libp2p to inside the container. Binding to `0.0.0.0:9171` means the Host container, running on the same Docker bridge, can reach it.

`INDEXER_START_HEIGHT=0` starts indexing from genesis. For Ethereum Mainnet that's a lot of history, but this quickstart only needs a few committed blocks to verify the pipeline. To start closer to head, set this to a recent block height.

`DEFRADB_PLAYGROUND=true` enables a browser-based GraphQL playground on the API port.

## Read the Generator's P2P address

The Host needs two things to connect: 

1. The Generator's libp2p Peer ID.
1. A multiaddr it can dial.

Both come from the Generator's `/health` endpoint once it finishes starting up.

```shell
curl -s http://localhost:8080/health | jq '.p2p.self'
```

{% output() %}
```
{
  "id": "12D3KooWK8zmiDmX91PwDV1PsqtgA1UUDuuyipVBVPEjrvwgoFJH",
  "addresses": [
    "/ip4/127.0.0.1/tcp/9171",
    "/ip4/172.17.0.2/tcp/9171"
  ],
  "public_key": "8a7f061eeaaec8b8130ce4b9d6e519bbe76b9a4bc038b7e6743a773ad3915e02"
}
```
{% end %}

`id` is the Generator's libp2p Peer ID, derived from its keyring secret. It's stable across restarts as long as the secret stays the same.

`addresses` are the multiaddrs the Generator is actually listening on. The first one (`127.0.0.1`) is loopback and useless to other containers. The second (`172.17.0.2` here) is the Generator container's IP on the Docker bridge. That's the one the Host will dial.

Capture both into shell variables:

```shell
PEER_ID=$(curl -s http://localhost:8080/health | jq -r '.p2p.self.id')

INDEXER_IP=$(curl -s http://localhost:8080/health \
  | jq -r '[.p2p.self.addresses[] | capture("/ip4/(?<ip>[0-9.]+)/").ip
           | select(. != "127.0.0.1" and . != "0.0.0.0")][0]')

BOOTSTRAP_PEER="/ip4/${INDEXER_IP}/tcp/9171/p2p/${PEER_ID}"
echo "$BOOTSTRAP_PEER"
```

{% output() %}
```
/ip4/172.17.0.2/tcp/9171/p2p/12D3KooWK8zmiDmX91PwDV1PsqtgA1UUDuuyipVBVPEjrvwgoFJH
```
{% end %}

`BOOTSTRAP_PEER` is a libp2p multiaddr that essentially says _"speak IPv4 to this address on this TCP port, then handshake with this Peer ID."_ If the Peer ID doesn't match, the Host refuses the connection. This is what makes the connection authenticated end to end.

## Write the Host config

The Host reads its configuration from a YAML file mounted into the container. The two values that matter here are the bootstrap peer (the multiaddr we just built) and the keyring secret. Create this file and save it as `~/host-config.yaml`:

```shell
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
  hub_base_url: rpc.devnet.shinzo.network:26657
  minimum_attestations: 1
  start_height: 0
logger:
  development: true
  level: "info"
host:
  lens_registry_path: "./.defra/lens"
  health_server_port: 8080
```

There are a few things in here worth calling out:

- `defradb.url: localhost:9181` is the Host's _internal_ DefraDB API, not the Generator's. Inside the Host container, DefraDB binds to `9181` on `localhost`. The Generator's API happens to use the same number because they're both DefraDB; we'll remap the published ports in the next step so they don't collide.
- `bootstrap_peers` is the only Generator-specific value. The Host learns everything else (schemas, signed data) from the Generator over P2P once it connects.
- `minimum_attestations: 1` means the Host will serve data as soon as it has one signature on it. Production setups use higher values to require independent confirmation from multiple Generators. See the [Host overview](/hosts/overview) for more on attestations.
- `hub_base_url` points to ShinzoHub. We're not registering anything here, but the Host expects the field to be present.

## Start the Host

The Generator is already occupying `9181`, `9171`, and `8080` on the host machine, so the Host container's ports get bumped by one.

| Host port | Container port | What it is |
| --- | --- | --- |
| `9182` | `9181` | DefraDB GraphQL API (the Host's own copy of the data). |
| `9172` | `9171` | libp2p. |
| `8081` | `8080` | Health, metrics, registration. |

```shell
docker run -d \
  --name shinzo-host \
  -e BOOTSTRAP_PEERS="$BOOTSTRAP_PEER" \
  -v ~/host-config.yaml:/app/config.yaml:ro \
  -p 9182:9181 \
  -p 9172:9171 \
  -p 8081:8080 \
  ghcr.io/shinzonetwork/shinzo-host-client:standard
```

`BOOTSTRAP_PEERS` is an override. The same value is in the config file, but some Host builds also read the env var, so we set both.

## Verify the peering

The Host's `/health` lists the peers it's connected to. Once the Generator's Peer ID appears there, the connection is live.

```shell
curl -s http://localhost:8081/health | jq '{status, current_block, p2p: {self: .p2p.self.id, peers: [.p2p.peers[].id]}}'
```

{% output() %}
```
{
  "status": "healthy",
  "current_block": 25303386,
  "p2p": {
    "self": "12D3KooWK76zTyFW73BSwoQRkuM45Aky7SNSCQGkzjGvxGy8Y76Z",
    "peers": [
      "12D3KooWK8zmiDmX91PwDV1PsqtgA1UUDuuyipVBVPEjrvwgoFJH"
    ]
  }
}
```
{% end %}

Check the Generator's side too. Its peer list should now contain the Host:

```shell
curl -s http://localhost:8080/health | jq '[.p2p.peers[].id]'
```

{% output() %}
```
[
  "12D3KooWK76zTyFW73BSwoQRkuM45Aky7SNSCQGkzjGvxGy8Y76Z"
]
```
{% end %}

If both list each other, libp2p is connected and DefraDB is replicating between them! Data from the Generator lands in the Host within a few seconds.

## Query the Host

The Host runs an embedded DefraDB with a GraphQL API on the remapped port `9182`. Once `current_block` is non-zero on the Host's `/health`, query it:

```shell
curl -s -X POST http://localhost:9182/api/v0/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"query { Ethereum__Mainnet__Log(order: { blockNumber: DESC }, limit: 5) { address topics blockNumber transactionHash logIndex } }"}' \
  | jq
```

{% output() %}
```
{
  "data": {
    "Ethereum__Mainnet__Log": [
      {
        "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "blockNumber": 25303402,
        "logIndex": 899,
        "topics": [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x000000000000000000000000710ed94f2a25859b7a45337f4245da34a6f15190",
          ...
        ]
      }
    ]
  }
}
```
{% end %}

The rows that come back were originally just logs on Ethereum, then pulled in by the Generator over the Geth WebSocket, signed, gossiped over libp2p to the Host, and are now being served back to you over GraphQL. More queries are on the [Host examples](/hosts/examples) page.

## Undo everything

If you want to burn everything down and start again, just run:

```shell
docker rm -f shinzo-generator shinzo-host
rm ~/host-config.yaml
```

## Troubleshooting

### The Generator's `/health` never returns a Peer ID

```shell
docker logs --tail 50 shinzo-generator
```

The most common cause is the Generator can't reach Geth. Confirm `GETH_RPC_URL` and `GETH_WS_URL` are correct and reachable from the container, and that the API key (if any) is right. The Generator can fall back to HTTP-only mode if WebSocket is unavailable, and will log that it did.

### The Host never lists the Generator as a peer

Confirm the bootstrap peer multiaddr in the config uses the Generator's non-loopback container IP, not `127.0.0.1`. From inside the Host container, the Generator's loopback is unreachable. Verify with:

```shell
docker exec shinzo-host getent hosts $(echo "$BOOTSTRAP_PEER" | grep -oP '/ip4/\K[0-9.]+')
```

Also check that the Peer ID portion of the multiaddr matches what `curl localhost:8080/health | jq .p2p.self.id` returns.

### `Permission denied` on `.defra/keys`

The container runs as UID `1001`. If you mounted a host directory for persistence (this quickstart does not), make sure it's owned by `1001:1001`.

### Port already in use

The Generator or the Host is colliding with something else on the machine. Change the published ports in the `docker run` commands. Container-side ports stay the same.
