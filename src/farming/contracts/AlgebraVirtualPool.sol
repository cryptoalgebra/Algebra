// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import './libraries/TickManager.sol';
import './libraries/TickTable.sol';
import './libraries/LiquidityMath.sol';

import './interfaces/IAlgebraVirtualPool.sol';

contract AlgebraVirtualPool is IAlgebraVirtualPool {
    using TickTable for mapping(int16 => uint256);
    using TickManager for mapping(int24 => TickManager.Tick);

    // @inheritdoc IAlgebraVirtualPool
    address public immutable poolAddress;
    // @inheritdoc IAlgebraVirtualPool
    address public immutable farmingAddress;

    // @inheritdoc IAlgebraVirtualPool
    uint32 public override initTimestamp;
    // @inheritdoc IAlgebraVirtualPool
    uint32 public override endTimestamp;
    // @inheritdoc IAlgebraVirtualPool
    uint32 public override timeOutside;
    uint160 public override globalSecondsPerLiquidityCumulative;
    // @inheritdoc IAlgebraVirtualPool
    uint128 public override prevLiquidity;
    // @inheritdoc IAlgebraVirtualPool
    uint128 public override currentLiquidity;
    // @inheritdoc IAlgebraVirtualPool
    uint32 public override _prevTimestamp;
    // @inheritdoc IAlgebraVirtualPool
    int24 public override globalTick;

    // @inheritdoc IAlgebraVirtualPool
    mapping(int24 => TickManager.Tick) public override ticks;
    mapping(int16 => uint256) private tickTable;

    modifier onlyPool() {
        require(msg.sender == poolAddress, 'only the pool can call this function');
        _;
    }

    modifier onlyFarming() {
        require(msg.sender == farmingAddress, 'only farming can call this function');
        _;
    }

    constructor(address _poolAddress, address _farmingAddress) {
        poolAddress = _poolAddress;
        farmingAddress = _farmingAddress;
    }

    // @inheritdoc IAlgebraVirtualPool
    function finish(uint32 _endTimestamp, uint32 startTime) external override onlyFarming {
        uint32 currentTimestamp = _endTimestamp;
        uint32 previousTimestamp = _prevTimestamp;

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

    // @inheritdoc IAlgebraVirtualPool
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

    // @inheritdoc IAlgebraVirtualPool
    function cross(int24 nextTick, bool zeroForOne) external override onlyPool {
        if (ticks[nextTick].initialized) {
            int128 liquidityDelta = ticks.cross(nextTick, 0, 0, globalSecondsPerLiquidityCumulative, 0, 0);

            if (zeroForOne) liquidityDelta = -liquidityDelta;
            currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
        }
        globalTick = zeroForOne ? nextTick - 1 : nextTick;
    }

    // @inheritdoc IAlgebraVirtualPool
    function increaseCumulative(uint32 previousTimestamp, uint32 currentTimestamp) external override onlyPool {
        if (initTimestamp == 0) {
            initTimestamp = currentTimestamp;
            prevLiquidity = currentLiquidity;
        }
        previousTimestamp = previousTimestamp < initTimestamp ? initTimestamp : previousTimestamp;
        if (prevLiquidity > 0)
            globalSecondsPerLiquidityCumulative =
                globalSecondsPerLiquidityCumulative +
                ((uint160(currentTimestamp - previousTimestamp) << 128) / (prevLiquidity));
        else timeOutside += currentTimestamp - previousTimestamp;
        _prevTimestamp = currentTimestamp;
    }

    // @inheritdoc IAlgebraVirtualPool
    function processSwap() external override onlyPool {
        prevLiquidity = currentLiquidity;
    }

    // @inheritdoc IAlgebraVirtualPool
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
                ticks.clear(bottomTick);
            }
            if (flippedTop) {
                ticks.clear(topTick);
            }
        }
    }
}
