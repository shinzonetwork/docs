# Indexer Getting Started

The Shinzo Indexer is the entry point into the Shinzo Network. The indexer is a client built with golang allowing a validator of any network to earn an additional reward for sorting and storing blocks with Shinzo. 

### Required GETH Config Values

```bash
GETH_RPC_URL=
GETH_WS_URL=
GETH_API_KEY= #optional if geth has authentication
```

These three keys are needed for the indexer to run. The indexer queries the Geth node for each block, sorts it into the resultant collection types, and stores it in its local defra instance. 

---

### Schema Details

The collection types are as follows, the field values can be found in `pkg/schema/schema.graphql`

```bash
Block{...}
Transaction{...}
AccessListEntry{...}
Log{...}
```

The order of the schema is:

```bash
1 Blocks contains many transactions
1 Transactions may contain many accessList
1 Transactions contains many logs
```

In practice each block looks like this, where … is the fields defined above in the schema

```bash
Block{
	...
	transactions{
		...
		accessList{...}
		logs{...}
	},
}

```

The indexer uses an embedded DefraDB instance to store, serve and replicate the data to the rest of the Shinzo Network. DefraDB uses libp2p under the hood for the replication and that happens passively when a host adds your PeerID to their list of peers.

---

### Config Settings

```bash
# Indexer Configuration
INDEXER_START_HEIGHT=23000000

# DefraDB Configuration 
DEFRADB_URL= # empty for embedded mode
DEFRADB_KEYRING_SECRET=<pick_a_password>

# Optional Defra Log Suppression recommended for prod
LOG_LEVEL=error
LOG_SOURCE=false 
LOG_STACKTRACE=false 
```

### Running Locally

---

1. create a `.env` 
    
    ```bash
    GETH_RPC_URL=
    GETH_WS_URL=
    GETH_API_KEY=                      #optional if geth has authentication
    
    # Indexer Configuration
    INDEXER_START_HEIGHT=<pick_a_starting_block> | # recommended 23000000
    
    # DefraDB Configuration 
    DEFRADB_URL=                       # empty for embedded mode
    DEFRADB_KEYRING_SECRET=<pick_a_password>
    ```
    
2. run `make build`
3. run `make start` 

*After `make start` the client will start posting block data to the provided DefraDB.* 

*Open up* http://localhost:8080/registration 

<aside>
💡

Registration will show required data to submit to ShinzoHub

</aside>

*Open up* http://localhost:8080/health 

<aside>
💡

Health shows status and uptime data

</aside>

*On `make stop` the client will shut down the client + DefraDB, saving everything the* storage location

### Network Configuring

---

P2P networking happens on port `9171` please leave that open for production deployments

Optional Port: `9181` for graphql

### ShinzoHub Registration

---

1. Start your indexer
2. Open the [registration route](http://localhost:8080/registration)
3. Copy the required fields under registration `message`, `public_key`, `signed_pk_message`, `peer_id` and `signed_peer_message`
    
    ```bash
      "registration": {
        "enabled": true,
        "message": "0x5368696e7a6f204e6574776f726b20496e646578657220726567697374726174696f6e",
        "defra_pk_registration": {
          "public_key": "0x02cea33c883fe893a277ef7637efbc844638d78a595e1776e7e30263631be798e3",
          "signed_pk_message": "0x3045022100c210e58b0547d7ed236cacc395c424a866b941422632e8d28f714ca7a0e6baa302201e94c77ac2124a21a62921bc28c909beaf4c8c3b03072c03d58853b12ea10f05"
        },
        "peer_id_registration": {
          "peer_id": "0xe02a3d4bd4b735aade91f5bcda664c446ecc44a5edfd8f6a45e49ac0bde4c2f6",
          "signed_peer_message": "0x0f926a1f832ca9b79581bdee22cc74c60099460ff6a75616f763cb1a1dd5508a184bf45efd7f25c048d60347ad99b19dd652c278f4b9c808eabe64c15e9f7201"
        }
    }
    ```
4. a.  Install Foundry forge [to use cast] from https://book.getfoundry.sh/forge/installation
4. b.  Complete this script and `run`
    
    ```bash
    #!/usr/bin/env bash
    set -euo pipefail
    
    RPC_URL="http://34.29.171.79:8545"
    FROM_ADDR="0x..." 
    PRECOMPILE_ADDR="0x0000000000000000000000000000000000000211"
    GAS_HEX="0x100000"
    ENTITY=1 
    
    PEER_PUB="0x..."
    PEER_SIG="0x..."
    
    NODE_PUB="0x..."
    NODE_SIG="0x..."
    
    # "Shinzo Network Indexer registration" in hex, starting with 0x
    MESSAGE="0x..."
    
    PRIVATE_KEY="0x..."
    
    cast send "$PRECOMPILE_ADDR" \
      "register(bytes,bytes,bytes,bytes,bytes,uint8)" \
      "$PEER_PUB" \
      "$PEER_SIG" \
      "$NODE_PUB" \
      "$NODE_SIG" \
      "$MESSAGE" \
      "$ENTITY" \
      --rpc-url "$RPC_URL" \
      --from "$FROM_ADDR" \
      --private-key "$PRIVATE_KEY" \
      --gas-limit "$GAS_LIMIT"
    
    ```
    

**🎉 you have successfully registered your indexer**
