// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '@openzeppelin/contracts/drafts/ERC20Permit.sol';

contract TestERC20 is ERC20Permit {
    using SafeMath for uint256;
    bool isDefl;

    constructor(uint256 amountToMint) ERC20('Test ERC20', 'TEST') ERC20Permit('Test ERC20') {
        _mint(msg.sender, amountToMint);
    }

    function setDefl() external {
        isDefl = true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal override {
        if (isDefl) {
            uint256 fee = amount - (amount * 95) / 100;
            amount = amount - fee;
            super._transfer(sender, address(1), fee);
        }
        super._transfer(sender, recipient, amount);
    }
}
