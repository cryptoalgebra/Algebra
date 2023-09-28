

# ERC721Permit


ERC721 with permit

Nonfungible tokens that support an approve via signature, i.e. permit

**Inherits:** BlockTimestamp [ERC721Enumerable](https://docs.openzeppelin.com/contracts/4.x/) [IERC721Permit](../interfaces/IERC721Permit.md)

## Public variables
### PERMIT_TYPEHASH
```solidity
bytes32 constant PERMIT_TYPEHASH = 0x49ecf333e5b8c95c40fdafc95c1ad136e8914a8fb55e9dc8bb01eaa83a2df9ad
```
**Selector**: `0x30adf81f`

The permit typehash used in the permit signature



## Functions
### DOMAIN_SEPARATOR

```solidity
function DOMAIN_SEPARATOR() public view returns (bytes32)
```
**Selector**: `0x3644e515`

The domain separator used in the permit signature

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 | The domain separator used in encoding of permit signature |

### permit

```solidity
function permit(address spender, uint256 tokenId, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external payable
```
**Selector**: `0x7ac2ff7b`

Approve of a specific token ID for spending by spender via signature

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | The account that is being approved |
| tokenId | uint256 | The ID of the token that is being approved for spending |
| deadline | uint256 | The deadline timestamp by which the call must be mined for the approve to work |
| v | uint8 | Must produce valid secp256k1 signature from the holder along with `r` and `s` |
| r | bytes32 | Must produce valid secp256k1 signature from the holder along with `v` and `s` |
| s | bytes32 | Must produce valid secp256k1 signature from the holder along with `r` and `v` |

