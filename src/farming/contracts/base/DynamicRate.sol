// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;
pragma abicoder v1;

import '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/FullMath.sol';

abstract contract DynamicRate is Timestamp {
  uint32 public constant RATE_CHANGE_FREQUENCY = 1 hours;
  uint16 public constant FEE_WEIGHT_DENOMINATOR = 1e3;

  uint16 internal fee1Weight;
  uint16 internal fee0Weight;

  uint32 internal prevDelta;
  uint32 internal prevRateChangeTimestamp;

  uint128 internal prevFees0Collected;
  uint128 internal prevFees1Collected;

  uint128 internal fees0Collected;
  uint128 internal fees1Collected;

  uint128 internal maxRate0;
  uint128 internal maxRate1;

  uint128 internal minRate0;
  uint128 internal minRate1;

  function _getNewRates(uint128 rate0, uint128 rate1) internal returns (uint128 newRate0, uint128 newRate1) {
    uint32 _prevDelta = prevDelta;
    uint32 timeDelta = _blockTimestamp() - prevRateChangeTimestamp;

    if (_prevDelta != 0 && prevFees0Collected != 0 && prevFees1Collected != 0) {
      newRate0 = uint128(
        FullMath.mulDiv(rate0, fees0Collected * fee0Weight * _prevDelta, prevFees0Collected * FEE_WEIGHT_DENOMINATOR * timeDelta) +
          FullMath.mulDiv(rate0, fees1Collected * fee1Weight * _prevDelta, prevFees1Collected * FEE_WEIGHT_DENOMINATOR * timeDelta)
      );

      newRate1 = uint128(
        FullMath.mulDiv(rate1, fees0Collected * fee0Weight * _prevDelta, prevFees0Collected * FEE_WEIGHT_DENOMINATOR * timeDelta) +
          FullMath.mulDiv(rate1, fees1Collected * fee1Weight * _prevDelta, prevFees1Collected * FEE_WEIGHT_DENOMINATOR * timeDelta)
      );

      if (newRate0 > rate0) {
        if (newRate0 > maxRate0 && maxRate0 != 0) {
          newRate0 = maxRate0;
        }
        if (newRate1 > maxRate1 && maxRate1 != 0) {
          newRate1 = maxRate1;
        }
      } else {
        if (newRate0 < minRate0 && minRate0 != 0) {
          newRate0 = minRate0;
        }
        if (newRate1 < minRate1 && minRate1 != 0) {
          newRate1 = minRate1;
        }
      }
    } else {
      (newRate0, newRate1) = (rate0, rate1);
    }

    prevFees0Collected = fees0Collected;
    prevFees1Collected = fees1Collected;

    prevDelta = timeDelta;
    prevRateChangeTimestamp = _blockTimestamp();

    fees0Collected = 0;
    fees1Collected = 0;
  }

  function _resetDynamicRateState() internal {
    prevDelta = 0;
    prevRateChangeTimestamp = _blockTimestamp();

    prevFees0Collected = 0;
    prevFees1Collected = 0;

    fees0Collected = 0;
    fees1Collected = 0;

    maxRate0 = 0;
    maxRate1 = 0;

    minRate0 = 0;
    minRate1 = 0;
  }
}
