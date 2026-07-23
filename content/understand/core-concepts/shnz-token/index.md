+++
title = "Tokenomics"
+++
SHNZ is the native token of ShinzoHub, the Cosmos SDK chain that coordinates the Shinzo network. It's the economic unit flowing between developers who publish Views, Hosts who serve them, and consumers who subscribe.

Confirmed so far:

- Staking: any address can stake SHNZ on a View to signal demand. Stake feeds into the View's price.
- Funding: consumers prepay SHNZ into a View's contract, tied to their DID. The balance sits there until a Host client serves a query, at which point the current price is debited and credited to the creator's earnings.
- Protocol cut: a flat percentage comes off every consumption event. It's enforced in the SVS-1 contract standard and can't be bypassed with a custom pricing contract.

The broader token design (staking incentives, Host earnings, slashing, the final fee rate) is still being worked out.
