// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../../base/AlgebraFeeConfiguration.sol';
import '../../libraries/AdaptiveFee.sol';

contract AdaptiveFeeEchidnaTest {
  function expInvariants(uint256 x, uint16 gamma) external pure {
    unchecked {
      require(gamma != 0);
      if (x >= 6 * gamma) return;
      uint256 g4 = uint256(gamma) ** 4;
      uint256 exp = AdaptiveFee.expXg4(x, gamma, g4);
      assert(exp < 2 ** 137);
    }
  }

  function sigmoidInvariants(uint256 x, uint16 gamma, uint16 alpha, uint256 beta) external pure {
    require(gamma != 0);
    uint256 res = AdaptiveFee.sigmoid(x, gamma, alpha, beta);
    assert(res <= type(uint16).max);
    assert(res <= alpha);
  }

  function getFeeInvariants(
    uint88 volatility,
    uint16 alpha1,
    uint16 alpha2,
    uint32 beta1,
    uint32 beta2,
    uint16 gamma1,
    uint16 gamma2,
    uint16 baseFee
  ) external pure returns (uint256 fee) {
    unchecked {
      AlgebraFeeConfiguration memory feeConfig = AlgebraFeeConfiguration(alpha1, alpha2, beta1, beta2, gamma1, gamma2, baseFee);
      AdaptiveFee.validateFeeConfiguration(feeConfig);

      fee = AdaptiveFee.getFee(volatility, feeConfig);
      assert(fee <= type(uint16).max);
      assert(fee >= baseFee);
      assert(fee <= baseFee + alpha1 + alpha2);
    }
  }
}
