+++
title = "Watchtower auto-deploy"
[extra]
mermaid = true
+++

When to use this: you want pushes to `main` to automatically deploy to your Host VM. GitHub Actions builds and pushes the image to GHCR, then Watchtower on the VM detects the new image and restarts the container.

These scenarios use Ethereum Mainnet data. Ethereum is the only officially supported chain today, but any EVM-compatible chain should work by changing the contract addresses and topic hashes to match the target chain. See the [Generator chain config](/generators/config-reference#chain) for details.

## Topology

{% mermaid() %}
flowchart LR
  Dev["Push to main"]
  CI["<b>GitHub Actions</b><br/>test + build"]
  GHCR["<b>GHCR</b><br/>:latest + :sha-<commit>"]

  subgraph VM["Host VM"]
    direction TB
    WT["<b>Watchtower</b><br/>polls every 5 min"]
    Host["<b>Host container</b><br/>auto-restarts"]
    WT -- "pull + restart" --> Host
  end

  Dev --> CI --> GHCR
  GHCR -- "pull" --> WT
{% end %}

A developer pushes to `main`. GitHub Actions runs tests, builds the Docker image, and pushes it to GitHub Container Registry with two tags: `:latest` and `:sha-<commit>`. Watchtower runs on the VM and polls GHCR every 5 minutes. When it detects a new `:latest` image, it stops the old Host container, pulls the new image, and starts a new container with the same configuration.

## Prerequisites

- Docker installed on the VM.
- A GitHub Personal Access Token (PAT) with `read:packages` scope for GHCR authentication.
- A `config.yaml` file with your Host configuration on the VM.
- The Host GitHub repo set up with GitHub Actions and the `DEFRA_KEYRING_SECRET` secret for tests.

## VM setup

### Authenticate to GHCR

Log in to GHCR once on the VM. The credentials are saved to `~/.docker/config.json` so Watchtower can use them:

```shell
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

Replace `YOUR_GITHUB_PAT` with your GitHub Personal Access Token and `YOUR_USERNAME` with your GitHub username.

### Start Watchtower

Watchtower watches for containers with the `com.centurylinklabs.watchtower.enable=true` label and pulls new images for them. It polls every 300 seconds (5 minutes) and cleans up old images:

```shell
docker run -d \
  --name watchtower \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.docker/config.json:/config.json:ro \
  -e WATCHTOWER_POLL_INTERVAL=300 \
  -e WATCHTOWER_CLEANUP=true \
  -e WATCHTOWER_LABEL_ENABLE=true \
  containrrr/watchtower
```

### Start the Host container

The Host container needs the Watchtower label so Watchtower knows to update it. This `docker run` is drawn from `.github/DEPLOYMENT.md` in the `shinzo-host-client` repo:

```shell
docker run -d \
  --label com.centurylinklabs.watchtower.enable=true \
  --name shinzo-host \
  --restart unless-stopped \
  -p 9181:9181 \
  -p 9182:9182 \
  -p 9171:9171 \
  -v $(pwd)/data/defradb:/app/.defra/data \
  -v $(pwd)/data/lens:/app/.lens \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -e DEFRA_URL=0.0.0.0:9181 \
  -e LOG_LEVEL=error \
  -e LOG_SOURCE=false \
  -e LOG_STACKTRACE=false \
  ghcr.io/shinzonetwork/shinzo-host-client:latest
```

The `--label com.centurylinklabs.watchtower.enable=true` tells Watchtower to manage this container. Without it, Watchtower ignores the container.

## GitHub Actions workflow

The GitHub Actions workflow triggers on push to `main`. It runs tests, builds the Docker image, and pushes it to GHCR with two tags. The required GitHub secret is `DEFRA_KEYRING_SECRET`, used for tests.

### Image tags

| Tag | Purpose |
| --- | --- |
| `ghcr.io/shinzonetwork/shinzo-host-client:latest` | Most recent main build. Watchtower watches this tag. |
| `ghcr.io/shinzonetwork/shinzo-host-client:sha-<7chars>` | Specific commit, used for rollback. |

### Deploy process

1. Run tests.
1. Build Docker image with SHA tag.
1. Push to GHCR with `:latest` and `:sha-<commit>` tags.
1. Watchtower detects the new `:latest` image within 5 minutes.
1. Watchtower stops the old container, pulls the new image, and starts a new container with the same configuration.

## Troubleshooting

### Check Watchtower logs

```shell
docker logs watchtower --tail 50
```

### Check if Watchtower can pull images

```shell
docker pull ghcr.io/shinzonetwork/shinzo-host-client:latest
```

If this fails, check your GHCR credentials in `~/.docker/config.json`.

### Force immediate update

```shell
docker exec watchtower /watchtower --run-once
```

### Manual rollback

Stop the current container and start with a specific SHA tag:

```shell
docker stop shinzo-host && docker rm shinzo-host

docker run -d \
  --label com.centurylinklabs.watchtower.enable=true \
  --name shinzo-host \
  --restart unless-stopped \
  -p 9181:9181 \
  -p 9182:9182 \
  -p 9171:9171 \
  -v $(pwd)/data/defradb:/app/.defra/data \
  -v $(pwd)/data/lens:/app/.lens \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -e DEFRA_URL=0.0.0.0:9181 \
  -e LOG_LEVEL=error \
  -e LOG_SOURCE=false \
  -e LOG_STACKTRACE=false \
  ghcr.io/shinzonetwork/shinzo-host-client:sha-abc1234
```

Replace `sha-abc1234` with the actual commit SHA tag you want to roll back to.

## Gotchas

- The container must have the `com.centurylinklabs.watchtower.enable=true` label or Watchtower will ignore it. Verify with `docker inspect shinzo-host | grep watchtower`.
- `DEFRA_URL`, `LOG_LEVEL`, `LOG_SOURCE`, and `LOG_STACKTRACE` in the `docker run` commands are not read by the Host client. They are kept here because they are in the original DEPLOYMENT.md, but they have no effect. See [env vars that are not read](/hosts/config-reference#env-vars-that-are-not-read).
- The Host image tag `:latest` is used here. The [prod VM scenario](../prod-vm-nginx-tls/) uses `:standard`, and the [GCP local SSD scenario](../gcp-local-ssd-raid0/) pins `:v0.5.1`. If you use Watchtower with `:latest`, you get automatic updates. If you pin a specific tag, Watchtower will not detect new images.
- Watchtower preserves the container's configuration (ports, volumes, env vars, labels) across restarts. It only replaces the image. If you need to change the container configuration, stop and remove it manually, then start a new container with the updated configuration.
- The `DEFRA_KEYRING_SECRET` GitHub secret is used for tests in the CI pipeline, not for runtime. The runtime keyring secret comes from your `config.yaml` on the VM. See [defradb config](/hosts/config-reference#defradb).
- There is a 5-minute delay between the image push and the container restart, controlled by `WATCHTOWER_POLL_INTERVAL=300`. To reduce this, lower the interval. To increase it, raise the interval. Lower intervals mean more frequent GHCR API calls.
- Local SSDs are ephemeral on GCP. If you use Watchtower with the [GCP local SSD scenario](../gcp-local-ssd-raid0/), a VM restart will lose all DefraDB data. Watchtower will restart the container with the new image, but the data directory will be empty. Pair with the [snapshot bootstrap scenario](../snapshot-bootstrap/) to re-import data on restart.

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
