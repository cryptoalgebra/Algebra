// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import 'algebra/contracts/libraries/TickManager.sol';
import 'algebra/contracts/libraries/TickTable.sol';
import 'algebra/contracts/libraries/LiquidityMath.sol';

import 'algebra/contracts/libraries/FullMath.sol';
import 'algebra/contracts/libraries/Constants.sol';

import './interfaces/IAlgebraEternalVirtualPool.sol';

contract EternalVirtualPool is IAlgebraEternalVirtualPool {
    using TickTable for mapping(int16 => uint256);
    using TickManager for mapping(int24 => TickManager.Tick);

    // @inheritdoc IAlgebraEternalVirtualPool
    address public immutable farmingCenterAddress;
    // @inheritdoc IAlgebraEternalVirtualPool
    address public immutable farmingAddress;
    address public immutable pool;

    // @inheritdoc IAlgebraEternalVirtualPool
    uint128 public override currentLiquidity;
    // @inheritdoc IAlgebraEternalVirtualPool
    int24 public override globalTick;
    // @inheritdoc IAlgebraEternalVirtualPool
    uint32 public override timeOutside;

    // @inheritdoc IAlgebraEternalVirtualPool
    uint128 public override prevLiquidity;

    uint160 public override globalSecondsPerLiquidityCumulative;

    // @inheritdoc IAlgebraEternalVirtualPool
    uint32 public override prevTimestamp;

    // @inheritdoc IAlgebraEternalVirtualPool
    mapping(int24 => TickManager.Tick) public override ticks;
    mapping(int16 => uint256) private tickTable;

    uint128 public rewardRate0;
    uint128 public rewardRate1;

    uint256 public rewardReserve0;
    uint256 public rewardReserve1;

    uint256 public totalRewardGrowth0;
    uint256 public totalRewardGrowth1;

    modifier onlyFarmingCenter() {
        require(
            msg.sender == farmingCenterAddress || msg.sender == farmingAddress || msg.sender == pool,
            'only pool can call this function'
        );
        _;
    }

    modifier onlyFarming() {
        require(msg.sender == farmingAddress, 'only farming can call this function');
        _;
    }

    constructor(
        address _farmingCenterAddress,
        address _farmingAddress,
        address _pool
    ) {
        farmingCenterAddress = _farmingCenterAddress;
        farmingAddress = _farmingAddress;
        pool = _pool;
        prevTimestamp = uint32(block.timestamp);
    }

    function addRewards(uint256 token0Amount, uint256 token1Amount) external override onlyFarming {
        _increaseCumulative(uint32(block.timestamp));

        if (token0Amount > 0) {
            rewardReserve0 += token0Amount;
        }

        if (token1Amount > 0) {
            rewardReserve1 += token1Amount;
        }
    }

    function setRates(uint128 rate0, uint128 rate1) external override onlyFarming {
        _increaseCumulative(uint32(block.timestamp));
        rewardRate0 = rate0;
        rewardRate1 = rate1;
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
    function cross(int24 nextTick, bool zeroToOne) external override onlyFarmingCenter {
        if (ticks[nextTick].initialized) {
            int128 liquidityDelta = ticks.cross(
                nextTick,
                totalRewardGrowth0,
                totalRewardGrowth1,
                globalSecondsPerLiquidityCumulative,
                0,
                0
            );

            if (zeroToOne) liquidityDelta = -liquidityDelta;
            currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
        }
        globalTick = zeroToOne ? nextTick - 1 : nextTick;
    }

    // @inheritdoc IAlgebraEternalVirtualPool
    function increaseCumulative(uint32 currentTimestamp) external override onlyFarmingCenter returns (Status) {
        return _increaseCumulative(currentTimestamp);
    }

    function _increaseCumulative(uint32 currentTimestamp) private returns (Status) {
        uint128 _prevLiquidity;
        if ((_prevLiquidity = prevLiquidity) > 0) {
            uint32 previousTimestamp = prevTimestamp;
            if (currentTimestamp > previousTimestamp) {
                uint32 delta = currentTimestamp - previousTimestamp;

                uint256 _rewardReserve0;
                if ((_rewardReserve0 = rewardReserve0) > 0) {
                    uint256 reward0 = rewardRate0 * delta;
                    if (reward0 > _rewardReserve0) {
                        reward0 = _rewardReserve0;
                    }
                    rewardReserve0 = _rewardReserve0 - reward0;
                    totalRewardGrowth0 += FullMath.mulDiv(reward0, Constants.Q128, _prevLiquidity);
                }

                uint256 _rewardReserve1;
                if ((_rewardReserve1 = rewardReserve1) > 0) {
                    uint256 reward1 = rewardRate1 * delta;
                    if (reward1 > _rewardReserve1) {
                        reward1 = _rewardReserve1;
                    }

                    rewardReserve1 = _rewardReserve1 - reward1;
                    totalRewardGrowth1 += FullMath.mulDiv(reward1, Constants.Q128, _prevLiquidity);
                }
            }
            globalSecondsPerLiquidityCumulative += ((uint160(currentTimestamp - previousTimestamp) << 128) /
                (_prevLiquidity));
            prevTimestamp = currentTimestamp;
        } else {
            timeOutside += currentTimestamp - prevTimestamp;
            prevTimestamp = currentTimestamp;
        }

        return Status.ACTIVE;
    }

    // @inheritdoc IAlgebraEternalVirtualPool
    function processSwap() external override onlyFarmingCenter {
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
            _increaseCumulative(currentTimestamp);
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
                delete ticks[bottomTick];
            }
            if (flippedTop) {
                delete ticks[topTick];
            }
        }
    }
}
