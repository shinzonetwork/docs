---
title: "Architecture overview"
---

Shinzo has two layers: an on-chain coordination layer and an off-chain data layer. The on-chain layer handles registration, payments, and access control. The off-chain layer handles the actual blockchain data, from fetching it through signing and transforming it to serving it to users. Neither layer works without the other. The on-chain layer controls who can participate, while the off-chain layer does the actual work.

## Component inventory

| Component | Layer | Language | Repo | Touches data? | | --- | --- | --- | --- | --- |
| Geth (source chain node) | Off-chain | Go | [go-ethereum](https://github.com/ethereum/go-ethereum) | Yes |
| Indexer client | Off-chain | Go | [shinzo-indexer-client](https://github.com/shinzonetwork/shinzo-indexer-client) | Yes |
| Host client | Off-chain | Go | [shinzo-host-client](https://github.com/shinzonetwork/shinzo-host-client) | Yes |
| Scheduler | Off-chain | Go | [shinzo-scheduler-service](https://github.com/shinzonetwork/shinzo-scheduler-service) | No |
| Network gateway | Off-chain | Go | [shinzo-network-gateway](https://github.com/shinzonetwork/shinzo-network-gateway) | No |
| ShinzoHub | On-chain | Go (Cosmos SDK) | [shinzohub](https://github.com/shinzonetwork/shinzohub) | No |
| SourceHub | On-chain | Go (Cosmos SDK) | [sourcehub](https://github.com/sourcenetwork/sourcehub) | No |
| EVM relayer | Off-chain | Go | [shinzo-evm-relayer](https://github.com/shinzonetwork/shinzo-evm-relayer) | No |
| Outpost contract | On-chain | Solidity | [shinzo-outpost](https://github.com/shinzonetwork/shinzo-outpost-contract) | No |
| View creator (viewkit) | Off-chain | Go | [shinzo-view-creator](https://github.com/shinzonetwork/shinzo-view-creator) | No |
| DefraDB | Off-chain | Go | [defradb](https://github.com/sourcenetwork/defradb) | Yes |
| Lens (LensVM) | Off-chain | Go/WASM | [lens](https://github.com/sourcenetwork/lens) | Yes |

## The two chains

### ShinzoHub

ShinzoHub is a Cosmos SDK chain with an integrated EVM running CometBFT consensus. The native token is `SHNZ`. ShinzoHub maintains three EVM precompile registries:

| Address | Registry | Purpose |
| --- | --- | --- |
| `0x0210` | View Registry | Registers views, deploys SVS-1 contracts. |
| `0x0211` | Host Registry | Tracks registered hosts. |
| `0x0212` | Indexer Registry | Tracks registered indexers. |

These precompiles are implemented in Go, not Solidity bytecode. They have direct access to Cosmos SDK keepers, which is how EVM transactions trigger cross-chain ICA calls to SourceHub. ShinzoHub also runs five custom Cosmos modules: `x/admin`, `x/sourcehub` (ICA controller), `x/host`, `x/indexer`, and `x/view`. These run alongside the standard Cosmos modules (auth, bank, staking, etc.).

| Environment | Chain ID |
| --- | --- |
| Devnet | `91273002` |
| Testnet | `91273001` |
| Mainnet | `91273000` |

### SourceHub

SourceHub is a separate Cosmos SDK chain built by [Source Network](https://source.network/). It runs the Access Control Policy (ACP) module, which implements Google's Zanzibar authorization model.

The ACP module stores authorization tuples:

```plaintext
object#relation@user
```

For example:

```plaintext
group:host#guest@did:key:z6MkHost7
view:0xABC#subscriber@did:key:z6MkUser1
```

Permission checks evaluate whether a chain of tuples grants a specific action. Permissions are boolean expressions over relations: `admin + creator + subscriber - banned` means anyone with the admin, creator, or subscriber relation, unless they are also banned.

SourceHub manages two independent policy domains:

1. Protocol participation -- which DIDs are registered as hosts or indexers (`group:host`, `group:indexer`).
1. View access -- which DIDs can read which views (`view:0xABC#subscriber`).

Users never interact with SourceHub directly. ShinzoHub sends commands to it via ICA.

## Cross-chain communication

ShinzoHub and SourceHub communicate using inter-blockchain communication (IBC). IBC has four layers:

```plaintext
┌─────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER                                          │
│  ICA (Interchain Accounts), IBC Transfer                    │
├─────────────────────────────────────────────────────────────┤
│  CHANNEL LAYER                                              │
│  Ordered or unordered packet delivery                       │
│  ICA uses ORDERED channels                                  │
├─────────────────────────────────────────────────────────────┤
│  CONNECTION LAYER                                           │
│  Links two chains via their light clients                   │
│  Durable -- survives channel closures                       │
├─────────────────────────────────────────────────────────────┤
│  CLIENT LAYER                                               │
│  Each chain runs a light client of the other                │
│  Verifies state proofs against block headers                │
└─────────────────────────────────────────────────────────────┘
```

The bottom two layers (clients and connections) are set up once and persist. The channel layer is fragile. ICA channels use ORDERED delivery, meaning packets must arrive in sequence. If any packet times out, the channel closes permanently and a new one must be opened.

ICA lets ShinzoHub control an account on SourceHub. When a precompile registration happens on ShinzoHub, the keeper constructs an ICA packet wrapping a `MsgDirectPolicyCmd` and sends it to SourceHub. The packet structure:

```plaintext
ICA Packet
└── CosmosTx
    └── MsgDirectPolicyCmd
            creator:    <ICA account on SourceHub>
            policy_id:  <Shinzo policy ID>
            cmd:        RegisterObjectCmd / SetRelationshipCmd / etc.
```

The Hermes relayer (Rust binary by Informal Systems) is the off-chain process that physically moves packets between chains. It reads outbound packets from ShinzoHub's state, fetches Merkle proofs, and submits them to SourceHub. It then reads acknowledgements from SourceHub and returns them to ShinzoHub. Hermes is stateless and trustless. It cannot fabricate packets because SourceHub verifies each packet against a state proof.

The ICA relay is asynchronous. When a precompile call triggers an ICA packet, the EVM transaction completes and returns a receipt before SourceHub has processed anything. If the ICA packet fails or times out, the EVM transaction still succeeded. The two outcomes are independent.

The `x/sourcehub` keeper uses a hardcoded 5-minute timeout on all `SendTx` calls. If SourceHub does not acknowledge within that window, the packet times out and the channel closes.

## The bridge to source chains

Two components connect external blockchains (Ethereum, Cosmos chains, etc.) to ShinzoHub.

### Outpost contracts

Outpost contracts are deployed on each source chain. They handle two things:

1. Validator assertions -- a challenge-response protocol where a validator proves their identity using chain-native mechanisms. On Ethereum, this uses EIP-712 typed signatures and embeds a 15-byte pointer in the block's `extraData` field with an "SH" prefix. Only block producers can write `extraData`, so the tag is proof of validator status.

2. Payments -- users call `payment()` on the outpost. The contract stores a receipt and emits a `PaymentCreated` event.

The outpost design is chain agnostic. Each chain gets its own implementation using whatever verification mechanism is native to that chain. The only requirement is that the output is a signed assertion that a relayer can deliver to ShinzoHub.

### Relayers (EVM relayer)

The EVM relayer is a Go process with two pipelines:

The assertion pipeline scans each Ethereum block's `extraData` for the "SH" tag, extracts the pointer, resolves it to an attestation on the ChallengeIssuer contract, verifies the EIP-712 signatures, and broadcasts `MsgIndexerAssertion` to ShinzoHub.

The payment pipeline subscribes to `PaymentCreated` log events from the outpost, extracts user DID and payment amount, and broadcasts `MsgRequestStreamAccess` to ShinzoHub.

The relayer maintains a persistent block cursor so it can resume where it left off after a restart. It has its own wallet on ShinzoHub and needs SHNZ for gas.

Note: the EVM relayer and the Hermes IBC relayer are completely different systems. The EVM relayer bridges Ethereum to ShinzoHub. The Hermes relayer bridges ShinzoHub to SourceHub over IBC. They share the word "relayer" and nothing else.

## Off-chain data flow

### DefraDB

DefraDB is the peer-to-peer document database embedded in every indexer and host. Three separate DefraDB instances exist in the system (one per indexer, one per host for primitives, one per host for view data).

DefraDB uses MerkleCRDTs, a combination of Merkle DAGs and CRDTs. Document updates are stored as a Merkle DAG where each node is a CRDT operation. CRDTs give you conflict resolution without coordination. The Merkle DAG gives you verifiable history. And because nodes can diff DAGs, sync only transfers the missing pieces.

Documents are content-addressed using CIDs (Content Identifiers). The CID is a hash of the document content, so verification is just re-hashing and comparing. DefraDB schemas are defined in GraphQL SDL, and queries use standard GraphQL syntax.

### P2P topology

Data replication uses libp2p, managed internally by DefraDB. The flow for a new document:

1. Indexer writes document to its local DefraDB
2. DefraDB computes a content digest
3. DefraDB gossips the digest to connected peers
4. Peers that want the document request the full content
5. DefraDB sends the full document

Indexers are write-only. They publish documents and reject all incoming replication (enforced by a replication filter in the indexer client). Hosts accept incoming documents from indexers and replicate attestation records between each other.

Peers discover each other through bootstrap peers configured in DefraDB and through `EntityRegistered` events from ShinzoHub (when new indexers or hosts join the network).

### Signing and attestation

Each indexer signs every block batch it produces. After writing all documents for a block (Block, Transaction, Log, AccessListEntry), the indexer computes a Merkle root over all document CIDs, signs it with its identity key, and writes a `BlockSignature` document. Individual documents also carry per-document signatures in their `_version` array.

Hosts verify incoming `BlockSignature` documents by recomputing the Merkle root and checking the signature against the indexer's known identity. They then create `AttestationRecord` documents that track how many independent indexers produced the same data. The `vote_count` field uses a P-counter CRDT, which merges deterministically across hosts.

Snapshots bundle multiple blocks into signed files for faster initial sync. The indexer periodically creates `SnapshotSignature` documents whose Merkle root is computed over the per-block `BlockSignature` roots within the range. So you get a two-level Merkle tree: document CIDs roll up into per-block roots, which roll up into per-snapshot roots.

## Registration flows

### Indexer registration

Spans two chains and a relayer:

```plaintext
Source chain (Ethereum)          ShinzoHub                  SourceHub
        |                            |                           |
        |  1. Validator calls createAttestation()               |
        |     on ChallengeIssuer contract                       |
        |     <- returns attestationId + EIP-712 digest         |
        |                            |                           |
        |  2. Validator submits signatures                       |
        |     <- gets 15-byte pointer                           |
        |     sets block extraData: "SH" + pointer              |
        |                            |                           |
        |  3. EVM Relayer scans extraData, resolves pointer,    |
        |     verifies signatures                               |
        | --------- MsgIndexerAssertion ---------> |            |
        |                            |                           |
        |            4. Processes MsgIndexerAssertion,          |
        |               stores assertion                        |
        |                            |                           |
        |            5. Operator calls register()               |
        |               on Indexer Registry (0x0212)            |
        |               -> verifies assertion                   |
        |               -> derives DID/PID                      |
        |                            |                           |
        |                            | ------- ICA packet -----> |
        |                            |                           |
        |                            |     6. ACP adds DID to   |
        |                            |        indexer group      |
```

### Host registration

```plaintext
ShinzoHub                              SourceHub
    |                                      |
    |  1. Operator calls register()        |
    |     on Host Registry (0x0211)        |
    |     -> provides peer key + node key  |
    |     -> registry verifies signatures  |
    |     -> derives DID/PID               |
    |                                      |
    | ----------- ICA packet ------------> |
    |                                      |
    |              2. ACP adds DID to      |
    |                 host group           |
```

### View registration

```plaintext
Developer machine              ShinzoHub                  SourceHub
        |                          |                           |
        |  1. viewkit view deploy  |                           |
        |     -> encodes VWL bytes |                           |
        |     -> signs EVM tx      |                           |
        | ------- to 0x0210 -----> |                           |
        |                          |                           |
        |          2. View Registry (0x0210)                   |
        |             -> decodes VWL header                    |
        |             -> extracts SDL type name                |
        |             -> deploys SVS-1 contract                |
        |             -> emits Registered event                |
        |                          |                           |
        |                          | -- ICA RegisterObject --> |
        |                          |                           |
        |                          |     3. ACP registers      |
        |                          |        view object        |
        |                          |                           |
        |          4. Host detects event                       |
        |             -> downloads bundle                      |
        |             -> loads WASM lens                       |
        |             -> starts transforming                   |
```

## Transaction flow through a precompile

The full path of an EVM transaction that hits a registry precompile and triggers a cross-chain ICA call:

```plaintext
  User sends EVM tx to precompile (e.g., 0x0210)
                      |
                      v
      Validator includes tx in ShinzoHub block
                      |
                      v
           EVM calls precompile.Run()
                      |
                      v
           Precompile Go code:
             1. Decode ABI arguments
             2. Business logic (validate, store)
             3. Call Cosmos keeper (e.g., RegisterObject)
             4. Keeper builds ICA packet, committed to IBC state
             5. Emit EVM log + Cosmos event
                      |
                      v  (async)
      Hermes relayer picks up ICA packet
                      |
                      v
  Hermes submits packet + state proof to SourceHub
                      |
                      v
    SourceHub verifies proof, executes ACP command
                      |
                      v
  Hermes relays acknowledgement back to ShinzoHub
```

The precompile emits both a Solidity EVM log and a Cosmos SDK event. The event names differ between layers:

| Precompile | EVM log | Cosmos event |
|-----------|---------|-------------|
| View Registry (0x0210) | `ViewCreated(address,address,string)` | `"ViewRegistered"` |
| Host Registry (0x0211) | `Registered(address,string)` | `"HostRegistered"` |
| Indexer Registry (0x0212) | `Registered(address,string)` | `"Registered"` |

## Repositories

### shinzo-gh (14 repos)

| Repo | Language | Purpose |
|------|----------|---------|
| shinzohub | Go (Cosmos SDK) | ShinzoHub chain: registries, SVS-1, payments |
| shinzo-indexer-client | Go | Indexer sidecar: block parsing, signing, P2P publish |
| shinzo-host-client | Go | Host node: attestation, lens execution, GraphQL serving |
| shinzo-view-creator | Go | CLI for building and deploying view bundles |
| shinzo-scheduler-service | Go | Scheduler: indexer-to-host assignment |
| shinzo-network-gateway | Go | Gateway: query routing, load balancing |
| shinzo-evm-relayer | Go | Relayer: Ethereum to ShinzoHub event bridging |
| shinzo-outpost-contract | Solidity | Outpost contract on Ethereum |
| shinzo-app-sdk | TypeScript | SDK for apps to query Shinzo views |
| viewbundle-go | Go | VWL wire format library (server-side) |
| wasm-bucket | Go | WASM artifact storage |
| blockscout-explorer | Elixir | Fork of Blockscout for ShinzoHub explorer |
| go-ethereum | Go | Fork of Geth (source chain node) |
| web | TypeScript | Registration page and web frontend |

### source-gh (key repos)

| Repo | Language | Purpose |
|------|----------|---------|
| defradb | Go | CRDT document database (core data layer) |
| sourcehub | Go (Cosmos SDK) | SourceHub chain: ACP, identity, policy |
| lens | Go/WASM | WASM transform runtime for views |
| network-operator | Go | Kubernetes controller for Hermes/chain infra |
| go-p2p | Go | libp2p networking layer |
| corekv | Go | Key-value store abstraction used by DefraDB |
