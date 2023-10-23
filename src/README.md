Separate components of the protocol are taken out in modules.

## Core

The key part of the protocol, which contains the main logic of liquidity pools. Swaps, liquidity provision, flashloans and so on are implemented here.

## Plugin

A separate module with plugin for the Core module. With the help of replaceable plugins, the functionality of the protocol can be changed and extended. A default plugin from the Algebra protocol team is implemented here.

## Periphery

This module contains smart contracts that can be used by users to easily interact with the protocol. Such as swap router, position manager and so on.

## Farming

A separate module with onchain farming for Algebra protocol concentrated liquidity positions.
