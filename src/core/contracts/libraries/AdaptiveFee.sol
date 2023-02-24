// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../interfaces/IAlgebraFeeConfiguration.sol';
import './Constants.sol';

/// @title AdaptiveFee
/// @notice Calculates fee based on combination of sigmoids
library AdaptiveFee {
  /// @notice
  function initialFeeConfiguration() internal pure returns (IAlgebraFeeConfiguration.Configuration memory) {
    return
      IAlgebraFeeConfiguration.Configuration(
        3000 - Constants.BASE_FEE, // alpha1
        15000 - 3000, // alpha2
        360, // beta1
        60000, // beta2
        59, // gamma1
        8500, // gamma2
        Constants.BASE_FEE // baseFee
      );
  }

  /// @notice
  function validateFeeConfiguration(IAlgebraFeeConfiguration.Configuration memory _config) internal pure {
    require(uint256(_config.alpha1) + uint256(_config.alpha2) + uint256(_config.baseFee) <= type(uint16).max, 'Max fee exceeded');
    require(_config.gamma1 != 0 && _config.gamma2 != 0, 'Gammas must be > 0');
  }

  /// @notice Calculates fee based on formula:
  /// baseFee + sigmoidVolume(sigmoid1(volatility, volumePerLiquidity) + sigmoid2(volatility, volumePerLiquidity))
  /// maximum value capped by baseFee + alpha1 + alpha2
  function getFee(uint88 volatility, IAlgebraFeeConfiguration.Configuration memory config) internal pure returns (uint16 fee) {
    unchecked {
      volatility /= 15; // normalize for 15 sec interval
      uint256 sumOfSigmoids = sigmoid(volatility, config.gamma1, config.alpha1, config.beta1) +
        sigmoid(volatility, config.gamma2, config.alpha2, config.beta2);

      if (sumOfSigmoids > type(uint16).max) sumOfSigmoids = type(uint16).max; // should be impossible, just in case

      return uint16(config.baseFee + sumOfSigmoids); // safe since alpha1 + alpha2 + baseFee _must_ be <= type(uint16).max
    }
  }

  /// @notice calculates α / (1 + e^( (β-x) / γ))
  /// that is a sigmoid with a maximum value of α, x-shifted by β, and stretched by γ
  /// @dev returns uint256 for fuzzy testing. Guaranteed that the result is not greater than alpha
  function sigmoid(uint256 x, uint16 g, uint16 alpha, uint256 beta) internal pure returns (uint256 res) {
    unchecked {
      if (x > beta) {
        x = x - beta;
        if (x >= 6 * uint256(g)) return alpha; // so x < 19 bits
        uint256 g4 = uint256(g) ** 4; // < 64 bits (4*16)
        uint256 ex = expXg4(x, g, g4); // < 155 bits
        res = (alpha * ex) / (g4 + ex); // in worst case: (16 + 155 bits) / 155 bits
        // so res <= alpha
      } else {
        x = beta - x;
        if (x >= 6 * uint256(g)) return 0; // so x < 19 bits
        uint256 g4 = uint256(g) ** 4; // < 64 bits (4*16)
        uint256 ex = g4 + expXg4(x, g, g4); // < 156 bits
        res = (alpha * g4) / ex; // in worst case: (16 + 128 bits) / 156 bits
        // g8 <= ex, so res <= alpha
      }
    }
  }

  /// @notice calculates e^(x/g) * g^4 in a series, since (around zero):
  /// e^x = 1 + x + x^2/2 + ... + x^n/n! + ...
  /// e^(x/g) = 1 + x/g + x^2/(2*g^2) + ... + x^(n)/(g^n * n!) + ...
  function expXg4(uint256 x, uint16 g, uint256 gHighestDegree) internal pure returns (uint256 res) {
    uint256 closestValue; // nearest 'table' value of e^(x/g), multiplied by 10^20
    assembly {
      let xdg := div(x, g)
      switch xdg
      case 0 {
        closestValue := 100000000000000000000 // 1
      }
      case 1 {
        closestValue := 271828182845904523536 // ~= e
      }
      case 2 {
        closestValue := 738905609893065022723 // ~= e^2
      }
      case 3 {
        closestValue := 2008553692318766774092 // ~= e^3
      }
      case 4 {
        closestValue := 5459815003314423907811 // ~= e^4
      }
      default {
        closestValue := 14841315910257660342111 // ~= e^5
      }

      x := mod(x, g)
    }

    unchecked {
      if (x >= g / 2) {
        // (x - closestValue) >= 0.5, so closestValue := closestValue * e^0.5
        x -= g / 2;
        closestValue = (closestValue * 164872127070012814684) / 1e20;
      }

      // After calculating the closestValue x/g is <= 0.5, so that the series in the neighborhood of zero converges with sufficient speed
      uint256 xLowestDegree = x;
      res = gHighestDegree; // g**4

      gHighestDegree /= g; // g**3
      res += xLowestDegree * gHighestDegree;

      gHighestDegree /= g; // g**2
      xLowestDegree *= x; // x**2
      res += (xLowestDegree * gHighestDegree) / 2;

      gHighestDegree /= g; // g
      xLowestDegree *= x; // x**3
      res += (xLowestDegree * g * 4 + xLowestDegree * x) / 24;

      // res = g^4 * (1 + x/g + x^2/(2*g^2) + x^3/(6*g^3) + x^4/(24*g^4)) * closestValue / 10^20
      res = (res * closestValue) / (1e20);
    }
  }
}
