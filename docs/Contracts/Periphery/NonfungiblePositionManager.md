

# NonfungiblePositionManager


NFT positions

Wraps Algebra positions in the ERC721 non-fungible token interface

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*

**Inherits:** [INonfungiblePositionManager](interfaces/INonfungiblePositionManager.md) [Multicall](base/Multicall.md) [ERC721Permit](base/ERC721Permit.md) [PeripheryImmutableState](base/PeripheryImmutableState.md) [PoolInitializer](base/PoolInitializer.md) [LiquidityManagement](base/LiquidityManagement.md) PeripheryValidation [SelfPermit](base/SelfPermit.md)
## Modifiers
### isAuthorizedForToken

```solidity
modifier isAuthorizedForToken(uint256 tokenId)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |


## Structs
### Position



```solidity
struct Position {
  uint88 nonce;
  address operator;
  uint80 poolId;
  int24 tickLower;
  int24 tickUpper;
  uint128 liquidity;
  uint256 feeGrowthInside0LastX128;
  uint256 feeGrowthInside1LastX128;
  uint128 tokensOwed0;
  uint128 tokensOwed1;
}
```


## Public variables
### NONFUNGIBLE_POSITION_MANAGER_ADMINISTRATOR_ROLE
```solidity
bytes32 constant NONFUNGIBLE_POSITION_MANAGER_ADMINISTRATOR_ROLE = 0xff0e0466f109fcf4f5660899d8847c592e1e8dea30ffbe040704b23ad381d762
```
**Selector**: `0xb227aa79`



*Developer note: The role which has the right to change the farming center address*

### farmingCenter
```solidity
address farmingCenter
```
**Selector**: `0xdd56e5d8`

Returns the address of currently connected farming, if any


### farmingApprovals
```solidity
mapping(uint256 => address) farmingApprovals
```
**Selector**: `0x2d0b22de`

Returns the address of farming that is approved for this token, if any


### tokenFarmedIn
```solidity
mapping(uint256 => address) tokenFarmedIn
```
**Selector**: `0xe7ce18a3`

Returns the address of farming in which this token is farmed, if any



## Functions
### constructor

```solidity
constructor(address _factory, address _WNativeToken, address _tokenDescriptor_, address _poolDeployer) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _factory | address |  |
| _WNativeToken | address |  |
| _tokenDescriptor_ | address |  |
| _poolDeployer | address |  |

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

### tokenURI

```solidity
function tokenURI(uint256 tokenId) public view returns (string)
```
**Selector**: `0xc87b56dd`



*Developer note: Returns the Uniform Resource Identifier (URI) for &#x60;tokenId&#x60; token.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

### getApproved

```solidity
function getApproved(uint256 tokenId) public view returns (address)
```
**Selector**: `0x081812fc`



*Developer note: Returns the account approved for &#x60;tokenId&#x60; token.

Requirements:

- &#x60;tokenId&#x60; must exist.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

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

