

# IERC20PermitAllowed

Interface for permit
Interface used by DAI/CHAI for permit




## Functions
### permit


`permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)`  external

Approve the spender to spend some tokens via the holder signature



| Name | Type | Description |
| ---- | ---- | ----------- |
| holder | address | The address of the token holder, the token owner |
| spender | address | The address of the token spender |
| nonce | uint256 | The holder&#x27;s nonce, increases at each call to permit |
| expiry | uint256 | The timestamp at which the permit is no longer valid |
| allowed | bool | Boolean that sets approval amount, true for type(uint256).max and false for 0 |
| v | uint8 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;s&#x60; |
| r | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;v&#x60; and &#x60;s&#x60; |
| s | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;v&#x60; |




---




# IERC20PermitAllowed

Interface for permit
Interface used by DAI/CHAI for permit




## Functions
### permit


`permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)`  external

Approve the spender to spend some tokens via the holder signature



| Name | Type | Description |
| ---- | ---- | ----------- |
| holder | address | The address of the token holder, the token owner |
| spender | address | The address of the token spender |
| nonce | uint256 | The holder&#x27;s nonce, increases at each call to permit |
| expiry | uint256 | The timestamp at which the permit is no longer valid |
| allowed | bool | Boolean that sets approval amount, true for type(uint256).max and false for 0 |
| v | uint8 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;s&#x60; |
| r | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;v&#x60; and &#x60;s&#x60; |
| s | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;v&#x60; |




---


