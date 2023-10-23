// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../interfaces/IAlgebraEternalFarming.sol';
import '../base/IncentiveKey.sol';
import './TestERC20.sol';

contract TestERC20Reentrant is TestERC20 {
  bool public doReentrancy = false;
  bool public doComplexReentrancy = false;

  IncentiveKey private keyForAttack;
  uint128 rewardAmountForAttack;
  uint128 bonusRewardAmountForAttack;

  address addressForComplexAttack;
  bytes calldataForComplexAttack;

  constructor(uint256 amountToMint) TestERC20(amountToMint) {
    //
  }

  function prepareAttack(IncentiveKey memory key, uint128 rewardAmount, uint128 bonusRewardAmount) external {
    doReentrancy = true;
    keyForAttack = key;
    rewardAmountForAttack = rewardAmount;
    bonusRewardAmountForAttack = bonusRewardAmount;
  }

  function prepareComplexAttack(address target, bytes calldata data) external {
    doComplexReentrancy = true;
    addressForComplexAttack = target;
    calldataForComplexAttack = data;
  }

  function cancelComplexAttack() external {
    doComplexReentrancy = false;
  }

  function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
    if (doReentrancy) {
      IAlgebraEternalFarming(msg.sender).addRewards(keyForAttack, rewardAmountForAttack, bonusRewardAmountForAttack);
    }

    if (doComplexReentrancy) {
      (bool res, ) = addressForComplexAttack.call(calldataForComplexAttack);
      require(res, 'Attack failed');
    }

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
