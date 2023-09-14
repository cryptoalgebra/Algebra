

# Positions


Algebra positions abstract contract

Contains the logic of recalculation and change of liquidity positions

*Developer note: Relies on method _addOrRemoveTicks, which is implemented in TickStructure*


## Structs
### Position



```solidity
struct Position {
  uint256 liquidity;
  uint256 innerFeeGrowth0Token;
  uint256 innerFeeGrowth1Token;
  uint128 fees0;
  uint128 fees1;
}
```


## Variables
### mapping(bytes32 &#x3D;&gt; struct Positions.Position) positions 

Returns the information about a position by the position&#x27;s key

*Developer note: **important security note: caller should check reentrancy lock to prevent read-only reentrancy***

