This directory contains the main Algebra protocol contracts

## AlgebraPool

The main contract of the entire protocol, which implements the functions necessary for providing liquidity, making swaps, distributing fees, making flashloans and other key actions related to AMM. For each pair of tokens, one unique pool is created, whose parameters can be changed by the DAO or a protocol team.

Parts of the internal logic of the pool are placed in separate abstract contracts in the base directory:


- `AlgebraPoolBase.sol` basic abstract contract containing storage layout and general pool functions
- `Positions.sol` encapsulates the logic and calculations associated with liquidity positions
- `ReentrancyGuard.sol` contains modifier and functions to protect against reentrancy attacks
- `ReservesManager.sol` encapsulates the logic for changing and updating pool reserves
- `SwapCalculation.sol` contains calculations related to swaps (main cycle)
- `TickStructure.sol` defines the tick storage structure (doubly linked list)


The functionality of the pool can be extended using **plugins**. Each pool can be connected to a plugin smart contract, with which, using hooks (special functions), the pool can interact before or after certain actions.

The Algebra pool implements the interface `IAlgebraPool`. The interface is close to the UniswapV3 interface, but it has some differences.


## AlgebraFactory

The contract used to create new liquidity pools. The factory deploys the pool contract using a separate AlgebraPoolDeployer. Pools are created with the `create2` opcode, so their address can be determined at any time. However, it is important to note that the direct deployer of pools is not an AlgebraFactory, but an AlgebraPoolDeployer smart contract.

In addition, the factory contract is used to control access to various sensitive protocol functions. This smart contract provides a flexible mechanism of roles (using OppenZeppelin AccessControl), with the help of which DEX can configure rights and access both to a number of actions within the Algebra protocol and to additional external smart contracts.

## AlgebraPoolDeployer

A separate smart contract used exclusively for deploying new pools. The address of this contract must be used as a deployer when calculating pool addresses using the `create2` mechanism.

## AlgebraCommunityVault

A smart contract that receives the community fees collected by the protocol, if they are enabled. The use of one pre-created vault makes it easier to collect fees and reduce the cost of sending them from the pool.
