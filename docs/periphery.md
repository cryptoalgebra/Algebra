# Solidity API

## ECDSA






## EIP712



### Variables
#### bytes32 _CACHED_DOMAIN_SEPARATOR immutable



#### uint256 _CACHED_CHAIN_ID immutable



#### bytes32 _HASHED_NAME immutable



#### bytes32 _HASHED_VERSION immutable



#### bytes32 _TYPE_HASH immutable






## ERC20Permit



### Variables
#### mapping(address &#x3D;&gt; struct Counters.Counter) _nonces 



#### bytes32 _PERMIT_TYPEHASH immutable






## IERC20Permit






## ERC165



### Variables
#### bytes4 _INTERFACE_ID_ERC165 constant



#### mapping(bytes4 &#x3D;&gt; bool) _supportedInterfaces 



*Developer note: Mapping of interface ids to whether or not it&#x27;s supported.*



## IERC165






## SafeMath






## SignedSafeMath



### Variables
#### int256 _INT256_MIN constant






## ERC20



### Variables
#### mapping(address &#x3D;&gt; uint256) _balances 



#### mapping(address &#x3D;&gt; mapping(address &#x3D;&gt; uint256)) _allowances 



#### uint256 _totalSupply 



#### string _name 



#### string _symbol 



#### uint8 _decimals 






## IERC20


### Events
#### Transfer  


`Transfer(address,address,uint256)`



*Developer note: Emitted when &#x60;value&#x60; tokens are moved from one account (&#x60;from&#x60;) to
another (&#x60;to&#x60;).
Note that &#x60;value&#x60; may be zero.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| value | uint256 |  |


#### Approval  


`Approval(address,address,uint256)`



*Developer note: Emitted when the allowance of a &#x60;spender&#x60; for an &#x60;owner&#x60; is set by
a call to {approve}. &#x60;value&#x60; is the new allowance.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |
| value | uint256 |  |






## ERC721



### Variables
#### bytes4 _ERC721_RECEIVED constant



#### mapping(address &#x3D;&gt; struct EnumerableSet.UintSet) _holderTokens 



#### struct EnumerableMap.UintToAddressMap _tokenOwners 



#### mapping(uint256 &#x3D;&gt; address) _tokenApprovals 



#### mapping(address &#x3D;&gt; mapping(address &#x3D;&gt; bool)) _operatorApprovals 



#### string _name 



#### string _symbol 



#### mapping(uint256 &#x3D;&gt; string) _tokenURIs 



#### string _baseURI 



#### bytes4 _INTERFACE_ID_ERC721 constant



#### bytes4 _INTERFACE_ID_ERC721_METADATA constant



#### bytes4 _INTERFACE_ID_ERC721_ENUMERABLE constant






## IERC721


### Events
#### Transfer  


`Transfer(address,address,uint256)`



*Developer note: Emitted when &#x60;tokenId&#x60; token is transferred from &#x60;from&#x60; to &#x60;to&#x60;.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |


#### Approval  


`Approval(address,address,uint256)`



*Developer note: Emitted when &#x60;owner&#x60; enables &#x60;approved&#x60; to manage the &#x60;tokenId&#x60; token.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| approved | address |  |
| tokenId | uint256 |  |


#### ApprovalForAll  


`ApprovalForAll(address,address,bool)`



*Developer note: Emitted when &#x60;owner&#x60; enables or disables (&#x60;approved&#x60;) &#x60;operator&#x60; to manage all of its assets.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| operator | address |  |
| approved | bool |  |






## IERC721Enumerable






## IERC721Metadata






## IERC721Receiver






## Address






## Context






## Counters






## EnumerableMap






## EnumerableSet






## Strings






## IUniswapV2Pair


### Events
#### Approval  


`Approval(address,address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |
| value | uint256 |  |


#### Transfer  


`Transfer(address,address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| value | uint256 |  |


#### Mint  


`Mint(address,uint256,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| amount0 | uint256 |  |
| amount1 | uint256 |  |


#### Burn  


`Burn(address,uint256,uint256,address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| amount0 | uint256 |  |
| amount1 | uint256 |  |
| to | address |  |


#### Swap  


`Swap(address,uint256,uint256,uint256,uint256,address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| amount0In | uint256 |  |
| amount1In | uint256 |  |
| amount0Out | uint256 |  |
| amount1Out | uint256 |  |
| to | address |  |


#### Sync  


`Sync(uint112,uint112)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| reserve0 | uint112 |  |
| reserve1 | uint112 |  |






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






## IDataStorageOperator






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






## Constants



### Variables
#### uint8 RESOLUTION constant



#### uint256 Q96 constant



#### uint256 Q128 constant



#### uint16 BASE_FEE constant






## FullMath






## LowGasSafeMath






## SafeCast






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






## Base64



### Variables
#### string TABLE constant






## SwapRouter



### Variables
#### uint256 DEFAULT_AMOUNT_IN_CACHED constant



*Developer note: Used as the placeholder value for amountInCached, because the computed amount in for an exact output swap
can never actually be this value*
#### uint256 amountInCached 



*Developer note: Transient storage variable used for returning the computed amount in for an exact output swap.*



## V3Migrator



### Variables
#### address nonfungiblePositionManager immutable






## BlockTimestamp






## ERC721Permit



### Variables
#### bytes32 nameHash immutable



*Developer note: The hash of the name used in the permit signature verification*
#### bytes32 versionHash immutable



*Developer note: The hash of the version string used in the permit signature verification*
#### bytes32 PERMIT_TYPEHASH constant

The permit typehash used in the permit signature


*Developer note: Value is equal to keccak256(&quot;Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)&quot;);*



## LiquidityManagement






## Multicall






## PeripheryImmutableState



### Variables
#### address factory immutable



#### address poolDeployer immutable



#### address WNativeToken immutable






## PeripheryPayments






## PeripheryPaymentsWithFee






## PeripheryValidation

### Modifiers
#### checkDeadline  














## PoolInitializer






## SelfPermit






## IERC20Metadata






## IERC721Permit






## IMulticall






## INonfungiblePositionManager


### Events
#### IncreaseLiquidity  


`IncreaseLiquidity(uint256,uint128,uint128,uint256,uint256,address)`

Emitted when liquidity is increased for a position NFT


*Developer note: Emitted when liquidity is increased for a position NFT*


| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity was increased |
| liquidity | uint128 | The amount by which liquidity for the NFT position was increased |
| actualLiquidity | uint128 | the actual liquidity that was added into a pool. Could differ from _liquidity_ when using FeeOnTransfer tokens |
| amount0 | uint256 | The amount of token0 that was paid for the increase in liquidity |
| amount1 | uint256 | The amount of token1 that was paid for the increase in liquidity |
| pool | address |  |


#### DecreaseLiquidity  


`DecreaseLiquidity(uint256,uint128,uint256,uint256)`

Emitted when liquidity is decreased for a position NFT


*Developer note: Emitted when liquidity is decreased for a position NFT*


| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity was decreased |
| liquidity | uint128 | The amount by which liquidity for the NFT position was decreased |
| amount0 | uint256 | The amount of token0 that was accounted for the decrease in liquidity |
| amount1 | uint256 | The amount of token1 that was accounted for the decrease in liquidity |


#### Collect  


`Collect(uint256,address,uint256,uint256)`

Emitted when tokens are collected for a position NFT


*Developer note: Emitted when tokens are collected for a position NFT*


| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which underlying tokens were collected |
| recipient | address | The address of the account that received the collected tokens |
| amount0 | uint256 | The amount of token0 owed to the position that was collected |
| amount1 | uint256 | The amount of token1 owed to the position that was collected |






## INonfungibleTokenPositionDescriptor






## IPeripheryImmutableState






## IPeripheryPayments






## IPeripheryPaymentsWithFee






## IPoolInitializer






## IQuoter






## IQuoterV2






## ISelfPermit






## ISwapRouter






## ITickLens






## IV3Migrator






## IERC1271






## IERC20PermitAllowed






## IWNativeToken






## Quoter



### Variables
#### uint256 amountOutCached 



*Developer note: Transient storage variable used to check a safety condition in exact output swaps.*



## QuoterV2



### Variables
#### uint256 amountOutCached 



*Developer note: Transient storage variable used to check a safety condition in exact output swaps.*



## TickLens






## AddressStringUtil






## BytesLib






## CallbackValidation






## ChainId






## DataStorageLibrary






## HexStrings



### Variables
#### bytes16 ALPHABET constant






## LiquidityAmounts






## NFTSVG



### Variables
#### string curve1 constant



#### string curve2 constant



#### string curve3 constant



#### string curve4 constant



#### string curve5 constant



#### string curve6 constant



#### string curve7 constant



#### string curve8 constant






## Path



### Variables
#### uint256 ADDR_SIZE constant



*Developer note: The length of the bytes encoded address*
#### uint256 FEE_SIZE constant



*Developer note: The length of the bytes encoded fee*
#### uint256 NEXT_OFFSET constant



*Developer note: The offset of a single token address and pool fee*
#### uint256 POP_OFFSET constant



*Developer note: The offset of an encoded pool key*
#### uint256 MULTIPLE_POOLS_MIN_LENGTH constant



*Developer note: The minimum length of an encoding that contains 2 or more pools*



## PoolAddress



### Variables
#### bytes32 POOL_INIT_CODE_HASH constant






## PoolTicksCounter






## PositionKey






## SafeERC20Namer






## TokenRatioSortOrder



### Variables
#### int256 NUMERATOR_MOST constant



#### int256 NUMERATOR_MORE constant



#### int256 NUMERATOR constant



#### int256 DENOMINATOR_MOST constant



#### int256 DENOMINATOR_MORE constant



#### int256 DENOMINATOR constant






## TransferHelper






## WeightedDataStorageLibrary






## Base64Test






## LiquidityAmountsTest






## MockTimeSwapRouter



### Variables
#### uint256 time 






## NonfungiblePositionManagerPositionsGasTest



### Variables
#### contract INonfungiblePositionManager nonfungiblePositionManager immutable






## DataStorageTest






## PathTest






## PeripheryImmutableStateTest






## PoolAddressTest






## PoolTicksCounterTest






## SelfPermitTest






## TestCallbackValidation






## TestERC20






## TestERC20Metadata






## TestERC20PermitAllowed






## TestMulticall



### Variables
#### uint256 paid 






## TestPositionNFTOwner



### Variables
#### address owner 






## TestAlgebraCallee






## TickLensTest






## WeightedDataStorageTest






## SafeMath






## SignedSafeMath



### Variables
#### int256 _INT256_MIN constant






## Strings






## IAlgebraPool






## IDataStorageOperator






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






## FullMath






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






## Base64



### Variables
#### string TABLE constant






## HexStrings



### Variables
#### bytes16 ALPHABET constant






## NFTDescriptor



### Variables
#### uint256 sqrt10X128 constant






## NFTSVG



### Variables
#### string curve1 constant



#### string curve2 constant



#### string curve3 constant



#### string curve4 constant



#### string curve5 constant



#### string curve6 constant



#### string curve7 constant



#### string curve8 constant






## IERC20Permit






## ERC165



### Variables
#### bytes4 _INTERFACE_ID_ERC165 constant



#### mapping(bytes4 &#x3D;&gt; bool) _supportedInterfaces 



*Developer note: Mapping of interface ids to whether or not it&#x27;s supported.*



## IERC165






## SafeMath






## IERC20


### Events
#### Transfer  


`Transfer(address,address,uint256)`



*Developer note: Emitted when &#x60;value&#x60; tokens are moved from one account (&#x60;from&#x60;) to
another (&#x60;to&#x60;).
Note that &#x60;value&#x60; may be zero.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| value | uint256 |  |


#### Approval  


`Approval(address,address,uint256)`



*Developer note: Emitted when the allowance of a &#x60;spender&#x60; for an &#x60;owner&#x60; is set by
a call to {approve}. &#x60;value&#x60; is the new allowance.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |
| value | uint256 |  |






## ERC721



### Variables
#### bytes4 _ERC721_RECEIVED constant



#### mapping(address &#x3D;&gt; struct EnumerableSet.UintSet) _holderTokens 



#### struct EnumerableMap.UintToAddressMap _tokenOwners 



#### mapping(uint256 &#x3D;&gt; address) _tokenApprovals 



#### mapping(address &#x3D;&gt; mapping(address &#x3D;&gt; bool)) _operatorApprovals 



#### string _name 



#### string _symbol 



#### mapping(uint256 &#x3D;&gt; string) _tokenURIs 



#### string _baseURI 



#### bytes4 _INTERFACE_ID_ERC721 constant



#### bytes4 _INTERFACE_ID_ERC721_METADATA constant



#### bytes4 _INTERFACE_ID_ERC721_ENUMERABLE constant






## IERC721


### Events
#### Transfer  


`Transfer(address,address,uint256)`



*Developer note: Emitted when &#x60;tokenId&#x60; token is transferred from &#x60;from&#x60; to &#x60;to&#x60;.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |


#### Approval  


`Approval(address,address,uint256)`



*Developer note: Emitted when &#x60;owner&#x60; enables &#x60;approved&#x60; to manage the &#x60;tokenId&#x60; token.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| approved | address |  |
| tokenId | uint256 |  |


#### ApprovalForAll  


`ApprovalForAll(address,address,bool)`



*Developer note: Emitted when &#x60;owner&#x60; enables or disables (&#x60;approved&#x60;) &#x60;operator&#x60; to manage all of its assets.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| operator | address |  |
| approved | bool |  |






## IERC721Enumerable






## IERC721Metadata






## IERC721Receiver






## Address






## Context






## EnumerableMap






## EnumerableSet






## Strings






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






## IDataStorageOperator






## IAlgebraMintCallback






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






## Constants



### Variables
#### uint8 RESOLUTION constant



#### uint256 Q96 constant



#### uint256 Q128 constant



#### uint16 BASE_FEE constant






## FullMath






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



## NonfungiblePositionManager

### Modifiers
#### isAuthorizedForToken  











### Variables
#### mapping(address &#x3D;&gt; uint80) _poolIds 



*Developer note: IDs of pools assigned by this contract*
#### mapping(uint80 &#x3D;&gt; struct PoolAddress.PoolKey) _poolIdToPoolKey 



*Developer note: Pool keys by pool ID, to save on SSTOREs for position data*
#### mapping(uint256 &#x3D;&gt; struct NonfungiblePositionManager.Position) _positions 



*Developer note: The token ID position data*
#### uint176 _nextId 



*Developer note: The ID of the next token that will be minted. Skips 0*
#### uint80 _nextPoolId 



*Developer note: The ID of the next pool that is used for the first time. Skips 0*
#### address _tokenDescriptor immutable



*Developer note: The address of the token descriptor contract, which handles generating token URIs for position tokens*



## BlockTimestamp






## ERC721Permit



### Variables
#### bytes32 nameHash immutable



*Developer note: The hash of the name used in the permit signature verification*
#### bytes32 versionHash immutable



*Developer note: The hash of the version string used in the permit signature verification*
#### bytes32 PERMIT_TYPEHASH constant

The permit typehash used in the permit signature


*Developer note: Value is equal to keccak256(&quot;Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)&quot;);*



## LiquidityManagement






## Multicall






## PeripheryImmutableState



### Variables
#### address factory immutable



#### address poolDeployer immutable



#### address WNativeToken immutable






## PeripheryPayments






## PeripheryValidation

### Modifiers
#### checkDeadline  














## PoolInitializer






## SelfPermit






## IERC721Permit






## IMulticall






## INonfungiblePositionManager


### Events
#### IncreaseLiquidity  


`IncreaseLiquidity(uint256,uint128,uint128,uint256,uint256,address)`

Emitted when liquidity is increased for a position NFT


*Developer note: Emitted when liquidity is increased for a position NFT*


| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity was increased |
| liquidity | uint128 | The amount by which liquidity for the NFT position was increased |
| actualLiquidity | uint128 | the actual liquidity that was added into a pool. Could differ from _liquidity_ when using FeeOnTransfer tokens |
| amount0 | uint256 | The amount of token0 that was paid for the increase in liquidity |
| amount1 | uint256 | The amount of token1 that was paid for the increase in liquidity |
| pool | address |  |


#### DecreaseLiquidity  


`DecreaseLiquidity(uint256,uint128,uint256,uint256)`

Emitted when liquidity is decreased for a position NFT


*Developer note: Emitted when liquidity is decreased for a position NFT*


| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity was decreased |
| liquidity | uint128 | The amount by which liquidity for the NFT position was decreased |
| amount0 | uint256 | The amount of token0 that was accounted for the decrease in liquidity |
| amount1 | uint256 | The amount of token1 that was accounted for the decrease in liquidity |


#### Collect  


`Collect(uint256,address,uint256,uint256)`

Emitted when tokens are collected for a position NFT


*Developer note: Emitted when tokens are collected for a position NFT*


| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which underlying tokens were collected |
| recipient | address | The address of the account that received the collected tokens |
| amount0 | uint256 | The amount of token0 owed to the position that was collected |
| amount1 | uint256 | The amount of token1 owed to the position that was collected |






## INonfungibleTokenPositionDescriptor






## IPeripheryImmutableState






## IPeripheryPayments






## IPoolInitializer






## ISelfPermit






## IERC1271






## IERC20PermitAllowed






## IWNativeToken






## CallbackValidation






## ChainId






## LiquidityAmounts






## PoolAddress



### Variables
#### bytes32 POOL_INIT_CODE_HASH constant






## PositionKey






## TransferHelper






## NFTDescriptorTest






## IERC165






## SafeMath






## SignedSafeMath



### Variables
#### int256 _INT256_MIN constant






## IERC20


### Events
#### Transfer  


`Transfer(address,address,uint256)`



*Developer note: Emitted when &#x60;value&#x60; tokens are moved from one account (&#x60;from&#x60;) to
another (&#x60;to&#x60;).
Note that &#x60;value&#x60; may be zero.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| value | uint256 |  |


#### Approval  


`Approval(address,address,uint256)`



*Developer note: Emitted when the allowance of a &#x60;spender&#x60; for an &#x60;owner&#x60; is set by
a call to {approve}. &#x60;value&#x60; is the new allowance.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |
| value | uint256 |  |






## IERC721


### Events
#### Transfer  


`Transfer(address,address,uint256)`



*Developer note: Emitted when &#x60;tokenId&#x60; token is transferred from &#x60;from&#x60; to &#x60;to&#x60;.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |


#### Approval  


`Approval(address,address,uint256)`



*Developer note: Emitted when &#x60;owner&#x60; enables &#x60;approved&#x60; to manage the &#x60;tokenId&#x60; token.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| approved | address |  |
| tokenId | uint256 |  |


#### ApprovalForAll  


`ApprovalForAll(address,address,bool)`



*Developer note: Emitted when &#x60;owner&#x60; enables or disables (&#x60;approved&#x60;) &#x60;operator&#x60; to manage all of its assets.*


| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| operator | address |  |
| approved | bool |  |






## IERC721Enumerable






## IERC721Metadata






## Strings






## IAlgebraPool






## IDataStorageOperator






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






## FullMath






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






## Base64



### Variables
#### string TABLE constant






## NonfungibleTokenPositionDescriptor



### Variables
#### address DAI constant



#### address USDC constant



#### address USDT constant



#### address WETH constant



#### address WBTC constant



#### address WNativeToken immutable






## IERC20Metadata






## IERC721Permit






## INonfungiblePositionManager


### Events
#### IncreaseLiquidity  


`IncreaseLiquidity(uint256,uint128,uint128,uint256,uint256,address)`

Emitted when liquidity is increased for a position NFT


*Developer note: Emitted when liquidity is increased for a position NFT*


| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity was increased |
| liquidity | uint128 | The amount by which liquidity for the NFT position was increased |
| actualLiquidity | uint128 | the actual liquidity that was added into a pool. Could differ from _liquidity_ when using FeeOnTransfer tokens |
| amount0 | uint256 | The amount of token0 that was paid for the increase in liquidity |
| amount1 | uint256 | The amount of token1 that was paid for the increase in liquidity |
| pool | address |  |


#### DecreaseLiquidity  


`DecreaseLiquidity(uint256,uint128,uint256,uint256)`

Emitted when liquidity is decreased for a position NFT


*Developer note: Emitted when liquidity is decreased for a position NFT*


| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity was decreased |
| liquidity | uint128 | The amount by which liquidity for the NFT position was decreased |
| amount0 | uint256 | The amount of token0 that was accounted for the decrease in liquidity |
| amount1 | uint256 | The amount of token1 that was accounted for the decrease in liquidity |


#### Collect  


`Collect(uint256,address,uint256,uint256)`

Emitted when tokens are collected for a position NFT


*Developer note: Emitted when tokens are collected for a position NFT*


| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which underlying tokens were collected |
| recipient | address | The address of the account that received the collected tokens |
| amount0 | uint256 | The amount of token0 owed to the position that was collected |
| amount1 | uint256 | The amount of token1 owed to the position that was collected |






## INonfungibleTokenPositionDescriptor






## IPeripheryImmutableState






## IPeripheryPayments






## IPoolInitializer






## AddressStringUtil






## ChainId






## HexStrings



### Variables
#### bytes16 ALPHABET constant






## NFTDescriptor



### Variables
#### uint256 sqrt10X128 constant






## NFTSVG



### Variables
#### string curve1 constant



#### string curve2 constant



#### string curve3 constant



#### string curve4 constant



#### string curve5 constant



#### string curve6 constant



#### string curve7 constant



#### string curve8 constant






## PoolAddress



### Variables
#### bytes32 POOL_INIT_CODE_HASH constant






## SafeERC20Namer






## TokenRatioSortOrder



### Variables
#### int256 NUMERATOR_MOST constant



#### int256 NUMERATOR_MORE constant



#### int256 NUMERATOR constant



#### int256 DENOMINATOR_MOST constant



#### int256 DENOMINATOR_MORE constant



#### int256 DENOMINATOR constant






## AlgebraInterfaceMulticall






## MockObservable



### Variables
#### struct MockObservable.Timepoint timepoint0 



#### struct MockObservable.Timepoint timepoint1 






## MockTimeNonfungiblePositionManager



### Variables
#### uint256 time 






