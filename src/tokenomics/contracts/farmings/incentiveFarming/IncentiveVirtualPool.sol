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
    }

    /// @inheritdoc IAlgebraIncentiveVirtualPool
    function finish() external override onlyFarming {
        uint32 previousTimestamp;
        uint32 _initTimestamp = initTimestamp;
        endTimestamp = desiredEndTimestamp;

        if (_initTimestamp == 0) {
            initTimestamp = desiredStartTimestamp;
            previousTimestamp = desiredStartTimestamp;
        } else {
            previousTimestamp = prevTimestamp;
            if (previousTimestamp < _initTimestamp) previousTimestamp = _initTimestamp;
        }

        if (currentLiquidity > 0)
            globalSecondsPerLiquidityCumulative +=
                (uint160(desiredEndTimestamp - previousTimestamp) << 128) /
                currentLiquidity;
        else timeOutside += desiredEndTimestamp - previousTimestamp;
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
        endTime = endTimestamp;
        if (endTime != 0) endTime -= timeOutside;
    }

    function _crossTick(int24 nextTick) internal override returns (int128 liquidityDelta) {
        return ticks.cross(nextTick, 0, 0, globalSecondsPerLiquidityCumulative, 0, 0);
    }

    function _increaseCumulative(uint32 currentTimestamp) internal override returns (Status) {
        if (currentTimestamp <= desiredStartTimestamp) {
            return Status.NOT_STARTED;
        }
        if (currentTimestamp >= desiredEndTimestamp) {
            return Status.NOT_EXIST;
        }

        uint32 _previousTimestamp = prevTimestamp;
        if (_previousTimestamp == 0) {
            initTimestamp = currentTimestamp;
            prevTimestamp = currentTimestamp;
            return Status.ACTIVE;
        }

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
