

# SelfPermit


Self Permit

Functionality to call permit on any EIP-2612-compliant token for use in the route

*Developer note: These functions are expected to be embedded in multicalls to allow EOAs to approve a contract and call a function
that requires an approval in a single transaction.*




## Functions
### selfPermit


`function selfPermit(address token, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public payable` payable public

Permits this contract to spend a given token from &#x60;msg.sender&#x60;
*Developer note: The &#x60;owner&#x60; is always msg.sender and the &#x60;spender&#x60; is always address(this).*



| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The address of the token spent |
| value | uint256 | The amount that can be spent of token |
| deadline | uint256 | A timestamp, the current blocktime must be less than or equal to this timestamp |
| v | uint8 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;s&#x60; |
| r | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;v&#x60; and &#x60;s&#x60; |
| s | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;v&#x60; |


### selfPermitIfNecessary


`function selfPermitIfNecessary(address token, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external payable` payable external

Permits this contract to spend a given token from &#x60;msg.sender&#x60;
*Developer note: The &#x60;owner&#x60; is always msg.sender and the &#x60;spender&#x60; is always address(this).
Can be used instead of #selfPermit to prevent calls from failing due to a frontrun of a call to #selfPermit*



| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The address of the token spent |
| value | uint256 | The amount that can be spent of token |
| deadline | uint256 | A timestamp, the current blocktime must be less than or equal to this timestamp |
| v | uint8 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;s&#x60; |
| r | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;v&#x60; and &#x60;s&#x60; |
| s | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;v&#x60; |


### selfPermitAllowed


`function selfPermitAllowed(address token, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) public payable` payable public

Permits this contract to spend the sender&#x27;s tokens for permit signatures that have the &#x60;allowed&#x60; parameter
*Developer note: The &#x60;owner&#x60; is always msg.sender and the &#x60;spender&#x60; is always address(this)*



| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The address of the token spent |
| nonce | uint256 | The current nonce of the owner |
| expiry | uint256 | The timestamp at which the permit is no longer valid |
| v | uint8 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;s&#x60; |
| r | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;v&#x60; and &#x60;s&#x60; |
| s | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;v&#x60; |


### selfPermitAllowedIfNecessary


`function selfPermitAllowedIfNecessary(address token, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external payable` payable external

Permits this contract to spend the sender&#x27;s tokens for permit signatures that have the &#x60;allowed&#x60; parameter
*Developer note: The &#x60;owner&#x60; is always msg.sender and the &#x60;spender&#x60; is always address(this)
Can be used instead of #selfPermitAllowed to prevent calls from failing due to a frontrun of a call to #selfPermitAllowed.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The address of the token spent |
| nonce | uint256 | The current nonce of the owner |
| expiry | uint256 | The timestamp at which the permit is no longer valid |
| v | uint8 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;s&#x60; |
| r | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;v&#x60; and &#x60;s&#x60; |
| s | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;v&#x60; |






---

