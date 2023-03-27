// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import '../../libraries/TickManager.sol';

import './interfaces/IAlgebraLimitVirtualPool.sol';

import '../AlgebraVirtualPoolBase.sol';

contract LimitVirtualPool is AlgebraVirtualPoolBase, IAlgebraLimitVirtualPool {
    using TickManager for mapping(int24 => TickManager.Tick);

    /// @inheritdoc IAlgebraLimitVirtualPool
    bool public override isFinished;

    /// @inheritdoc IAlgebraLimitVirtualPool
    uint32 public immutable override desiredEndTimestamp;
    /// @inheritdoc IAlgebraLimitVirtualPool
    uint32 public immutable override desiredStartTimestamp;
    /// @inheritdoc IAlgebraLimitVirtualPool
    uint32 public override timeOutside;
    /// @inheritdoc IAlgebraLimitVirtualPool
    uint160 public override globalSecondsPerLiquidityCumulative;

    constructor(
        address _farmingCenterAddress,
        address _farmingAddress,
        address _pool,
        uint32 _desiredStartTimestamp,
        uint32 _desiredEndTimestamp
    ) AlgebraVirtualPoolBase(_farmingCenterAddress, _farmingAddress, _pool) {
        desiredStartTimestamp = _desiredStartTimestamp;
        desiredEndTimestamp = _desiredEndTimestamp;
        prevTimestamp = _desiredStartTimestamp;
    }

    /// @notice get seconds per liquidity inside range
    function getInnerSecondsPerLiquidity(
        int24 bottomTick,
        int24 topTick
    ) external view override returns (uint160 innerSecondsSpentPerLiquidity) {
        uint160 lowerSecondsPerLiquidity = ticks[bottomTick].outerSecondsPerLiquidity;
        uint160 upperSecondsPerLiquidity = ticks[topTick].outerSecondsPerLiquidity;

        if (globalTick < bottomTick) {
            return (lowerSecondsPerLiquidity - upperSecondsPerLiquidity);
        } else if (globalTick < topTick) {
            uint32 currentTimestamp = uint32(block.timestamp);
            if (currentTimestamp > desiredEndTimestamp) currentTimestamp = desiredEndTimestamp;
            uint160 _globalSecondsPerLiquidityCumulative = globalSecondsPerLiquidityCumulative;

            if (currentTimestamp > prevTimestamp) {
                uint128 _currentLiquidity = currentLiquidity;
                if (_currentLiquidity > 0) {
                    _globalSecondsPerLiquidityCumulative +=
                        (uint160(currentTimestamp - prevTimestamp) << 128) /
                        _currentLiquidity;
                }
            }

            return (_globalSecondsPerLiquidityCumulative - lowerSecondsPerLiquidity - upperSecondsPerLiquidity);
        } else {
            return (upperSecondsPerLiquidity - lowerSecondsPerLiquidity);
        }
    }

    /// @inheritdoc IAlgebraLimitVirtualPool
    function finish() external override onlyFarming returns (bool wasFinished, uint32 activeTime) {
        wasFinished = isFinished;
        if (!wasFinished) {
            isFinished = true;
            _increaseCumulative(desiredEndTimestamp);
        }
        activeTime = desiredEndTimestamp - timeOutside - desiredStartTimestamp;
    }

    function _crossTick(int24 nextTick) internal override returns (int128 liquidityDelta) {
        return ticks.cross(nextTick, 0, 0, globalSecondsPerLiquidityCumulative);
    }

    function _increaseCumulative(uint32 currentTimestamp) internal override returns (bool) {
        if (currentTimestamp <= desiredStartTimestamp) {
            return true;
        }
        if (currentTimestamp > desiredEndTimestamp) {
            return false; // return "not successful"
        }

        uint32 _previousTimestamp = prevTimestamp;
        if (currentTimestamp > _previousTimestamp) {
            uint128 _currentLiquidity = currentLiquidity;
            if (_currentLiquidity > 0) {
                globalSecondsPerLiquidityCumulative +=
                    (uint160(currentTimestamp - _previousTimestamp) << 128) /
                    _currentLiquidity;
                prevTimestamp = currentTimestamp;
            } else {
                timeOutside += currentTimestamp - _previousTimestamp;
                prevTimestamp = currentTimestamp;
            }
        }

        return true;
    }

    function _updateTick(
        int24 tick,
        int24 currentTick,
        int128 liquidityDelta,
        bool isTopTick
    ) internal override returns (bool updated) {
        return ticks.update(tick, currentTick, liquidityDelta, 0, 0, 0, isTopTick);
    }
}
