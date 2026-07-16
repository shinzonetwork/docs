+++
title = "Nginx with TLS serving snapshots"
[extra]
mermaid = true
+++

When to use this: you want to run a production Generator behind Nginx with TLS, serving snapshot files to Host clients for fast historical bootstraping.

These scenarios use Ethereum Mainnet and Geth. Ethereum is the only officially supported chain today, but any EVM-compatible chain should work by changing `chain.name` and pointing the RPC URLs at a compatible node. See the [chain config](/generators/config-reference#chain) for details.

## Topology

{% mermaid() %}
flowchart LR
  subgraph VM["Prod VM"]
    direction LR
    Nginx["<b>Nginx</b><br/>:443 TLS"]
    Gen["<b>Generator client</b><br/>:8080 Health/Metrics/Snapshots<br/>:9171 P2P"]
    Nginx -- "proxy :8080" --> Gen
  end

  Hosts["Hosts"]

  Gen -- "P2P (libp2p)<br/>:9171" --> Hosts
  Hosts -- "HTTPS<br/>/snapshots" --> Nginx
{% end %}

Nginx terminates TLS on port 443 and proxies health, metrics, and snapshot requests to the Generator on port 8080. Hosts connect to the Generator over P2P on port 9171 for live block data. Hosts can also pull snapshot files over HTTPS through Nginx for historical bootstrap.

## Prerequisites

- Docker installed on the VM.
- TLS certificates in `~/ssl/`. You can use Let's Encrypt or your own CA.
- A Geth node endpoint (self-hosted or managed provider).
- Ports 443 and 9171 open externally.

## Compose file

This compose file is drawn from `docker-compose-prod.yml` and `indexer-prod-setup.sh` in the `shinzo-generator-client` repo. Snapshots are enabled so the Generator produces snapshot files that Hosts can download through Nginx. Replace `<YOUR_API_KEY_HERE>` with your Geth API key:

```yaml
networks:
  shinzo-net:
    driver: bridge

services:
  shinzo-indexer:
    container_name: shinzo-indexer
    platform: linux/amd64
    image: ghcr.io/shinzonetwork/shinzo-indexer-client:standard
    user: "1001:1001"
    restart: unless-stopped
    networks:
      - shinzo-net
    mem_limit: 16g
    mem_reservation: 13g
    ports:
      - "9171:9171"
    volumes:
      - ~/shinzo-data/defradb:/app/.defra
    environment:
      - GETH_RPC_URL=https://json-rpc.aouzyll7wj7e9xe4g7t82w88c.blockchainnodeengine.com
      - GETH_WS_URL=wss://ws.aouzyll7wj7e9xe4g7t82w88c.blockchainnodeengine.com
      - GETH_API_KEY=<YOUR_API_KEY_HERE>
      - GETH_API_KEY_TYPE=x-goog-api-key
      - INDEXER_START_HEIGHT=0
      - DEFRADB_KEYRING_SECRET=pingpong
      - GOMEMLIMIT=14GiB
      - SNAPSHOT_ENABLED=true
    logging:
      options:
        max-size: "50m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  nginx:
    image: nginx:alpine
    ports:
      - "443:8080"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ~/ssl:/etc/nginx/ssl:ro
    depends_on:
      - shinzo-indexer
    networks:
      - shinzo-net
    restart: unless-stopped
```

## Nginx configuration

This Nginx config is drawn from `indexer-prod-setup.sh`. It proxies health, registration, metrics, and snapshot endpoints, and returns 404 for unmatched routes. The CORS headers allow requests from `shinzo.network` origins:

```nginx
events { worker_connections 1024; }

http {
  map $http_origin $cors_origin {
    default "";
    "~^https://[^/]+\.shinzo\.network$" $http_origin;
  }

  server {
    listen 8080;
    server_name _;

    add_header 'Access-Control-Allow-Origin' $cors_origin always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, Origin' always;
    add_header 'Access-Control-Max-Age' 3600 always;
    add_header 'Vary' 'Origin' always;

    location = /health {
      if ($request_method = OPTIONS) { return 204; }
      proxy_pass http://shinzo-indexer:8080/health;
    }

    location = /registration {
      if ($request_method = OPTIONS) { return 204; }
      proxy_pass http://shinzo-indexer:8080/registration;
    }

    location = /metrics {
      if ($request_method = OPTIONS) { return 204; }
      proxy_pass http://shinzo-indexer:8080/metrics;
    }

    location = /snapshots {
      if ($request_method = OPTIONS) { return 204; }
      proxy_pass http://shinzo-indexer:8080/snapshots;
    }

    location ~ ^/snapshots/(.+)$ {
      if ($request_method = OPTIONS) { return 204; }
      proxy_pass http://shinzo-indexer:8080/snapshots/$1;
      proxy_buffering off;
      proxy_read_timeout 300s;
      proxy_send_timeout 300s;
      client_max_body_size 0;
    }

    location / {
      return 404;
    }
  }
}
```

### What the key values mean

- `SNAPSHOT_ENABLED=true`: The Generator produces signed snapshot files before pruning. The original `docker-compose-prod.yml` sets this to `false`. This scenario enables it so Hosts can bootstrap from snapshots. See [snapshot config](/generators/config-reference#snapshot).
- `GETH_API_KEY_TYPE=x-goog-api-key`: Header name for GCP BNE authentication. See [geth config](/generators/config-reference#geth).
- `GOMEMLIMIT=14GiB`: Go runtime soft memory limit, set below the 16g container limit. See [env vars](/generators/config-reference#environment-variables).
- The Nginx `proxy_buffering off` and extended timeouts on `/snapshots/(.+)$` prevent Nginx from buffering large snapshot downloads. `client_max_body_size 0` removes the request body size limit.

## Start the Generator

Place both files in the same directory and start:

```shell
docker compose -f docker-compose.yml up -d
```

Verify the Generator is healthy through Nginx:

```shell
curl https://your-domain/health
```

List available snapshots:

```shell
curl https://your-domain/snapshots
```

## Registration

Once the Generator is running, register it with the Shinzo Network. See [Registration](/generators/register/).

## Gotchas

- The original `docker-compose-prod.yml` sets `SNAPSHOT_ENABLED=false`. This scenario changes it to `true` because the purpose is to serve snapshots to Hosts. If you keep it `false`, no snapshot files are produced and the `/snapshots` endpoint returns nothing.
- The Nginx config listens on port 8080 internally and the compose file maps it to `443:8080`. This means Nginx handles TLS termination. You need TLS certificates in `~/ssl/` or Nginx will fail to start if configured for SSL. The config above does not include an explicit `ssl` directive because it inherits the certificates from the volume mount. Adjust the `listen` directive and certificate paths to match your TLS setup.
- The image tag `ghcr.io/shinzonetwork/shinzo-indexer-client:standard` in this compose file differs from the tag `ghcr.io/shinzonetwork/shinzo-generator-client:ethereum-mainnet-latest` used in the [install page](/generators/install/). Both refer to the Generator client image. Pick one and be consistent.
- `LOG_LEVEL`, `LOG_SOURCE`, and `LOG_STACKTRACE` appear in the original `docker-compose-prod.yml` but are not read by the Generator client. They have been omitted from this compose file. See the [env vars table](/generators/config-reference#environment-variables) for details.
- The snapshot directory defaults to `./snapshots` inside the container. Snapshots are written to the DefraDB data directory at `~/shinzo-data/defradb/snapshots` on the host because of the volume mount. Hosts download them through Nginx, not directly from the filesystem.
- The `proxy_read_timeout` and `proxy_send_timeout` are set to 300 seconds for snapshot downloads. Large snapshot files can take time to transfer. If Hosts time out downloading, increase these values.

## Need help

{{ need_help(client="Generator", repo_name="shinzo-generator-client", repo="https://github.com/shinzonetwork/shinzo-generator-client/issues") }}
