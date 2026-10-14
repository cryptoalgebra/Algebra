// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.26;
pragma abicoder v1;

import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol';

contract TestERC20 is ERC20Permit {
    uint256 fee;

    constructor(uint256 amountToMint) ERC20('Test ERC20', 'TEST') ERC20Permit('Test ERC20') {
        _mint(msg.sender, amountToMint);
    }

    function setFee(uint256 newFee) external {
        fee = newFee;
    }

    /// @dev The fee is taken from transfers only, `_update` is also called on mint and burn
    function _update(address from, address to, uint256 amount) internal override {
        uint256 _fee = fee;
        if (_fee != 0 && from != address(0) && to != address(0)) {
            uint256 collectedFee = (amount * _fee) / 1000;
            amount = amount - collectedFee;
            super._update(from, address(this), collectedFee);
        }
        super._update(from, to, amount);
    }
}
