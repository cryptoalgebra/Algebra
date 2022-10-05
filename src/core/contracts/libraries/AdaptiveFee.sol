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
    uint16 baseFee; // minimum possible fee
  }

  /// @notice Calculates fee based on formula:
  /// baseFee + sigmoidVolume(sigmoid1(volatility, volumePerLiquidity) + sigmoid2(volatility, volumePerLiquidity))
  /// maximum value capped by baseFee + alpha1 + alpha2
  function getFee(uint88 volatility, Configuration memory config) internal pure returns (uint16 fee) {
    uint256 sumOfSigmoids = sigmoid(volatility, config.gamma1, config.alpha1, config.beta1) +
      sigmoid(volatility, config.gamma2, config.alpha2, config.beta2);

    if (sumOfSigmoids > type(uint16).max) {
      // should be impossible, just in case
      sumOfSigmoids = type(uint16).max;
    }

    return uint16(config.baseFee + sumOfSigmoids); // safe since alpha1 + alpha2 + baseFee _must_ be <= type(uint16).max
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
      if (x >= 6 * uint256(g)) return alpha; // so x < 19 bits
      uint256 g4 = uint256(g)**4; // < 64 bits (4*16)
      uint256 ex = expMul(x, g, g4); // < 155 bits
      res = (alpha * ex) / (g4 + ex); // in worst case: (16 + 155 bits) / 155 bits
      // so res <= alpha
    } else {
      x = beta - x;
      if (x >= 6 * uint256(g)) return 0; // so x < 19 bits
      uint256 g4 = uint256(g)**4; // < 64 bits (4*16)
      uint256 ex = g4 + expMul(x, g, g4); // < 156 bits
      res = (alpha * g4) / ex; // in worst case: (16 + 128 bits) / 156 bits
      // g8 <= ex, so res <= alpha
    }
  }

  /// @notice calculates e^(x/g) * g^4 in a series, since (around zero):
  /// e^x = 1 + x + x^2/2 + ... + x^n/n! + ...
  /// e^(x/g) = 1 + x/g + x^2/(2*g^2) + ... + x^(n)/(g^n * n!) + ...
  function expMul(
    uint256 x,
    uint16 g,
    uint256 gHighestDegree
  ) internal pure returns (uint256 res) {
    uint256 closestValue;
    {
      assembly {
        let xdg := div(x, g)
        switch xdg
        case 0 {
          closestValue := 100000000000000000000
        }
        case 1 {
          closestValue := 271828182845904523536
        }
        case 2 {
          closestValue := 738905609893065022723
        }
        case 3 {
          closestValue := 2008553692318766774092
        }
        case 4 {
          closestValue := 5459815003314423907811
        }
        default {
          closestValue := 14841315910257660342111
        }

        x := sub(x, mul(xdg, g))
      }

      if (x >= g / 2) {
        x -= g / 2;
        closestValue = (closestValue * 164872127070012814684) / 100000000000000000000;
      }
    }

    uint256 xLowestDegree = x;
    res = gHighestDegree; // g**4

    gHighestDegree /= g; // g**3
    res += xLowestDegree * gHighestDegree;

    gHighestDegree /= g; // g**2
    xLowestDegree *= x; // x**2
    res += ((xLowestDegree * gHighestDegree) * 3 + (xLowestDegree * x * g)) / 6;

    res = (res * closestValue) / (10000000000000000000);
    if (res % 10 >= 5) res = res / 10 + 1;
    else res = res / 10;
  }
}
