// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol';

contract TestERC20 is ERC20Permit {
    uint256 fee;

    constructor(uint256 amountToMint) ERC20('Test ERC20', 'TEST') ERC20Permit('Test ERC20') {
        _mint(msg.sender, amountToMint);
    }

    function setFee(uint256 newFee) external {
        fee = newFee;
    }

    function _transfer(address owner, address to, uint256 amount) internal override {
        uint256 _fee = fee;
        if (_fee != 0) {
            uint256 collectedFee = (amount * _fee) / 1000;
            amount = amount - collectedFee;
            super._transfer(owner, address(this), collectedFee);
        }
        super._transfer(owner, to, amount);
    }
}
