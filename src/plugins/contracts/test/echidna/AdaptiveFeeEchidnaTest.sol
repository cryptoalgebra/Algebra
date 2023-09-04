// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../../base/AlgebraFeeConfiguration.sol';
import '../../libraries/AdaptiveFee.sol';

contract AdaptiveFeeEchidnaTest {
  using AlgebraFeeConfigurationU144Lib for AlgebraFeeConfiguration;

  function checkExpInvariants(uint256 x, uint16 gamma) external pure {
    unchecked {
      require(gamma != 0);
      if (x >= 6 * gamma) return;
      uint256 g4 = uint256(gamma) ** 4;
      uint256 exp = AdaptiveFee.expXg4(x, gamma, g4);
      assert(exp < 2 ** 137);
    }
  }

  function checkSigmoidInvariants(uint256 x, uint16 gamma, uint16 alpha, uint256 beta) external pure {
    require(gamma != 0);
    uint256 res = AdaptiveFee.sigmoid(x, gamma, alpha, beta);
    assert(res <= type(uint16).max);
    assert(res <= alpha);
  }

  function checkFeeInvariants(
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

      fee = AdaptiveFee.getFee(volatility, feeConfig.pack());
      assert(fee <= type(uint16).max);
      assert(fee >= baseFee);
      assert(fee <= baseFee + alpha1 + alpha2);
    }
  }

  function checkFeeConfigPackedCorrectness(
    uint16 alpha1,
    uint16 alpha2,
    uint32 beta1,
    uint32 beta2,
    uint16 gamma1,
    uint16 gamma2,
    uint16 baseFee
  ) external pure {
    AlgebraFeeConfigurationU144 feeConfig = AlgebraFeeConfiguration(alpha1, alpha2, beta1, beta2, gamma1, gamma2, baseFee).pack();

    assert(feeConfig.alpha1() == alpha1);
    assert(feeConfig.alpha2() == alpha2);
    assert(feeConfig.beta1() == beta1);
    assert(feeConfig.beta2() == beta2);
    assert(feeConfig.gamma1() == gamma1);
    assert(feeConfig.gamma2() == gamma2);
    assert(feeConfig.baseFee() == baseFee);
  }
}
