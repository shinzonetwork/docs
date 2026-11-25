+++
path = "run/bnb/generator/prerequisites"
aliases = ["run/chains/bnb/mainnet/generator/prerequisites"]
title = "Prerequisites"
description = "Requirements for running a Shinzo Generator on BNB Smart Chain Mainnet"
+++

A Shinzo Generator connects to a synchronized BNB Smart Chain Mainnet node through JSON-RPC and WebSocket endpoints to ingest blockchain data, process it into structured records and distribute signed data across the Shinzo network.

Before installing the Generator, you’ll need access to a BSC node with HTTP JSON-RPC and WebSocket subscriptions enabled, sufficient computing resources and connectivity to the Shinzo network. The Generator can run alongside your existing BSC node or on a separate server, provided both endpoints are accessible.

{% <admonition type="note"> %}
Note: Running a Generator and registering it with Shinzo are separate steps. You can install the client without registering, but network participation is subject to the eligibility requirements described in [Register Your Generator](../register)⁠￼.
{% </admonition> %}

## Hardware requirements

The Generator runs independently of the BSC node. The resources below are for the Generator only and must be provisioned in addition to the resources used by your existing blockchain infrastructure.

Resource|	Minimum	|Recommended
| --- | --- | --- |
CPU|	4 cores	|8 cores
Memory|	8 GB	|16 GB
Storage	|300 GB|	500 GB
Network|	100 Mbps|	1 Gbps

### Storage

The Generator uses pruning by default to limit how much historical blockchain data it retains. With pruning enabled, storage usage remains bounded by the configured retention window rather than growing indefinitely with chain history.

The 300–500 GB recommendation includes headroom for database operations, snapshot serving and P2P replication. With pruning disabled, storage grows as historical data accumulates.

### Network

A stable connection to your BSC node matters more than peak bandwidth. The Generator reads new blocks as they arrive, so RPC latency and node availability directly affect how closely it follows the chain tip. A 100 Mbps connection is the current planning baseline, while 1 Gbps provides additional headroom for snapshot serving and P2P replication.

## Deployment requirements

The Generator can be deployed on the same machine as your BSC node or on separate infrastructure.

### Running alongside your BSC node

You can run the Generator on the same machine as your existing BSC node, provided sufficient computing resources are available. In this configuration, the Generator connects to locally accessible JSON-RPC and WebSocket endpoints. Account for the Generator’s additional CPU, memory, and storage requirements when sizing the machine.

### Running on a separate machine

You can deploy the Generator on a dedicated server and connect it to your BSC node remotely. This approach separates the Generator’s resource consumption from the underlying blockchain node and allows both services to be managed independently. The BSC node’s JSON-RPC and WebSocket endpoints must be reachable from the Generator. Use a private network or secured connection rather than exposing unauthenticated RPC endpoints to the public internet.

## Registration requirements

Shinzo Testnet registration is open. To register a BNB Smart Chain Generator, you’ll need:

* **An eligible BSC validator**: Registration requires a validator recognized by the BNB Smart Chain network. Validator status is not currently verified during testnet registration. On mainnet, registration will require verification that the operator is associated with an active BSC validator.
* **Your validator address**: The BSC validator address used to identify your validator on the network. This will be required for validator verification on mainnet.
* **A browser wallet**: An EVM-compatible wallet to sign the registration transaction on ShinzoHub.

{% <admonition type="note"> %}
Validator verification is not enforced on the current testnet. You can register and operate a Generator without completing validator verification. This requirement will be enforced as Shinzo transitions to mainnet.
{% </admonition> %}

## Next steps

Once your BSC node is synchronized and the required infrastructure is available, continue to [Install & Configure](../install)⁠ to deploy the Generator and connect it to your node.