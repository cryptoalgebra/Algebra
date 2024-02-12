// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;
pragma abicoder v1;

import '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/FullMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Constants.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/LiquidityMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickManagement.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/pool/IAlgebraPoolErrors.sol';

import '../base/VirtualTickStructure.sol';

/// @title Algebra Integral 1.0 eternal virtual pool
/// @notice used to track active liquidity in farming and distribute rewards
contract EternalVirtualPool is Timestamp, VirtualTickStructure {
  using TickManagement for mapping(int24 => TickManagement.Tick);

  /// @inheritdoc IAlgebraEternalVirtualPool
  address public immutable override farmingAddress;
  /// @inheritdoc IAlgebraEternalVirtualPool
  address public immutable override plugin;

  /// @inheritdoc IAlgebraEternalVirtualPool
  uint128 public override currentLiquidity;
  /// @inheritdoc IAlgebraEternalVirtualPool
  int24 public override globalTick;
  /// @inheritdoc IAlgebraEternalVirtualPool
  uint32 public override prevTimestamp;
  /// @inheritdoc IAlgebraEternalVirtualPool
  bool public override deactivated;

  uint128 internal rewardRate0;
  uint128 internal rewardRate1;

  uint128 internal rewardReserve0;
  uint128 internal rewardReserve1;

  uint256 internal totalRewardGrowth0 = 1;
  uint256 internal totalRewardGrowth1 = 1;

  modifier onlyFromFarming() {
    _checkIsFromFarming();
    _;
  }

  constructor(address _farmingAddress, address _plugin) {
    farmingAddress = _farmingAddress;
    plugin = _plugin;

    prevTimestamp = _blockTimestamp();
    globalPrevInitializedTick = TickMath.MIN_TICK;
    globalNextInitializedTick = TickMath.MAX_TICK;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function rewardReserves() external view override returns (uint128 reserve0, uint128 reserve1) {
    return (rewardReserve0, rewardReserve1);
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function rewardRates() external view override returns (uint128 rate0, uint128 rate1) {
    return (rewardRate0, rewardRate1);
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function totalRewardGrowth() external view override returns (uint256 rewardGrowth0, uint256 rewardGrowth1) {
    return (totalRewardGrowth0, totalRewardGrowth1);
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function getInnerRewardsGrowth(
    int24 bottomTick,
    int24 topTick
  ) external view override returns (uint256 rewardGrowthInside0, uint256 rewardGrowthInside1) {
    unchecked {
      // check if ticks are initialized
      if (ticks[bottomTick].prevTick == ticks[bottomTick].nextTick || ticks[topTick].prevTick == ticks[topTick].nextTick)
        revert IAlgebraPoolErrors.tickIsNotInitialized();

      uint32 timeDelta = _blockTimestamp() - prevTimestamp;
      int24 _globalTick = globalTick;

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

      return ticks.getInnerFeeGrowth(bottomTick, topTick, _globalTick, _totalRewardGrowth0, _totalRewardGrowth1);
    }
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function deactivate() external override onlyFromFarming {
    deactivated = true;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function addRewards(uint128 token0Amount, uint128 token1Amount) external override onlyFromFarming {
    _applyRewardsDelta(true, token0Amount, token1Amount);
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function decreaseRewards(uint128 token0Amount, uint128 token1Amount) external override onlyFromFarming {
    _applyRewardsDelta(false, token0Amount, token1Amount);
  }

  /// @inheritdoc IAlgebraVirtualPool
  /// @dev If the virtual pool is deactivated, does nothing
  function crossTo(int24 targetTick, bool zeroToOne) external override returns (bool) {
    if (msg.sender != plugin) revert onlyPlugin();

    // All storage reads in this code block use the same slot
    uint128 _currentLiquidity = currentLiquidity;
    int24 _globalTick = globalTick;
    uint32 _prevTimestamp = prevTimestamp;
    bool _deactivated = deactivated;

    int24 previousTick = globalPrevInitializedTick;
    int24 nextTick = globalNextInitializedTick;

    if (_deactivated) return false; // early return if virtual pool is deactivated
    bool virtualZtO = targetTick <= _globalTick; // direction of movement from the point of view of the virtual pool

    // early return if without any crosses
    if (virtualZtO) {
      if (targetTick >= previousTick) return true;
    } else {
      if (targetTick < nextTick) return true;
    }

    if (virtualZtO != zeroToOne) {
      deactivated = true; // deactivate if invalid input params (possibly desynchronization)
      return false;
    }

    _distributeRewards(_prevTimestamp, _currentLiquidity);

    (uint256 rewardGrowth0, uint256 rewardGrowth1) = (totalRewardGrowth0, totalRewardGrowth1);
    // The set of active ticks in the virtual pool must be a subset of the active ticks in the real pool
    // so this loop will cross no more ticks than the real pool
    if (zeroToOne) {
      while (_globalTick != TickMath.MIN_TICK) {
        if (targetTick >= previousTick) break;
        unchecked {
          int128 liquidityDelta;
          _globalTick = previousTick - 1; // safe since tick index range is narrower than the data type
          nextTick = previousTick;
          (liquidityDelta, previousTick, ) = ticks.cross(previousTick, rewardGrowth0, rewardGrowth1);
          _currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, -liquidityDelta);
        }
      }
    } else {
      while (_globalTick != TickMath.MAX_TICK - 1) {
        if (targetTick < nextTick) break;
        int128 liquidityDelta;
        _globalTick = nextTick;
        previousTick = nextTick;
        (liquidityDelta, , nextTick) = ticks.cross(nextTick, rewardGrowth0, rewardGrowth1);
        _currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, liquidityDelta);
      }
    }

    currentLiquidity = _currentLiquidity;
    globalTick = targetTick;

    globalPrevInitializedTick = previousTick;
    globalNextInitializedTick = nextTick;
    return true;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function distributeRewards() external override onlyFromFarming {
    _distributeRewards();
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function applyLiquidityDeltaToPosition(
    int24 bottomTick,
    int24 topTick,
    int128 liquidityDelta,
    int24 currentTick
  ) external override onlyFromFarming {
    uint128 _currentLiquidity = currentLiquidity;
    uint32 _prevTimestamp = prevTimestamp;
    bool _deactivated = deactivated;
    {
      int24 _nextActiveTick = globalNextInitializedTick;
      int24 _prevActiveTick = globalPrevInitializedTick;

      if (!_deactivated) {
        // checking if the current tick is within the allowed range: it should not be on the other side of the nearest active tick
        // if the check is violated, the virtual pool deactivates
        if (!_isTickInsideRange(currentTick, _prevActiveTick, _nextActiveTick)) {
          deactivated = _deactivated = true;
        }
      }
    }

    if (_deactivated) {
      // early return if virtual pool is deactivated
      return;
    }

    globalTick = currentTick;

    if (_blockTimestamp() > _prevTimestamp) {
      _distributeRewards(_prevTimestamp, _currentLiquidity);
    }

    if (liquidityDelta != 0) {
      // if we need to update the ticks, do it

      bool flippedBottom = _updateTick(bottomTick, currentTick, liquidityDelta, false);
      bool flippedTop = _updateTick(topTick, currentTick, liquidityDelta, true);

      if (_isTickInsideRange(currentTick, bottomTick, topTick)) {
        currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, liquidityDelta);
      }

      if (flippedBottom || flippedTop) {
        _addOrRemoveTicks(bottomTick, topTick, flippedBottom, flippedTop, currentTick, liquidityDelta < 0);
      }
    }
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function setRates(uint128 rate0, uint128 rate1) external override onlyFromFarming {
    _distributeRewards();
    (rewardRate0, rewardRate1) = (rate0, rate1);
  }

  function _checkIsFromFarming() internal view {
    if (msg.sender != farmingAddress) revert onlyFarming();
  }

  function _isTickInsideRange(int24 tick, int24 bottomTick, int24 topTick) internal pure returns (bool) {
    return tick >= bottomTick && tick < topTick;
  }

  function _applyRewardsDelta(bool add, uint128 token0Delta, uint128 token1Delta) private {
    _distributeRewards();
    if (token0Delta | token1Delta != 0) {
      (uint128 _rewardReserve0, uint128 _rewardReserve1) = (rewardReserve0, rewardReserve1);
      if (add) {
        _rewardReserve0 = _rewardReserve0 + token0Delta;
        _rewardReserve1 = _rewardReserve1 + token1Delta;
      } else {
        _rewardReserve0 = _rewardReserve0 - token0Delta;
        _rewardReserve1 = _rewardReserve1 - token1Delta;
      }
      (rewardReserve0, rewardReserve1) = (_rewardReserve0, _rewardReserve1);
    }
  }

  function _distributeRewards() internal {
    _distributeRewards(prevTimestamp, currentLiquidity);
  }

  function _distributeRewards(uint32 _prevTimestamp, uint256 _currentLiquidity) internal {
    // currentLiquidity is uint128
    unchecked {
      uint256 timeDelta = _blockTimestamp() - _prevTimestamp; // safe until timedelta > 136 years
      if (timeDelta == 0) return; // only once per block

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

    prevTimestamp = _blockTimestamp();
    return;
  }

  function _updateTick(int24 tick, int24 currentTick, int128 liquidityDelta, bool isTopTick) internal returns (bool updated) {
    return ticks.update(tick, currentTick, liquidityDelta, totalRewardGrowth0, totalRewardGrowth1, isTopTick);
  }
}
