

# IAlgebraPoolImmutables

Pool state that never changes

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*




## Functions
# dataStorageOperator


`function dataStorageOperator() external view returns (address)` view external

The contract that stores all the timepoints and can perform actions with them




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The operator address |

# factory


`function factory() external view returns (address)` view external

The contract that deployed the pool, which must adhere to the IAlgebraFactory interface




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The contract address |

# token0


`function token0() external view returns (address)` view external

The first of the two tokens of the pool, sorted by address




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The token contract address |

# token1


`function token1() external view returns (address)` view external

The second of the two tokens of the pool, sorted by address




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The token contract address |

# communityVault


`function communityVault() external view returns (address)` view external

The contract to which community fees are transferred




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The communityVault address |

# maxLiquidityPerTick


`function maxLiquidityPerTick() external view returns (uint128)` view external

The maximum amount of position liquidity that can use any tick in the range
*Developer note: This parameter is enforced per tick to prevent liquidity from overflowing a uint128 at any point, and
also prevents out-of-range liquidity from being used to prevent adding in-range liquidity to a pool*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 | The max amount of liquidity per tick |



---


