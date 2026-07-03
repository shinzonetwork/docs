+++
title = "Frequently Asked Questions"
weight = 5
+++

### What is the GitHub link for the Shinzo Host?

[github.com/shinzonetwork/shinzo-host-client](https://github.com/shinzonetwork/shinzo-host-client]

### What is the difference between a Host and an Indexer?

Indexers are the write side: they read raw blocks from an Ethereum execution node, sign the data, and gossip it over P2P. Hosts are the read side: they receive those signed primitives, verify them, run WebAssembly lens transforms to build Views, and serve the results to applications over GraphQL. An Indexer talks to a source-chain node; a Host never does. See the [Host overview](/hosts/overview) for more.

### Do I need to run my own Indexer to run a Host?

No, but you do need access to at least one working Indexer. A Host doesn't read the source chain itself; it receives signed primitives from Indexers over P2P, so it needs at least one reachable Indexer to sync from. That Indexer doesn't have to be _yours_, you can point at any one you can reach. The image ships with default peers, but they aren't guaranteed to be live, so in practice set `BOOTSTRAP_PEERS` to an Indexer you know is up (see [Install](/hosts/install)). 

A public Indexer you can point at is planned; this page will link it once it's live.

### Can I connect my Host to my own Indexer?

Yes, this is the normal way to run a Host. Point it at your Indexer's libp2p multiaddr.

With Docker, pass it as an environment variable:

```shell
-e BOOTSTRAP_PEERS="/ip4/<indexer-ip>/tcp/9171/p2p/<indexer-peer-id>"
```

When building from source, set `defradb.p2p.bootstrap_peers` in your `config.yaml` instead.

The multiaddr must end in the Indexer's peer ID, because libp2p authenticates the connection against it, so a bare IP won't connect. Read the IP and peer ID from the Indexer's health endpoint:

```shell
curl -s http://<indexer-host>:8080/health | jq -r '.p2p.self'
```

The peer ID is derived from the Indexer's keyring secret, so it's stable across restarts as long as that secret doesn't change. If you run the Host and Indexer on the same machine, remap the Host's published ports (the `-p` flags, or `defradb.url` and the P2P ports for a source build) so they don't collide with the Indexer's `9181` and `9171`.

### What hardware is recommended for running a Host?

See [the Overview page](../overview) for a detailed rundown of hardware recommendataions.

### How do Views and lenses arrive on my Host?

Developers register Views on ShinzoHub. Each View defines a WebAssembly lens that filters, decodes, and reshapes primitive data. Your Host queries ShinzoHub for registered Views, downloads the lens for each, runs it against the primitives it receives from Indexers, and writes the results to its local DefraDB. Applications query those documents over GraphQL. The ShinzoHub connection and the Indexer connection are separate: the Host learns _which_ Views exist from ShinzoHub, but the raw data to run them on comes from an Indexer, so registered Views will appear before any data does if no Indexer is connected.

### What are attestation records?

When a Host receives the same block from multiple independent Indexers, it verifies each signature and creates an `AttestationRecord` that tracks how many Indexers produced identical data. These records replicate between Hosts using a P-counter CRDT, which lets applications check how many independent sources agree on a piece of data before trusting it.

### Which ports does the Host use?

| Port | Service |
| --- | --- |
| `9181` | DefraDB GraphQL + REST API. |
| `9182` | GraphQL Playground UI (the DefraDB GraphQL port + 1). |
| `9171` | libp2p P2P networking. Must be reachable for the Host to connect to Indexers. |
| `8080` | Health (`/health`) and metrics (`/metrics`) server. |

### How do I back up my keys?

Your node identity key is your Host's identity on the network. Lose it without a backup and you can't restore the same identity.

Where it lives depends on how you run the Host:

- **Build from source:** `~/.defra/keys` by default.
- **Docker with persistence:** the host directory you mounted to `/app/.defra/keys` (for example `~/data/keys`).
- **Docker without volume mounts:** the key only exists inside the container and is lost when the container is removed. Mount a volume before you rely on a Host keeping its identity.

Copy the directory somewhere safe:

```shell
cp -r ~/.defra/keys /mnt/backup-drive/   # adjust the source path to match your setup
```
See [Register](/hosts/register#backup-your-node-identity-key) for more.

### My Host starts but connects to no peers. What's wrong?

The Host is running but can't sync from an Indexer. Check `docker logs shinzo-host` (or the process output for a source build) for the specific cause:

- `peer id mismatch: expected <A>, but remote key matches <B>` means the peer ID in your multiaddr is wrong or out of date. The Indexer at that address is running a different identity than the multiaddr claims; get the current one from its `/health` endpoint (`.p2p.self.id`). This also happens when you rely on the image's built-in default peers and they've gone stale; set `BOOTSTRAP_PEERS` to a current Indexer instead.
- `all dials failed` / `no route to host` / `i/o timeout` all mean that the address is unreachable. Confirm the Indexer is up and that outbound port `9171` is open from your machine.
- `dial tcp4 ... i/o timeout` usually indicates that you're running the Host client on an IPv6-only machine. the IPv4 peers are unreachable. Run on a dual-stack host, or enable NAT64/DNS64.

See [Install](/hosts/install#verify) for how to confirm a healthy connection.
