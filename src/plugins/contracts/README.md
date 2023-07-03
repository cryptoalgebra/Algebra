This directory contains the main Algebra protocol contracts:

## AlgebraPool

Concentrated liquidity pool contract where swaps occur and liquidity positions are placed. Only one pool can exist for each pair of tokens.

Parts of the internal logic of the pool are placed in separate abstract contracts in the base directory.

## DataStorageOperator

A separate DataStorageOperator contract is also created for each pool. This contract contains the logic needed to record the history of the pool in a series of timepoints. It also calculates statistical values ​​and adaptive fee.

## AlgebraFactory

The contract used to create new liquidity pools. The factory creates a DataStorageOperator contract for each pool and deploys the pool contract using a separate AlgebraPoolDeployer.

In addition, the factory contract is used to control access to various sensitive protocol functions. Such as changing community fee value, enabling/disabling farmings and so on.

## AlgebraCommunityVault

Community fee accumulates on this contract if it is enabled in pools.