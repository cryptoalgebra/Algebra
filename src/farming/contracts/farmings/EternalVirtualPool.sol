// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;
pragma abicoder v1;

import '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/FullMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Constants.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/LiquidityMath.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/pool/IAlgebraPoolErrors.sol';

import '../base/VirtualTickManagement.sol';
import '../base/VirtualTickStructure.sol';

/// @title Algebra Integral 1.0 eternal virtual pool
/// @notice used to track active liquidity in farming and distribute rewards
contract EternalVirtualPool is Timestamp, VirtualTickStructure {
  using VirtualTickManagement for mapping(int24 => VirtualTickManagement.Tick);

  /// @inheritdoc IAlgebraEternalVirtualPool
  address public immutable override farmingAddress;
  /// @inheritdoc IAlgebraEternalVirtualPool
  address public immutable override plugin;

  uint32 public constant RATE_CHANGE_FREQUENCY = 1 hours;
  uint16 public constant FEE_WEIGHT_DENOMINATOR = 1e3;

  /// @inheritdoc IAlgebraEternalVirtualPool
  uint128 public override currentLiquidity;
  /// @inheritdoc IAlgebraEternalVirtualPool
  int24 public override globalTick;
  /// @inheritdoc IAlgebraEternalVirtualPool
  uint32 public override prevTimestamp;
  /// @inheritdoc IAlgebraEternalVirtualPool
  bool public override deactivated;

  mapping(address => RewardInfo) public override rewardsInfo;

  address[] internal rewardTokensList;

  uint16 internal fee1Weight;
  uint16 internal fee0Weight;

  uint32 internal prevDelta;
  uint32 internal prevRateChangeTimestamp;

  uint128 internal prevFees0Collected;
  uint128 internal prevFees1Collected;

  uint128 internal fees0Collected;
  uint128 internal fees1Collected;

  modifier onlyFromFarming() {
    _checkIsFromFarming();
    _;
  }

  constructor(address _farmingAddress, address _plugin) {
    farmingAddress = _farmingAddress;
    plugin = _plugin;

    prevTimestamp = _blockTimestamp();
    prevRateChangeTimestamp = _blockTimestamp();
    globalPrevInitializedTick = TickMath.MIN_TICK;
    globalNextInitializedTick = TickMath.MAX_TICK;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function rewardReserve(address rewardToken) external view override returns (uint128 reserve) {
    return rewardsInfo[rewardToken].reserve;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function rewardRate(address rewardToken) external view override returns (uint128 rate) {
    return rewardsInfo[rewardToken].rewardRate;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function totalRewardGrowth(address rewardToken) external view override returns (uint256 rewardGrowth) {
    return rewardsInfo[rewardToken].totalRewardGrowth;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function getInnerRewardsGrowth(int24 bottomTick, int24 topTick, address rewardToken) external view override returns (uint256 rewardGrowthInside) {
    unchecked {
      // check if ticks are initialized
      if (ticks[bottomTick].prevTick == ticks[bottomTick].nextTick || ticks[topTick].prevTick == ticks[topTick].nextTick)
        revert IAlgebraPoolErrors.tickIsNotInitialized();

      uint32 timeDelta = _blockTimestamp() - prevTimestamp;
      int24 _globalTick = globalTick;

      (uint128 _rewardRate, uint128 _rewardReserve, uint256 _totalRewardGrowth) = (
        rewardsInfo[rewardToken].rewardRate,
        rewardsInfo[rewardToken].reserve,
        rewardsInfo[rewardToken].totalRewardGrowth
      );

      if (timeDelta > 0) {
        // update rewards
        uint128 _currentLiquidity = currentLiquidity;
        if (_currentLiquidity > 0) {
          uint256 reward = _rewardRate * timeDelta;

          if (reward > _rewardReserve) reward = _rewardReserve;

          if (reward > 0) _totalRewardGrowth += FullMath.mulDiv(reward, Constants.Q128, _currentLiquidity);
        }
      }

      return ticks.getInnerFeeGrowth(bottomTick, topTick, _globalTick, _totalRewardGrowth, rewardToken);
    }
  }

  function getTickGrowth(int24 tick, address rewardToken) external view override returns (uint256 outerFeeGrowth) {
    outerFeeGrowth = ticks[tick].outerFeeGrowth[rewardToken];
  }
  /// @inheritdoc IAlgebraEternalVirtualPool
  function deactivate() external override onlyFromFarming {
    deactivated = true;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function addRewards(address rewardToken, uint128 amount) external override onlyFromFarming {
    _applyRewardsDelta(true, rewardToken, amount);
  }

  function addRewardToken(address newRewardToken) external override onlyFromFarming {
    for (uint i; i < rewardTokensList.length; i++) {
      if (newRewardToken == rewardTokensList[i]) revert alreadyInList();
    }

    rewardTokensList.push(newRewardToken);
    rewardsInfo[newRewardToken].totalRewardGrowth = 1;
  }

  function removeRewardToken(uint256 tokenIndex) external override onlyFromFarming {
    address token = rewardTokensList[tokenIndex];

    if (rewardsInfo[token].rewardRate != 0) revert nonZeroRate();
    if (tokenIndex >= rewardTokensList.length) revert indexOutOfRange();

    for (uint i = tokenIndex; i < rewardTokensList.length - 1; i++) {
      rewardTokensList[i] = rewardTokensList[i + 1];
    }
    rewardTokensList.pop();
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function decreaseRewards(address rewardToken, uint128 amount) external override onlyFromFarming {
    _applyRewardsDelta(false, rewardToken, amount);
  }

  /// @inheritdoc IAlgebraVirtualPool
  /// @dev If the virtual pool is deactivated, does nothing
  function crossTo(int24 targetTick, bool zeroToOne, uint128 feeAmount) external override returns (bool) {
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

    if (zeroToOne) {
      fees0Collected += feeAmount;
    } else {
      fees1Collected += feeAmount;
    }

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

    {
      uint32 _prevRateChangeTimestamp = prevRateChangeTimestamp;
      uint32 _prevDelta = prevDelta;
      uint32 timeDelta = _blockTimestamp() - _prevRateChangeTimestamp;
      if (timeDelta > RATE_CHANGE_FREQUENCY) {
        uint128 currentFees0CollectedPerSec = fees0Collected / timeDelta;
        uint128 currentFees1CollectedPerSec = fees1Collected / timeDelta;

        if (_prevDelta != 0) {
          uint128 prevFees0CollectedPerSec = prevFees0Collected / _prevDelta;
          uint128 prevFees1CollectedPerSec = prevFees1Collected / _prevDelta;

          if (prevFees0CollectedPerSec | prevFees1CollectedPerSec != 0) {
            for (uint i; i < rewardTokensList.length; i++) {
              uint128 lastRewardRate = rewardsInfo[rewardTokensList[i]].rewardRate;
              // TODO muldiv
              rewardsInfo[rewardTokensList[i]].rewardRate =
                (currentFees0CollectedPerSec * lastRewardRate * fee0Weight) /
                (prevFees0CollectedPerSec * FEE_WEIGHT_DENOMINATOR) +
                (currentFees1CollectedPerSec * lastRewardRate * fee1Weight) /
                (prevFees1CollectedPerSec * FEE_WEIGHT_DENOMINATOR);
            }
          }
        }

        prevFees0Collected = fees0Collected;
        prevFees1Collected = fees1Collected;

        prevDelta = timeDelta;
        prevRateChangeTimestamp = _blockTimestamp();

        fees0Collected = 0;
        fees1Collected = 0;
      }
    }

    // The set of active ticks in the virtual pool must be a subset of the active ticks in the real pool
    // so this loop will cross no more ticks than the real pool
    if (zeroToOne) {
      while (_globalTick != TickMath.MIN_TICK) {
        if (targetTick >= previousTick) break;
        unchecked {
          int128 liquidityDelta;
          _globalTick = previousTick - 1; // safe since tick index range is narrower than the data type
          nextTick = previousTick;
          for (uint i; i < rewardTokensList.length; i++) {
            address rewardToken = rewardTokensList[i];
            (liquidityDelta, previousTick, ) = ticks.cross(previousTick, rewardsInfo[rewardToken].totalRewardGrowth, rewardToken);
          }
          _currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, -liquidityDelta);
        }
      }
    } else {
      while (_globalTick != TickMath.MAX_TICK - 1) {
        if (targetTick < nextTick) break;
        int128 liquidityDelta;
        _globalTick = nextTick;
        previousTick = nextTick;
        for (uint i; i < rewardTokensList.length; i++) {
          address rewardToken = rewardTokensList[i];
          (liquidityDelta, , nextTick) = ticks.cross(nextTick, rewardsInfo[rewardToken].totalRewardGrowth, rewardToken);
        }
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
      uint256 listLength = rewardTokensList.length;
      uint256[] memory rewardGrowths = new uint256[](listLength);
      for (uint i; i < listLength; i++) {
        rewardGrowths[i] = rewardsInfo[rewardTokensList[i]].totalRewardGrowth;
      }
      bool flippedBottom = _updateTick(bottomTick, currentTick, liquidityDelta, false, rewardGrowths, rewardTokensList);
      bool flippedTop = _updateTick(topTick, currentTick, liquidityDelta, true, rewardGrowths, rewardTokensList);

      if (_isTickInsideRange(currentTick, bottomTick, topTick)) {
        currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, liquidityDelta);
      }

      if (flippedBottom || flippedTop) {
        _addOrRemoveTicks(bottomTick, topTick, flippedBottom, flippedTop, currentTick, liquidityDelta < 0);
      }
    }
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function setRates(address token, uint128 rate) external override onlyFromFarming {
    _distributeRewards();
    // TODO check token list
    rewardsInfo[token].rewardRate = rate;
  }

  function setWeights(uint16 weight0, uint16 weight1) external override onlyFromFarming {
    (fee0Weight, fee1Weight) = (weight0, weight1);
  }

  function _checkIsFromFarming() internal view {
    if (msg.sender != farmingAddress) revert onlyFarming();
  }

  function _isTickInsideRange(int24 tick, int24 bottomTick, int24 topTick) internal pure returns (bool) {
    return tick >= bottomTick && tick < topTick;
  }

  function _applyRewardsDelta(bool add, address token, uint128 amount) private {
    _distributeRewards();
    if (amount != 0) {
      if (add) {
        rewardsInfo[token].reserve += amount;
      } else {
        rewardsInfo[token].reserve -= amount;
      }
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
        for (uint i; i < rewardTokensList.length; i++) {
          address rewardToken = rewardTokensList[i];
          (uint128 _rewardRate, uint128 _rewardReserve) = (rewardsInfo[rewardToken].rewardRate, rewardsInfo[rewardToken].reserve);
          uint256 reward = _rewardRate * timeDelta;

          if (reward > _rewardReserve) reward = _rewardReserve;

          if (reward != 0) {
            _rewardReserve = uint128(_rewardReserve - reward);

            if (reward > 0) rewardsInfo[rewardToken].totalRewardGrowth += FullMath.mulDiv(reward, Constants.Q128, _currentLiquidity);

            rewardsInfo[rewardToken].reserve = _rewardReserve;
          }
        }
      }
    }

    prevTimestamp = _blockTimestamp();
    return;
  }

  function _updateTick(
    int24 tick,
    int24 currentTick,
    int128 liquidityDelta,
    bool isTopTick,
    uint256[] memory totalRewardGrowths,
    address[] memory rewardTokens
  ) internal returns (bool updated) {
    return ticks.update(tick, currentTick, liquidityDelta, isTopTick, totalRewardGrowths, rewardTokens);
  }
}
