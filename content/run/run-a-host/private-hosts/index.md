+++
title = "Private Hosts"
aliases = ["/run/run-a-host/private", "/run/run-a-host/direct-client"]
description = "Run a Shinzo Host client privately, peered only to your own Generator and publicizing nothing to the network."
[extra]
mermaid = true
+++

A private Host, sometimes called a Direct Client, is a Host client that doesn't join the public Shinzo network. It connects to a single Generator client, runs Views locally, and never registers itself or publishes anything. A person running a private Host client is usually the same person running the Generator client it's connected to, meaning the read path stays private between those two clients.

## It's the same Host client

A private Host client is not a different binary, Docker image, or repository. It's the same `shinzo-host-client`. You pull the same image (`ghcr.io/shinzonetwork/shinzo-host-client:ethereum-mainnet-latest`), use the same `config.yaml`, and run the same binary. What makes it private is the configuration: which peers it dials, whether it contacts ShinzoHub, and whether it registers.

There is no separate download, no `--private` flag, and no private build of the client.

## The privacy model

A standard Host client ships configured for the public network. On startup it does two things that publicize activity:

- Dials the public bootstrap peers shipped in `config.yaml` to reach Generator clients it doesn't control.
- Contacts ShinzoHub (`shinzo.hub_base_url`) to fetch every registered View and subscribe to live registration events.

A third step is opt-in: registering on the [Host registry](../register) so other nodes can discover and replicate from it. This is a manual, wallet-signed action from the registration app, not something the Host client does on startup.

A private Host client connection closes some or all of these. How many you close decides how private the setup is.

## Two tiers

There are two tiers of privacy. Select that one that works for your use-case.

### Standard private Host client

Keep ShinzoHub connected so the Host client still fetches and runs the public Views registered on the network, but make the Host itself invisible. Don't register it, and peer it only to your own Generator client. You get the public Views without exposing your read node to the network.

What changes from the defaults:

- `defradb.p2p.bootstrap_peers`: replace the public peers with your Generator client's multiaddr. Do no include any other multiaddrs.
- `shinzo.hub_base_url`: set it to `testnet.shinzo.network:26657` (the shipped value; the code default is empty) so the Host client keeps fetching public Views.
- Skip [Register](/hosts/register/). An unregistered Host isn't discoverable and won't serve the network.

This is the topology covered in the [Operator Quickstart](/guides/operator-quickstart/).

### Fully air-gapped Host client

Cut ShinzoHub off entirely by setting `shinzo.hub_base_url` to an empty string. On startup the Host client logs a message like _No ShinzoHub base URL configured..._ and starts no event subscription, so it contacts nothing except the Generator client you point it at.

{% mermaid() %}
flowchart LR
  Geth["Geth<br/>(your node)"] -->|RPC + WS| Gen["Generator client<br/>(yours)"]
  Gen -->|libp2p| Host["Host client<br/>(direct client)"]
  Host -->|GraphQL| App["Your application"]
{% end %}

With no hub connection, no public peers, and no registration, nothing about this Host client is published to the network. This is the most private setup possible.

## Configure an air-gapped direct client

You need a reachable Generator client and its libp2p multiaddr. If you don't have one running, see [Generator Install](/generators/install/) and the [Operator Quickstart](/guides/operator-quickstart/). The Generator client's `/health` endpoint returns its peer ID and listening addresses under `.p2p.self`, as an object rather than a finished multiaddr:

```shell
PEER_ID=$(curl -s http://<generator-host>:8080/health | jq -r '.p2p.self.id')

GENERATOR_IP=$(curl -s http://<generator-host>:8080/health \
  | jq -r '[.p2p.self.addresses[] | capture("/ip4/(?<ip>[0-9.]+)/").ip
           | select(. != "127.0.0.1" and . != "0.0.0.0")][0]')

BOOTSTRAP_PEER="/ip4/${GENERATOR_IP}/tcp/9171/p2p/${PEER_ID}"
echo "$BOOTSTRAP_PEER"
```

```output
/ip4/172.17.0.2/tcp/9171/p2p/12D3KooWK8zmiDmX91PwDV1PsqtgA1UUDuuyipVBVPEjrvwgoFJH
```

`.p2p.self.id` is the Generator client's libp2p Peer ID, and `.p2p.self.addresses` lists the multiaddrs it's listening on. The `jq` filter drops loopback and `0.0.0.0` and takes the first remaining IPv4. `BOOTSTRAP_PEER` is the multiaddr the host dials. libp2p authenticates the peer ID, so the connection is verified end to end.

Save this as `~/host-config.yaml`:

```yaml
defradb:
  url: "localhost:9181"
  keyring_secret: "<your-strong-secret>"
  p2p:
    enabled: true              # libp2p stays on; it's how the host reaches your Generator
    bootstrap_peers:
      - '/ip4/<generator-ip>/tcp/9171/p2p/<generator-peer-id>'   # your Generator only
    listen_addr: "/ip4/0.0.0.0/tcp/9171"
    enable_auto_reconnect: true
  store:
    path: "./.defra"
shinzo:
  hub_base_url: ""             # air-gapped: no ShinzoHub fetch, no event subscription
  minimum_attestations: 1      # not read by the host; kept for parity with shipped config.yaml
  start_height: 0
logger:
  development: false
host:
  lens_registry_path: "./.defra/lens"
  health_server_port: 8080
```

`hub_base_url` has no environment-variable override, so for an air-gapped setup you must mount this config file into the container. `BOOTSTRAP_PEERS` still works as an override for the peer list:

```shell
docker run -d \
  --name shinzo-host \
  -e DEFRA_KEYRING_SECRET="<your-strong-secret>" \
  -e BOOTSTRAP_PEERS="/ip4/<generator-ip>/tcp/9171/p2p/<generator-peer-id>" \
  -v ~/host-config.yaml:/app/config.yaml:ro \
  -p 9181:9181 \
  -p 9182:9182 \
  -p 9171:9171 \
  ghcr.io/shinzonetwork/shinzo-host-client:ethereum-mainnet-latest
```

Publishing `9171` is optional for a private setup. The Host client only dials out to your Generator client, so you can drop `-p 9171:9171` or leave it published and firewall the port.

{% admonition(type="tip") %}
You don't need to expose port `9171` to the internet for a private setup. The Host client dials out to your Generator client; it doesn't need to accept inbound P2P from the public network. Keep `9171` firewalled to your private network.
{% end %}

For the full run sequence including persistent volume mounts and building from source, see [Install](/hosts/install/). For every config field, see the [Config reference](/hosts/config-reference/).

## Loading Views in a private setup

The Host client loads Views from a local `views.json` file in `host.lens_registry_path` on every startup, independent of ShinzoHub. What differs between the privacy tiers is how that file gets populated.

In a [standard private Host](#standard-private-host-client) client, with `hub_base_url` pointed at ShinzoHub, the Host client fetches every registered View on startup and persists each one to `views.json`. You don't do anything; the public Views show up and run.

In a [fully air-gapped Host client](#fully-air-gapped-host-client), with `hub_base_url` empty, the Host client never fetches from ShinzoHub, so `views.json` only contains what was already persisted. To populate it, use an ingest-then-go-dark flow:

1. Start the Host client once with `hub_base_url` set to ShinzoHub. It fetches the public Views and writes them to `views.json`.
1. Stop the Host client, edit the mounted config to set `hub_base_url` to `""`, and restart the **same** container (`docker stop shinzo-host && docker start shinzo-host`). The Host client now loads those Views from the local file and contacts no hub.

Restart the same container, not a fresh one. `views.json` and the cached WASM lens files live in `./.defra` inside the container, and the `docker run` above doesn't mount that path. If you `docker rm` and start a new container, `views.json` is gone and the host boots with no Views. To let `views.json` survive container recreation, mount a persistent `.defra` volume as shown in [Install](/hosts/install/).

## What stays the same and the trade-offs

- The Host client still creates `AttestationRecord`s from your Generator client's signatures and verifies them. What you lose is cross-host replication of those attestations. With no other Host peers, there's no one to gossip with. The `minimum_attestations` key is in the config but the Host client doesn't read it. It's an app-sdk setting, so changing it has no effect on a Host.
- Your Generator is your only data source. If it goes down or falls behind, the Host client has no public fallback in a fully air-gapped setup.
- You manage View updates yourself. In a standard private host setup the hub still pushes new registrations. In a fully air-gapped setup, you re-run the ingest step to pick up new public Views.

## Need Help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
