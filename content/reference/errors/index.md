+++
title = "Errors"
description = "HTTP statuses and error responses from the Shinzo query path, and what each one means."
+++

Errors come in two layers on the query path. The billing gate in front of a Host's GraphQL endpoint rejects requests with a plain HTTP status and a plain text message. Requests that get past it can still fail inside GraphQL, and those failures arrive in the standard GraphQL error envelope. This page covers both, plus the statuses added by a network gateway deployment.

## Billing gate rejections (Host)

A Host client gates `/api/v0/graphql` with the billing middleware. When it rejects a request, the response body is plain text, not JSON:

```output
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8

forbidden: stale or future request
```

| Status | Message | Cause |
| --- | --- | --- |
| `400` | `bad graphql request` | The request could not be parsed as a GraphQL request at all. |
| `400` | `a billed query may touch only one view` | The query selects more than one View collection, and a billed query maps to one pool. |
| `403` | `forbidden: missing request signature` | The `extensions` envelope is absent or carries no `request_signature`. |
| `403` | `forbidden: stale or future request` | `request_timestamp` is outside the two-minute freshness window around the Host's clock. |
| `403` | `forbidden: request verification failed` | The signature does not verify, or the query does not match the signed `query_hash`. |
| `403` | `forbidden: query names no pool` | `pool_address` is missing or is the zero address. |
| `402` | `payment required: insufficient query balance` | The signer's query balance is below the Host's minimum. |
| `503` | `authorization backend unavailable` | The Host could not reach its authorizer. Retry, and report it if it persists. |
| `503` | `view metadata unavailable` | A registered View is missing its on-chain address, and the Host fails closed rather than serve it unverified. |

The envelope and the signing flow it requires are covered in [Connect your app to a Host](/build/how-to/connect-to-a-host/) and [Query your first View](/build/tutorials/query-your-first-view/). The freshness window is two minutes by default, so sign the envelope right before you send it, and treat repeated `stale or future request` rejections as clock skew between your machine and the Host.

## GraphQL errors

A request that passes the gate can still fail inside GraphQL: an unknown field, a malformed filter, a collection that does not exist. These arrive in the standard GraphQL error envelope:

```json
{
  "errors": [
    {
      "message": "..."
    }
  ]
}
```

A response can carry `data` and `errors` together, so check for `errors` before trusting `data`. Which HTTP status accompanies the envelope depends on the server and the negotiated content type, so parse the body rather than the status line for anything that got past the billing gate.

## Network gateway statuses

A network gateway deployment sits in front of several Hosts and returns the agreed answer. When it rejects a request itself, these statuses appear:

| Status | When |
| --- | --- |
| `400` | The query fails parse or validation, when the client negotiated `application/graphql-response+json`. With plain `application/json` these come back as `200` with an `errors` body, per the GraphQL-over-HTTP spec. |
| `406` | The `Accept` header matches no supported content type. |
| `413` | The request body exceeds 64 KiB. |
| `415` | The request `Content-Type` is not `application/json`. |
| `500` | An internal failure marshaling the response. |
| `502` | Every sampled Host failed, or a Host returned an unparseable response. |
| `503` | No Host serves the requested collection, or the query spans multiple root collections. |

The parse and validation messages a gateway returns are: `empty GraphQL query`, `GraphQL parse error`, `validation failed`, `limit not specified`, `invalid limit`, `order not specified`, `invalid order`, and `unsupported root selection`. The last three reflect the gateway's query contract: every root field needs a `limit` and an `order`, and fragments at the root of a query are not supported.

## Generator schema endpoint

The Generator's schema endpoints reject unauthenticated calls with a JSON envelope, `{"error": "<code>", "message": "<text>"}`, on `/api/v1/*`:

| Status | Code | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | No credentials supplied. |
| `403` | `forbidden` | The supplied key is not accepted. |
| `404` | `not_found` | Unknown collection name on `/api/v1/schema/{collection}`. |
| `500` | `internal_error` | Unexpected authentication failure. |
| `503` | `service_unavailable` | The Generator is in token mode but has no keys configured. |

See [Primitives](../data-model/primitives/) for the endpoints themselves.

## When a Host will not answer

On a testnet, registered endpoints go stale as Hosts come and go. If a Host times out or its connection fails, pick another registered Host and try again; [Query your first View](/build/tutorials/query-your-first-view/) shows the fallback loop. For operational symptoms on the infrastructure side, see [Troubleshooting](/run/operations/troubleshooting/).
