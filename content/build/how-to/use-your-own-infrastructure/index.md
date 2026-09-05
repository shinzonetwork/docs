+++
title = "Use your own infrastructure"
description = "How to run your own Host as a private Direct Client for your app: the strongest privacy and control, at the cost of operating a node."
+++

Everything in the Build apps section works against public infrastructure, and for most apps that is the right trade. But public Hosts are shared: they see your queries, their availability is not yours to control, and your app inherits their trust posture. Running your own Host client as a private Direct Client flips that. You get the strongest query privacy available today and full control over the data path, at the cost of operating a node.

The privacy point is worth stating plainly. When your app queries a public Host, that Host's operator can observe what you ask. When your app embeds DefraDB and receives pushed data, the Hosts you peer with still see what you subscribe to. Querying a Host you run yourself is the only configuration today where no third party can observe your queries, because there is no third party in the path at all. [Privacy](/understand/core-concepts/privacy/) lays out the full model.

## Pick a privacy tier

A private Host client comes in two tiers, and the difference is how much of the public network it talks to.

A standard private setup keeps ShinzoHub connected so your Host still fetches and runs the public Views, but makes the Host invisible: you skip registration, and you set `defradb.p2p.bootstrap_peers` to your own Generator client only. You get the public Views without exposing your read path to the network.

A fully air-gapped setup cuts ShinzoHub off entirely by setting `shinzo.hub_base_url` to an empty string. The Host contacts nothing except the Generator client you point it at, and nothing about it is published anywhere. This is the most private setup possible, and it means you manage View definitions yourself.

## Set it up

This page is the bridge, not the guide. The run section has the real instructions:

1. Run a Generator client to produce the signed primitive data. Start with [Run a Generator](/run/run-a-generator/install/) for installation and configuration.
1. Run a Host client against it. [Install a Host](/run/run-a-host/install/) covers the binary and ports, and [Private Hosts](/run/run-a-host/private-hosts/) walks through both privacy tiers with complete configs, including how to load Views onto an air-gapped Host.
1. Point your app at your Host exactly as you would at a public one. The `connection_string` and `endpoint_address` come from your Host's own `/registration` endpoint.

Expect to operate real infrastructure: a synced source-chain node or a managed endpoint for the Generator, disk for DefraDB, and the usual monitoring.

## Back to building

- [Connect your app to a Host](/build/how-to/connect-to-a-host/): everything on that page works unchanged against your own Host.
- [Choosing an app architecture](/build/explanation/choosing-an-architecture/): where running your own Host sits relative to the other two models.

## Need help

{{ need_help(client="Host", repo_name="shinzo-host-client", repo="https://github.com/shinzonetwork/shinzo-host-client/issues") }}
