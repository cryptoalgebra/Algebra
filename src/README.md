Separate components of the protocol are taken out in modules.

## Core

The key part of the protocol, which contains the main logic of liquidity pools. Swaps, liquidity provision, flashloans and so on are implemented here.

## Plugins

A separate module with plugins for the Core module. With the help of replaceable plugins, the functionality of the protocol can be changed and extended. A default plugin from the Algebra protocol is also implemented here.

## Periphery

This module contains smart contracts that can be used by users to easily interact with the protocol. Such as swap router, position manager and so on.

## Tokenomics

A separate module with onchain farming for Algebra protocol concentrated liquidity positions.
