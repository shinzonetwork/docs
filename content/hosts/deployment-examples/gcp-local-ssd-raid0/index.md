+++
title = "GCP VM with local SSD RAID-0"
[extra]
mermaid = true
+++

When to use this: you need high IOPS for DefraDB storage and want to use GCP local SSDs in a RAID-0 array. Local SSDs provide much higher throughput than standard persistent disks but are ephemeral.

These scenarios use Ethereum Mainnet data. Ethereum is the only officially supported chain today, but any EVM-compatible chain should work by changing the contract addresses and topic hashes to match the target chain. See the [Generator chain config](/generators/config-reference#chain) for details.

## Topology

{% mermaid() %}
flowchart LR
  subgraph GCP["GCP VM"]
    direction TB
    subgraph RAID["RAID-0 array"]
      direction LR
      SSD1["Local SSD 1"]
      SSD2["Local SSD 2"]
      SSDN["Local SSD N"]
    end
    MNT["/mnt/localssd<br/>ext4, noatime, discard"]
    Host["<b>Host container</b><br/>--network host<br/>:9181 :9171 :8080"]
    RAID --> MNT --> Host
  end

  Gens["Generators"]
  Gens -- "P2P (libp2p)" --> Host
{% end %}

The GCP startup script detects all local SSDs attached to the VM, creates a RAID-0 array across them, formats it as ext4, and mounts it at `/mnt/localssd`. The Host container runs with `--network host` and stores its DefraDB data on the RAID-0 mount. This gives the Host the combined IOPS and throughput of all attached local SSDs.

## Prerequisites

- A GCP VM with one or more local SSDs attached. See the [GCP local SSD documentation](https://cloud.google.com/compute/docs/disks/local-ssd) for how to create a VM with local SSDs.
- The `gcp-startup-host-local-ssd.sh` script from the `shinzo-host-client` repo, set as the VM startup script or run manually.
- A `config.yaml` file in the working directory where the script runs.

## Startup script

This script is drawn verbatim from `scripts/gcp-startup-host-local-ssd.sh` in the `shinzo-host-client` repo. It installs Docker, detects local SSDs by their `nvme_card` model, creates a RAID-0 array if there are two or more, formats and mounts the array, then pulls and starts the Host container:

```shell
#!/bin/bash

set -euxo pipefail

apt-get update
apt-get install -y docker.io mdadm

DEVICES=()
for dev in /dev/nvme*n*; do
  [[ "$dev" =~ p[0-9]+$ ]] && continue
  CTRL=$(echo "$dev" | sed 's|/dev/\(nvme[0-9]*\)n.*|\1|')
  MODEL=$(cat /sys/class/nvme/$CTRL/model 2>/dev/null | xargs)
  echo "Checking $dev - controller: $CTRL, model: '$MODEL'"
  if [[ "$MODEL" == "nvme_card" ]]; then
    DEVICES+=("$dev")
  fi
done

echo "Found ${#DEVICES[@]} Local SSD(s): ${DEVICES[*]}"

if [ "${#DEVICES[@]}" -eq 0 ]; then
  echo "ERROR: No Local SSDs detected! Check that Local SSDs are attached to this VM."
  exit 1
fi

if [ "${#DEVICES[@]}" -ge 2 ]; then
  echo "Creating RAID-0 over ${#DEVICES[@]} Local SSDs"
  RAID_DEV=/dev/md0
  if [ ! -e "$RAID_DEV" ]; then
    mdadm --create $RAID_DEV \
      --level=0 \
      --raid-devices=${#DEVICES[@]} \
      "${DEVICES[@]}"
  fi
  TARGET_DEV=$RAID_DEV
else
  echo "Only one Local SSD found, using it directly"
  TARGET_DEV=${DEVICES[0]}
fi

if ! blkid $TARGET_DEV; then
  mkfs.ext4 -F $TARGET_DEV
fi

MNT=/mnt/localssd
mkdir -p $MNT
mountpoint -q $MNT || mount -o noatime,discard $TARGET_DEV $MNT
chmod 777 $MNT
mkdir -p \
  $MNT/defradb \
  $MNT/logs
chown -R 1003:1006 $MNT/defradb

docker pull ghcr.io/shinzonetwork/shinzo-host-client:v0.5.1
docker rm -f shinzo-host || true
docker run -d \
  --name shinzo-host \
  --restart unless-stopped \
  --network host \
  -u 1003:1006 \
  -v $MNT/defradb:/app/.defra \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -e DEFRA_URL=0.0.0.0:9181 \
  -e START_HEIGHT=${START_HEIGHT:-} \
  -e BOOTSTRAP_PEERS=${BOOTSTRAP_PEERS:-} \
  -e LOG_LEVEL=error \
  -e LOG_SOURCE=false \
  -e LOG_STACKTRACE=false \
  --health-cmd="wget --no-verbose --tries=1 --spider http://localhost:8080/metrics || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  --health-start-period=40s \
  --log-opt max-size=50m \
  --log-opt max-file=3 \
  ghcr.io/shinzonetwork/shinzo-host-client:v0.5.1
```

### What each part does

- `apt-get install -y docker.io mdadm`: Installs Docker and `mdadm` for RAID management.
- The `for dev in /dev/nvme*n*` loop: Detects all NVMe devices and filters for GCP local SSDs by checking the `nvme_card` model string. GCP local SSDs can appear as multiple namespaces on one controller (`nvme0n1`, `nvme0n2`) or as separate controllers (`nvme0n1`, `nvme1n1`).
- `mdadm --create`: Creates a RAID-0 array across all detected local SSDs. If only one SSD is found, it is used directly without RAID.
- `mount -o noatime,discard`: Mounts the filesystem with `noatime` (no access time updates) and `discard` (TRIM support for SSD wear leveling).
- `chown -R 1003:1006 $MNT/defradb`: Sets ownership so the Host container (UID 1003, GID 1006) can read and write.
- `--network host`: The Host container uses the host network directly. No port mappings are needed because all ports are exposed on the VM.
- `-v $MNT/defradb:/app/.defra`: Mounts the RAID-0 filesystem as the DefraDB data directory. See [defradb store](/hosts/config-reference#defradb-store).
- `START_HEIGHT=${START_HEIGHT:-}` and `BOOTSTRAP_PEERS=${BOOTSTRAP_PEERS:-}`: These env vars are passed through from the VM environment if set. See [environment variables](/hosts/config-reference#environment-variables).

## Running the script

Set the script as the GCP VM startup script, or run it manually after SSH-ing into the VM:

```shell
chmod +x gcp-startup-host-local-ssd.sh
sudo ./gcp-startup-host-local-ssd.sh
```

Set `START_HEIGHT` and `BOOTSTRAP_PEERS` as environment variables before running if you want to override the config file values:

```shell
export START_HEIGHT=20000000
export BOOTSTRAP_PEERS='/ip4/34.63.13.57/tcp/9171/p2p/12D3KooWJGCSs1tkiDif4rgQMS7uNqTNA8BKNsNhW62NXbUN5Au3'
sudo -E ./gcp-startup-host-local-ssd.sh
```

## Gotchas

- GCP local SSDs are ephemeral. If the VM stops or restarts, all data on the local SSDs is lost. Use this setup only for data that can be re-synced from Generators over P2P, or pair it with the [snapshot bootstrap scenario](../snapshot-bootstrap/) to re-import historical data on restart.
- The script pins the image to `ghcr.io/shinzonetwork/shinzo-host-client:v0.5.1`. The [Watchtower scenario](../watchtower-auto-deploy/) uses `:latest`, and the [prod VM scenario](../prod-vm-nginx-tls/) uses `:standard`. Pick one tag and be consistent. The `v0.5.1` pin protects against unexpected updates but means you need to manually update the script to get new releases.
- `DEFRA_URL`, `LOG_LEVEL`, `LOG_SOURCE`, and `LOG_STACKTRACE` in the `docker run` command are not read by the Host client. They are kept here because they are in the original script, but they have no effect. See [env vars that are not read](/hosts/config-reference#env-vars-that-are-not-read).
- The script uses `--network host`, so no Docker port mappings are specified. All Host ports (9181, 9171, 8080) are directly exposed on the VM. If you need nginx as a reverse proxy, run it as a separate container or install it on the host.
- The `nvme_card` model check is specific to GCP local SSDs. If you are running on a different cloud provider, the NVMe model string will differ. Adjust the `MODEL` check accordingly.
- The `chmod 777 $MNT` sets world-writable permissions on the mount point. This is permissive but matches the original script. If you want tighter permissions, adjust the chmod and ensure the Host container's UID (1003) can still access the directory.

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
