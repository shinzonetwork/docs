+++
title = "Frequently Asked Questions"
weight = 5
+++

### What is the GitHub link for the Shinzo Host?

[github.com/shinzonetwork/shinzo-host-client](https://github.com/shinzonetwork/shinzo-host-client)

### What is the difference between a Host and a Generator?

Generator clients are the write side: they read raw blocks from an Ethereum execution node, sign the data, and gossip it over P2P. Host clients are the read side: they receive those signed primitives, verify them, run WebAssembly lens transforms to build Views, and serve the results to applications over GraphQL. A Generator client talks to a source-chain node; a Host client never does. See the [Host overview](/hosts/overview) for more.

### Do I need to run my own Generator client to run a Host client?

No, but you do need access to at least one working Generator client. A Host client doesn't read the source chain itself; it receives signed primitives from Generator clients over P2P, so it needs at least one reachable Generator client to sync from. That Generator client doesn't have to be _yours_, you can point at any one you can reach. The image ships with default peers, but they aren't guaranteed to be live, so in practice set `BOOTSTRAP_PEERS` to a Generator client you know is up (see [Install](/hosts/install)).

A public Generator client you can point at is planned; this page will link it once it's live.

### Can I connect my Host client to my own Generator client?

Yes, this is the normal way to run a Host client. Point it at your Generator client's libp2p multiaddr.

With Docker, pass it as an environment variable:

```shell
-e BOOTSTRAP_PEERS="/ip4/<generator-ip>/tcp/9171/p2p/<generator-peer-id>"
```

When building from source, set `defradb.p2p.bootstrap_peers` in your `config.yaml` instead.

The multiaddr must end in the Generator client's peer ID, because libp2p authenticates the connection against it, so a bare IP won't connect. Read the IP and peer ID from the Generator client's health endpoint:

```shell
curl -s http://<generator-host>:8080/health | jq -r '.p2p.self'
```

The peer ID is derived from the Generator client's keyring secret, so it's stable across restarts as long as that secret doesn't change. If you run the Host client and Generator client on the same machine, remap the Host client's published ports (the `-p` flags, or `defradb.url` and the P2P ports for a source build) so they don't collide with the Generator client's `9181` and `9171`.

### What hardware is recommended for running a Host client?

See [the Overview page](../overview) for a detailed rundown of hardware recommendataions.

### How do Views and lenses arrive on my Host client?

Developers register Views on ShinzoHub. Each View defines a WebAssembly lens that filters, decodes, and reshapes primitive data. Your Host client queries ShinzoHub for registered Views, downloads the lens for each, runs it against the primitives it receives from Generator clients, and writes the results to its local DefraDB. Applications query those documents over GraphQL. The ShinzoHub connection and the Generator client connection are separate: the Host client learns _which_ Views exist from ShinzoHub, but the raw data to run them on comes from a Generator client, so registered Views will appear before any data does if no Generator client is connected.

### What are attestation records?

When a Host client receives the same block from multiple independent Generator clients, it verifies each signature and creates an `AttestationRecord` that tracks how many Generator clients produced identical data. These records replicate between Host clients using a P-counter CRDT, which lets applications check how many independent sources agree on a piece of data before trusting it.

### Which ports does the Host client use?

| Port | Service |
| --- | --- |
| `9181` | DefraDB GraphQL + REST API. |
| `9182` | GraphQL Playground UI (the DefraDB GraphQL port + 1). |
| `9171` | libp2p P2P networking. Must be reachable for the Host client to connect to Generator clients. |
| `8080` | Health (`/health`) and metrics (`/metrics`) server. |

### How do I back up my keys?

Your node identity key is your Host's identity on the network. Lose it without a backup and you can't restore the same identity.

Where it lives depends on how you run the Host client:

- **Build from source:** `~/.defra/keys` by default.
- **Docker with persistence:** the host directory you mounted to `/app/.defra/keys` (for example `~/data/keys`).
- **Docker without volume mounts:** the key only exists inside the container and is lost when the container is removed. Mount a volume before you rely on a Host keeping its identity.

Copy the directory somewhere safe:

```shell
cp -r ~/.defra/keys /mnt/backup-drive/   # adjust the source path to match your setup
```
See [Register](/hosts/register#backup-your-node-identity-key) for more.

### My Host client starts but connects to no peers. What's wrong?

The Host client is running but can't sync from a Generator client. Check `docker logs shinzo-host` (or the process output for a source build) for the specific cause:

- `peer id mismatch: expected <A>, but remote key matches <B>` means the peer ID in your multiaddr is wrong or out of date. The Generator client at that address is running a different identity than the multiaddr claims; get the current one from its `/health` endpoint (`.p2p.self.id`). This also happens when you rely on the image's built-in default peers and they've gone stale; set `BOOTSTRAP_PEERS` to a current Generator client instead.
- `all dials failed` / `no route to host` / `i/o timeout` all mean that the address is unreachable. Confirm the Indexer is up and that outbound port `9171` is open from your machine.
- `dial tcp4 ... i/o timeout` usually indicates that you're running the Host client on an IPv6-only machine. the IPv4 peers are unreachable. Run on a dual-stack host, or enable NAT64/DNS64.

See [Install](/hosts/install#verify) for how to confirm a healthy connection.
