+++
path = "run/chains/tron/mainnet/host/install"
title = "Host installation status \u2014 TRON Mainnet"
description = "Identify the compatible Host release before attempting TRON deployment."
template = "chain-page.html"
[extra]
chain = "tron"
heading = "Host installation status"
product = "host"
task = "install"
+++

## No verified TRON Host install command yet

The available TRON Generator branch supplies real ingestion code. The reviewed Host release still defines EVM-specific collection handling, so this guide does not publish a guessed TRON image tag or a renamed Ethereum deployment command.

## Integration sequence

1. Build and verify the [TRON Generator preview](../../generator/install/).
2. Obtain the matching Host implementation and supported configuration from the maintainers.
3. Confirm the collection compatibility requirements in [Prerequisites](../prerequisites/).
4. Configure the TRON Generator's schema base URL and full P2P multiaddr, using its actual schema prefix and authorization token.
5. Run the [verification sequence](../verify/) against an isolated deployment before registration.

## What the release must define

The executable or image reference, supported Generator revision, configuration schema, persistent identity location, TRON data retention behavior, attestation support, and operational limits must be documented together. A production setup command can be added once those are available.

Contact [Shinzo onboarding](https://discord.shinzo.network/) with the Generator revision and intended TRON workload to confirm the compatible Host path.
