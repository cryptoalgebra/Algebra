// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

library PIFee {
  uint16 internal constant maxFee = 50000;

  function recalculateFee(
    bool zeroForOne,
    uint160 startPrice,
    uint160 currentPrice,
    uint16 startFee,
    uint16 currentFee
  ) internal pure returns (uint16 fee) {
    return currentFee; // MOCK, WIP

    if (currentFee == maxFee) {
      return maxFee;
    }

    // price deviation percent, 1 = 0.0001%
    uint256 deviationPercent;

    if (zeroForOne) {
      deviationPercent = (((startPrice * 1e3) / currentPrice)**2 - 1e6);
    } else {
      deviationPercent = (((currentPrice * 1e3) / startPrice)**2 - 1e6);
    }

    // y = 1/625x + 125     y = 1/9000x + 8500
    // ________________0.05%__________________
    if (deviationPercent < 500) {
      fee = uint16(((deviationPercent + 125) * startFee) / 625);
    } else {
      fee = uint16(((deviationPercent + 8500) * startFee) / 9000);
      // check overflow
      if (fee < currentFee || fee > maxFee) {
        return maxFee;
      }
    }
  }
}
