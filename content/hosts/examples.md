---
title: Examples
sidebar_label: Query Examples
sidebar_position: 3
description: Ethereum Mainnet GraphQL Query Examples & Patterns
---

# Ethereum Mainnet GraphQL Query Examples & Patterns

This page lists common GraphQL query examples for Ethereum Mainnet. The examples focus on blocks, transactions, attestations, signatures, and document navigation using DocIDs and CIDs.

## 1. Querying a Block with Nested Data

Fetch a single block with nested sub-documents.

```graphql
{
  Ethereum__Mainnet__Block(limit:1){
    _docID
    number
    timestamp
    hash
    nonce
    difficulty
    size
    stateRoot
    gasUsed
    gasLimit
    baseFeePerGas
    logsBloom
    uncles
    sha3Uncles
    receiptsRoot
    parentHash
    extraData
    miner
    difficulty
    totalDifficulty
    transactions{
      hash
      blockHash
      block_id
      _docID
      # ...additional fields
      logs{
        blockHash
        transactionHash
        address
        topics
        data
        # ...additional fields
      }
      accessList{
        storageKeys
        address
        transaction_id
        # ...additional fields
      }
    }
  }
}
```

## 2. Blocks with Signatures (Verifiability)

Verify who signed a block record and inspect the cryptographic metadata.

```graphql
{
  Ethereum__Mainnet__Block(limit: 10, order: {number: DESC}) {
    number
    _docID
    _version {
      cid
      signature {
        identity
        value
        type
      }
    }
  }
}
```

## 3. Fetching a Document by DocID

Retrieve an exact document when you already know its `_docID`.

```graphql
query {
  Ethereum__Mainnet__Block(docID: <doc-id>) {
    _docID
    number
    _count(transactions:{})
    hash
    transactions(order: {transactionIndex: DESC}) {
      transactionIndex
      _docID
    }
  }
}
```

## 4. Attestations and Document Navigation

Attestation records link documents to one or more CIDs. These CIDs can then be used to navigate to commit metadata or directly to the underlying document.

### 4.1 AttestationRecord

```graphql
{
  Ethereum__Mainnet__AttestationRecord(limit:10){
    attested_doc
    source_doc
    CIDs
    _docID
    doc_type
  }
}
```

**Response**

```json
[..., {
	"CIDs": [
	  "bafyreibtbym4uht5dppohohg4wg66tdg4r253ws2i4wshc2gtwje6e25sy"
	],
	"_docID": "bae-00000035-bd9b-5938-a55f-3a477dac226a",
	"attested_doc": "bae-25fb059c-f232-5305-8a5d-0162f01e43e6",
  "doc_type": "Ethereum__Mainnet__Transaction",
  "source_doc": "bae-25fb059c-f232-5305-8a5d-0162f01e43e6"
},...]
```

### 4.2 CID → Commit Details

Given a CID from an attestation record, you can query commit-level metadata and signatures.

```graphql
{
  _commits(
    cid:"bafyreibtbym4uht5dppohohg4wg66tdg4r253ws2i4wshc2gtwje6e25sy"
  ){
    cid
    docID
    fieldName
    schemaVersionId
    signature{
      type
      value
      identity
    }
  }
}
```

**Response**

```json
{
  "data": {
    "_commits": [
      {
        "cid": "bafyreibtbym4uht5dppohohg4wg66tdg4r253ws2i4wshc2gtwje6e25sy",
        "docID": "bae-25fb059c-f232-5305-8a5d-0162f01e43e6",
        "fieldName": "_C",
        "schemaVersionId": "bafyreiagteeodcsrofk3s4fhubdi7jdzjeovhvpx4yayxkcxw2gm4zlcru",
        "signature": {
          "identity": "0348621aed3cb78ade074e86a3d650dfdfad0c110b274c0633b331d1b0a41ddd99",
          "type": "ES256K",
          "value": "MEUCIQCjfh3m0RNv4j094aW5YPEeF+GCMFWEGy0hiAcga7HKbQIgc54AV7WSdXZVyGH7jOuLcXJ6w5fDQSUdrlzgZhDkBTw="
        }
      }
    ]
  }
}
```

### 4.3 CID → Document

The same CID can be used to directly resolve the document itself.

```graphql
{
  Ethereum__Mainnet__Transaction(cid:"bafyreibtbym4uht5dppohohg4wg66tdg4r253ws2i4wshc2gtwje6e25sy"){
    _docID
		block_id
    blockHash
    blockNumber
    hash
    to
    from
    transactionIndex
    value
    # ... other fields
  }
}
```

**Response**

```json
{
  "data": {
    "Ethereum__Mainnet__Transaction": [
      {
        "_docID": "bae-25fb059c-f232-5305-8a5d-0162f01e43e6",
        "blockHash": "0x9ea35b3bd9e71c57617cc30394b22f607b735f2eea7a0db974cf02ad54de98fb",
        "blockNumber": 23902272,
        "block_id": "bae-91bd3f16-ccb1-5c35-b098-45672ee6fd48",
        "from": "0x654a6BCe2C6F0aF68eAdCFEaD06bB49C398B3F98",
        "hash": "0x61b79fc417ef183e1798681c59481410dd79f919d11806a6e7e77ebd0a744f78",
        "to": "0x677f857da5e7C42b823655290cc40ff401e138D3",
        "transactionIndex": 130,
        "value": "1000000000"
      }
    ]
  }
}
```

### 4.4 From CID → Document Directly

```graphql
{
  Ethereum__Mainnet__Transaction(cid:"bafyreibtbym4uht5dppohohg4wg66tdg4r253ws2i4wshc2gtwje6e25sy"){
    _docID
		block_id
    blockHash
    blockNumber
    hash
    to
    from
    transactionIndex
    value
    # ... other fields
  }
}
```

**Response**

```json
{
  "data": {
    "Ethereum__Mainnet__Transaction": [
      {
        "_docID": "bae-25fb059c-f232-5305-8a5d-0162f01e43e6",
        "blockHash": "0x9ea35b3bd9e71c57617cc30394b22f607b735f2eea7a0db974cf02ad54de98fb",
        "blockNumber": 23902272,
        "block_id": "bae-91bd3f16-ccb1-5c35-b098-45672ee6fd48",
        "from": "0x654a6BCe2C6F0aF68eAdCFEaD06bB49C398B3F98",
        "hash": "0x61b79fc417ef183e1798681c59481410dd79f919d11806a6e7e77ebd0a744f78",
        "to": "0x677f857da5e7C42b823655290cc40ff401e138D3",
        "transactionIndex": 130,
        "value": "1000000000"
      }
    ]
  }
}
```

## 5. DocID-Based Queries

```graphql
{
  Ethereum__Mainnet__Transaction(docID:"bae-25fb059c-f232-5305-8a5d-0162f01e43e6"){
    _docID
	block_id
    blockHash
    blockNumber
    hash
    to
    from
    transactionIndex
    value
    # ... other fields
  }
}
```

**Response**

```json
{
  "data": {
    "Ethereum__Mainnet__Transaction": [
      {
        "_docID": "bae-25fb059c-f232-5305-8a5d-0162f01e43e6",
        "blockHash": "0x9ea35b3bd9e71c57617cc30394b22f607b735f2eea7a0db974cf02ad54de98fb",
        "blockNumber": 23902272,
        "block_id": "bae-91bd3f16-ccb1-5c35-b098-45672ee6fd48",
        "from": "0x654a6BCe2C6F0aF68eAdCFEaD06bB49C398B3F98",
        "hash": "0x61b79fc417ef183e1798681c59481410dd79f919d11806a6e7e77ebd0a744f78",
        "to": "0x677f857da5e7C42b823655290cc40ff401e138D3",
        "transactionIndex": 130,
        "value": "1000000000"
      }
    ]
  }
}
```

## 6. Filters, Ordering & Limits

Number of Transactions in a Specific Block

```graphql
query {
  Ethereum__Mainnet__Block( filter: { number: { _eq: 23901130 } } ){
    _docID
    number
    hash
    receiptsRoot
    size
    gasUsed
    transactions(
      limit: 1,
      filter: { blockNumber: { _eq: 23901130 } }  
      order: { transactionIndex: DESC }
    ) {
      transactionIndex # highest index within the block / +1 to get tx count
    }
  }
}
```

The total transaction count is `highest transactionIndex + 1`.

## 7. Block with Transaction Count

```graphql
query {
  Ethereum__Mainnet__Block(limit:10) {
    _docID
    number
    hash
    _count(transactions:{})
  }
}
```
