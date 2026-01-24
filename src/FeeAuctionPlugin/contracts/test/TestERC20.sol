// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract TestERC20 is ERC20 {
  constructor(uint256 amountToMint) ERC20('Test Token', 'TEST') {
    _mint(msg.sender, amountToMint);
  }

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }
}
