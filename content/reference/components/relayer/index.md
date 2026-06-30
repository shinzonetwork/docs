+++
title = "Relayer"
weight = 4
+++

A relayer is a process that moves data from an external chain to ShinzoHub. It watches for assertions and payments produced by [outpost](../outpost) contracts and delivers them to ShinzoHub as Cosmos SDK transactions.

ShinzoHub does not watch external chains. It only processes messages that are broadcast to it. The relayer reads what happened on the source chain and tells ShinzoHub about it.

The relayer is a standalone Go process, not a smart contract. It connects to both the source chain and ShinzoHub: reads from one, writes to the other.

{% admonition(type="info") %}
This is the EVM relayer, which bridges Ethereum to ShinzoHub. It is a completely different system from the Hermes IBC relayer, which bridges ShinzoHub to SourceHub. They share the word _relayer_ and nothing else.
{% end %}

## Assertion relay

When a signed assertion is detected on the source chain, the relayer:

1. Extracts the assertion data (consensus key, delegate signature, digest, etc.).
1. Recovers the delegate public key from the delegate signature.
1. Packages everything into a `MsgGeneratorAssertion`.
1. Broadcasts the message to ShinzoHub.

After ShinzoHub processes the message, the Validator can register as a Generator in the Generator Registry (`0x0212`).

### What gets relayed

| Field | Description |
| --- | --- |
| Consensus public key | Public key of the validator |
| Delegate address | Address derived from the delegate key |
| Source chain | Identifier of the source chain |
| Source chain ID | Chain ID of the source chain |
| Assertion ID | ID from the outpost contract |
| Delegate digest | The assertion digest that was signed |
| Delegate signature | The delegate's signature over the digest |

### Chain-specific detection

How the relayer detects assertions depends on the source chain. EVM chains expose data through block headers and event logs. Cosmos chains emit `wasm-assertion_signed` events. ShinzoHub does not care how the relayer found the assertion. As long as it gets a valid `MsgGeneratorAssertion`, it processes it the same way.

## Payment relay

When the relayer sees a `PaymentCreated` event from the outpost contract, it extracts the payment details (resource type, identity, stream ID, expiration) and broadcasts `MsgRequestStreamAccess` to ShinzoHub.

The payment pipeline is optional and can be toggled in the relayer's configuration.

## Connections

The relayer maintains two connections:

| Connection | Purpose |
| --- | --- |
| Source chain (Ethereum) | Read assertion and payment data |
| ShinzoHub | Broadcast transactions |

The relayer has its own wallet on ShinzoHub and needs SHNZ for gas to broadcast transactions. It maintains a persistent block cursor so it can resume exactly where it left off after a restart.

## Implementations

| Implementation | Source chain type | Status |
| --- | --- | --- |
| shinzo-evm-relayer | EVM (Ethereum, L2s) | Complete |
| Cosmos relayer | Cosmos SDK chains | Not yet implemented |
| CosmosEVM relayer | Hybrid Cosmos+EVM chains | Not yet implemented |

Supporting a new chain type means writing a new relayer implementation. The detection mechanism can differ as long as the output (`MsgGeneratorAssertion`) follows the same format.
