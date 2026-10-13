// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.37;
pragma abicoder v1;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract TestToken is ERC20 {
    constructor(uint256 amountToMint, string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, amountToMint);
    }
}
