// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;

import '../libraries/AdaptiveFee.sol';

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
    uint256 volumePerLiquidity,
    uint16 gamma1,
    uint16 gamma2,
    uint16 alpha1,
    uint16 alpha2,
    uint32 beta1,
    uint32 beta2,
    uint16 volumeGamma,
    uint32 volumeBeta,
    uint16 baseFee
  ) external pure returns (uint256 fee) {
    unchecked {
      require(uint256(alpha1) + uint256(alpha2) + uint256(baseFee) <= type(uint16).max, 'Max fee exceeded');
      require(gamma1 != 0 && gamma2 != 0 && volumeGamma != 0, 'Gammas must be > 0');

      uint256 sigm1 = AdaptiveFee.sigmoid(volatility, gamma1, alpha1, beta1);
      uint256 sigm2 = AdaptiveFee.sigmoid(volatility, gamma2, alpha2, beta2);

      assert(sigm1 + sigm2 <= type(uint16).max);

      fee = baseFee + AdaptiveFee.sigmoid(volumePerLiquidity, volumeGamma, uint16(sigm1 + sigm2), volumeBeta);
      assert(fee <= type(uint16).max);
    }
  }
}
