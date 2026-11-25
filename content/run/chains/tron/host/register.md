+++
draft = true
path = "run/tron/host/register"
aliases = ["run/chains/tron/mainnet/host/register"]
title = "Host registration status \u2014 TRON Mainnet"
description = "Verify TRON-serving support before registering a Host for that workload."
template = "chain-page.html"
[extra]
chain = "tron"
heading = "Host registration status"
product = "host"
task = "register"
+++

## Complete compatibility checks first

Do not treat a successful generic Host registration as evidence that the Host serves TRON correctly. Complete the [TRON Host compatibility requirements](../prerequisites/) with a supported implementation first.

## Coordination identity

Host registration is a ShinzoHub flow, separate from TRON source-chain account or producer registration. The [shared Host registry guide](/run/ethereum/host/register/) explains the existing identity and connection-string workflow, but does not establish TRON-serving compatibility.

Confirm the supported Host release, source-chain availability in onboarding, coordination environment, and registration scope with the Shinzo team. Do not invent TRON-specific registry fields or require a TRON producer's signing key for Host registration.

After a verified flow is available, check the registered identity and endpoint, then query TRON data through the registered Host to confirm the complete path.
