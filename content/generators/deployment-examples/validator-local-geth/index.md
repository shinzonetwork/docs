+++
title = "Validator with local Geth"
[extra]
mermaid = true
+++

When to use this: you run a validator and want to run the Generator client beside your own Geth node on the same machine or VPC, with no API key and minimal latency.

These scenarios use Ethereum Mainnet and Geth. Ethereum is the only officially supported chain today, but any EVM-compatible chain should work by changing `chain.name` and pointing the RPC URLs at a compatible node. See the [chain config](/generators/config-reference#chain) for details.

## Topology

{% mermaid() %}
flowchart LR
  subgraph VM["Validator machine"]
    direction LR
    Geth["<b>Geth node</b><br/>:8545 HTTP<br/>:8546 WS"]
    Gen["<b>Generator client</b><br/>:9171 P2P<br/>:8080 Health/Metrics"]
    Geth -- "HTTP + WS<br/>(localhost)" --> Gen
  end

  Hosts["Hosts"]
  Gen -- "P2P (libp2p)" --> Hosts
{% end %}

The Generator and Geth share a single machine. The Generator connects to Geth over localhost on the standard JSON-RPC and WebSocket ports. No API key is needed because Geth has no authentication on a private network. The Generator pushes data out to Hosts over P2P on port 9171.

## Prerequisites

- Docker installed on the validator machine.
- Geth running and synced, with HTTP and WebSocket enabled on ports 8545 and 8546. See the [Geth documentation](https://geth.ethereum.org/docs/fundamentals/security) for configuration.
- Ports 9171, 9181, and 8080 available on the validator machine. See [exposed ports](/generators/install#exposed-ports) for details.

## Run the Generator

Start the Generator client with a direct localhost connection to Geth. No API key or API key type is needed:

```shell
docker run -d \
  --name shinzo-generator \
  --restart unless-stopped \
  -e GETH_RPC_URL=http://localhost:8545 \
  -e GETH_WS_URL=ws://localhost:8546 \
  -e INDEXER_START_HEIGHT=0 \
  -e DEFRADB_KEYRING_SECRET=testnet-secret \
  -e DEFRADB_P2P_ENABLED=true \
  -e DEFRADB_P2P_LISTEN_ADDR=/ip4/0.0.0.0/tcp/9171 \
  -e LOGGER_DEBUG=false \
  -p 9181:9181 \
  -p 9171:9171 \
  -p 8080:8080 \
  ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest
```

### What each value means

- `GETH_RPC_URL=http://localhost:8545`: Geth JSON-RPC on localhost. See [geth config](/generators/config-reference#geth).
- `GETH_WS_URL=ws://localhost:8546`: Geth WebSocket on localhost. See [geth config](/generators/config-reference#geth).
- `INDEXER_START_HEIGHT=0`: Start indexing from the chain tip. See [indexer config](/generators/config-reference#indexer).
- `DEFRADB_KEYRING_SECRET=testnet-secret`: Encryption secret for the DefraDB keyring. Change this to your own secret and keep it consistent across restarts. See [defradb config](/generators/config-reference#defradb).
- `DEFRADB_P2P_ENABLED=true`: Enable P2P networking so the Generator can push data to Hosts. See [defradb p2p config](/generators/config-reference#defradb-p2p).
- `DEFRADB_P2P_LISTEN_ADDR=/ip4/0.0.0.0/tcp/9171`: Listen on all interfaces so Hosts outside the machine can connect. See [defradb p2p config](/generators/config-reference#defradb-p2p).
- `LOGGER_DEBUG=false`: Production log level. Set to `true` for debug-level output during setup. See [logger config](/generators/config-reference#logger).

## Verify the connection

Check that the Generator is healthy and processing blocks:

```shell
curl http://localhost:8080/health
```

Expected response:

```json
{ "status": "healthy", "defradb_connected": true }
```

Check processing metrics:

```shell
curl -s http://localhost:8080/metrics | jq
```

If `blocks_processed` is climbing, the Generator is receiving blocks from Geth and writing them to DefraDB.

## Registration

Once the Generator is running, register it with the Shinzo Network. See [Registration](/generators/register/).

## Gotchas

- `DEFRADB_KEYRING_SECRET` must stay the same across restarts. If it changes, the Generator cannot load its existing DefraDB identity and will fail to start. The value `testnet-secret` is from the install page. Replace it with your own secret for any real deployment.
- The install page includes `DEFRADB_PLAYGROUND=true` in its `docker run` example. This env var is not read by the Generator client. The playground is controlled by build tags, not environment variables. See the [env vars table](/generators/config-reference#environment-variables) for which vars are effective.
- If Geth is on a different machine in the same VPC, replace `localhost` with the internal IP or hostname of the Geth machine. Still no API key needed as long as the traffic stays within the private network.
- If the Generator falls back to HTTP-only mode, the WebSocket connection to Geth failed. Check that `GETH_WS_URL` is correct and that Geth has WebSocket enabled with `--ws --ws.port 8546`.
- The default `config.yaml` in the container image enables pruning with `max_blocks: 1000` and snapshots with `blocks_per_file: 100`. For an archival Generator, see the [archival versus pruned scenario](../archival-vs-pruned/).

## Need help

{{ need_help(client="Generator", repo_name="shinzo-generator-client", repo="https://github.com/shinzonetwork/shinzo-generator-client/issues") }}
