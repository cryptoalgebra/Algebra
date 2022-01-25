# Solidity API

## ERC165



### Variables
#### bytes4 _INTERFACE_ID_ERC165 constant



#### mapping(bytes4 &#x3D;&gt; bool) _supportedInterfaces 



*Developer note: Mapping of interface ids to whether or not it&#x27;s supported.*



## IERC165






## Math






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






## SafeERC20






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



## Multicall






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






## IPeripheryImmutableState






## IPeripheryPayments






## IPoolInitializer






## ISwapRouter






## IERC1271






## ChainId






## PoolAddress



### Variables
#### bytes32 POOL_INIT_CODE_HASH constant






## TransferHelper






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






## FullMath






## AlgebraFarming

### Modifiers
#### isAuthorizedForToken  









#### onlyIncentiveMaker  









#### onlyOwner  











### Variables
#### contract INonfungiblePositionManager nonfungiblePositionManager immutable

The nonfungible position manager with which this farming contract is compatible

*Developer note: The nonfungible position manager with which this farming contract is compatible*
#### contract IAlgebraPoolDeployer deployer immutable

The pool deployer with which this farming contract is compatible

*Developer note: The pool deployer with which this farming contract is compatible*
#### contract IVirtualPoolDeployer vdeployer immutable

The virtual pool deployer with which this farming contract is compatible

*Developer note: The virtual pool deployer with which this farming contract is compatible*
#### uint256 maxIncentiveStartLeadTime immutable

The max amount of seconds into the future the incentive startTime can be set

*Developer note: The max amount of seconds into the future the incentive startTime can be set*
#### uint256 maxIncentiveDuration immutable

The max duration of an incentive in seconds

*Developer note: The max duration of an incentive in seconds*
#### uint256 _nextId 



*Developer note: The ID of the next token that will be minted. Skips 0*
#### mapping(bytes32 &#x3D;&gt; struct AlgebraFarming.Incentive) incentives 



*Developer note: bytes32 refers to the return value of IncentiveId.compute*
#### mapping(uint256 &#x3D;&gt; struct AlgebraFarming.Deposit) deposits 



*Developer note: deposits[tokenId] &#x3D;&gt; Deposit*
#### mapping(uint256 &#x3D;&gt; mapping(bytes32 &#x3D;&gt; uint128)) farms 



*Developer note: farms[tokenId][incentiveHash] &#x3D;&gt; Farm*
#### mapping(uint256 &#x3D;&gt; struct AlgebraFarming.L2Nft) l2Nfts 



*Developer note: l2Nfts[tokenId] &#x3D;&gt; L2Nft*
#### address incentiveMaker 



#### address owner 



#### mapping(contract IERC20Minimal &#x3D;&gt; mapping(address &#x3D;&gt; uint256)) rewards 

Returns amounts of reward tokens owed to a given address according to the last time all farms were updated


*Developer note: rewards[rewardToken][owner] &#x3D;&gt; uint256*



## AlgebraTokenStaking

### Modifiers
#### onlyOwner  










### Events
#### Entered  


`Entered(address,uint256,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address |  |
| ALGBAmount | uint256 |  |
| xALGBAmount | uint256 |  |


#### Left  


`Left(address,uint256,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address |  |
| xALGBAmount | uint256 |  |
| ALGBAmount | uint256 |  |



### Variables
#### uint256 freezeTime 



#### address owner 



#### contract IERC20Minimal ALGB 






## AlgebraVault

### Modifiers
#### onlyOwner  









#### onlyRelayerOrOwner  










### Events
#### Swap  


`Swap(contract IERC20,bytes,uint256,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| swappedToken | contract IERC20 |  |
| path | bytes |  |
| amountIn | uint256 |  |
| amountOut | uint256 |  |



### Variables
#### address stakingAddress 



#### address ALGB 



#### address owner 



#### address relayer 



#### contract ISwapRouter AlgebraRouter 






## AlgebraVirtualPool

### Modifiers
#### onlyPool  









#### onlyFarming  











### Variables
#### address poolAddress immutable



#### address farmingAddress immutable



#### uint32 desiredEndTimestamp immutable



#### uint32 desiredStartTimestamp immutable



#### uint32 initTimestamp 



#### uint32 endTimestamp 



#### uint32 timeOutside 



#### uint160 globalSecondsPerLiquidityCumulative 



#### uint128 prevLiquidity 



#### uint128 currentLiquidity 



#### uint32 prevTimestamp 



#### int24 globalTick 



#### mapping(int24 &#x3D;&gt; struct TickManager.Tick) ticks 



#### mapping(int16 &#x3D;&gt; uint256) tickTable 






## VirtualPoolDeployer

### Modifiers
#### onlyFarming  









#### onlyOwner  











### Variables
#### address farming 



#### address owner 






## BlockTimestamp






## ERC20



### Variables
#### mapping(address &#x3D;&gt; uint256) _balances 



#### mapping(address &#x3D;&gt; mapping(address &#x3D;&gt; uint256)) _allowances 



#### uint256 _totalSupply 



#### string _name 



#### string _symbol 



#### uint8 _decimals 






## ERC721Permit



### Variables
#### bytes32 nameHash immutable



*Developer note: The hash of the name used in the permit signature verification*
#### bytes32 versionHash immutable



*Developer note: The hash of the version string used in the permit signature verification*
#### bytes32 PERMIT_TYPEHASH constant

The permit typehash used in the permit signature


*Developer note: Value is equal to keccak256(&quot;Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)&quot;);*



## FreezableToken


### Events
#### Freezed  


`Freezed(address,uint64,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |
| release | uint64 |  |
| amount | uint256 |  |


#### Released  


`Released(address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| amount | uint256 |  |



### Variables
#### mapping(bytes32 &#x3D;&gt; uint64) chains 



#### mapping(bytes32 &#x3D;&gt; uint256) freezings 



#### mapping(address &#x3D;&gt; uint256) freezingBalance 






## IAlgebraFarming


### Events
#### IncentiveCreated  


`IncentiveCreated(contract IERC20Minimal,contract IERC20Minimal,contract IAlgebraPool,address,uint256,uint256,address,uint256,uint256)`

Event emitted when a liquidity mining incentive has been created


*Developer note: Event emitted when a liquidity mining incentive has been created*


| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| bonusRewardToken | contract IERC20Minimal | The token being distributed as a bonus reward |
| pool | contract IAlgebraPool | The Algebra pool |
| virtualPool | address | The virtual pool address |
| startTime | uint256 | The time when the incentive program begins |
| endTime | uint256 | The time when rewards stop accruing |
| refundee | address | The address which receives any remaining reward tokens after the end time |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |


#### DepositTransferred  


`DepositTransferred(uint256,address,address)`

Emitted when ownership of a deposit changes


*Developer note: Emitted when ownership of a deposit changes*


| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the deposit (and token) that is being transferred |
| oldOwner | address | The owner before the deposit was transferred |
| newOwner | address | The owner after the deposit was transferred |


#### FarmStarted  


`FarmStarted(uint256,uint256,bytes32,uint128)`

Event emitted when a Algebra LP token has been farmd


*Developer note: Event emitted when a Algebra LP token has been farmd*


| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| L2tokenId | uint256 | The unique identifier of an Algebra Farming token |
| incentiveId | bytes32 | The incentive in which the token is farming |
| liquidity | uint128 | The amount of liquidity farmd |


#### FarmEnded  


`FarmEnded(uint256,bytes32,address,address,address,uint256,uint256)`

Event emitted when a Algebra LP token has been exitFarmingd


*Developer note: Event emitted when a Algebra LP token has been exitFarmingd*


| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| incentiveId | bytes32 | The incentive in which the token is farming |
| rewardAddress | address | The token being distributed as a reward |
| bonusRewardToken | address | The token being distributed as a bonus reward |
| owner | address | The address where claimed rewards were sent to |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |


#### IncentiveMakerChanged  


`IncentiveMakerChanged(address,address)`

Emitted when the incentive maker is changed


*Developer note: Emitted when the incentive maker is changed*


| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveMaker | address | The incentive maker address before the address was changed |
| _incentiveMaker | address | The factorincentive maker address after the address was changed |


#### RewardClaimed  


`RewardClaimed(address,uint256,address,address)`

Event emitted when a reward token has been claimed


*Developer note: Event emitted when a reward token has been claimed*


| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address where claimed rewards were sent to |
| reward | uint256 | The amount of reward tokens claimed |
| rewardAddress | address | The token reward address |
| owner | address | The address where claimed rewards were sent to |






## IAlgebraIncentiveVirtualPool






## IERC1271






## IERC721Permit






## IVirtualPoolDeployer


### Events
#### FarmingAddressChanged  


`FarmingAddressChanged(address,address)`

Emitted when the farming address is changed


*Developer note: Emitted when the farming address is changed*


| Name | Type | Description |
| ---- | ---- | ----------- |
| farming | address | The farming address before the address was changed |
| _farming | address | The farming address after the address was changed |






## ChainId






## IncentiveId






## LiquidityMath






## LowGasSafeMath






## NFTPositionInfo






## RewardMath






## SafeCast






## TickManager






## TickTable






## TestERC20



### Variables
#### mapping(address &#x3D;&gt; uint256) balanceOf 



#### mapping(address &#x3D;&gt; mapping(address &#x3D;&gt; uint256)) allowance 



#### bool isDeflationary 






## TestIncentiveId






## TestRewardMath






## IAlgebraVirtualPool






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






