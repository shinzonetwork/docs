+++
title = "Generator and Host on one machine"
description = "Connect a source-built Host to a Generator on the same machine without port conflicts."
+++

Use this example when you already run a Generator and want a Host on the same machine. Follow [Install](/run/run-a-host/install/#build-from-source) for the source build and keyring secret. Size the machine for both workloads.

## Separate the listening ports

Each process needs distinct ports. Check the Generator's configuration before choosing Host ports. This example assumes the Generator uses P2P port `9171`, API port `9181`, and health port `8080`; reserve `9191`, `9192`, and `8090` for the Host. If you enable the Host Playground, also ensure its port `9182` is free.

Merge these values into the Host's existing `config/config.yaml`:

```yaml
defradb:
  url: "localhost:9191"
  p2p:
    enabled: true
    listen_addr: "/ip4/0.0.0.0/tcp/9192"
host:
  health_server_port: 8090
chains:
  - prefix: Ethereum__Mainnet
    generators:
      - url: http://127.0.0.1:8080
        peer: /ip4/127.0.0.1/tcp/9171/p2p/<generator-peer-id>
```

Use the exact prefix served by your Generator. Read its peer ID from its health endpoint:

```shell
curl -s http://127.0.0.1:8080/health | jq -r '.p2p.self.id'
```

These loopback addresses assume both processes run directly on the same machine. Inside Docker, `127.0.0.1` refers to the container itself. For separate containers, use addresses reachable over their Docker network and the Generator's actual container ports.

## Start and verify

Start the Host using the source-build instructions, then check its separate health endpoint:

```shell
curl -s http://localhost:8090/health | jq '.chains'
```

Use `http://localhost:9191/api/v0/graphql` for the verification query in Install. If exposing the Host publicly, configure its advertised addresses and firewall rules for the Host's chosen ports; do not advertise loopback addresses. See [Register](/run/run-a-host/register/) for public registration requirements.
