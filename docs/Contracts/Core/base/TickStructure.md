

# TickStructure


Algebra tick structure abstract contract

Encapsulates the logic of interaction with the data structure with ticks

*Developer note: Ticks are stored as a doubly linked list. A three-level bitmap tree is used to search through the list*


## Variables
### uint32 tickTreeRoot 

The root of tick search tree

*Developer note: Each bit corresponds to one node in the second layer of tick tree: &#x27;1&#x27; if node has at least one active bit.
**important security note: caller should check reentrancy lock to prevent read-only reentrancy***

### mapping(int16 &#x3D;&gt; uint256) tickTreeSecondLayer 

The second layer of tick search tree

*Developer note: Each bit in node corresponds to one node in the leafs layer (&#x60;tickTable&#x60;) of tick tree: &#x27;1&#x27; if leaf has at least one active bit.
**important security note: caller should check reentrancy lock to prevent read-only reentrancy***

