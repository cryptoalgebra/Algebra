

# ReservesManager


Algebra reserves management abstract contract

Encapsulates logic for tracking and changing pool reserves

*Developer note: The reserve mechanism allows the pool to keep track of unexpected increases in balances*


## Functions
### getReserves


`function getReserves() external view returns (uint128, uint128)` view external

The tracked token0 and token1 reserves of pool

*Developer note: If at any time the real balance is larger, the excess will be transferred to liquidity providers as additional fee.
If the balance exceeds uint128, the excess will be sent to the communityVault.*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |
| [1] | uint128 |  |

