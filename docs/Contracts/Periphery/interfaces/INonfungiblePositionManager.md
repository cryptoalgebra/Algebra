

# INonfungiblePositionManager


Non-fungible token for positions

Wraps Algebra positions in a non-fungible token interface which allows for them to be transferred
and authorized.

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*

**Inherits:** [IPoolInitializer](IPoolInitializer.md) [IPeripheryPayments](IPeripheryPayments.md) [IPeripheryImmutableState](IPeripheryImmutableState.md) [IERC721Metadata](https://docs.openzeppelin.com/contracts/4.x/) [IERC721Enumerable](https://docs.openzeppelin.com/contracts/4.x/) [IERC721Permit](IERC721Permit.md)

## Events
### IncreaseLiquidity

```solidity
event IncreaseLiquidity(uint256 tokenId, uint128 liquidityDesired, uint128 actualLiquidity, uint256 amount0, uint256 amount1, address pool)
```

Emitted when liquidity is increased for a position NFT

*Developer note: Also emitted when a token is minted*

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity was increased |
| liquidityDesired | uint128 | The amount by which liquidity for the NFT position was increased |
| actualLiquidity | uint128 | the actual liquidity that was added into a pool. Could differ from _liquidity_ when using FeeOnTransfer tokens |
| amount0 | uint256 | The amount of token0 that was paid for the increase in liquidity |
| amount1 | uint256 | The amount of token1 that was paid for the increase in liquidity |
| pool | address |  |

### DecreaseLiquidity

```solidity
event DecreaseLiquidity(uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
```

Emitted when liquidity is decreased for a position NFT

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity was decreased |
| liquidity | uint128 | The amount by which liquidity for the NFT position was decreased |
| amount0 | uint256 | The amount of token0 that was accounted for the decrease in liquidity |
| amount1 | uint256 | The amount of token1 that was accounted for the decrease in liquidity |

### Collect

```solidity
event Collect(uint256 tokenId, address recipient, uint256 amount0, uint256 amount1)
```

Emitted when tokens are collected for a position NFT

*Developer note: The amounts reported may not be exactly equivalent to the amounts transferred, due to rounding behavior*

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which underlying tokens were collected |
| recipient | address | The address of the account that received the collected tokens |
| amount0 | uint256 | The amount of token0 owed to the position that was collected |
| amount1 | uint256 | The amount of token1 owed to the position that was collected |

### FarmingFailed

```solidity
event FarmingFailed(uint256 tokenId)
```

Emitted if farming failed in call from NonfungiblePositionManager.

*Developer note: Should never be emitted*

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of corresponding token |

### FarmingCenter

```solidity
event FarmingCenter(address farmingCenterAddress)
```

Emitted after farming center address change

| Name | Type | Description |
| ---- | ---- | ----------- |
| farmingCenterAddress | address | The new address of connected farming center |


## Structs
### MintParams



```solidity
struct MintParams {
  address token0;
  address token1;
  int24 tickLower;
  int24 tickUpper;
  uint256 amount0Desired;
  uint256 amount1Desired;
  uint256 amount0Min;
  uint256 amount1Min;
  address recipient;
  uint256 deadline;
}
```

### IncreaseLiquidityParams



```solidity
struct IncreaseLiquidityParams {
  uint256 tokenId;
  uint256 amount0Desired;
  uint256 amount1Desired;
  uint256 amount0Min;
  uint256 amount1Min;
  uint256 deadline;
}
```

### DecreaseLiquidityParams



```solidity
struct DecreaseLiquidityParams {
  uint256 tokenId;
  uint128 liquidity;
  uint256 amount0Min;
  uint256 amount1Min;
  uint256 deadline;
}
```

### CollectParams



```solidity
struct CollectParams {
  uint256 tokenId;
  address recipient;
  uint128 amount0Max;
  uint128 amount1Max;
}
```


## Functions
### positions

```solidity
function positions(uint256 tokenId) external view returns (uint88 nonce, address operator, address token0, address token1, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)
```
**Selector**: `0x99fbab88`

Returns the position information associated with a given token ID.

*Developer note: Throws if the token ID is not valid.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token that represents the position |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| nonce | uint88 | The nonce for permits |
| operator | address | The address that is approved for spending |
| token0 | address | The address of the token0 for a specific pool |
| token1 | address | The address of the token1 for a specific pool |
| tickLower | int24 | The lower end of the tick range for the position |
| tickUpper | int24 | The higher end of the tick range for the position |
| liquidity | uint128 | The liquidity of the position |
| feeGrowthInside0LastX128 | uint256 | The fee growth of token0 as of the last action on the individual position |
| feeGrowthInside1LastX128 | uint256 | The fee growth of token1 as of the last action on the individual position |
| tokensOwed0 | uint128 | The uncollected amount of token0 owed to the position as of the last computation |
| tokensOwed1 | uint128 | The uncollected amount of token1 owed to the position as of the last computation |

### mint

```solidity
function mint(struct INonfungiblePositionManager.MintParams params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
```
**Selector**: `0x9cc1a283`

Creates a new position wrapped in a NFT

*Developer note: Call this when the pool does exist and is initialized. Note that if the pool is created but not initialized
a method does not exist, i.e. the pool is assumed to be initialized.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.MintParams | The params necessary to mint a position, encoded as `MintParams` in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token that represents the minted position |
| liquidity | uint128 | The liquidity delta amount as a result of the increase |
| amount0 | uint256 | The amount of token0 |
| amount1 | uint256 | The amount of token1 |

### increaseLiquidity

```solidity
function increaseLiquidity(struct INonfungiblePositionManager.IncreaseLiquidityParams params) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)
```
**Selector**: `0x219f5d17`

Increases the amount of liquidity in a position, with tokens paid by the &#x60;msg.sender&#x60;

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.IncreaseLiquidityParams | tokenId The ID of the token for which liquidity is being increased, amount0Desired The desired amount of token0 to be spent, amount1Desired The desired amount of token1 to be spent, amount0Min The minimum amount of token0 to spend, which serves as a slippage check, amount1Min The minimum amount of token1 to spend, which serves as a slippage check, deadline The time by which the transaction must be included to effect the change |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 | The liquidity delta amount as a result of the increase |
| amount0 | uint256 | The amount of token0 to achieve resulting liquidity |
| amount1 | uint256 | The amount of token1 to achieve resulting liquidity |

### decreaseLiquidity

```solidity
function decreaseLiquidity(struct INonfungiblePositionManager.DecreaseLiquidityParams params) external payable returns (uint256 amount0, uint256 amount1)
```
**Selector**: `0x0c49ccbe`

Decreases the amount of liquidity in a position and accounts it to the position

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.DecreaseLiquidityParams | tokenId The ID of the token for which liquidity is being decreased, amount The amount by which liquidity will be decreased, amount0Min The minimum amount of token0 that should be accounted for the burned liquidity, amount1Min The minimum amount of token1 that should be accounted for the burned liquidity, deadline The time by which the transaction must be included to effect the change |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 | The amount of token0 accounted to the position's tokens owed |
| amount1 | uint256 | The amount of token1 accounted to the position's tokens owed |

### collect

```solidity
function collect(struct INonfungiblePositionManager.CollectParams params) external payable returns (uint256 amount0, uint256 amount1)
```
**Selector**: `0xfc6f7865`

Collects up to a maximum amount of fees owed to a specific position to the recipient

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.CollectParams | tokenId The ID of the NFT for which tokens are being collected, recipient The account that should receive the tokens, amount0Max The maximum amount of token0 to collect, amount1Max The maximum amount of token1 to collect |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 | The amount of fees collected in token0 |
| amount1 | uint256 | The amount of fees collected in token1 |

### burn

```solidity
function burn(uint256 tokenId) external payable
```
**Selector**: `0x42966c68`

Burns a token ID, which deletes it from the NFT contract. The token must have 0 liquidity and all tokens
must be collected first.

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token that is being burned |

### approveForFarming

```solidity
function approveForFarming(uint256 tokenId, bool approve, address farmingAddress) external payable
```
**Selector**: `0x832f630a`

Changes approval of token ID for farming.

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token that is being approved / unapproved |
| approve | bool | New status of approval |
| farmingAddress | address | The address of farming: used to prevent tx frontrun |

### switchFarmingStatus

```solidity
function switchFarmingStatus(uint256 tokenId, bool toActive) external
```
**Selector**: `0x70227515`

Changes farming status of token to &#x27;farmed&#x27; or &#x27;not farmed&#x27;

*Developer note: can be called only by farmingCenter*

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token |
| toActive | bool | The new status |

### setFarmingCenter

```solidity
function setFarmingCenter(address newFarmingCenter) external
```
**Selector**: `0x4d10862d`

Changes address of farmingCenter

*Developer note: can be called only by factory owner or NONFUNGIBLE_POSITION_MANAGER_ADMINISTRATOR_ROLE*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFarmingCenter | address | The new address of farmingCenter |

### isApprovedOrOwner

```solidity
function isApprovedOrOwner(address spender, uint256 tokenId) external view returns (bool)
```
**Selector**: `0x430c2081`

Returns whether &#x60;spender&#x60; is allowed to manage &#x60;tokenId&#x60;

*Developer note: Requirement: &#x60;tokenId&#x60; must exist*

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address |  |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### farmingCenter

```solidity
function farmingCenter() external view returns (address)
```
**Selector**: `0xdd56e5d8`

Returns the address of currently connected farming, if any

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the farming center contract, which handles farmings logic |

### farmingApprovals

```solidity
function farmingApprovals(uint256 tokenId) external view returns (address)
```
**Selector**: `0x2d0b22de`

Returns the address of farming that is approved for this token, if any

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### tokenFarmedIn

```solidity
function tokenFarmedIn(uint256 tokenId) external view returns (address)
```
**Selector**: `0xe7ce18a3`

Returns the address of farming in which this token is farmed, if any

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

