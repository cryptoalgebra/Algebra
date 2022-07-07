

# ERC721Permit

ERC721 with permit
Nonfungible tokens that support an approve via signature, i.e. permit



## Variables
### bytes32 PERMIT_TYPEHASH constant

The permit typehash used in the permit signature

*Developer note: Value is equal to keccak256(&quot;Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)&quot;);*

## Functions
### DOMAIN_SEPARATOR


`DOMAIN_SEPARATOR()` view public

The domain separator used in the permit signature




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

### permit


`permit(address,uint256,uint256,uint8,bytes32,bytes32)` payable external

Approve of a specific token ID for spending by spender via signature



| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | The account that is being approved |
| tokenId | uint256 | The ID of the token that is being approved for spending |
| deadline | uint256 | The deadline timestamp by which the call must be mined for the approve to work |
| v | uint8 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;s&#x60; |
| r | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;v&#x60; and &#x60;s&#x60; |
| s | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;v&#x60; |




---


