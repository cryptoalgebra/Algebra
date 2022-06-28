// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import 'algebra/contracts/libraries/TickManager.sol';
import 'algebra/contracts/libraries/TickTable.sol';
import 'algebra/contracts/libraries/LiquidityMath.sol';

import './interfaces/IAlgebraIncentiveVirtualPool.sol';

contract IncentiveVirtualPool is IAlgebraIncentiveVirtualPool {
    using TickTable for mapping(int16 => uint256);
    using TickManager for mapping(int24 => TickManager.Tick);

    address public immutable farmingCenterAddress;

    address public immutable farmingAddress;

    address public immutable pool;

    /// @inheritdoc IAlgebraIncentiveVirtualPool
    uint32 public immutable override desiredEndTimestamp;
    /// @inheritdoc IAlgebraIncentiveVirtualPool
    uint32 public immutable override desiredStartTimestamp;

    /// @inheritdoc IAlgebraIncentiveVirtualPool
    uint32 public override initTimestamp;
    /// @inheritdoc IAlgebraIncentiveVirtualPool
    uint32 public override endTimestamp;
    /// @inheritdoc IAlgebraIncentiveVirtualPool
    uint32 public override timeOutside;
    /// @inheritdoc IAlgebraIncentiveVirtualPool
    uint128 public override prevLiquidity;
    /// @inheritdoc IAlgebraIncentiveVirtualPool
    uint128 public override currentLiquidity;
    /// @inheritdoc IAlgebraIncentiveVirtualPool
    uint160 public override globalSecondsPerLiquidityCumulative;
    /// @inheritdoc IAlgebraIncentiveVirtualPool
    uint32 public override prevTimestamp;
    /// @inheritdoc IAlgebraIncentiveVirtualPool
    int24 public override globalTick;

    /// @inheritdoc IAlgebraIncentiveVirtualPool
    mapping(int24 => TickManager.Tick) public override ticks;
    mapping(int16 => uint256) private tickTable;

    modifier onlyFarmingCenter() {
        require(msg.sender == farmingCenterAddress || msg.sender == pool, 'only the pool can call this function');
        _;
    }

    modifier onlyFarming() {
        require(msg.sender == farmingAddress, 'only farming can call this function');
        _;
    }

    constructor(
        address _farmingCenterAddress,
        address _farmingAddress,
        address _pool,
        uint32 _desiredStartTimestamp,
        uint32 _desiredEndTimestamp
    ) {
        farmingCenterAddress = _farmingCenterAddress;
        farmingAddress = _farmingAddress;
        desiredStartTimestamp = _desiredStartTimestamp;
        pool = _pool;
        desiredEndTimestamp = _desiredEndTimestamp;

        prevTimestamp = _desiredStartTimestamp;
    }

    /// @inheritdoc IAlgebraIncentiveVirtualPool
    function finish(uint32 _endTimestamp, uint32 startTime) external override onlyFarming {
        uint32 currentTimestamp = _endTimestamp;
        uint32 previousTimestamp = prevTimestamp;

        if (initTimestamp == 0) {
            initTimestamp = startTime;
            prevLiquidity = currentLiquidity;
            previousTimestamp = startTime;
        }

        previousTimestamp = previousTimestamp < initTimestamp ? initTimestamp : previousTimestamp;
        if (prevLiquidity > 0)
            globalSecondsPerLiquidityCumulative =
                globalSecondsPerLiquidityCumulative +
                ((uint160(currentTimestamp - previousTimestamp) << 128) / (prevLiquidity));
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
        uint160 lowerSecondsPerLiquidity = ticks[bottomTick].outerSecondsPerLiquidity;
        uint160 upperSecondsPerLiquidity = ticks[topTick].outerSecondsPerLiquidity;

        if (globalTick < bottomTick) {
            return (
                lowerSecondsPerLiquidity - upperSecondsPerLiquidity,
                initTimestamp,
                endTimestamp == 0 ? 0 : endTimestamp - timeOutside
            );
        } else if (globalTick < topTick) {
            return (
                globalSecondsPerLiquidityCumulative - lowerSecondsPerLiquidity - upperSecondsPerLiquidity,
                initTimestamp,
                endTimestamp == 0 ? 0 : endTimestamp - timeOutside
            );
        } else {
            return (
                upperSecondsPerLiquidity - lowerSecondsPerLiquidity,
                initTimestamp,
                endTimestamp == 0 ? 0 : endTimestamp - timeOutside
            );
        }
    }

    /// @inheritdoc IAlgebraVirtualPool
    function cross(int24 nextTick, bool zeroToOne) external override onlyFarmingCenter {
        if (ticks[nextTick].initialized) {
            int128 liquidityDelta = ticks.cross(nextTick, 0, 0, globalSecondsPerLiquidityCumulative, 0, 0);

            if (zeroToOne) liquidityDelta = -liquidityDelta;
            currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
        }
        globalTick = zeroToOne ? nextTick - 1 : nextTick;
    }

    /// @inheritdoc IAlgebraVirtualPool
    function increaseCumulative(uint32 currentTimestamp) external override onlyFarmingCenter returns (Status) {
        if (desiredStartTimestamp >= currentTimestamp) {
            return Status.NOT_STARTED;
        }
        if (desiredEndTimestamp <= currentTimestamp) {
            return Status.NOT_EXIST;
        }
        uint32 previousTimestamp;

        if (initTimestamp == 0) {
            initTimestamp = currentTimestamp;
            prevLiquidity = currentLiquidity;
            previousTimestamp = currentTimestamp;
        } else {
            previousTimestamp = prevTimestamp;
        }

        if (prevLiquidity > 0) {
            globalSecondsPerLiquidityCumulative += ((uint160(currentTimestamp - previousTimestamp) << 128) /
                (prevLiquidity));
            prevTimestamp = currentTimestamp;
        } else {
            timeOutside += currentTimestamp - previousTimestamp;
            prevTimestamp = currentTimestamp;
        }

        return Status.ACTIVE;
    }

    /// @inheritdoc IAlgebraVirtualPool
    function processSwap() external override onlyFarmingCenter {
        prevLiquidity = currentLiquidity;
    }

    /// @inheritdoc IAlgebraIncentiveVirtualPool
    function applyLiquidityDeltaToPosition(
        int24 bottomTick,
        int24 topTick,
        int128 liquidityDelta,
        int24 tick
    ) external override onlyFarming {
        // if we need to update the ticks, do it
        bool flippedBottom;
        bool flippedTop;
        globalTick = tick;
        if (liquidityDelta != 0) {
            if (globalTick >= bottomTick && globalTick < topTick) {
                currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
            }

            if (ticks.update(bottomTick, globalTick, liquidityDelta, 0, 0, 0, 0, 0, false)) {
                flippedBottom = true;
                tickTable.toggleTick(bottomTick);
            }

            if (ticks.update(topTick, globalTick, liquidityDelta, 0, 0, 0, 0, 0, true)) {
                flippedTop = true;
                tickTable.toggleTick(topTick);
            }
        }

        // clear any tick data that is no longer needed
        if (liquidityDelta < 0) {
            if (flippedBottom) {
                delete ticks[bottomTick];
            }
            if (flippedTop) {
                delete ticks[topTick];
            }
        }
    }
}
