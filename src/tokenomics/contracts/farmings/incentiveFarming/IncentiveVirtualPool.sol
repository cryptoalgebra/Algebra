// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import 'algebra/contracts/libraries/TickManager.sol';
import 'algebra/contracts/libraries/TickTable.sol';

import './interfaces/IAlgebraIncentiveVirtualPool.sol';

import '../AlgebraVirtualPoolBase.sol';

contract IncentiveVirtualPool is AlgebraVirtualPoolBase, IAlgebraIncentiveVirtualPool {
    using TickTable for mapping(int16 => uint256);
    using TickManager for mapping(int24 => TickManager.Tick);

    /// @inheritdoc IAlgebraIncentiveVirtualPool
    uint32 public override initTimestamp;
    /// @inheritdoc IAlgebraIncentiveVirtualPool
    uint32 public override endTimestamp;

    /// @inheritdoc IAlgebraIncentiveVirtualPool
    uint32 public immutable override desiredEndTimestamp;
    /// @inheritdoc IAlgebraIncentiveVirtualPool
    uint32 public immutable override desiredStartTimestamp;

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

    /// @inheritdoc IAlgebraIncentiveVirtualPool
    function finish(uint32 _endTimestamp, uint32 startTime) external override onlyFarming {
        uint32 currentTimestamp = _endTimestamp;
        uint32 previousTimestamp = prevTimestamp;

        if (initTimestamp == 0) {
            initTimestamp = startTime;
            previousTimestamp = startTime;
        }

        previousTimestamp = previousTimestamp < initTimestamp ? initTimestamp : previousTimestamp;
        if (currentLiquidity > 0)
            globalSecondsPerLiquidityCumulative =
                globalSecondsPerLiquidityCumulative +
                ((uint160(currentTimestamp - previousTimestamp) << 128) / (currentLiquidity));
        else timeOutside += currentTimestamp - previousTimestamp;

        endTimestamp = _endTimestamp;
    }

    /// @inheritdoc IAlgebraIncentiveVirtualPool
    function getInnerSecondsPerLiquidity(int24 bottomTick, int24 topTick)
        external
        view
        override
        returns (
            uint160 innerSecondsSpentPerLiquidity,
            uint32 initTime,
            uint32 endTime
        )
    {
        innerSecondsSpentPerLiquidity = _getInnerSecondsPerLiquidity(bottomTick, topTick);
        initTime = initTimestamp;
        endTime = endTimestamp == 0 ? 0 : endTimestamp - timeOutside;
    }

    function _crossTick(int24 nextTick) internal override returns (int128 liquidityDelta) {
        return ticks.cross(nextTick, 0, 0, globalSecondsPerLiquidityCumulative, 0, 0);
    }

    function _increaseCumulative(uint32 currentTimestamp) internal override returns (Status) {
        if (desiredStartTimestamp >= currentTimestamp) {
            return Status.NOT_STARTED;
        }
        if (desiredEndTimestamp <= currentTimestamp) {
            return Status.NOT_EXIST;
        }
        uint32 previousTimestamp;

        if (initTimestamp == 0) {
            initTimestamp = currentTimestamp;
            previousTimestamp = currentTimestamp;
        } else {
            previousTimestamp = prevTimestamp;
        }

        if (currentTimestamp > previousTimestamp) {
            if (currentLiquidity > 0) {
                globalSecondsPerLiquidityCumulative += ((uint160(currentTimestamp - previousTimestamp) << 128) /
                    (currentLiquidity));
                prevTimestamp = currentTimestamp;
            } else {
                timeOutside += currentTimestamp - previousTimestamp;
                prevTimestamp = currentTimestamp;
            }
        }

        return Status.ACTIVE;
    }

    function _updateTick(
        int24 tick,
        int24 currentTick,
        int128 liquidityDelta,
        bool isTopTick
    ) internal override returns (bool updated) {
        return ticks.update(tick, currentTick, liquidityDelta, 0, 0, 0, 0, 0, isTopTick);
    }
}
