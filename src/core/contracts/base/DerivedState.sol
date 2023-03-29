// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './AlgebraPoolBase.sol';

/// @title Pool state that is not stored
/// @notice Contains view functions to provide information about the pool that is computed rather than stored on the blockchain
abstract contract DerivedState is AlgebraPoolBase {
  /// @inheritdoc IAlgebraPoolDerivedState
  function getInnerCumulatives(
    int24 bottomTick,
    int24 topTick
  ) external view override onlyValidTicks(bottomTick, topTick) returns (uint160 innerSecondsSpentPerLiquidity, uint32 innerSecondsSpent) {
    TickManagement.Tick storage _bottomTick = ticks[bottomTick];
    TickManagement.Tick storage _topTick = ticks[topTick];

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
      } else return (upperOuterSecondPerLiquidity - lowerOuterSecondPerLiquidity, upperOuterSecondsSpent - lowerOuterSecondsSpent);
    }
  }
}
