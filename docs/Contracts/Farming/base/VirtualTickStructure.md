

# VirtualTickStructure


Algebra virtual tick structure abstract contract

Encapsulates the logic of interaction with the data structure with ticks

*Developer note: Ticks are stored as a doubly linked list. A two-layer bitmap tree is used to search through the list*

**Inherits:** [IAlgebraEternalVirtualPool](../interfaces/IAlgebraEternalVirtualPool.md)

## Public variables
### ticks
```solidity
mapping(int24 => struct TickManagement.Tick) ticks
```
**Selector**: `0xf30dba93`

Returns data associated with a tick


