+++
title = "Security"
description = "Security guidance for placing the Generator client relative to your validator: same-machine vs separate-machine deployments, key separation, and port exposure."
aliases = ["/generator/security", "/generators/security"]
[extra]
mermaid = true
+++

The Generator client runs as a sidecar next to an execution node, not as part of your validator's consensus process. This page covers the two deployment shapes operators ask about most: running the Generator on the same machine as your validator, and running it on a separate machine connected over a network.

## Same-machine deployment

Running the Generator client on the same machine as your validator (and its execution node) is the default shape and is safe. The Generator is a separate process with its own key, its own resources, and a one-way relationship with the execution node. It does not touch consensus.

### Key separation

The Generator client generates and stores its own operator (delegate) key locally. It never reads, writes, or holds your validator's consensus key or withdrawal key:

| Key | Held by | Used for |
| --- | --- | --- |
| Operator / delegate key | Generator client (local keyring) | Signing block batches, registering on ShinzoHub. |
| Consensus key | Validator client | Signing blocks and participating in consensus. |
| Withdrawal key | Browser wallet (off-machine) | Signing the one-time assertion that links the operator key to your validator during [registration](../register). |

The withdrawal key is used exactly once, in a browser wallet, to sign the assertion that ties the operator key to the validator's identity. After that, the Generator runs on the operator key alone. See [Registration](../register) and the [architecture reference](/reference/architecture/#generator-registration) for the full flow.

Because no key material is shared, a compromise of the Generator's operator key does not expose your validator's consensus or withdrawal keys.

### Reject inbound replication

The Generator is a write-only data producer. It reads blocks from the execution node and publishes signed documents to Hosts over P2P, but it rejects all inbound P2P replication. This is enforced by a replication filter in `pkg/generator/replication_filter.go` and by `defradb.p2p.accept_incoming`, which defaults to `false`. The Generator never accepts documents from peers, so even a peer that connects to it cannot push data into its database.

See the [Generator client reference](/reference/components/generator-client/#p2p-data-distribution) for details.

### Independent resource budget

The Generator is a lightweight sidecar: a ~50 MB binary with its own CPU and memory budget (4-8 CPU / 8-16 GB RAM for verifiable indexing of Ethereum Mainnet). It is sized independently of the execution node and the validator, so its load does not compete with consensus for resources when you run it as a separate process with its own limits. See [hardware requirements](../hardware-requirements/) for sizing.

For a worked same-machine example, see the [Validator with Geth](../deployment-examples/validator-with-geth/) deployment guide.

## Separate-machine deployment

When the Generator and the execution node (or validator) run on different machines, the question becomes which ports to expose across the network boundary. The rule of thumb: expose the P2P port, restrict the management API behind a reverse proxy, and keep the raw database API private.

### Topology

{% mermaid() %}
flowchart LR
  subgraph Exec["Execution node machine"]
    Node["<b>Execution node</b><br/>:8545 JSON-RPC<br/>:8546 WebSocket"]
  end

  subgraph GenVM["Generator machine"]
    direction TB
    Nginx["<b>Reverse proxy</b><br/>:443 TLS<br/>path allowlist"]
    Gen["<b>Generator client</b><br/>:9171 P2P<br/>:8080 health/metrics/registration<br/>:9181 DefraDB API (localhost)"]
    Nginx -- "safe paths only" --> Gen
  end

  Hosts["Hosts"]
  Ops["Operator / monitoring"]

  Node -- "RPC + WS<br/>VPC, restricted to Gen IP" --> Gen
  Gen -- "P2P (libp2p)<br/>:9171 public" --> Hosts
  Ops -- "HTTPS<br/>/health /metrics /snapshots" --> Nginx
{% end %}

The execution node feeds the Generator over a restricted private link. The Generator publishes to Hosts over P2P on `9171`. Operators and monitoring reach only the safe management paths through a reverse proxy on `443`. The raw DefraDB API on `9181` stays bound to localhost and never crosses the firewall.

### Port exposure

| Port | Service | Expose publicly? | Recommendation |
| --- | --- | --- | --- |
| `9171` | DefraDB P2P (libp2p) | Yes | Open on the firewall. This is how Hosts subscribe and receive data. |
| `8080` | Health, metrics, registration, schema | Only behind a reverse proxy | Do not publish raw. Put an nginx (or equivalent) allowlist in front that proxies only the safe paths (`/health`, `/registration`, `/registration-app`, `/metrics`, `/snapshots`, `/api/v1/schema`) and returns 404 for everything else. See the [nginx with snapshots](../deployment-examples/nginx-with-snapshots/) example for a working config. |
| `9181` | DefraDB GraphQL / REST API | No | Bind to localhost or a private network. This port gives raw, unauthenticated read/write access to the local DefraDB database. Publishing it to `0.0.0.0` lets anyone read or mutate the Generator's data. |

The shipped production tooling (`docker-compose-prod.yml` and `indexer-prod-setup.sh` in the `shinzo-generator-client` repo) follows this pattern: it publishes `9171`, fronts `8080` with an nginx allowlist, and never publishes `9181`.

### How this differs from a Host

Hosts intentionally expose `9181` because serving GraphQL queries to subscribers is their job. Generators only produce data and have no reason to answer external queries, so their `9181` should stay closed. The two roles have opposite exposure profiles on the same port.

### Execution-node side

On the execution node side of the link, restrict its JSON-RPC and WebSocket ports (commonly `8545` and `8546`) to the Generator's IP via a private network or VPC firewall. The Generator only reads from the node; it never writes to it. If the connection must cross a public boundary, authenticate it with an API key or a reverse proxy rather than exposing the node unauthenticated. See the [install page's API key guidance](../install/#do-you-need-an-api-key) for the header configuration.

### Schema endpoint auth

The shipped production scripts set `SCHEMA_AUTH_MODE=none`, which disables authentication on the `/api/v1/schema` endpoints. This is acceptable when `8080` is already behind a reverse-proxy allowlist that only proxies known-safe paths. If you expose schema management more broadly, switch `SCHEMA_AUTH_MODE` to `token` and provide accepted tokens via `SCHEMA_API_KEYS`. See the [config reference](../config-reference/#indexer) for the full set of values.

## Scope note on `9181`

This page treats the `9181` recommendation as an operational and network-exposure rule: keep the raw DefraDB HTTP API off the public internet because the shipped configuration has no built-in authentication for arbitrary queries against it. It is not a claim about what DefraDB can or cannot do internally. Whether DefraDB supports opt-in authentication or ACP on its HTTP API is still being confirmed with the team. Until that is settled, the safe default is to not expose `9181`.

## Need help

{{ need_help(client="Generator", repo_name="shinzo-generator-client", repo="https://github.com/shinzonetwork/shinzo-generator-client/issues") }}
