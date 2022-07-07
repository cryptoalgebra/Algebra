

# IAlgebraPoolEvents





## Events
### Initialize


`Initialize(uint160,int24)`  

Emitted exactly once by a pool when #initialize is first called on the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | The initial sqrt price of the pool, as a Q64.96 |
| tick | int24 | The initial tick of the pool, i.e. log base 1.0001 of the starting price of the pool |


### Mint


`Mint(address,address,int24,int24,uint128,uint256,uint256)`  

Emitted when liquidity is minted for a given position



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that minted the liquidity |
| owner | address | The owner of the position and recipient of any minted liquidity |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| liquidityAmount | uint128 | The amount of liquidity minted to the position range |
| amount0 | uint256 | How much token0 was required for the minted liquidity |
| amount1 | uint256 | How much token1 was required for the minted liquidity |


### Collect


`Collect(address,address,int24,int24,uint128,uint128)`  

Emitted when fees are collected by the owner of a position



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The owner of the position for which fees are collected |
| recipient | address | The address that received fees |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| amount0 | uint128 | The amount of token0 fees collected |
| amount1 | uint128 | The amount of token1 fees collected |


### Burn


`Burn(address,int24,int24,uint128,uint256,uint256)`  

Emitted when a position&#x27;s liquidity is removed



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The owner of the position for which liquidity is removed |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| liquidityAmount | uint128 | The amount of liquidity to remove |
| amount0 | uint256 | The amount of token0 withdrawn |
| amount1 | uint256 | The amount of token1 withdrawn |


### Swap


`Swap(address,address,int256,int256,uint160,uint128,int24)`  

Emitted by the pool for any swaps between token0 and token1



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that initiated the swap call, and that received the callback |
| recipient | address | The address that received the output of the swap |
| amount0 | int256 | The delta of the token0 balance of the pool |
| amount1 | int256 | The delta of the token1 balance of the pool |
| price | uint160 | The sqrt(price) of the pool after the swap, as a Q64.96 |
| liquidity | uint128 | The liquidity of the pool after the swap |
| tick | int24 | The log base 1.0001 of price of the pool after the swap |


### Flash


`Flash(address,address,uint256,uint256,uint256,uint256)`  

Emitted by the pool for any flashes of token0/token1



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that initiated the swap call, and that received the callback |
| recipient | address | The address that received the tokens from flash |
| amount0 | uint256 | The amount of token0 that was flashed |
| amount1 | uint256 | The amount of token1 that was flashed |
| paid0 | uint256 | The amount of token0 paid for the flash, which can exceed the amount0 plus the fee |
| paid1 | uint256 | The amount of token1 paid for the flash, which can exceed the amount1 plus the fee |


### CommunityFee


`CommunityFee(uint8,uint8)`  

Emitted when the community fee is changed by the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFee0New | uint8 | The updated value of the token0 community fee percent |
| communityFee1New | uint8 | The updated value of the token1 community fee percent |


### Incentive


`Incentive(address)`  

Emitted when new activeIncentive is set



| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPoolAddress | address | The address of a virtual pool associated with the current active incentive |


### Fee


`Fee(uint16)`  

Emitted when the fee changes



| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint16 | The value of the token fee |


### LiquidityCooldown


`LiquidityCooldown(uint32)`  

Emitted when the LiquidityCooldown changes



| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityCooldown | uint32 | The value of locktime for added liquidity |






---


