---
title: "ShinzoHub"
---

Repo: [shinzonetwork/shinzohub](https://github.com/shinzonetwork/shinzohub) (Go)

ShinzoHub is the coordination chain of the Shinzo network. It is a Cosmos SDK chain with an integrated EVM, running CometBFT consensus. Views, hosts, indexers, and the economic layer (staking, funding, pricing, earnings) all live here.

ShinzoHub does not store or serve blockchain data. It is only a coordination layer.

## Tech stack

| Component | Implementation |
|-----------|---------------|
| Application framework | Cosmos SDK v0.53.4 |
| EVM module | cosmos/evm v0.4.1 |
| Consensus | CometBFT |
| Native token | SHNZ |

## Chain IDs

| Environment | Chain ID | Status |
|-------------|----------|--------|
| Devnet | 91273002 | Running |
| Testnet | 91273001 | Target: July 1, 2026 |
| Mainnet | 91273000 | Future |
| Local | 91273003 | Local development |

## Token details

| Property | Value |
|----------|-------|
| Base denomination | ushinzo |
| Display denomination | SHNZ |
| Decimals | 18 |
| Bech32 prefix | shinzo |
| Coin type | 60 (Ethereum-compatible) |
| Key algorithm | eth_secp256k1 |

ShinzoHub uses coin type 60, the same as Ethereum. The BIP-44 derivation path is `m/44'/60'/0'/0/0`. A MetaMask private key produces the same underlying address on both chains. The hex address (`0x742d...`) and bech32 address (`shinzo1ws69...`) are just different encodings of the same public key.

## Custom modules

ShinzoHub extends the standard Cosmos SDK module set with five custom modules:

| Module | Path | Purpose |
|--------|------|---------|
| admin | `x/admin/` | Network administration, governance |
| sourcehub | `x/sourcehub/` | ICA controller, sends messages to SourceHub |
| host | `x/host/` | Host registration data |
| indexer | `x/indexer/` | Indexer assertions and registrations |
| view | `x/view/` | View metadata after registration |

These run alongside the standard Cosmos SDK modules (auth, bank, staking, mint, distribution, slashing, gov, etc.) and the EVM/ERC20 modules.

Some older docs reference "Access Module" and "Registry Module." These do not exist. The registries are EVM precompiles, and access control lives on SourceHub.

## Precompiles

ShinzoHub uses EVM precompiled contracts to connect Cosmos module logic with the Solidity layer. Precompiles sit at fixed addresses and are implemented in Go rather than compiled Solidity bytecode. They have direct access to Cosmos SDK keepers.

| Address | Precompile | Purpose |
|---------|-----------|---------|
| `0x0210` | View Registry | Registers views, deploys SVS-1 contracts |
| `0x0211` | Host Registry | Tracks registered hosts |
| `0x0212` | Indexer Registry | Tracks registered indexers |

### View Registry (0x0210)

Two registration methods:

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `register(bytes) returns (address)` | Register view from VWL wire bytes, returns deployed View.sol address |
| `registerWithPricing` | `registerWithPricing(bytes, address) returns (address)` | Same, but sets a custom SVPS-1 pricing contract |

When `register(bytes)` is called:

1. Decodes VWL wire bytes via `viewbundle.DecodeHeader()`
2. Extracts SDL type name via regex
3. Computes key: `keccak256(caller, encodedValue)`
4. Modifies SDL to include unique ID (typename becomes `typename_0xkey`)
5. Re-encodes via `viewbundle.EncodeHeader()`
6. Calls `sourcehubKeeper.RegisterObject()` via ICA to register in SourceHub ACP
7. Deploys an SVS-1 contract for the view
8. Stores creator mapping in EVM state
9. Emits `Registered(key, creator)` EVM log + Cosmos event

Key files:
- `app/precompiles/viewregistry/methods.go`
- `app/precompiles/viewregistry/viewregistry.go`

### Host Registry (0x0211)

Receives a peer key and node identity key. On registration:

1. Verifies signatures
2. Derives DID and PID
3. Triggers ICA to SourceHub to add the DID to the `"host"` group

View.sol contracts check this registry before allowing `report()` and `consume()` calls:

```solidity
require(HOST_REGISTRY_CONTRACT.isRegistered(msg.sender), "caller is not a registered host");
```

Key files: `app/precompiles/hostregistry/methods.go`

### Indexer Registry (0x0212)

Indexers cannot self-register. They must go through the outpost + relayer assertion flow first:

1. Validator proves identity on source chain via outpost contract
2. Relayer delivers `MsgIndexerAssertion` to ShinzoHub
3. ShinzoHub's indexer module stores the assertion
4. Operator calls `register()`, registry verifies stored assertion, derives DID/PID, sends ICA to SourceHub

Key files: `app/precompiles/indexerregistry/methods.go`

## Event names

Each precompile emits both a Solidity EVM log and a Cosmos SDK event. The names differ:

| Precompile | Solidity EVM log | Cosmos SDK event |
|-----------|-----------------|-----------------|
| View Registry | `ViewCreated(address,address,string)` | `"ViewRegistered"` |
| Host Registry | `Registered(address,string)` | `"HostRegistered"` |
| Indexer Registry | `Registered(address,string)` | `"Registered"` |

Other events:

| Event | Emitted by |
|-------|-----------|
| `IndexerAsserted` | Indexer module msg_server |
| `AccessRequestSuccess` | SourceHub module msg_server |

There is a known issue: the host client subscribes to `"Registered"` events (filter: `Registered.key EXISTS`). This catches Indexer Registry events but misses View Registry events (which emit `"ViewRegistered"`). This is why view discovery can fail on some host versions. Fixed in ShinzoHub v2.

Some older docs reference `DataPurchased`, `AccessRevoked`, and `AccessRequestPayment`. These event names do not exist in the codebase.

## SVS-1 (Shinzo View Standard 1)

A per-view smart contract that the View Registry deploys automatically during view registration. Each view gets its own SVS-1 instance.

The contract exposes four functions:

- `stake()` -- stake SHNZ on the view
- `fund(did)` -- fund a DID's access to query the view
- `consume(did)` -- consume funded credits (called by hosts when serving queries)
- `report()` -- report usage

Price formula:

```
price = rate x complexity x premium - 5% protocol fee
```

For custom pricing, views can implement the SVPS-1 interface, which exposes a single `price() returns (uint256)` function.

## The sourcehub module (x/sourcehub)

This module holds the ICA controller logic. It stores ICA connection metadata (controller/host connection IDs), builds and sends ICA packets to SourceHub, and uses a hardcoded 5-minute timeout on all `SendTx` calls.

When a precompile registration triggers an ICA call, the keeper constructs a `MsgDirectPolicyCmd` wrapping a `RegisterObjectCmd` or `SetRelationshipCmd`, packs it into a `CosmosTx` envelope, and sends it over ICA. The Hermes relayer picks up the packet asynchronously.

The ICA relay is asynchronous. The EVM transaction completes and returns a receipt before SourceHub processes the packet. If the ICA packet fails or times out, the EVM transaction has still succeeded.

Key file: `x/sourcehub/keeper/keeper.go`

## Payment and access flow

The path from user payment to access grant has four steps:

1. User calls `payment()` on the outpost contract on the source chain, sends ETH. Contract stores receipt, emits `PaymentCreated`.
2. EVM relayer subscribes to `PaymentCreated`, builds `MsgRequestStreamAccess`, broadcasts to ShinzoHub.
3. ShinzoHub handler builds `MsgDirectPolicyCmd` with `SetRelationshipCmd`, sends via ICA. Grants user's DID read access on SourceHub.
4. ShinzoHub emits `AccessRequestSuccess` event.

## Endpoints

| Service | URL (devnet) |
|---------|-------------|
| EVM JSON-RPC | `http://rpc.devnet.shinzo.network:8545` |
| CometBFT RPC | `http://rpc.devnet.shinzo.network:26657` |
| REST / LCD | `http://rpc.devnet.shinzo.network:1317` |
| gRPC | port 9090 |

## What is not implemented yet

These appear in design docs but do not exist in any branch as of the current devnet:

- Balance monitoring (no code monitors user balances for depletion)
- Automatic access revocation (no RevokeAccess message; Expiration field exists in proto but is not enforced)
- `DataPurchased` event (outpost emits `PaymentCreated`, not `DataPurchased`)
- `GrantAccess` IBC message (actual mechanism uses ICA with ACP policy commands)
- Direct outpost integration in ShinzoHub (the relayer bridges everything)
- Hosts listening to SourceHub events (hosts listen to ShinzoHub CometBFT RPC, not SourceHub)
