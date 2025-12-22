// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.4;

import {IERC20Minimal} from '@cryptoalgebra/integral-core/contracts/interfaces/IERC20Minimal.sol';

contract TestERC20 is IERC20Minimal {
  string public name;
  string public symbol;
  uint8 public constant decimals = 18;
  mapping(address => uint256) public override balanceOf;
  mapping(address => mapping(address => uint256)) public override allowance;

  event Withdraw(address indexed to, uint256 amount);

  constructor(uint256 amountToMint) {
    name = 'name';
    symbol = 'symbol';
    mint(msg.sender, amountToMint);
  }

  function mint(address to, uint256 amount) public {
    uint256 balanceNext = balanceOf[to] + amount;
    require(balanceNext >= amount, 'overflow balance');
    balanceOf[to] = balanceNext;
  }

  function transfer(address recipient, uint256 amount) external override returns (bool) {
    uint256 balanceBefore = balanceOf[msg.sender];
    require(balanceBefore >= amount, 'insufficient balance');
    balanceOf[msg.sender] = balanceBefore - amount;

    uint256 balanceRecipient = balanceOf[recipient];
    require(balanceRecipient + amount >= balanceRecipient, 'recipient balance overflow');
    balanceOf[recipient] = balanceRecipient + amount;

    emit Transfer(msg.sender, recipient, amount);
    return true;
  }

  function approve(address spender, uint256 amount) external override returns (bool) {
    allowance[msg.sender][spender] = amount;
    emit Approval(msg.sender, spender, amount);
    return true;
  }

  function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
    uint256 allowanceBefore = allowance[sender][msg.sender];
    require(allowanceBefore >= amount, 'allowance insufficient');

    allowance[sender][msg.sender] = allowanceBefore - amount;

    uint256 balanceRecipient = balanceOf[recipient];
    require(balanceRecipient + amount >= balanceRecipient, 'overflow balance recipient');
    balanceOf[recipient] = balanceRecipient + amount;
    uint256 balanceSender = balanceOf[sender];
    require(balanceSender >= amount, 'underflow balance sender');
    balanceOf[sender] = balanceSender - amount;

    emit Transfer(sender, recipient, amount);
    return true;
  }

  function deposit() public payable {
    balanceOf[msg.sender] += msg.value;
  }

  function withdraw(uint256 amount) public {
    require(balanceOf[msg.sender] >= amount, 'insufficient balance');
    balanceOf[msg.sender] -= amount;
    payable(msg.sender).transfer(amount);
    emit Withdraw(msg.sender, amount);
  }
}
