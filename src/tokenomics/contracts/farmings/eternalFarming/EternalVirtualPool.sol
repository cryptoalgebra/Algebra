// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import '@cryptoalgebra/core/contracts/libraries/FullMath.sol';
import '@cryptoalgebra/core/contracts/libraries/LowGasSafeMath.sol';

import '../../libraries/TickManager.sol';
import '../../libraries/VirtualPoolConstants.sol';
import './interfaces/IAlgebraEternalVirtualPool.sol';

import '../AlgebraVirtualPoolBase.sol';

contract EternalVirtualPool is AlgebraVirtualPoolBase, IAlgebraEternalVirtualPool {
    using TickManager for mapping(int24 => TickManager.Tick);
    using LowGasSafeMath for uint256;

    uint128 public rewardRate0;
    uint128 public rewardRate1;

    uint256 public rewardReserve0;
    uint256 public rewardReserve1;

    uint256 public totalRewardGrowth0;
    uint256 public totalRewardGrowth1;

    constructor(
        address _farmingCenterAddress,
        address _farmingAddress,
        address _pool
    ) AlgebraVirtualPoolBase(_farmingCenterAddress, _farmingAddress, _pool) {
        prevTimestamp = uint32(block.timestamp);
    }

    function addRewards(uint256 token0Amount, uint256 token1Amount) external override onlyFarming {
        _increaseCumulative(uint32(block.timestamp));
        if (token0Amount > 0) rewardReserve0 = rewardReserve0.add(token0Amount);
        if (token1Amount > 0) rewardReserve1 = rewardReserve1.add(token1Amount);
    }

    // @inheritdoc IAlgebraEternalVirtualPool
    function setRates(uint128 rate0, uint128 rate1) external override onlyFarming {
        _increaseCumulative(uint32(block.timestamp));
        (rewardRate0, rewardRate1) = (rate0, rate1);
    }

    // @inheritdoc IAlgebraEternalVirtualPool
    function getInnerRewardsGrowth(int24 bottomTick, int24 topTick)
        external
        view
        override
        returns (uint256 rewardGrowthInside0, uint256 rewardGrowthInside1)
    {
        uint32 timeDelta = uint32(block.timestamp) - prevTimestamp;

        uint256 _totalRewardGrowth0 = totalRewardGrowth0;
        uint256 _totalRewardGrowth1 = totalRewardGrowth1;

        if (timeDelta > 0) {
            uint128 _currentLiquidity = currentLiquidity;
            if (_currentLiquidity > 0) {
                (uint256 _rewardRate0, uint256 _rewardRate1) = (rewardRate0, rewardRate1);
                uint256 _rewardReserve0 = _rewardRate0 > 0 ? rewardReserve0 : 0;
                uint256 _rewardReserve1 = _rewardRate1 > 0 ? rewardReserve1 : 0;

                if (_rewardReserve0 > 0) {
                    uint256 reward0 = _rewardRate0 * timeDelta;
                    if (reward0 > _rewardReserve0) reward0 = _rewardReserve0;
                    _totalRewardGrowth0 += FullMath.mulDiv(reward0, VirtualPoolConstants.Q128, _currentLiquidity);
                }

                if (_rewardReserve1 > 0) {
                    uint256 reward1 = _rewardRate1 * timeDelta;
                    if (reward1 > _rewardReserve1) reward1 = _rewardReserve1;
                    _totalRewardGrowth1 += FullMath.mulDiv(reward1, VirtualPoolConstants.Q128, _currentLiquidity);
                }
            }
        }

        return ticks.getInnerFeeGrowth(bottomTick, topTick, globalTick, _totalRewardGrowth0, _totalRewardGrowth1);
    }

    function _crossTick(int24 nextTick) internal override returns (int128 liquidityDelta) {
        return ticks.cross(nextTick, totalRewardGrowth0, totalRewardGrowth1, globalSecondsPerLiquidityCumulative, 0, 0);
    }

    function _increaseCumulative(uint32 currentTimestamp) internal override returns (bool) {
        uint256 timeDelta = currentTimestamp - prevTimestamp; // safe until timedelta > 136 years
        if (timeDelta == 0) return true; // only once per block

        uint256 _currentLiquidity = currentLiquidity; // currentLiquidity is uint128
        if (_currentLiquidity > 0) {
            (uint256 _rewardRate0, uint256 _rewardRate1) = (rewardRate0, rewardRate1);
            uint256 _rewardReserve0 = _rewardRate0 > 0 ? rewardReserve0 : 0;
            uint256 _rewardReserve1 = _rewardRate1 > 0 ? rewardReserve1 : 0;

            if (_rewardReserve0 > 0) {
                uint256 reward0 = _rewardRate0 * timeDelta;
                if (reward0 > _rewardReserve0) reward0 = _rewardReserve0;
                rewardReserve0 = _rewardReserve0 - reward0;
                totalRewardGrowth0 += FullMath.mulDiv(reward0, VirtualPoolConstants.Q128, _currentLiquidity);
            }

            if (_rewardReserve1 > 0) {
                uint256 reward1 = _rewardRate1 * timeDelta;
                if (reward1 > _rewardReserve1) reward1 = _rewardReserve1;
                rewardReserve1 = _rewardReserve1 - reward1;
                totalRewardGrowth1 += FullMath.mulDiv(reward1, VirtualPoolConstants.Q128, _currentLiquidity);
            }
            globalSecondsPerLiquidityCumulative += (uint160(timeDelta) << 128) / uint160(_currentLiquidity);
            prevTimestamp = currentTimestamp; // duplicated for gas optimization
        } else {
            timeOutside += uint32(timeDelta);
            prevTimestamp = currentTimestamp; // duplicated for gas optimization
        }

        return true;
    }

    function _updateTick(
        int24 tick,
        int24 currentTick,
        int128 liquidityDelta,
        bool isTopTick
    ) internal override returns (bool updated) {
        return
            ticks.update(tick, currentTick, liquidityDelta, totalRewardGrowth0, totalRewardGrowth1, 0, 0, 0, isTopTick);
    }
}
