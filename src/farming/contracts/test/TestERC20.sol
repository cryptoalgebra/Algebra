// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '@cryptoalgebra/integral-core/contracts/interfaces/IERC20Minimal.sol';

contract TestERC20 is IERC20Minimal {
  mapping(address => uint256) public override balanceOf;
  mapping(address => mapping(address => uint256)) public override allowance;

  constructor(uint256 amountToMint) {
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
    if (!isDeflationary) {
      balanceOf[recipient] = balanceRecipient + amount;
    } else {
      balanceOf[recipient] = balanceRecipient + (amount - (amount * 5) / 100);
    }

    emit Transfer(msg.sender, recipient, amount);
    return true;
  }

  function approve(address spender, uint256 amount) external override returns (bool) {
    allowance[msg.sender][spender] = amount;
    emit Approval(msg.sender, spender, amount);
    return true;
  }

  bool isDeflationary = false;
  uint128 transferFeePercent = 5;
  bool overrideNextTransfer;

  uint256 nextTransferAmount;

  function setDefl(bool _isDeflationary, uint128 percent) external {
    isDeflationary = _isDeflationary;
    transferFeePercent = percent;
  }

  function setNextTransferAmount(uint256 _nextTransferAmount) external {
    overrideNextTransfer = true;
    nextTransferAmount = _nextTransferAmount;
  }

  function transferFrom(address sender, address recipient, uint256 amount) external virtual override returns (bool) {
    uint256 allowanceBefore = allowance[sender][msg.sender];
    require(allowanceBefore >= amount, 'allowance insufficient');

    allowance[sender][msg.sender] = allowanceBefore - amount;

    uint256 balanceRecipient = balanceOf[recipient];
    require(balanceRecipient + amount >= balanceRecipient, 'overflow balance recipient');

    if (overrideNextTransfer) {
      amount = nextTransferAmount;
      nextTransferAmount = 0;
      overrideNextTransfer = false;
    }

    if (!isDeflationary) {
      balanceOf[recipient] = balanceRecipient + amount;
    } else {
      balanceOf[recipient] = balanceRecipient + (amount - (amount * uint256(transferFeePercent)) / 100);
    }
    uint256 balanceSender = balanceOf[sender];
    require(balanceSender >= amount, 'underflow balance sender');
    balanceOf[sender] = balanceSender - amount;

    emit Transfer(sender, recipient, amount);
    return true;
  }
}
