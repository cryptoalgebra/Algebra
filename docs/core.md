# Solidity API

## AlgebraFactory

### Modifiers
#### onlyOwner  











### Variables
#### bool isPaused 



#### bool isPauseForbidden 



#### address owner 

Returns the current owner of the factory


*Developer note: Returns the current owner of the factory*
#### address poolDeployer 

Returns the current poolDeployerAddress


*Developer note: Returns the current poolDeployerAddress*
#### address farmingAddress 



*Developer note: Is retrieved from the pools to restrict calling
certain functions not by a tokenomics contract*
#### address vaultAddress 



#### struct AdaptiveFee.Configuration baseFeeConfiguration 



#### mapping(address &#x3D;&gt; mapping(address &#x3D;&gt; address)) poolByPair 

Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist


*Developer note: Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist*
#### bytes32 POOL_INIT_CODE_HASH constant






## AlgebraPool

### Modifiers
#### onlyFactoryOwner  









#### whenUnpaused  











### Variables
#### mapping(bytes32 &#x3D;&gt; struct AlgebraPool.Position) positions 

Returns the information about a position by the position&#x27;s key


*Developer note: Returns the information about a position by the position&#x27;s key*
#### address activeIncentive 

Returns the information about active incentive


*Developer note: Returns the information about active incentive*
#### uint32 liquidityCooldown 

Returns the lock time for added liquidity

*Developer note: Returns the lock time for added liquidity*



## AlgebraPoolDeployer

### Modifiers
#### onlyFactory  









#### onlyOwner  











### Variables
#### struct AlgebraPoolDeployer.Parameters parameters 

Get the parameters to be used in constructing the pool, set transiently during pool creation.


*Developer note: Get the parameters to be used in constructing the pool, set transiently during pool creation.*
#### address factory 



#### address owner 






## DataStorageOperator

### Modifiers
#### onlyPool  









#### onlyFactory  











### Variables
#### struct DataStorage.Timepoint[65535] timepoints 



#### struct AdaptiveFee.Configuration feeConfig 



#### address pool immutable



#### address factory immutable






## PoolImmutables



### Variables
#### address dataStorageOperator immutable

The contract that stores all the timepoints and can perform actions with them


*Developer note: The contract that stores all the timepoints and can perform actions with them*
#### address factory immutable

The contract that deployed the pool, which must adhere to the IAlgebraFactory interface


*Developer note: The contract that deployed the pool, which must adhere to the IAlgebraFactory interface*
#### address token0 immutable

The first of the two tokens of the pool, sorted by address


*Developer note: The first of the two tokens of the pool, sorted by address*
#### address token1 immutable

The second of the two tokens of the pool, sorted by address


*Developer note: The second of the two tokens of the pool, sorted by address*
#### uint8 tickSpacing constant

The pool tick spacing


*Developer note: The pool tick spacing*
#### uint128 maxLiquidityPerTick constant

The maximum amount of position liquidity that can use any tick in the range


*Developer note: The maximum amount of position liquidity that can use any tick in the range*



## PoolState

### Modifiers
#### lock  











### Variables
#### uint256 totalFeeGrowth0Token 

The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool


*Developer note: The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool*
#### uint256 totalFeeGrowth1Token 

The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool


*Developer note: The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool*
#### struct PoolState.GlobalState globalState 

The globalState structure in the pool stores many values but requires only one slot
and is exposed as a single method to save gas when accessed externally.


*Developer note: The globalState structure in the pool stores many values but requires only one slot
and is exposed as a single method to save gas when accessed externally.*
#### uint128 liquidity 

The currently in range liquidity available to the pool


*Developer note: The currently in range liquidity available to the pool*
#### uint128 volumePerLiquidityInBlock 



#### mapping(int24 &#x3D;&gt; struct TickManager.Tick) ticks 

Look up information about a specific tick in the pool


*Developer note: Look up information about a specific tick in the pool*
#### mapping(int16 &#x3D;&gt; uint256) tickTable 

Returns 256 packed tick initialized boolean values. See TickTable for more information 

*Developer note: Returns 256 packed tick initialized boolean values. See TickTable for more information*



## IAlgebraFactory


### Events
#### OwnerChanged  


`OwnerChanged(address,address)`

Emitted when the owner of the factory is changed


*Developer note: Emitted when the owner of the factory is changed*


| Name | Type | Description |
| ---- | ---- | ----------- |
| oldOwner | address | The owner before the owner was changed |
| newOwner | address | The owner after the owner was changed |


#### VaultAddressChanged  


`VaultAddressChanged(address,address)`

Emitted when the vault address is changed


*Developer note: Emitted when the vault address is changed*


| Name | Type | Description |
| ---- | ---- | ----------- |
| vaultAddress | address | The vault address before the address was changed |
| _vaultAddress | address | The vault address after the address was changed |


#### PoolCreated  


`PoolCreated(address,address,address)`

Emitted when a pool is created


*Developer note: Emitted when a pool is created*


| Name | Type | Description |
| ---- | ---- | ----------- |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |
| pool | address | The address of the created pool |


#### FarmingAddressChanged  


`FarmingAddressChanged(address,address)`

Emitted when the farming address is changed


*Developer note: Emitted when the farming address is changed*


| Name | Type | Description |
| ---- | ---- | ----------- |
| farmingAddress | address | The farming address before the address was changed |
| _farmingAddress | address | The farming address after the address was changed |






## IAlgebraPool






## IAlgebraPoolDeployer


### Events
#### FactoryChanged  


`FactoryChanged(address,address)`

Emitted when the factory address is changed


*Developer note: Emitted when the factory address is changed*


| Name | Type | Description |
| ---- | ---- | ----------- |
| factory | address | The factory address before the address was changed |
| _factory | address | The factory address after the address was changed |






## IAlgebraVirtualPool






## IDataStorageOperator






## IERC20Minimal


### Events
#### Transfer  


`Transfer(address,address,uint256)`

Event emitted when tokens are transferred from one address to another, either via &#x60;#transfer&#x60; or &#x60;#transferFrom&#x60;.


*Developer note: Event emitted when tokens are transferred from one address to another, either via &#x60;#transfer&#x60; or &#x60;#transferFrom&#x60;.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | The account from which the tokens were sent, i.e. the balance decreased |
| to | address | The account to which the tokens were sent, i.e. the balance increased |
| value | uint256 | The amount of tokens that were transferred |


#### Approval  


`Approval(address,address,uint256)`

Event emitted when the approval amount for the spender of a given owner&#x27;s tokens changes.


*Developer note: Event emitted when the approval amount for the spender of a given owner&#x27;s tokens changes.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The account that approved spending of its tokens |
| spender | address | The account for which the spending allowance was modified |
| value | uint256 | The new allowance from the owner to the spender |






## IAlgebraFlashCallback






## IAlgebraMintCallback






## IAlgebraSwapCallback






## IAlgebraPoolActions






## IAlgebraPoolDerivedState






## IAlgebraPoolEvents


### Events
#### Initialize  


`Initialize(uint160,int24)`

Emitted exactly once by a pool when #initialize is first called on the pool


*Developer note: Emitted exactly once by a pool when #initialize is first called on the pool*


| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | The initial sqrt price of the pool, as a Q64.96 |
| tick | int24 | The initial tick of the pool, i.e. log base 1.0001 of the starting price of the pool |


#### Mint  


`Mint(address,address,int24,int24,uint128,uint256,uint256)`

Emitted when liquidity is minted for a given position


*Developer note: Emitted when liquidity is minted for a given position*


| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that minted the liquidity |
| owner | address | The owner of the position and recipient of any minted liquidity |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| amount | uint128 | The amount of liquidity minted to the position range |
| amount0 | uint256 | How much token0 was required for the minted liquidity |
| amount1 | uint256 | How much token1 was required for the minted liquidity |


#### Collect  


`Collect(address,address,int24,int24,uint128,uint128)`

Emitted when fees are collected by the owner of a position


*Developer note: Emitted when fees are collected by the owner of a position*


| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The owner of the position for which fees are collected |
| recipient | address |  |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| amount0 | uint128 | The amount of token0 fees collected |
| amount1 | uint128 | The amount of token1 fees collected |


#### Burn  


`Burn(address,int24,int24,uint128,uint256,uint256)`

Emitted when a position&#x27;s liquidity is removed


*Developer note: Emitted when a position&#x27;s liquidity is removed*


| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The owner of the position for which liquidity is removed |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| amount | uint128 | The amount of liquidity to remove |
| amount0 | uint256 | The amount of token0 withdrawn |
| amount1 | uint256 | The amount of token1 withdrawn |


#### Swap  


`Swap(address,address,int256,int256,uint160,uint128,int24)`

Emitted by the pool for any swaps between token0 and token1


*Developer note: Emitted by the pool for any swaps between token0 and token1*


| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that initiated the swap call, and that received the callback |
| recipient | address | The address that received the output of the swap |
| amount0 | int256 | The delta of the token0 balance of the pool |
| amount1 | int256 | The delta of the token1 balance of the pool |
| price | uint160 | The sqrt(price) of the pool after the swap, as a Q64.96 |
| liquidity | uint128 | The liquidity of the pool after the swap |
| tick | int24 | The log base 1.0001 of price of the pool after the swap |


#### Flash  


`Flash(address,address,uint256,uint256,uint256,uint256)`

Emitted by the pool for any flashes of token0/token1


*Developer note: Emitted by the pool for any flashes of token0/token1*


| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that initiated the swap call, and that received the callback |
| recipient | address | The address that received the tokens from flash |
| amount0 | uint256 | The amount of token0 that was flashed |
| amount1 | uint256 | The amount of token1 that was flashed |
| paid0 | uint256 | The amount of token0 paid for the flash, which can exceed the amount0 plus the fee |
| paid1 | uint256 | The amount of token1 paid for the flash, which can exceed the amount1 plus the fee |


#### SetCommunityFee  


`SetCommunityFee(uint8,uint8,uint8,uint8)`

Emitted when the community fee is changed by the pool


*Developer note: Emitted when the community fee is changed by the pool*


| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFee0Old | uint8 | The previous value of the token0 community fee percent |
| communityFee1Old | uint8 | The previous value of the token1 community fee percent |
| communityFee0New | uint8 | The updated value of the token0 community fee percent |
| communityFee1New | uint8 | The updated value of the token1 community fee percent |


#### CollectCommunityFee  


`CollectCommunityFee(address,address,uint128,uint128)`

Emitted when the collected community fees are withdrawn by the factory owner


*Developer note: Emitted when the collected community fees are withdrawn by the factory owner*


| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that collects the community fees |
| recipient | address | The address that receives the collected community fees |
| amount0 | uint128 | The amount of token0 community fees that is withdrawn |
| amount1 | uint128 |  |


#### IncentiveSet  


`IncentiveSet(address)`

Emitted when new activeIncentive is set


*Developer note: Emitted when new activeIncentive is set*


| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPoolAddress | address | The address of a virtual pool associated with the current active incentive |


#### ChangeFee  


`ChangeFee(uint16)`

Emitted when the fee changes


*Developer note: Emitted when the fee changes*


| Name | Type | Description |
| ---- | ---- | ----------- |
| Fee | uint16 | The value of the token fee |






## IAlgebraPoolImmutables






## IAlgebraPoolPermissionedActions






## IAlgebraPoolState






## AdaptiveFee






## Constants



### Variables
#### uint8 RESOLUTION constant



#### uint256 Q96 constant



#### uint256 Q128 constant



#### uint16 BASE_FEE constant






## DataStorage



### Variables
#### uint32 WINDOW constant






## FullMath






## LiquidityMath






## LowGasSafeMath






## PriceMovementMath






## SafeCast






## Sqrt






## TickManager






## TickMath



### Variables
#### int24 MIN_TICK constant



*Developer note: The minimum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**-128*
#### int24 MAX_TICK constant



*Developer note: The maximum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**128*
#### uint160 MIN_SQRT_RATIO constant



*Developer note: The minimum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MIN_TICK)*
#### uint160 MAX_SQRT_RATIO constant



*Developer note: The maximum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MAX_TICK)*



## TickTable






## TokenDeltaMath






## TransferHelper






## AdaptiveFeeTest



### Variables
#### struct AdaptiveFee.Configuration feeConfig 






## AlgebraPoolSwapTest



### Variables
#### int256 _amount0Delta 



#### int256 _amount1Delta 






## BitMathEchidnaTest






## BitMathTest






## DataStorageEchidnaTest



### Variables
#### contract DataStorageTest dataStorage 



#### bool initialized 



#### uint32 timePassed 






## DataStorageTest



### Variables
#### struct DataStorage.Timepoint[65535] timepoints 



#### uint32 time 



#### int24 tick 



#### uint128 liquidity 



#### uint16 index 






## FullMathEchidnaTest






## FullMathTest






## LiquidityAmounts






## LiquidityMathTest






## LowGasSafeMathEchidnaTest






## MockTimeAlgebraPool



### Variables
#### uint256 time 






## MockTimeAlgebraPoolDeployer


### Events
#### PoolDeployed  


`PoolDeployed(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |



### Variables
#### struct MockTimeAlgebraPoolDeployer.Parameters parameters 



#### struct AdaptiveFee.Configuration baseFeeConfiguration 






## PriceMovementMathEchidnaTest






## TokenDeltaMathTest






## PriceMovementMathTest






## TestAlgebraCallee


### Events
#### SwapCallback  


`SwapCallback(int256,int256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Delta | int256 |  |
| amount1Delta | int256 |  |


#### MintResult  


`MintResult(uint256,uint256,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Owed | uint256 |  |
| amount1Owed | uint256 |  |
| resultLiquidity | uint256 |  |


#### MintCallback  


`MintCallback(uint256,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Owed | uint256 |  |
| amount1Owed | uint256 |  |


#### FlashCallback  


`FlashCallback(uint256,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| fee0 | uint256 |  |
| fee1 | uint256 |  |






## TestAlgebraReentrantCallee



### Variables
#### string expectedReason constant






## TestAlgebraRouter


### Events
#### SwapCallback  


`SwapCallback(int256,int256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Delta | int256 |  |
| amount1Delta | int256 |  |






## TestAlgebraSwapPay






## TestERC20



### Variables
#### mapping(address &#x3D;&gt; uint256) balanceOf 



#### mapping(address &#x3D;&gt; mapping(address &#x3D;&gt; uint256)) allowance 



#### bool isDeflationary 






## TickMathEchidnaTest






## TickMathTest






## TickOverflowSafetyEchidnaTest



### Variables
#### int24 MIN_TICK constant



#### int24 MAX_TICK constant



#### uint128 MAX_LIQUIDITY constant



#### mapping(int24 &#x3D;&gt; struct TickManager.Tick) ticks 



#### int24 tick 



#### int256 totalLiquidity 



#### uint256 totalFeeGrowth0Token 



#### uint256 totalFeeGrowth1Token 



#### uint256 totalGrowth0 



#### uint256 totalGrowth1 






## TickTableEchidnaTest



### Variables
#### mapping(int16 &#x3D;&gt; uint256) bitmap 






## TickTableTest



### Variables
#### mapping(int16 &#x3D;&gt; uint256) bitmap 






## TickTest



### Variables
#### mapping(int24 &#x3D;&gt; struct TickManager.Tick) ticks 






## TokenDeltaMathEchidnaTest






## UnsafeMathEchidnaTest






