// SPDX-License-Identifier: MIT
pragma solidity =0.8.20;

import {IAlgebraFactory} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import {IAlgebraPool} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import {Timestamp} from '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';
import {TickMath} from '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';

import {BasePlugin} from '../base/BasePlugin.sol';

abstract contract SlidingFeePlugin is BasePlugin {
  uint64 internal constant FEE_FACTOR_SHIFT = 96;

  bytes32 internal constant SLIDING_FEE_NAMESPACE = keccak256('namespace.sliding.fee');

  struct SlidingFeeLayout {
    uint128 zeroToOneFeeFactor;
    uint128 oneToZeroFeeFactor;
    uint256 priceChangeFactor;
  }

  /// @dev Fetch pointer of Adaptive fee plugin's storage
  function getSlidingFeePointer() internal pure returns (SlidingFeeLayout storage sfl) {
    bytes32 position = SLIDING_FEE_NAMESPACE;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      sfl.slot := position
    }
  }

  event PriceChangeFactor(uint256 priceChangeFactor);

  constructor() {
    SlidingFeeLayout storage sfl = getSlidingFeePointer();

    sfl.zeroToOneFeeFactor = uint128(1 << FEE_FACTOR_SHIFT);
    sfl.oneToZeroFeeFactor = uint128(1 << FEE_FACTOR_SHIFT);
  }

  function setPriceChangeFactor(uint256 newPriceChangeFactor) external {
    require(msg.sender == pluginFactory || IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));
    SlidingFeeLayout storage sfl = getSlidingFeePointer();
    sfl.priceChangeFactor = newPriceChangeFactor;

    emit PriceChangeFactor(newPriceChangeFactor);
  }

  function _getFee(bool zeroToOne, int24 currentTick, int24 lastTick, uint16 poolFee) internal returns (uint16) {
    (uint128 ztoFeeFactor, uint128 otzFeeFactor) = _calculateAndUpdateFeeFactors(currentTick, lastTick);

    uint16 adjustedFee = zeroToOne ? uint16((poolFee * ztoFeeFactor) >> FEE_FACTOR_SHIFT) : uint16((poolFee * otzFeeFactor) >> FEE_FACTOR_SHIFT);

    return adjustedFee;
  }

  function _calculateAndUpdateFeeFactors(
    int24 currentTick,
    int24 lastTick
  ) internal returns (uint128 _zeroToOneFeeFactor, uint128 _oneToZeroFeeFactor) {
    SlidingFeeLayout storage sfl = getSlidingFeePointer();

    _zeroToOneFeeFactor = sfl.zeroToOneFeeFactor;
    _oneToZeroFeeFactor = sfl.oneToZeroFeeFactor;
    uint256 _priceChangeFactor = sfl.priceChangeFactor;

    // price change is positive after zeroToOne prevalence
    int256 priceChangeRatio = int256(uint256(TickMath.getSqrtRatioAtTick(currentTick - lastTick))) - int256(1 << FEE_FACTOR_SHIFT); // (currentPrice - lastPrice) / lastPrice
    int128 feeFactorImpact = int128(priceChangeRatio * int256(_priceChangeFactor));

    // if there were zeroToOne prevalence in the last price change,
    // in result price has increased
    // we need to increase zeroToOneFeeFactor
    // and vice versa
    int128 newZeroToOneFeeFactor = int128(_zeroToOneFeeFactor) + feeFactorImpact;

    if ((int128(-2) << FEE_FACTOR_SHIFT) < newZeroToOneFeeFactor && newZeroToOneFeeFactor < int128(uint128(2) << FEE_FACTOR_SHIFT)) {
      _zeroToOneFeeFactor = uint128(newZeroToOneFeeFactor);
      _oneToZeroFeeFactor = uint128(int128(_oneToZeroFeeFactor) - feeFactorImpact);
    } else if (newZeroToOneFeeFactor <= 0) {
      // In this case price has decreased that much so newZeroToOneFeeFactor is less than 0
      // So we set it to the minimal value == 0
      // It means that there were too much oneToZero prevalence and we want to decrease it
      // Basically price change is -100%
      _zeroToOneFeeFactor = uint128(2 << FEE_FACTOR_SHIFT);
      _oneToZeroFeeFactor = 0;
    } else {
      // In this case priceChange is big enough that newZeroToOneFeeFactor is greater than 2
      // So we set it to the maximum value
      // It means that there were too much zeroToOne prevalence and we want to decrease it
      _zeroToOneFeeFactor = 0;
      _oneToZeroFeeFactor = uint128(2 << FEE_FACTOR_SHIFT);
    }

    sfl.zeroToOneFeeFactor = _zeroToOneFeeFactor;
    sfl.oneToZeroFeeFactor = _oneToZeroFeeFactor;
  }
}
