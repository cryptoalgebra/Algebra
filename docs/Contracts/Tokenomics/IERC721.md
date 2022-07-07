

# IERC721



*Developer note: Required interface of an ERC721 compliant contract.*


## Events
### Transfer


`Transfer(address,address,uint256)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |


### Approval


`Approval(address,address,uint256)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| approved | address |  |
| tokenId | uint256 |  |


### ApprovalForAll


`ApprovalForAll(address,address,bool)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| operator | address |  |
| approved | bool |  |




## Functions
### balanceOf


`balanceOf(address)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 |  |

### ownerOf


`ownerOf(uint256)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |

### safeTransferFrom


`safeTransferFrom(address,address,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |


### transferFrom


`transferFrom(address,address,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |


### approve


`approve(address,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |
| tokenId | uint256 |  |


### getApproved


`getApproved(uint256)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address |  |

### setApprovalForAll


`setApprovalForAll(address,bool)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address |  |
| _approved | bool |  |


### isApprovedForAll


`isApprovedForAll(address,address)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| operator | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### safeTransferFrom


`safeTransferFrom(address,address,uint256,bytes)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |
| data | bytes |  |




---


