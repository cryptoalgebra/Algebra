

# AlgebraFactory

## Modifiers
#### onlyOwner  











## Variables
#### bool isPaused 



#### bool isPauseForbidden 



#### address owner 

Returns the current owner of the factory

*Developer note: Can be changed by the current owner via setOwner*
#### address poolDeployer 

Returns the current poolDeployerAddress

#### address farmingAddress 



*Developer note: Is retrieved from the pools to restrict calling
certain functions not by a tokenomics contract*
#### address vaultAddress 



#### struct AdaptiveFee.Configuration baseFeeConfiguration 



#### mapping(address &#x3D;&gt; mapping(address &#x3D;&gt; address)) poolByPair 

Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist

*Developer note: tokenA and tokenB may be passed in either token0/token1 or token1/token0 order*

## Functions
#### constructor  public


`constructor(address,address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _poolDeployer | address |  |
| _vaultAddress | address |  |


#### createPool  external


`createPool(address,address)`

Creates a pool for the given two tokens and fee



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenA | address | One of the two tokens in the desired pool |
| tokenB | address | The other of the two tokens in the desired pool |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

#### setOwner  external

onlyOwner

`setOwner(address)`

Updates the owner of the factory



| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | The new owner of the factory |


#### setFarmingAddress  external

onlyOwner

`setFarmingAddress(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingAddress | address | The new tokenomics contract address |


#### setVaultAddress  external

onlyOwner

`setVaultAddress(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _vaultAddress | address |  |


#### setBaseFeeConfiguration  external

onlyOwner

`setBaseFeeConfiguration(uint32,uint32,uint32,uint32,uint16,uint16,uint32,uint32,uint16)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint32 |  |
| alpha2 | uint32 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| volumeBeta | uint32 |  |
| volumeGamma | uint32 |  |
| baseFee | uint16 |  |


#### pause  external

onlyOwner

`pause()`







#### unpause  external

onlyOwner

`unpause()`







#### forbidPause  external

onlyOwner

`forbidPause()`









---




# AlgebraPool

## Modifiers
#### onlyFactoryOwner  









#### whenUnpaused  











## Variables
#### mapping(bytes32 &#x3D;&gt; struct AlgebraPool.Position) positions 

Returns the information about a position by the position&#x27;s key

#### address activeIncentive 

Returns the information about active incentive

*Developer note: if there is no active incentive at the moment, virtualPool,endTimestamp,startTimestamp would be equal to 0*
#### uint32 liquidityCooldown 

Returns the lock time for added liquidity


## Functions
#### constructor  public

PoolImmutables

`constructor()`







#### timepoints view external


`timepoints(uint256)`

Returns data about a specific timepoint index



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The element of the timepoints array to fetch |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool |  |
| blockTimestamp | uint32 |  |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint88 |  |
| averageTick | int24 |  |
| volumePerLiquidityCumulative | uint144 |  |

#### getInnerCumulatives view external


`getInnerCumulatives(int24,int24)`

Returns a snapshot of the tick cumulative, seconds per liquidity and seconds inside a tick range



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick of the range |
| topTick | int24 | The upper tick of the range |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| innerTickCumulative | int56 |  |
| innerSecondsSpentPerLiquidity | uint160 |  |
| innerSecondsSpent | uint32 |  |

#### getTimepoints view external


`getTimepoints(uint32[])`

Returns the cumulative tick and liquidity as of each timestamp &#x60;secondsAgo&#x60; from the current block timestamp



| Name | Type | Description |
| ---- | ---- | ----------- |
| secondsAgos | uint32[] | From how long ago each cumulative tick and liquidity value should be returned |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

#### initialize  external


`initialize(uint160)`

Sets the initial price for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| initialPrice | uint160 |  |


#### mint  external

lock, whenUnpaused

`mint(address,address,int24,int24,uint128,bytes)`

Adds liquidity for the given recipient/bottomTick/topTick position



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| recipient | address | The address for which the liquidity will be created |
| bottomTick | int24 | The lower tick of the position in which to add liquidity |
| topTick | int24 | The upper tick of the position in which to add liquidity |
| _liquidity | uint128 |  |
| data | bytes | Any data that should be passed through to the callback |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |
| liquidityAmount | uint256 |  |

#### collect  external

lock

`collect(address,int24,int24,uint128,uint128)`

Collects tokens owed to a position



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which should receive the fees collected |
| bottomTick | int24 | The lower tick of the position for which to collect fees |
| topTick | int24 | The upper tick of the position for which to collect fees |
| amount0Requested | uint128 | How much token0 should be withdrawn from the fees owed |
| amount1Requested | uint128 | How much token1 should be withdrawn from the fees owed |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint128 |  |
| amount1 | uint128 |  |

#### burn  external

lock

`burn(int24,int24,uint128)`

Burn liquidity from the sender and account tokens owed for the liquidity to the position



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick of the position for which to burn liquidity |
| topTick | int24 | The upper tick of the position for which to burn liquidity |
| amount | uint128 | How much liquidity to burn |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

#### swap  external


`swap(address,bool,int256,uint160,bytes)`

Swap token0 for token1, or token1 for token0



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address to receive the output of the swap |
| zeroForOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 |  |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 |  |
| amount1 | int256 |  |

#### swapSupportingFeeOnInputTokens  external


`swapSupportingFeeOnInputTokens(address,address,bool,int256,uint160,bytes)`

Swap token0 for token1, or token1 for token0 (tokens that have fee on transfer)



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address called this function (Comes from the Router) |
| recipient | address | The address to receive the output of the swap |
| zeroForOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 |  |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 |  |
| amount1 | int256 |  |

#### flash  external

lock

`flash(address,uint256,uint256,bytes)`

Receive token0 and/or token1 and pay it back, plus a fee, in the callback



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which will receive the token0 and token1 amounts |
| amount0 | uint256 | The amount of token0 to send |
| amount1 | uint256 | The amount of token1 to send |
| data | bytes | Any data to be passed through to the callback |


#### setCommunityFee  external

lock, onlyFactoryOwner

`setCommunityFee(uint8,uint8)`

Set the community&#x27;s % share of the fees



| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFee0 | uint8 | new community fee percent for token0 of the pool |
| communityFee1 | uint8 | new community fee percent for token1 of the pool |


#### setIncentive  external


`setIncentive(address)`

Sets an active incentive



| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPoolAddress | address | The address of a virtual pool associated with the incentive |


#### setLiquidityCooldown  external

onlyFactoryOwner

`setLiquidityCooldown(uint32)`

Sets new lock time for added liquidity



| Name | Type | Description |
| ---- | ---- | ----------- |
| newLiquidityCooldown | uint32 | The time in seconds |




---




# AlgebraPoolDeployer

## Modifiers
#### onlyFactory  









#### onlyOwner  











## Variables
#### struct AlgebraPoolDeployer.Parameters parameters 

Get the parameters to be used in constructing the pool, set transiently during pool creation.

*Developer note: Called by the pool constructor to fetch the parameters of the pool
Returns dataStorage The pools associated dataStorage
Returns factory The factory address
Returns token0 The first token of the pool by address sort order
Returns token1 The second token of the pool by address sort order*

## Functions
#### constructor  public


`constructor()`







#### setFactory  external

onlyOwner

`setFactory(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _factory | address |  |


#### deploy  external

onlyFactory

`deploy(address,address,address,address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| dataStorage | address | The pools associated dataStorage |
| _factory | address |  |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |



---




# DataStorageOperator

## Modifiers
#### onlyPool  









#### onlyFactory  











## Variables
#### struct DataStorage.Timepoint[65535] timepoints 



#### struct AdaptiveFee.Configuration feeConfig 




## Functions
#### constructor  public


`constructor(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _pool | address |  |


#### initialize  external

onlyPool

`initialize(uint32,int24)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |


#### changeFeeConfiguration  external


`changeFeeConfiguration(uint32,uint32,uint32,uint32,uint16,uint16,uint32,uint32,uint16)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint32 |  |
| alpha2 | uint32 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| volumeBeta | uint32 |  |
| volumeGamma | uint32 |  |
| baseFee | uint16 |  |


#### getSingleTimepoint view external

onlyPool

`getSingleTimepoint(uint32,uint32,int24,uint16,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgo | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint112 |  |
| volumePerAvgLiquidity | uint256 |  |

#### getTimepoints view external

onlyPool

`getTimepoints(uint32,uint32[],int24,uint16,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgos | uint32[] |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

#### getAverages view external

onlyPool

`getAverages(uint32,int24,uint16,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| TWVolatilityAverage | uint112 |  |
| TWVolumePerLiqAverage | uint256 |  |

#### write  external

onlyPool

`write(uint16,uint32,int24,uint128,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint16 |  |
| blockTimestamp | uint32 |  |
| tick | int24 |  |
| liquidity | uint128 |  |
| volumePerLiquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| indexUpdated | uint16 |  |

#### calculateVolumePerLiquidity pure external


`calculateVolumePerLiquidity(uint128,int256,int256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 |  |
| amount0 | int256 |  |
| amount1 | int256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| volumePerLiquidity | uint128 |  |

#### WINDOW pure external


`WINDOW()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

#### getFee view external

onlyPool

`getFee(uint32,int24,uint16,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _time | uint32 |  |
| _tick | int24 |  |
| _index | uint16 |  |
| _liquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint16 |  |



---




# PoolImmutables



## Variables
#### address dataStorageOperator immutable

The contract that stores all the timepoints and can perform actions with them

#### address factory immutable

The contract that deployed the pool, which must adhere to the IAlgebraFactory interface

#### address token0 immutable

The first of the two tokens of the pool, sorted by address

#### address token1 immutable

The second of the two tokens of the pool, sorted by address

#### uint8 tickSpacing constant

The pool tick spacing

*Developer note: Ticks can only be used at multiples of this value
e.g.: a tickSpacing of 60 means ticks can be initialized every 60th tick, i.e., ..., -120, -60, 0, 60, 120, ...
This value is an int24 to avoid casting even though it is always positive.*
#### uint128 maxLiquidityPerTick constant

The maximum amount of position liquidity that can use any tick in the range

*Developer note: This parameter is enforced per tick to prevent liquidity from overflowing a uint128 at any point, and
also prevents out-of-range liquidity from being used to prevent adding in-range liquidity to a pool*



---




# PoolState

## Modifiers
#### lock  











## Variables
#### uint256 totalFeeGrowth0Token 

The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool

*Developer note: This value can overflow the uint256*
#### uint256 totalFeeGrowth1Token 

The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool

*Developer note: This value can overflow the uint256*
#### struct PoolState.GlobalState globalState 

The globalState structure in the pool stores many values but requires only one slot
and is exposed as a single method to save gas when accessed externally.

#### uint128 liquidity 

The currently in range liquidity available to the pool

*Developer note: This value has no relationship to the total liquidity across all ticks*
#### mapping(int24 &#x3D;&gt; struct TickManager.Tick) ticks 

Look up information about a specific tick in the pool

#### mapping(int16 &#x3D;&gt; uint256) tickTable 

Returns 256 packed tick initialized boolean values. See TickTable for more information




---




# IAlgebraFactory


## Events
#### OwnerChanged  


`OwnerChanged(address,address)`

Emitted when the owner of the factory is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| oldOwner | address | The owner before the owner was changed |
| newOwner | address | The owner after the owner was changed |


#### VaultAddressChanged  


`VaultAddressChanged(address,address)`

Emitted when the vault address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| vaultAddress | address | The vault address before the address was changed |
| _vaultAddress | address | The vault address after the address was changed |


#### PoolCreated  


`PoolCreated(address,address,address)`

Emitted when a pool is created



| Name | Type | Description |
| ---- | ---- | ----------- |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |
| pool | address | The address of the created pool |


#### FarmingAddressChanged  


`FarmingAddressChanged(address,address)`

Emitted when the farming address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| farmingAddress | address | The farming address before the address was changed |
| _farmingAddress | address | The farming address after the address was changed |




## Functions
#### owner view external


`owner()`

Returns the current owner of the factory




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### poolDeployer view external


`poolDeployer()`

Returns the current poolDeployerAddress




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### farmingAddress view external


`farmingAddress()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### vaultAddress view external


`vaultAddress()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### poolByPair view external


`poolByPair(address,address)`

Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenA | address | The contract address of either token0 or token1 |
| tokenB | address | The contract address of the other token |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

#### createPool  external


`createPool(address,address)`

Creates a pool for the given two tokens and fee



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenA | address | One of the two tokens in the desired pool |
| tokenB | address | The other of the two tokens in the desired pool |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

#### setOwner  external


`setOwner(address)`

Updates the owner of the factory



| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | The new owner of the factory |


#### setFarmingAddress  external


`setFarmingAddress(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingAddress | address | The new tokenomics contract address |


#### setVaultAddress  external


`setVaultAddress(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _vaultAddress | address |  |


#### isPaused  external


`isPaused()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### isPauseForbidden  external


`isPauseForbidden()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### setBaseFeeConfiguration  external


`setBaseFeeConfiguration(uint32,uint32,uint32,uint32,uint16,uint16,uint32,uint32,uint16)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint32 |  |
| alpha2 | uint32 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| volumeBeta | uint32 |  |
| volumeGamma | uint32 |  |
| baseFee | uint16 |  |




---






# IAlgebraPoolDeployer


## Events
#### FactoryChanged  


`FactoryChanged(address,address)`

Emitted when the factory address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| factory | address | The factory address before the address was changed |
| _factory | address | The factory address after the address was changed |




## Functions
#### parameters view external


`parameters()`

Get the parameters to be used in constructing the pool, set transiently during pool creation.




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| dataStorage | address |  |
| factory | address |  |
| token0 | address |  |
| token1 | address |  |

#### deploy  external


`deploy(address,address,address,address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| dataStorage | address | The pools associated dataStorage |
| factory | address | The contract address of the Algebra factory |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

#### setFactory  external


`setFactory(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| factory | address | The address of the Algebra factory |




---




# IAlgebraVirtualPool




## Functions
#### cross  external


`cross(int24,bool)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| nextTick | int24 | The crossed tick |
| zeroForOne | bool | The direction |


#### processSwap  external


`processSwap()`







#### increaseCumulative  external


`increaseCumulative(uint32)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 | The timestamp of the current swap |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum IAlgebraVirtualPool.Status |  |



---




# IDataStorageOperator




## Functions
#### timepoints view external


`timepoints(uint256)`

Returns data belonging to a certain timepoint



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The index of timepoint in the array |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool |  |
| blockTimestamp | uint32 |  |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint88 |  |
| averageTick | int24 |  |
| volumePerLiquidityCumulative | uint144 |  |

#### initialize  external


`initialize(uint32,int24)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |


#### getSingleTimepoint view external


`getSingleTimepoint(uint32,uint32,int24,uint16,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgo | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint112 |  |
| volumePerAvgLiquidity | uint256 |  |

#### getTimepoints view external


`getTimepoints(uint32,uint32[],int24,uint16,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgos | uint32[] |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

#### getAverages view external


`getAverages(uint32,int24,uint16,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| TWVolatilityAverage | uint112 |  |
| TWVolumePerLiqAverage | uint256 |  |

#### write  external


`write(uint16,uint32,int24,uint128,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint16 |  |
| blockTimestamp | uint32 |  |
| tick | int24 |  |
| liquidity | uint128 |  |
| volumePerLiquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| indexUpdated | uint16 |  |

#### changeFeeConfiguration  external


`changeFeeConfiguration(uint32,uint32,uint32,uint32,uint16,uint16,uint32,uint32,uint16)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint32 |  |
| alpha2 | uint32 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| volumeBeta | uint32 |  |
| volumeGamma | uint32 |  |
| baseFee | uint16 |  |


#### calculateVolumePerLiquidity pure external


`calculateVolumePerLiquidity(uint128,int256,int256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 |  |
| amount0 | int256 |  |
| amount1 | int256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| volumePerLiquidity | uint128 |  |

#### WINDOW view external


`WINDOW()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

#### getFee view external


`getFee(uint32,int24,uint16,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _time | uint32 |  |
| _tick | int24 |  |
| _index | uint16 |  |
| _liquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint16 |  |



---




# IERC20Minimal


## Events
#### Transfer  


`Transfer(address,address,uint256)`

Event emitted when tokens are transferred from one address to another, either via &#x60;#transfer&#x60; or &#x60;#transferFrom&#x60;.



| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | The account from which the tokens were sent, i.e. the balance decreased |
| to | address | The account to which the tokens were sent, i.e. the balance increased |
| value | uint256 | The amount of tokens that were transferred |


#### Approval  


`Approval(address,address,uint256)`

Event emitted when the approval amount for the spender of a given owner&#x27;s tokens changes.



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The account that approved spending of its tokens |
| spender | address | The account for which the spending allowance was modified |
| value | uint256 | The new allowance from the owner to the spender |




## Functions
#### balanceOf view external


`balanceOf(address)`

Returns the balance of a token



| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account for which to look up the number of tokens it has, i.e. its balance |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### transfer  external


`transfer(address,uint256)`

Transfers the amount of token from the &#x60;msg.sender&#x60; to the recipient



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The account that will receive the amount transferred |
| amount | uint256 | The number of tokens to send from the sender to the recipient |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### allowance view external


`allowance(address,address)`

Returns the current allowance given to a spender by an owner



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The account of the token owner |
| spender | address | The account of the token spender |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### approve  external


`approve(address,uint256)`

Sets the allowance of a spender from the &#x60;msg.sender&#x60; to the value &#x60;amount&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | The account which will be allowed to spend a given amount of the owners tokens |
| amount | uint256 | The amount of tokens allowed to be used by &#x60;spender&#x60; |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### transferFrom  external


`transferFrom(address,address,uint256)`

Transfers &#x60;amount&#x60; tokens from &#x60;sender&#x60; to &#x60;recipient&#x60; up to the allowance given to the &#x60;msg.sender&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The account from which the transfer will be initiated |
| recipient | address | The recipient of the transfer |
| amount | uint256 | The amount of the transfer |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |



---




# IAlgebraFlashCallback




## Functions
#### AlgebraFlashCallback  external


`AlgebraFlashCallback(uint256,uint256,bytes)`

Called to &#x60;msg.sender&#x60; after transferring to the recipient from IAlgebraPool#flash.



| Name | Type | Description |
| ---- | ---- | ----------- |
| fee0 | uint256 | The fee amount in token0 due to the pool by the end of the flash |
| fee1 | uint256 | The fee amount in token1 due to the pool by the end of the flash |
| data | bytes | Any data passed through by the caller via the IAlgebraPoolActions#flash call |




---




# IAlgebraMintCallback




## Functions
#### AlgebraMintCallback  external


`AlgebraMintCallback(uint256,uint256,bytes)`

Called to &#x60;msg.sender&#x60; after minting liquidity to a position from IAlgebraPool#mint.



| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Owed | uint256 | The amount of token0 due to the pool for the minted liquidity |
| amount1Owed | uint256 | The amount of token1 due to the pool for the minted liquidity |
| data | bytes | Any data passed through by the caller via the IAlgebraPoolActions#mint call |




---




# IAlgebraSwapCallback




## Functions
#### AlgebraSwapCallback  external


`AlgebraSwapCallback(int256,int256,bytes)`

Called to &#x60;msg.sender&#x60; after executing a swap via IAlgebraPool#swap.



| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Delta | int256 | The amount of token0 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token0 to the pool. |
| amount1Delta | int256 | The amount of token1 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token1 to the pool. |
| data | bytes | Any data passed through by the caller via the IAlgebraPoolActions#swap call |




---




# IAlgebraPoolActions




## Functions
#### initialize  external


`initialize(uint160)`

Sets the initial price for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | the initial sqrt price of the pool as a Q64.96 |


#### mint  external


`mint(address,address,int24,int24,uint128,bytes)`

Adds liquidity for the given recipient/bottomTick/topTick position



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| recipient | address | The address for which the liquidity will be created |
| bottomTick | int24 | The lower tick of the position in which to add liquidity |
| topTick | int24 | The upper tick of the position in which to add liquidity |
| amount | uint128 | The amount of liquidity to mint |
| data | bytes | Any data that should be passed through to the callback |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |
| liquidityAmount | uint256 |  |

#### collect  external


`collect(address,int24,int24,uint128,uint128)`

Collects tokens owed to a position



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which should receive the fees collected |
| bottomTick | int24 | The lower tick of the position for which to collect fees |
| topTick | int24 | The upper tick of the position for which to collect fees |
| amount0Requested | uint128 | How much token0 should be withdrawn from the fees owed |
| amount1Requested | uint128 | How much token1 should be withdrawn from the fees owed |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint128 |  |
| amount1 | uint128 |  |

#### burn  external


`burn(int24,int24,uint128)`

Burn liquidity from the sender and account tokens owed for the liquidity to the position



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick of the position for which to burn liquidity |
| topTick | int24 | The upper tick of the position for which to burn liquidity |
| amount | uint128 | How much liquidity to burn |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

#### swap  external


`swap(address,bool,int256,uint160,bytes)`

Swap token0 for token1, or token1 for token0



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address to receive the output of the swap |
| zeroForOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountSpecified | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 |  |
| amount1 | int256 |  |

#### swapSupportingFeeOnInputTokens  external


`swapSupportingFeeOnInputTokens(address,address,bool,int256,uint160,bytes)`

Swap token0 for token1, or token1 for token0 (tokens that have fee on transfer)



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address called this function (Comes from the Router) |
| recipient | address | The address to receive the output of the swap |
| zeroForOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountSpecified | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 |  |
| amount1 | int256 |  |

#### flash  external


`flash(address,uint256,uint256,bytes)`

Receive token0 and/or token1 and pay it back, plus a fee, in the callback



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which will receive the token0 and token1 amounts |
| amount0 | uint256 | The amount of token0 to send |
| amount1 | uint256 | The amount of token1 to send |
| data | bytes | Any data to be passed through to the callback |




---




# IAlgebraPoolDerivedState




## Functions
#### getTimepoints view external


`getTimepoints(uint32[])`

Returns the cumulative tick and liquidity as of each timestamp &#x60;secondsAgo&#x60; from the current block timestamp



| Name | Type | Description |
| ---- | ---- | ----------- |
| secondsAgos | uint32[] | From how long ago each cumulative tick and liquidity value should be returned |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

#### getInnerCumulatives view external


`getInnerCumulatives(int24,int24)`

Returns a snapshot of the tick cumulative, seconds per liquidity and seconds inside a tick range



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick of the range |
| topTick | int24 | The upper tick of the range |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| innerTickCumulative | int56 |  |
| innerSecondsSpentPerLiquidity | uint160 |  |
| innerSecondsSpent | uint32 |  |



---




# IAlgebraPoolEvents


## Events
#### Initialize  


`Initialize(uint160,int24)`

Emitted exactly once by a pool when #initialize is first called on the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | The initial sqrt price of the pool, as a Q64.96 |
| tick | int24 | The initial tick of the pool, i.e. log base 1.0001 of the starting price of the pool |


#### Mint  


`Mint(address,address,int24,int24,uint128,uint256,uint256)`

Emitted when liquidity is minted for a given position



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



| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFee0Old | uint8 | The previous value of the token0 community fee percent |
| communityFee1Old | uint8 | The previous value of the token1 community fee percent |
| communityFee0New | uint8 | The updated value of the token0 community fee percent |
| communityFee1New | uint8 | The updated value of the token1 community fee percent |


#### CollectCommunityFee  


`CollectCommunityFee(address,address,uint128,uint128)`

Emitted when the collected community fees are withdrawn by the factory owner



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that collects the community fees |
| recipient | address | The address that receives the collected community fees |
| amount0 | uint128 | The amount of token0 community fees that is withdrawn |
| amount1 | uint128 |  |


#### IncentiveSet  


`IncentiveSet(address)`

Emitted when new activeIncentive is set



| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPoolAddress | address | The address of a virtual pool associated with the current active incentive |


#### ChangeFee  


`ChangeFee(uint16)`

Emitted when the fee changes



| Name | Type | Description |
| ---- | ---- | ----------- |
| Fee | uint16 | The value of the token fee |






---




# IAlgebraPoolImmutables




## Functions
#### dataStorageOperator view external


`dataStorageOperator()`

The contract that stores all the timepoints and can perform actions with them




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### factory view external


`factory()`

The contract that deployed the pool, which must adhere to the IAlgebraFactory interface




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### token0 view external


`token0()`

The first of the two tokens of the pool, sorted by address




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### token1 view external


`token1()`

The second of the two tokens of the pool, sorted by address




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### tickSpacing view external


`tickSpacing()`

The pool tick spacing




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint8 |  |

#### maxLiquidityPerTick view external


`maxLiquidityPerTick()`

The maximum amount of position liquidity that can use any tick in the range




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |



---




# IAlgebraPoolPermissionedActions




## Functions
#### setCommunityFee  external


`setCommunityFee(uint8,uint8)`

Set the community&#x27;s % share of the fees



| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFee0 | uint8 | new community fee percent for token0 of the pool |
| communityFee1 | uint8 | new community fee percent for token1 of the pool |


#### setIncentive  external


`setIncentive(address)`

Sets an active incentive



| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPoolAddress | address | The address of a virtual pool associated with the incentive |


#### setLiquidityCooldown  external


`setLiquidityCooldown(uint32)`

Sets new lock time for added liquidity



| Name | Type | Description |
| ---- | ---- | ----------- |
| newLiquidityCooldown | uint32 | The time in seconds |




---




# IAlgebraPoolState




## Functions
#### globalState view external


`globalState()`

The globalState structure in the pool stores many values but requires only one slot
and is exposed as a single method to save gas when accessed externally.




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 |  |
| tick | int24 |  |
| fee | uint16 |  |
| timepointIndex | uint16 |  |
| timepointIndexSwap | uint16 |  |
| communityFeeToken0 | uint8 |  |
| communityFeeToken1 | uint8 |  |
| unlocked | bool |  |

#### totalFeeGrowth0Token view external


`totalFeeGrowth0Token()`

The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### totalFeeGrowth1Token view external


`totalFeeGrowth1Token()`

The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### liquidity view external


`liquidity()`

The currently in range liquidity available to the pool




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

#### ticks view external


`ticks(int24)`

Look up information about a specific tick in the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| tick | int24 | The tick to look up |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityTotal | uint128 |  |
| liquidityDelta | int128 |  |
| outerFeeGrowth0Token | uint256 |  |
| outerFeeGrowth1Token | uint256 |  |
| outerTickCumulative | int56 |  |
| outerSecondsPerLiquidity | uint160 |  |
| outerSecondsSpent | uint32 |  |
| initialized | bool |  |

#### tickTable view external


`tickTable(int16)`

Returns 256 packed tick initialized boolean values. See TickTable for more information



| Name | Type | Description |
| ---- | ---- | ----------- |
| wordPosition | int16 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### positions view external


`positions(bytes32)`

Returns the information about a position by the position&#x27;s key



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | bytes32 | The position&#x27;s key is a hash of a preimage composed by the owner, bottomTick and topTick |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| _liquidity | uint128 |  |
| lastModificationTimestamp | uint32 |  |
| innerFeeGrowth0Token | uint256 |  |
| innerFeeGrowth1Token | uint256 |  |
| fees0 | uint128 |  |
| fees1 | uint128 |  |

#### timepoints view external


`timepoints(uint256)`

Returns data about a specific timepoint index



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The element of the timepoints array to fetch |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool |  |
| blockTimestamp | uint32 |  |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint88 |  |
| averageTick | int24 |  |
| volumePerLiquidityCumulative | uint144 |  |

#### activeIncentive view external


`activeIncentive()`

Returns the information about active incentive




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address |  |

#### liquidityCooldown view external


`liquidityCooldown()`

Returns the lock time for added liquidity




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| cooldownInSeconds | uint32 |  |



---








# DataStorage



## Variables
#### uint32 WINDOW constant






---


























