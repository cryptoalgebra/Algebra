// SPDX-License-Identifier: MIT
pragma solidity =0.8.20;

import {IAlgebraFactory} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import {IAlgebraPool} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import {Timestamp} from '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';
import {TickMath} from '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';
import {FullMath} from '@cryptoalgebra/integral-core/contracts/libraries/FullMath.sol';

import {ISlidingFeePlugin} from '../interfaces/plugins/ISlidingFeePlugin.sol';
import {BasePlugin} from '../base/BasePlugin.sol';

abstract contract SlidingFeePlugin is BasePlugin, ISlidingFeePlugin {
  struct FeeFactors {
    uint128 zeroToOneFeeFactor;
    uint128 oneToZeroFeeFactor;
  }

  int16 internal constant FACTOR_DENOMINATOR = 1000;
  uint64 internal constant FEE_FACTOR_SHIFT = 96;

  FeeFactors public s_feeFactors;

  uint16 public s_priceChangeFactor = 1000;
  uint16 public s_baseFee = 500;

  constructor() {
    FeeFactors memory feeFactors = FeeFactors(uint128(1 << FEE_FACTOR_SHIFT), uint128(1 << FEE_FACTOR_SHIFT));

    s_feeFactors = feeFactors;
  }

  function _getFeeAndUpdateFactors(bool zeroToOne, int24 currenTick, int24 lastTick) internal returns (uint16) {
    FeeFactors memory currentFeeFactors;

    uint16 priceChangeFactor = s_priceChangeFactor;
    uint16 baseFee = s_baseFee;

    if (currenTick != lastTick) {
      currentFeeFactors = _calculateFeeFactors(currenTick, lastTick, priceChangeFactor);

      s_feeFactors = currentFeeFactors;
    } else {
      currentFeeFactors = s_feeFactors;
    }

    uint256 adjustedFee = zeroToOne
      ? (uint256(baseFee) * currentFeeFactors.zeroToOneFeeFactor) >> FEE_FACTOR_SHIFT
      : (uint256(baseFee) * currentFeeFactors.oneToZeroFeeFactor) >> FEE_FACTOR_SHIFT;

    if (adjustedFee > type(uint16).max) adjustedFee = type(uint16).max;
    return uint16(adjustedFee);
  }

  function setPriceChangeFactor(uint16 newPriceChangeFactor) external override {
    require(IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));

    s_priceChangeFactor = newPriceChangeFactor;

    emit PriceChangeFactor(newPriceChangeFactor);
  }

  function setBaseFee(uint16 newBaseFee) external override {
    require(msg.sender == pluginFactory || IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));

    s_baseFee = newBaseFee;
    emit BaseFee(newBaseFee);
  }

  function _calculateFeeFactors(int24 currentTick, int24 lastTick, uint16 priceChangeFactor) internal view returns (FeeFactors memory feeFactors) {
    int256 tickDelta = int256(currentTick) - int256(lastTick);
    if (tickDelta > TickMath.MAX_TICK) {
      tickDelta = TickMath.MAX_TICK;
    } else if (tickDelta < TickMath.MIN_TICK) {
      tickDelta = TickMath.MIN_TICK;
    }
    uint256 sqrtPriceDelta = uint256(TickMath.getSqrtRatioAtTick(int24(tickDelta)));

    // price change is positive after oneToZero prevalence
    int256 priceChangeRatio = int256(FullMath.mulDiv(sqrtPriceDelta, sqrtPriceDelta, 2 ** 96)) - int256(1 << FEE_FACTOR_SHIFT); // (currentPrice - lastPrice) / lastPrice
    int256 feeFactorImpact = (priceChangeRatio * int256(uint256(priceChangeFactor))) / FACTOR_DENOMINATOR;

    feeFactors = s_feeFactors;

    // if there were zeroToOne prevalence in the last price change,
    // in result price has increased
    // we need to decrease zeroToOneFeeFactor
    // and vice versa
    int256 newZeroToOneFeeFactor = int128(feeFactors.zeroToOneFeeFactor) - feeFactorImpact;

    if (0 < newZeroToOneFeeFactor && newZeroToOneFeeFactor < (int128(2) << FEE_FACTOR_SHIFT)) {
      feeFactors = FeeFactors(uint128(int128(newZeroToOneFeeFactor)), uint128(int128(feeFactors.oneToZeroFeeFactor) + int128(feeFactorImpact)));
    } else if (newZeroToOneFeeFactor <= 0) {
      // In this case price has decreased that much so newZeroToOneFeeFactor is less than 0
      // So we set it to the minimal value == 0
      // It means that there were too much oneToZero prevalence and we want to decrease it
      // Basically price change is -100%
      feeFactors = FeeFactors(0, uint128(2 << FEE_FACTOR_SHIFT));
    } else {
      // In this case priceChange is big enough that newZeroToOneFeeFactor is greater than 2
      // So we set it to the maximum value
      // It means that there were too much zeroToOne prevalence and we want to decrease it
      feeFactors = FeeFactors(uint128(2 << FEE_FACTOR_SHIFT), 0);
    }
  }
}
