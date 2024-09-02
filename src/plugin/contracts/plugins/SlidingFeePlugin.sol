// SPDX-License-Identifier: MIT
pragma solidity =0.8.20;

import {IAlgebraFactory} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import {IAlgebraPool} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import {Timestamp} from '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';
import {TickMath} from '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';

import {ISlidingFeePlugin} from '../interfaces/plugins/ISlidingFeePlugin.sol';
import {BasePlugin} from '../base/BasePlugin.sol';

abstract contract SlidingFeePlugin is BasePlugin, ISlidingFeePlugin {
  struct FeeFactors {
    uint128 zeroToOneFeeFactor;
    uint128 oneToZeroFeeFactor;
  }

  uint64 internal constant FEE_FACTOR_SHIFT = 96;

  FeeFactors public s_feeFactors;

  uint16 public s_priceChangeFactor = 1;
  uint16 public s_baseFee;

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
    }

    s_feeFactors = currentFeeFactors;

    uint16 adjustedFee = zeroToOne
      ? uint16((baseFee * currentFeeFactors.zeroToOneFeeFactor) >> FEE_FACTOR_SHIFT)
      : uint16((baseFee * currentFeeFactors.oneToZeroFeeFactor) >> FEE_FACTOR_SHIFT);

    return adjustedFee;
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
    // price change is positive after zeroToOne prevalence
    int256 priceChangeRatio = int256(uint256(TickMath.getSqrtRatioAtTick(currentTick - lastTick))) - int256(1 << FEE_FACTOR_SHIFT); // (currentPrice - lastPrice) / lastPrice
    int128 feeFactorImpact = int128(priceChangeRatio * int16(priceChangeFactor));

    feeFactors = s_feeFactors;

    // if there were zeroToOne prevalence in the last price change,
    // in result price has increased
    // we need to decrease zeroToOneFeeFactor
    // and vice versa
    int128 newZeroToOneFeeFactor = int128(feeFactors.zeroToOneFeeFactor) - feeFactorImpact;

    if ((int128(-2) << FEE_FACTOR_SHIFT) < newZeroToOneFeeFactor && newZeroToOneFeeFactor < int128(uint128(2) << FEE_FACTOR_SHIFT)) {
      feeFactors = FeeFactors(uint128(newZeroToOneFeeFactor), uint128(int128(feeFactors.oneToZeroFeeFactor) + feeFactorImpact));
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
