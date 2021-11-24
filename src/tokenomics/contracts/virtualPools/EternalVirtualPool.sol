// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '../libraries/TickManager.sol';
import '../libraries/TickTable.sol';
import '../libraries/LiquidityMath.sol';

import 'algebra/contracts/libraries/FullMath.sol';
import 'algebra/contracts/libraries/Constants.sol';

import '../interfaces/IAlgebraEternalVirtualPool.sol';

contract EternalVirtualPool is IAlgebraEternalVirtualPool {
    using TickTable for mapping(int16 => uint256);
    using TickManager for mapping(int24 => TickManager.Tick);

    // @inheritdoc IAlgebraEternalVirtualPool
    address public immutable poolAddress;
    // @inheritdoc IAlgebraEternalVirtualPool
    address public immutable farmingAddress;

    // @inheritdoc IAlgebraEternalVirtualPool
    uint32 public override timeOutside;
    uint160 public override globalSecondsPerLiquidityCumulative;
    // @inheritdoc IAlgebraEternalVirtualPool
    uint128 public override prevLiquidity;
    // @inheritdoc IAlgebraEternalVirtualPool
    uint128 public override currentLiquidity;
    // @inheritdoc IAlgebraEternalVirtualPool
    uint32 public override prevTimestamp;
    // @inheritdoc IAlgebraEternalVirtualPool
    int24 public override globalTick;

    // @inheritdoc IAlgebraEternalVirtualPool
    mapping(int24 => TickManager.Tick) public override ticks;
    mapping(int16 => uint256) private tickTable;

    uint128 public rewardRate0 = 10;
    uint128 public rewardRate1 = 50;

    uint256 public rewardReserve0 = 10000;
    uint256 public rewardReserve1 = 200;

    uint256 public totalRewardGrowth0;
    uint256 public totalRewardGrowth1;

    modifier onlyPool() {
        require(msg.sender == poolAddress || msg.sender == farmingAddress, 'only the pool can call this function');
        _;
    }

    modifier onlyFarming() {
        require(msg.sender == farmingAddress, 'only farming can call this function');
        _;
    }

    constructor(address _poolAddress, address _farmingAddress) {
        poolAddress = _poolAddress;
        farmingAddress = _farmingAddress;
        prevTimestamp = uint32(block.timestamp);
    }

    // @inheritdoc IAlgebraEternalVirtualPool
    function getInnerSecondsPerLiquidity(int24 bottomTick, int24 topTick)
        external
        view
        override
        returns (uint160 innerSecondsSpentPerLiquidity)
    {
        uint160 lowerSecondsPerLiquidity = ticks[bottomTick].outerSecondsPerLiquidity;
        uint160 upperSecondsPerLiquidity = ticks[topTick].outerSecondsPerLiquidity;

        if (globalTick < bottomTick) {
            return (lowerSecondsPerLiquidity - upperSecondsPerLiquidity);
        } else if (globalTick < topTick) {
            return (globalSecondsPerLiquidityCumulative - lowerSecondsPerLiquidity - upperSecondsPerLiquidity);
        } else {
            return (upperSecondsPerLiquidity - lowerSecondsPerLiquidity);
        }
    }

    // @inheritdoc IAlgebraEternalVirtualPool
    function getInnerRewardsGrowth(int24 bottomTick, int24 topTick)
        external
        view
        override
        returns (uint256 rewardGrowthInside0, uint256 rewardGrowthInside1)
    {
        (rewardGrowthInside0, rewardGrowthInside1) = ticks.getInnerFeeGrowth(
            bottomTick,
            topTick,
            globalTick,
            totalRewardGrowth0,
            totalRewardGrowth1
        );
    }

    // @inheritdoc IAlgebraEternalVirtualPool
    function cross(int24 nextTick, bool zeroForOne) external override onlyPool {
        if (ticks[nextTick].initialized) {
            int128 liquidityDelta = ticks.cross(
                nextTick,
                totalRewardGrowth0,
                totalRewardGrowth1,
                globalSecondsPerLiquidityCumulative,
                0,
                0
            );

            if (zeroForOne) liquidityDelta = -liquidityDelta;
            currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
        }
        globalTick = zeroForOne ? nextTick - 1 : nextTick;
    }

    // @inheritdoc IAlgebraEternalVirtualPool
    function increaseCumulative(uint32 currentTimestamp) public override onlyPool returns (Status) {
        uint32 previousTimestamp = prevTimestamp;
        if (currentTimestamp > previousTimestamp && prevLiquidity > 0) {
            uint32 delta = currentTimestamp - previousTimestamp;

            if (rewardReserve0 > 0) {
                uint256 reward0 = rewardRate0 * delta;
                if (reward0 > rewardReserve0) {
                    reward0 = rewardReserve0;
                }
                rewardReserve0 -= reward0;
                totalRewardGrowth0 += FullMath.mulDiv(reward0, Constants.Q128, prevLiquidity);
            }

            if (rewardReserve1 > 0) {
                uint256 reward1 = rewardRate1 * delta;
                if (reward1 > rewardReserve1) {
                    reward1 = rewardReserve1;
                }

                rewardReserve1 -= reward1;
                totalRewardGrowth1 += FullMath.mulDiv(reward1, Constants.Q128, prevLiquidity);
            }
        }
        if (prevLiquidity > 0)
            globalSecondsPerLiquidityCumulative =
                globalSecondsPerLiquidityCumulative +
                ((uint160(currentTimestamp - previousTimestamp) << 128) / (prevLiquidity));
        else timeOutside += currentTimestamp - previousTimestamp;
        prevTimestamp = currentTimestamp;

        return Status.ACTIVE;
    }

    // @inheritdoc IAlgebraEternalVirtualPool
    function processSwap() external override onlyPool {
        prevLiquidity = currentLiquidity;
    }

    // @inheritdoc IAlgebraEternalVirtualPool
    function applyLiquidityDeltaToPosition(
        uint32 currentTimestamp,
        int24 bottomTick,
        int24 topTick,
        int128 liquidityDelta,
        int24 tick
    ) external override onlyFarming {
        // if we need to update the ticks, do it
        bool flippedBottom;
        bool flippedTop;
        globalTick = tick;
        prevLiquidity = currentLiquidity;
        if (currentTimestamp > prevTimestamp) {
            increaseCumulative(currentTimestamp);
        }
        if (liquidityDelta != 0) {
            if (
                ticks.update(
                    bottomTick,
                    globalTick,
                    liquidityDelta,
                    totalRewardGrowth0,
                    totalRewardGrowth1,
                    0,
                    0,
                    0,
                    false
                )
            ) {
                flippedBottom = true;
                tickTable.toggleTick(bottomTick);
            }

            if (
                ticks.update(topTick, globalTick, liquidityDelta, totalRewardGrowth0, totalRewardGrowth1, 0, 0, 0, true)
            ) {
                flippedTop = true;
                tickTable.toggleTick(topTick);
            }

            if (globalTick >= bottomTick && globalTick < topTick) {
                currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
                prevLiquidity = currentLiquidity;
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
