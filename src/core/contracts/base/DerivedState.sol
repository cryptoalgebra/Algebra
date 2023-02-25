// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './AlgebraPoolBase.sol';

abstract contract DerivedState is AlgebraPoolBase {
  /// @inheritdoc IAlgebraPoolDerivedState
  function getInnerCumulatives(
    int24 bottomTick,
    int24 topTick
  ) external view override onlyValidTicks(bottomTick, topTick) returns (uint160 innerSecondsSpentPerLiquidity, uint32 innerSecondsSpent) {
    TickManager.Tick storage _bottomTick = ticks[bottomTick];
    TickManager.Tick storage _topTick = ticks[topTick];

    if (_bottomTick.nextTick == _bottomTick.prevTick || _topTick.nextTick == _topTick.prevTick) revert tickIsNotInitialized();
    (uint160 lowerOuterSecondPerLiquidity, uint32 lowerOuterSecondsSpent) = (_bottomTick.outerSecondsPerLiquidity, _bottomTick.outerSecondsSpent);
    (uint160 upperOuterSecondPerLiquidity, uint32 upperOuterSecondsSpent) = (_topTick.outerSecondsPerLiquidity, _topTick.outerSecondsSpent);

    int24 currentTick = globalState.tick;
    unchecked {
      if (currentTick < bottomTick) {
        return (lowerOuterSecondPerLiquidity - upperOuterSecondPerLiquidity, lowerOuterSecondsSpent - upperOuterSecondsSpent);
      }

      if (currentTick < topTick) {
        uint32 time = _blockTimestamp();
        return (
          _getSecondsPerLiquidityCumulative(time, liquidity) - lowerOuterSecondPerLiquidity - upperOuterSecondPerLiquidity,
          time - lowerOuterSecondsSpent - upperOuterSecondsSpent
        );
      }

      return (upperOuterSecondPerLiquidity - lowerOuterSecondPerLiquidity, upperOuterSecondsSpent - lowerOuterSecondsSpent);
    }
  }
}
