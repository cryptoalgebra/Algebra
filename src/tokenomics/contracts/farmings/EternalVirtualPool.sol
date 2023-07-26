// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/core/contracts/libraries/FullMath.sol';
import '@cryptoalgebra/core/contracts/libraries/Constants.sol';
import '@cryptoalgebra/core/contracts/libraries/TickMath.sol';
import '@cryptoalgebra/core/contracts/libraries/LiquidityMath.sol';
import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';

import '../libraries/VirtualTickManagement.sol';

import '../base/VirtualTickStructure.sol';

/// @title Algebra eternal virtual pool
/// @notice used to track active liquidity in farming and distribute rewards
contract EternalVirtualPool is VirtualTickStructure {
  using VirtualTickManagement for mapping(int24 => VirtualTickManagement.Tick);

  address public immutable farmingAddress;
  address public immutable pool;

  /// @inheritdoc IAlgebraEternalVirtualPool
  uint128 public override currentLiquidity;
  /// @inheritdoc IAlgebraEternalVirtualPool
  int24 public override globalTick;
  /// @inheritdoc IAlgebraEternalVirtualPool
  uint32 public override prevTimestamp;

  int24 internal globalPrevInitializedTick;

  uint128 internal rewardRate0;
  uint128 internal rewardRate1;

  uint128 internal rewardReserve0;
  uint128 internal rewardReserve1;

  uint256 public totalRewardGrowth0 = 1;
  uint256 public totalRewardGrowth1 = 1;

  modifier onlyFromFarming() {
    _checkIsFromFarming();
    _;
  }

  constructor(address _farmingAddress, address _pool) {
    globalPrevInitializedTick = TickMath.MIN_TICK;
    farmingAddress = _farmingAddress;
    pool = _pool;
    prevTimestamp = uint32(block.timestamp);
  }

  // @inheritdoc IAlgebraEternalVirtualPool
  function rewardReserves() external view override returns (uint128 reserve0, uint128 reserve1) {
    return (rewardReserve0, rewardReserve1);
  }

  // @inheritdoc IAlgebraEternalVirtualPool
  function rewardRates() external view override returns (uint128 rate0, uint128 rate1) {
    return (rewardRate0, rewardRate1);
  }

  // @inheritdoc IAlgebraEternalVirtualPool
  function getInnerRewardsGrowth(
    int24 bottomTick,
    int24 topTick
  ) external view override returns (uint256 rewardGrowthInside0, uint256 rewardGrowthInside1) {
    unchecked {
      // check if ticks are initialized
      if (ticks[bottomTick].prevTick == ticks[bottomTick].nextTick) revert IAlgebraPoolErrors.tickIsNotInitialized();
      if (ticks[topTick].prevTick == ticks[topTick].nextTick) revert IAlgebraPoolErrors.tickIsNotInitialized();

      uint32 timeDelta = uint32(block.timestamp) - prevTimestamp;
      (uint256 _totalRewardGrowth0, uint256 _totalRewardGrowth1) = (totalRewardGrowth0, totalRewardGrowth1);

      if (timeDelta > 0) {
        // update rewards
        uint128 _currentLiquidity = currentLiquidity;
        if (_currentLiquidity > 0) {
          (uint256 reward0, uint256 reward1) = (rewardRate0 * timeDelta, rewardRate1 * timeDelta);
          (uint256 _rewardReserve0, uint256 _rewardReserve1) = (rewardReserve0, rewardReserve1);

          if (reward0 > _rewardReserve0) reward0 = _rewardReserve0;
          if (reward1 > _rewardReserve1) reward1 = _rewardReserve1;

          if (reward0 > 0) _totalRewardGrowth0 += FullMath.mulDiv(reward0, Constants.Q128, _currentLiquidity);
          if (reward1 > 0) _totalRewardGrowth1 += FullMath.mulDiv(reward1, Constants.Q128, _currentLiquidity);
        }
      }

      return ticks.getInnerFeeGrowth(bottomTick, topTick, globalTick, _totalRewardGrowth0, _totalRewardGrowth1);
    }
  }

  // @inheritdoc IAlgebraEternalVirtualPool
  function addRewards(uint128 token0Amount, uint128 token1Amount) external override onlyFromFarming {
    _applyRewardsDelta(true, token0Amount, token1Amount);
  }

  // @inheritdoc IAlgebraEternalVirtualPool
  function decreaseRewards(uint128 token0Amount, uint128 token1Amount) external override onlyFromFarming {
    _applyRewardsDelta(false, token0Amount, token1Amount);
  }

  /// @inheritdoc IAlgebraVirtualPool
  function crossTo(int24 targetTick, bool zeroToOne) external override returns (bool) {
    if (msg.sender != IAlgebraPool(pool).plugin()) revert onlyPool();
    _distributeRewards();

    int24 previousTick = globalPrevInitializedTick;
    uint128 _currentLiquidity = currentLiquidity;
    int24 _globalTick = globalTick;

    (uint256 rewardGrowth0, uint256 rewardGrowth1) = (totalRewardGrowth0, totalRewardGrowth1);
    // The set of active ticks in the virtual pool must be a subset of the active ticks in the real pool
    // so this loop will cross no more ticks than the real pool
    if (zeroToOne) {
      while (_globalTick != TickMath.MIN_TICK) {
        if (targetTick >= previousTick) break;
        unchecked {
          _currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, -ticks.cross(previousTick, rewardGrowth0, rewardGrowth1));
          _globalTick = previousTick - 1; // safe since tick index range is narrower than the data type
          previousTick = ticks[previousTick].prevTick;
          if (_globalTick < TickMath.MIN_TICK) _globalTick = TickMath.MIN_TICK;
        }
      }
    } else {
      while (_globalTick != TickMath.MAX_TICK - 1) {
        int24 nextTick = ticks[previousTick].nextTick;
        if (targetTick < nextTick) break;

        _currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, ticks.cross(nextTick, rewardGrowth0, rewardGrowth1));
        (_globalTick, previousTick) = (nextTick, nextTick);
      }
    }

    globalTick = targetTick;
    currentLiquidity = _currentLiquidity;
    globalPrevInitializedTick = previousTick;
    return true;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function distributeRewards() external override onlyFromFarming {
    _distributeRewards();
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function applyLiquidityDeltaToPosition(
    uint32 currentTimestamp,
    int24 bottomTick,
    int24 topTick,
    int128 liquidityDelta,
    int24 currentTick
  ) external override onlyFromFarming {
    globalTick = currentTick;

    if (currentTimestamp > prevTimestamp) {
      _distributeRewards();
    }

    if (liquidityDelta != 0) {
      // if we need to update the ticks, do it
      bool flippedBottom;
      bool flippedTop;

      if (_updateTick(bottomTick, currentTick, liquidityDelta, false)) {
        flippedBottom = true;
      }

      if (_updateTick(topTick, currentTick, liquidityDelta, true)) {
        flippedTop = true;
      }

      if (currentTick >= bottomTick && currentTick < topTick) {
        currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
      }

      if (flippedBottom || flippedTop) {
        int24 previousTick = globalPrevInitializedTick;
        if (flippedBottom) {
          previousTick = _insertOrRemoveTick(bottomTick, currentTick, previousTick, liquidityDelta < 0);
        }
        if (flippedTop) {
          previousTick = _insertOrRemoveTick(topTick, currentTick, previousTick, liquidityDelta < 0);
        }
        globalPrevInitializedTick = previousTick;
      }
    }
  }

  // @inheritdoc IAlgebraEternalVirtualPool
  function setRates(uint128 rate0, uint128 rate1) external override onlyFromFarming {
    _distributeRewards();
    (rewardRate0, rewardRate1) = (rate0, rate1);
  }

  function _checkIsFromFarming() internal view {
    if (msg.sender != farmingAddress) revert onlyFarming();
  }

  function _applyRewardsDelta(bool add, uint128 token0Delta, uint128 token1Delta) private {
    _distributeRewards();
    if (token0Delta | token1Delta != 0) {
      (uint128 _rewardReserve0, uint128 _rewardReserve1) = (rewardReserve0, rewardReserve1);
      _rewardReserve0 = add ? _rewardReserve0 + token0Delta : _rewardReserve0 - token0Delta;
      _rewardReserve1 = add ? _rewardReserve1 + token1Delta : _rewardReserve1 - token1Delta;
      (rewardReserve0, rewardReserve1) = (_rewardReserve0, _rewardReserve1);
    }
  }

  function _distributeRewards() internal {
    unchecked {
      uint256 timeDelta = uint32(block.timestamp) - prevTimestamp; // safe until timedelta > 136 years
      if (timeDelta == 0) return; // only once per block

      uint256 _currentLiquidity = currentLiquidity; // currentLiquidity is uint128
      if (_currentLiquidity > 0) {
        (uint256 reward0, uint256 reward1) = (rewardRate0 * timeDelta, rewardRate1 * timeDelta);
        (uint128 _rewardReserve0, uint128 _rewardReserve1) = (rewardReserve0, rewardReserve1);

        if (reward0 > _rewardReserve0) reward0 = _rewardReserve0;
        if (reward1 > _rewardReserve1) reward1 = _rewardReserve1;

        if (reward0 | reward1 != 0) {
          _rewardReserve0 = uint128(_rewardReserve0 - reward0);
          _rewardReserve1 = uint128(_rewardReserve1 - reward1);

          if (reward0 > 0) totalRewardGrowth0 += FullMath.mulDiv(reward0, Constants.Q128, _currentLiquidity);
          if (reward1 > 0) totalRewardGrowth1 += FullMath.mulDiv(reward1, Constants.Q128, _currentLiquidity);

          (rewardReserve0, rewardReserve1) = (_rewardReserve0, _rewardReserve1);
        }
      }
    }

    prevTimestamp = uint32(block.timestamp);
    return;
  }

  function _updateTick(int24 tick, int24 currentTick, int128 liquidityDelta, bool isTopTick) internal returns (bool updated) {
    return ticks.update(tick, currentTick, liquidityDelta, totalRewardGrowth0, totalRewardGrowth1, isTopTick);
  }
}
