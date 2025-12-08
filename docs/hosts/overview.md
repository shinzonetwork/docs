---
title: Overview
sidebar_label: Overview
sidebar_position: 1
description: Introduction to the Shinzo Host Client, its role, and how it fits into the Shinzo network.
---

Hosts play a very important role in the Shinzo ecosystem. The Host's role is primarily as a data transformer and data availability layer. Hosts are responsible for transforming primitive data (blocks, logs, transactions, etc.) into useful "Views" of data.

"Views" can be thought of as user-defined APIs. The user/developer is responsible for defining how to retrieve the primitive data, how to transform the data, and finally how to serve the data. The Host is responsible for providing the infrastructure, compute, and memory required to actually perform those transactions and to deliver the View output to the users that need it.

Hosts also play an integral role in the security of the Shinzo network. They are responsible for creating "Attestation Records" which are used to propogate sign-offs from Indexer(s) on primitive data; users have the option to validate the source data against what other Indexers have posted, providing a means for data self-verification.

To help facilitate the Host role, the Shinzo team provides a Host application client that we highly recommend using.
