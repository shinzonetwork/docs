+++
title = "Privacy"
description = "If you're concerned about keeping all your Views and queries private, you may want to consider spinning up a private Host client, sometimes called a Direct Client."
mermaid = true
+++

A private Host, sometimes called a Direct Client, is a Host client that doesn't join the public Shinzo network. It connects to a single Generator client, runs Views locally, and never registers itself or publishes anything. A person running a private Host client is usually the same person running the Generator client it's connected to, meaning the read path stays private between those two clients.

## It's the same Host client

A private Host client is not a different binary, Docker image, or repository. It's the same `shinzo-host-client`. You pull the same image (`ghcr.io/shinzonetwork/shinzo-host-client:ethereum-mainnet-latest`), use the same `config.yaml`, and run the same binary. What makes it private is the configuration: which peers it dials, whether it contacts ShinzoHub, and whether it registers.

There is no separate download, no `--private` flag, and no private build of the client.

## The privacy model

A standard Host client ships configured for the public network. On startup it does two things that publicize activity:

- Dials the public bootstrap peers shipped in `config.yaml` to reach Generator clients it doesn't control.
- Contacts ShinzoHub (`shinzo.hub_base_url`) to fetch every registered View and subscribe to live registration events.

A third step is opt-in: registering on the [Host registry](../register) so other nodes can discover and replicate from it. This is a manual, wallet-signed action from the registration app, not something the Host client does on startup.

A private Host client connection closes some or all of these. How many you close decides how private the setup is.

## Two tiers

There are two tiers of privacy. Select the one that works for your use-case.

### Standard private Host client

Keep ShinzoHub connected so the Host client still fetches and runs the public Views registered on the network, but make the Host itself invisible. Don't register it, and peer it only to your own Generator client. You get the public Views without exposing your read node to the network.

What changes from the defaults:

- `defradb.p2p.bootstrap_peers`: replace the public peers with your Generator client's multiaddr. Do not include any other multiaddrs.
- `shinzo.hub_base_url`: set it to `testnet.shinzo.network:26657` (the shipped value; the code default is empty) so the Host client keeps fetching public Views.
- Skip [Register](/hosts/register/). An unregistered Host isn't discoverable and won't serve the network.

This is the topology covered in the [Operator Quickstart](/guides/operator-quickstart/).

### Fully air-gapped Host client

Cut ShinzoHub off entirely by setting `shinzo.hub_base_url` to an empty string. On startup the Host client logs a message like _No ShinzoHub base URL configured..._ and starts no event subscription, so it contacts nothing except the Generator client you point it at.

With no hub connection, no public peers, and no registration, nothing about this Host client is published to the network. This is the most private setup possible.

## Install a private Host client

If this sounds like something you'd like to use, head on over to the [Private Hosts install page](../../../run/run-a-host/private-hosts) for more information.
