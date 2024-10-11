// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../plugins/SlidingFeePlugin.sol';

contract SlidingFeeTest is SlidingFeePlugin {
  event Fee(uint16 fee);
  uint8 public constant override defaultPluginConfig = 0;
  constructor() BasePlugin(msg.sender, msg.sender, msg.sender) {}

  function getFeeForSwap(bool zeroToOne, int24 lastTick, int24 currentTick) external returns (uint16 fee) {
    fee = _getFeeAndUpdateFactors(zeroToOne, currentTick, lastTick);
    emit Fee(fee);
  }

  function getGasCostOfGetFeeForSwap(bool zeroToOne, int24 lastTick, int24 currentTick) external returns (uint256) {
    unchecked {
      uint256 gasBefore = gasleft();
      _getFeeAndUpdateFactors(zeroToOne, currentTick, lastTick);
      return gasBefore - gasleft();
    }
  }

  function changeBaseFee(uint16 newFee) external {
    s_baseFee = newFee;
  }

  function changeFactor(uint16 newFactor) external {
    s_priceChangeFactor = newFactor;
  }
}
