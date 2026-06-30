+++
title = "Outpost"
weight = 3
[extra]
mermaid = true
+++

An outpost is a smart contract deployed on an external chain (not ShinzoHub) that does two things: lets validators prove their identity so they can register as Generator, and lets users pay for view access without interacting with ShinzoHub directly.

Outposts are how external chains connect into the Shinzo network. They handle source chain local logic. [Relayers](../relayer) bridge the results to [ShinzoHub](../shinzohub).

## Why outposts exist

ShinzoHub cannot directly verify that a validator on another chain is who they claim to be. Every chain has its own consensus mechanism and key types. The outpost runs on the same chain as the validator, where that chain's native tools can verify identity.

Outposts also handle payments. Users on external chains should be able to pay in their chain's native currency without bridging tokens to ShinzoHub first.

## Validator assertions

An assertion is a cryptographic proof that a validator on an external chain is who they claim to be. This is a prerequisite for becoming an Generator. A validator cannot register a Generator client directly on ShinzoHub; they must go through the assertion process on their source chain first.

The flow:

1. The Generator client generates an operator (delegate) key locally.
1. The validator's withdrawal key calls the outpost, providing their consensus public key and the operator pubkey, and signs the assertion digest.
1. Outpost verifies the validator using the chain's native mechanism, stores the signed assertion, and emits an `AssertionSigned` event.
1. A [relayer](../relayer) picks up the event and broadcasts `MsgGeneratorAssertion` to ShinzoHub.
1. ShinzoHub verifies the assertion and records a slip for the operator pubkey. The Generator can now register in the Generator Registry (`0x0212`), signing the registration with its operator key.

### Consensus public key

The consensus public key (sometimes just called the consensus key) is the validator's identity on a chain's consensus layer. The outpost reads it from the assertion to know which validator is asserting, then asks the chain to confirm that validator is active and bonded. It is not the same as the withdrawal key: the withdrawal key signs the assertion to prove control of the validator's stake, while the consensus public key names the validator being asserted.

The key type, format, and lookup tooling are all chain-specific. Each outpost implementation defines what it expects.

- **Ethereum.** A 48-byte BLS12-381 pubkey used to sign beacon-chain attestations, presented as a `0x`-prefixed 96-character hex string. An operator who runs the validator can read it from their validator keystore (`keystore-m_*.json` -> `pubkey`) or via their client's CLI (for example `lighthouse account validator list`). It can also be queried from a beacon node at `GET /eth/v1/beacon/states/head/validators/{index}` (`data.validator.pubkey`), or looked up by validator index or withdrawal address on a public explorer such as beaconcha.in.
- **Cosmos SDK chains.** Typically an Ed25519 CometBFT pubkey. On the validator node, `<chaind> tendermint show-validator` prints it in the chain's `valconspub...` bech32 form. It can also be read from `<chaind> query staking validator <valoper-addr>` under `consensus_pubkey`.
- **Other chains.** Each future outpost will define its own consensus key type and the corresponding lookup procedure.

### The digest

The outpost generates a hash that both parties must sign. The digest includes the assertion ID, withdrawal address, delegate key, consensus key hash, creation time, and signature deadline.

How the digest is computed depends on the implementation. Different chains have different hashing and signing conventions. The requirement is that the digest is deterministic and includes enough context to prevent replay attacks across chains.

### EVM implementation

On Ethereum, the outpost contract (`GeneratorAssertion`) uses EIP-712 typed data signatures. The validator opens an assertion with `createAssertion`, then submits the withdrawal-key signature with `submitAssertionSignature`. The contract emits `AssertionSigned`, which the relayer subscribes to:

{% mermaid() %}
sequenceDiagram
  participant V as Validator<br/>(withdrawal key)
  participant C as GeneratorAssertion<br/>contract
  participant R as EVM relayer

  V->>C: createAssertion(<br/>consensusPubKey, delegateKey)
  C-->>V: assertionId<br/>+ EIP-712 digest
  V->>C: submitAssertionSignature(<br/>assertionId, withdrawalSig)
  C->>C: verify signature<br/>and validator status
  C-->>R: emit AssertionSigned event
{% end %}

The relayer reads the assertion fields from the event log and forwards them to ShinzoHub. There is no `extraData` tagging and no dependency on who built the block, which matters on mainnet where MEV-boost builders construct the block header (including `extraData`) on the validator's behalf.

### Chain-specific verification

The verification step is what makes each outpost implementation different. The concept is always the same (prove you are a validator), but the proof mechanism depends on the chain.

Some chains let you query the staking module to check if an address is bonded. Some use block production as proof. Others might use multisig schemes or oracle attestations. The outpost interface does not prescribe a mechanism. Each implementation uses whatever works on its chain.

## Payments

Users on external chains can pay for Shinzo resources without interacting with ShinzoHub.

1. User calls `payment()` with a resource type, their DID, a stream ID, and an expiration duration.
1. The contract stores a `PaymentReceipt` and emits a `PaymentCreated` event.
1. A [relayer](../relayer) picks up the event and delivers it to ShinzoHub as `MsgRequestStreamAccess`.

## Implementations

| Implementation | Chain type | Status |
| --- | --- | --- |
| shinzo-outpost | EVM (Ethereum, L2s) | Complete |
| Cosmos outpost | Cosmos SDK chains | Not yet implemented |
| CosmosEVM outpost | Hybrid Cosmos+EVM chains | Not yet implemented |

Each chain type gets its own outpost implementation. The verification mechanism can be completely different as long as the output (a signed assertion that a relayer can deliver) follows the same format. A Cosmos outpost would be a CosmWasm contract querying the staking module. For CosmosEVM chains, a Solidity contract could call the staking precompile at `0x0800`.
