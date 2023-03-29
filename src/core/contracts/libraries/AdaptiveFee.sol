// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../base/AlgebraFeeConfiguration.sol';
import './Constants.sol';

/// @title AdaptiveFee
/// @notice Calculates fee based on combination of sigmoids
library AdaptiveFee {
  /// @notice Returns default initial fee configuration
  function initialFeeConfiguration() internal pure returns (AlgebraFeeConfiguration memory) {
    return
      AlgebraFeeConfiguration(
        3000 - Constants.BASE_FEE, // alpha1, max value of the first sigmoid in hundredths of a bip, i.e. 1e-6
        15000 - 3000, // alpha2, max value of the second sigmoid in hundredths of a bip, i.e. 1e-6
        360, // beta1, shift along the x-axis (volatility) for the first sigmoid
        60000, // beta2, shift along the x-axis (volatility) for the second sigmoid
        59, // gamma1, horizontal stretch factor for the first sigmoid
        8500, // gamma2, horizontal stretch factor for the second sigmoid
        Constants.BASE_FEE // baseFee in hundredths of a bip, i.e. 1e-6
      );
  }

  /// @notice Validates fee configuration.
  /// @dev Maximum fee value capped by baseFee + alpha1 + alpha2 must be <= type(uint16).max
  /// gammas must be > 0
  function validateFeeConfiguration(AlgebraFeeConfiguration memory _config) internal pure {
    require(uint256(_config.alpha1) + uint256(_config.alpha2) + uint256(_config.baseFee) <= type(uint16).max, 'Max fee exceeded');
    require(_config.gamma1 != 0 && _config.gamma2 != 0, 'Gammas must be > 0');
  }

  /// @notice Calculates fee based on formula:
  /// baseFee + sigmoidVolume(sigmoid1(volatility, volumePerLiquidity) + sigmoid2(volatility, volumePerLiquidity))
  /// maximum value capped by baseFee + alpha1 + alpha2
  function getFee(uint88 volatility, AlgebraFeeConfiguration memory config) internal pure returns (uint16 fee) {
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
  /// @dev has good accuracy only if x/g < 6
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
      res = gHighestDegree; // g**4, res < 64 bits

      gHighestDegree /= g; // g**3
      res += xLowestDegree * gHighestDegree; // g**4 + x*g**3, res < 68

      gHighestDegree /= g; // g**2
      xLowestDegree *= x; // x**2
      // g**4 + x * g**3 + (x**2 * g**2) / 2, res < 71
      res += (xLowestDegree * gHighestDegree) / 2;

      gHighestDegree /= g; // g
      xLowestDegree *= x; // x**3
      // g^4 + x * g^3 + (x^2 * g^2)/2 + x^3(g*4 + x)/24, res < 73
      res += (xLowestDegree * g * 4 + xLowestDegree * x) / 24;

      // res = g^4 * (1 + x/g + x^2/(2*g^2) + x^3/(6*g^3) + x^4/(24*g^4)) * closestValue / 10^20, closestValue < 75 bits, res < 155
      res = (res * closestValue) / (1e20);
    }
  }
}
