

# IERC721Permit


ERC721 with permit

Extension to ERC721 that includes a permit function for signature based approvals

**Inherits:** [IERC721](https://docs.openzeppelin.com/contracts/4.x/)

## Functions
### PERMIT_TYPEHASH

```solidity
function PERMIT_TYPEHASH() external pure returns (bytes32)
```
**Selector**: `0x30adf81f`

The permit typehash used in the permit signature

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 | The typehash for the permit |

### DOMAIN_SEPARATOR

```solidity
function DOMAIN_SEPARATOR() external view returns (bytes32)
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

