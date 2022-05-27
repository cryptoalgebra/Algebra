// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import './Constants.sol';

library AdaptiveFee {
  struct Configuration {
    uint32 alpha1;
    uint32 alpha2;
    uint32 beta1;
    uint32 beta2;
    uint16 gamma1;
    uint16 gamma2;
    uint32 volumeBeta;
    uint32 volumeGamma;
    uint16 baseFee;
  }

  function getFee(
    uint88 volatility,
    uint256 volumePerLiquidity,
    Configuration memory config
  ) internal pure returns (uint256 fee) {
    uint256 sigm1 = sigmoid(volatility, config.gamma1, config.alpha1, config.beta1);
    uint256 sigm2 = sigmoid(volatility, config.gamma2, config.alpha2, config.beta2);

    fee = uint256(config.baseFee) + sigmoid(volumePerLiquidity, config.volumeGamma, sigm1 + sigm2, config.volumeBeta);
  }

  function sigmoid(
    uint256 x,
    uint256 g,
    uint256 alpha,
    uint256 beta
  ) internal pure returns (uint256 res) {
    if (x > beta) {
      x = x - beta;
      if (x >= 6 * g) return alpha;
      uint256 ex = exp(x, g);
      res = ((10 * alpha * (ex)) / (g**7 + ex)) / 10;
    } else {
      x = beta - x;
      if (x >= 6 * g) return 0;
      uint256 ex = g**7 + exp(x, g);
      res = ((10 * alpha * g**7) / (ex)) / 10;
    }
  }

  function exp(uint256 x, uint256 g) internal pure returns (uint256 res) {
    return g**7 + x * g**6 + (x**2 * g**5) / 2 + (x**3 * g**4) / 6 + (x**4 * g**3) / 24 + (x**5 * g**2) / 120 + (x**6 * g) / 720 + x**7 / (720 * 7);
  }
}
