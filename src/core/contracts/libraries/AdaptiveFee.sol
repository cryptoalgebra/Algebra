// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import './Constants.sol';

/// @title AdaptiveFee
/// @notice Calculates fee based on combination of sigmoids
library AdaptiveFee {
  // alpha1 + alpha2 + baseFee must be <= type(uint16).max
  struct Configuration {
    uint16 alpha1; // max value of the first sigmoid
    uint16 alpha2; // max value of the second sigmoid
    uint32 beta1; // shift along the x-axis for the first sigmoid
    uint32 beta2; // shift along the x-axis for the second sigmoid
    uint16 gamma1; // horizontal stretch factor for the first sigmoid
    uint16 gamma2; // horizontal stretch factor for the second sigmoid
    uint32 volumeBeta; // shift along the x-axis for the outer volume-sigmoid
    uint16 volumeGamma; // horizontal stretch factor the outer volume-sigmoid
    uint16 baseFee; // minimum possible fee
  }

  /// @notice Calculates fee based on formula:
  /// baseFee + sigmoidVolume(sigmoid1(volatility, volumePerLiquidity) + sigmoid2(volatility, volumePerLiquidity))
  /// maximum value capped by baseFee + alpha1 + alpha2
  function getFee(
    uint88 volatility,
    uint256 volumePerLiquidity,
    Configuration memory config
  ) internal pure returns (uint16 fee) {
    uint256 sumOfSigmoids = sigmoid(volatility, config.gamma1, config.alpha1, config.beta1) +
      sigmoid(volatility, config.gamma2, config.alpha2, config.beta2);

    if (sumOfSigmoids > type(uint16).max) {
      // should be impossible
      sumOfSigmoids = type(uint16).max;
    }

    uint256 result = config.baseFee + sigmoid(volumePerLiquidity, config.volumeGamma, uint16(sumOfSigmoids), config.volumeBeta);
    if (result > type(uint16).max) {
      // should be impossible
      fee = type(uint16).max;
    } else {
      fee = uint16(result);
    }
  }

  /// @notice calculates α / (1 + e^( (β-x) / γ))
  /// that is a sigmoid with a maximum value of α, x-shifted by β, and stretched by γ
  /// @dev returns uint256 for fuzzy testing. Guaranteed that the result is not greater than alpha
  function sigmoid(
    uint256 x,
    uint16 g,
    uint16 alpha,
    uint256 beta
  ) internal pure returns (uint256 res) {
    if (x > beta) {
      x = x - beta;
      if (x >= 6 * g) return alpha; // so x < 19 bits
      uint256 g7 = uint256(g)**7; // < 112 bits (7*16)
      uint256 ex = exp(x, g, g7); // < 137 bits
      res = (alpha * (ex)) / (g7 + ex); // in worst case: (16 + 137 bits) / 138 bits
      // so res <= alpha
    } else {
      x = beta - x;
      if (x >= 6 * g) return 0; // so x < 19 bits
      uint256 g7 = uint256(g)**7; // < 112 bits (7*16)
      uint256 ex = g7 + exp(x, g, g7); // < 138 bits
      res = (alpha * g7) / (ex); // in worst case: (16 + 112 bits) / 138 bits
      // g7 <= ex, so res <= alpha
    }
  }

  /// @notice calculates e^(x/g) * g^7 in a series, since (around zero):
  /// e^x = 1 + x + x^2/2 + ... + x^n/n! + ...
  /// e^(x/g) = 1 + x/g + x^2/(2*g^2) + ... + x^(n)/(g^n * n!) + ...
  function exp(
    uint256 x,
    uint16 g,
    uint256 gHighestDegree
  ) internal pure returns (uint256 res) {
    // calculating:
    // g**7 + x * g**6 + (x**2 * g**5) / 2 + (x**3 * g**4) / 6 + (x**4 * g**3) / 24 + (x**5 * g**2) / 120 + (x**6 * g) / 720 + x**7 / (720 * 7)

    // x**7 < 133 bits (19*7) and g**7 < 112 bits (7*16)
    // so each summand < 133 bits and res < 137 bits
    uint256 xLowestDegree = x;
    res = gHighestDegree; // g**7

    gHighestDegree /= g; // g**6
    res += xLowestDegree * gHighestDegree;

    gHighestDegree /= g; // g**5
    xLowestDegree *= x; // x**2
    res += (xLowestDegree * gHighestDegree) / 2;

    gHighestDegree /= g; // g**4
    xLowestDegree *= x; // x**3
    res += (xLowestDegree * gHighestDegree) / 6;

    gHighestDegree /= g; // g**3
    xLowestDegree *= x; // x**4
    res += (xLowestDegree * gHighestDegree) / 24;

    gHighestDegree /= g; // g**2
    xLowestDegree *= x; // x**5
    res += (xLowestDegree * gHighestDegree) / 120;

    xLowestDegree *= x; // x**6
    res += (xLowestDegree * g) / 720;

    xLowestDegree *= x; // x**7
    res += xLowestDegree / 5040;
  }
}
