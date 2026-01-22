// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/FullMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Constants.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/LiquidityMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickManagement.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/pool/IAlgebraPoolErrors.sol';

import '../base/VirtualTickStructure.sol';

/// @title Algebra Integral 1.2.2 eternal virtual pool
/// @notice Used to track active liquidity in farming and calculate total fees earned by farming positions
contract EternalVirtualPool is Timestamp, VirtualTickStructure {
  using TickManagement for mapping(int24 => TickManagement.Tick);

  /// @inheritdoc IAlgebraEternalVirtualPool
  address public immutable override farmingAddress;
  /// @inheritdoc IAlgebraEternalVirtualPool
  address public immutable override plugin;
  /// @inheritdoc IAlgebraEternalVirtualPool
  address public immutable override pool;

  /// @inheritdoc IAlgebraEternalVirtualPool
  uint128 public override currentLiquidity;
  /// @inheritdoc IAlgebraEternalVirtualPool
  int24 public override globalTick;
  /// @inheritdoc IAlgebraEternalVirtualPool
  uint32 public override prevTimestamp;
  /// @inheritdoc IAlgebraEternalVirtualPool
  bool public override deactivated;

  /// @dev Accumulated fees earned by all positions in farming (token0)
  uint256 public totalFees0;
  /// @dev Accumulated fees earned by all positions in farming (token1)
  uint256 public totalFees1;

  /// @dev Last saved totalFeeGrowth from the real pool (token0)
  uint256 internal totalFeeGrowth0Token;
  /// @dev Last saved totalFeeGrowth from the real pool (token1)
  uint256 internal totalFeeGrowth1Token;

  modifier onlyFromFarming() {
    _checkIsFromFarming();
    _;
  }

  constructor(address _farmingAddress, address _plugin, address _pool) {
    farmingAddress = _farmingAddress;
    plugin = _plugin;
    pool = _pool;

    totalFeeGrowth0Token = IAlgebraPool(_pool).totalFeeGrowth0Token();
    totalFeeGrowth1Token = IAlgebraPool(_pool).totalFeeGrowth1Token();
    prevTimestamp = _blockTimestamp();
    globalPrevInitializedTick = TickMath.MIN_TICK;
    globalNextInitializedTick = TickMath.MAX_TICK;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  /// @dev Should be called after updateTotalFees() to get actual value
  function getTotalFees() external view override returns (uint256 _totalFees0, uint256 _totalFees1) {
    return (totalFees0, totalFees1);
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function deactivate() external override onlyFromFarming {
    deactivated = true;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  /// @dev Updates totalFees to account for swaps without tick crosses
  /// @dev Can be called by anyone - only reads from pool and updates internal accounting
  function updateTotalFees() external override {
    _updateTotalFees();
  }

  /// @inheritdoc IAlgebraVirtualPool
  /// @dev If the virtual pool is deactivated, does nothing
  function crossTo(int24 targetTick, bool zeroToOne) external override returns (bool) {
    if (msg.sender != plugin) revert onlyPlugin();

    // All storage reads in this code block use the same slot
    int24 _globalTick = globalTick;
    uint32 _prevTimestamp = prevTimestamp;
    bool _deactivated = deactivated;
    uint128 _currentLiquidity = currentLiquidity;

    int24 previousTick = globalPrevInitializedTick;
    int24 nextTick = globalNextInitializedTick;

    {
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
    }

    // Track fees during tick crosses
    (uint256 _totalFees0, uint256 _totalFees1) = (totalFees0, totalFees1);
    (uint256 _savedFeeGrowth0, uint256 _savedFeeGrowth1) = (totalFeeGrowth0Token, totalFeeGrowth1Token);

    // The set of active ticks in the virtual pool must be a subset of the active ticks in the real pool
    // so this loop will cross no more ticks than the real pool
    if (zeroToOne) {
      while (_globalTick != TickMath.MIN_TICK) {
        if (targetTick >= previousTick) break;
        unchecked {
          // Get outerFeeGrowth from real pool (already inverted after cross)
          (, , , , uint256 poolOuterFeeGrowth0, uint256 poolOuterFeeGrowth1) = IAlgebraPool(pool).ticks(previousTick);
          
          // Get saved outerFeeGrowth from virtual pool
          TickManagement.Tick storage tickData = ticks[previousTick];
          
          uint256 feeGrowthAtCross0 = poolOuterFeeGrowth0 + tickData.outerFeeGrowth0Token;
          uint256 feeGrowthAtCross1 = poolOuterFeeGrowth1 + tickData.outerFeeGrowth1Token;
  
          // Calculate fees earned with current liquidity before cross
          if (_currentLiquidity > 0) {
            _totalFees0 += FullMath.mulDiv(feeGrowthAtCross0 - _savedFeeGrowth0, _currentLiquidity, Constants.Q128);
            _totalFees1 += FullMath.mulDiv(feeGrowthAtCross1 - _savedFeeGrowth1, _currentLiquidity, Constants.Q128);
          }
          
          // Update saved values
          _savedFeeGrowth0 = feeGrowthAtCross0;
          _savedFeeGrowth1 = feeGrowthAtCross1;
          tickData.outerFeeGrowth0Token = poolOuterFeeGrowth0;
          tickData.outerFeeGrowth1Token = poolOuterFeeGrowth1;
          
          int128 liquidityDelta;
          _globalTick = previousTick - 1; // safe since tick index range is narrower than the data type
          nextTick = previousTick;
          (liquidityDelta, previousTick, ) = _crossTick(previousTick);
          _currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, -liquidityDelta);
        }
      }
    } else {
      while (_globalTick != TickMath.MAX_TICK - 1) {
        if (targetTick < nextTick) break;
        
        // Get outerFeeGrowth from real pool (already inverted after cross)
        (, , , , uint256 poolOuterFeeGrowth0, uint256 poolOuterFeeGrowth1) = IAlgebraPool(pool).ticks(nextTick);
        
        // Get saved outerFeeGrowth from virtual pool
        TickManagement.Tick storage tickData = ticks[nextTick];

        // Restore totalFeeGrowth at the moment of cross
        uint256 feeGrowthAtCross0 = poolOuterFeeGrowth0 + tickData.outerFeeGrowth0Token;
        uint256 feeGrowthAtCross1 = poolOuterFeeGrowth1 + tickData.outerFeeGrowth1Token;

        
        // Calculate fees earned with current liquidity before cross
        if (_currentLiquidity > 0) {
          _totalFees0 += FullMath.mulDiv(feeGrowthAtCross0 - _savedFeeGrowth0, _currentLiquidity, Constants.Q128);
          _totalFees1 += FullMath.mulDiv(feeGrowthAtCross1 - _savedFeeGrowth1, _currentLiquidity, Constants.Q128);
        }
        
        // Update saved values
        _savedFeeGrowth0 = feeGrowthAtCross0;
        _savedFeeGrowth1 = feeGrowthAtCross1;
        tickData.outerFeeGrowth0Token = poolOuterFeeGrowth0;
        tickData.outerFeeGrowth1Token = poolOuterFeeGrowth1;
        
        int128 liquidityDelta;
        _globalTick = nextTick;
        previousTick = nextTick;
        (liquidityDelta, , nextTick) = _crossTick(nextTick);
        _currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, liquidityDelta);
      }
    }
    
    // Save accumulated fees and fee growth
    totalFees0 = _totalFees0;
    totalFees1 = _totalFees1;
    totalFeeGrowth0Token = _savedFeeGrowth0;
    totalFeeGrowth1Token = _savedFeeGrowth1;

    currentLiquidity = _currentLiquidity;
    globalTick = targetTick;

    globalPrevInitializedTick = previousTick;
    globalNextInitializedTick = nextTick;
    return true;
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

    // Update total fees before modifying liquidity
    _updateTotalFees();

    if (liquidityDelta != 0) {
      // if we need to update the ticks, do it
      // Get outerFeeGrowth from real pool for tick initialization
      (, , , , uint256 bottomOuterFeeGrowth0, uint256 bottomOuterFeeGrowth1) = IAlgebraPool(pool).ticks(bottomTick);
      (, , , , uint256 topOuterFeeGrowth0, uint256 topOuterFeeGrowth1) = IAlgebraPool(pool).ticks(topTick);

      bool flippedBottom = _updateTick(bottomTick, currentTick, liquidityDelta, false, bottomOuterFeeGrowth0, bottomOuterFeeGrowth1);
      bool flippedTop = _updateTick(topTick, currentTick, liquidityDelta, true, topOuterFeeGrowth0, topOuterFeeGrowth1);

      if (_isTickInsideRange(currentTick, bottomTick, topTick)) {
        currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, liquidityDelta);
      }
      bool isBurn = liquidityDelta < 0;

      if (flippedBottom || flippedTop) {
        _addOrRemoveTicks(bottomTick, topTick, flippedBottom, flippedTop, currentTick, isBurn);
      }
    }
  }

  function _checkIsFromFarming() internal view {
    if (msg.sender != farmingAddress) revert onlyFarming();
  }

  function _isTickInsideRange(int24 tick, int24 bottomTick, int24 topTick) internal pure returns (bool) {
    return tick >= bottomTick && tick < topTick;
  }

  /// @dev Updates totalFees based on current pool feeGrowth (for swaps without tick crosses)
  function _updateTotalFees() internal {
    uint256 _currentLiquidity = currentLiquidity;
    if (_currentLiquidity == 0) return;

    uint256 poolGrowth0 = IAlgebraPool(pool).totalFeeGrowth0Token();
    uint256 poolGrowth1 = IAlgebraPool(pool).totalFeeGrowth1Token();
    
    uint256 _totalFeeGrowth0Token = totalFeeGrowth0Token;
    uint256 _totalFeeGrowth1Token = totalFeeGrowth1Token;

    unchecked {
      if (_totalFeeGrowth0Token != poolGrowth0) {
        uint256 growthDelta0 = poolGrowth0 - _totalFeeGrowth0Token;
        totalFees0 += FullMath.mulDiv(growthDelta0, _currentLiquidity, Constants.Q128);
        totalFeeGrowth0Token = poolGrowth0;
      }
      
      if (_totalFeeGrowth1Token != poolGrowth1) {
        uint256 growthDelta1 = poolGrowth1 - _totalFeeGrowth1Token;
        totalFees1 += FullMath.mulDiv(growthDelta1, _currentLiquidity, Constants.Q128);
        totalFeeGrowth1Token = poolGrowth1;
      }
    }
  }

  /// @dev Updates tick data and initializes outerFeeGrowth from real pool when tick is created
  function _updateTick(
    int24 tick,
    int24 currentTick,
    int128 liquidityDelta,
    bool isTopTick,
    uint256 poolOuterFeeGrowth0,
    uint256 poolOuterFeeGrowth1
  ) internal returns (bool flipped) {
    TickManagement.Tick storage data = ticks[tick];

    uint256 liquidityTotalBefore = data.liquidityTotal;
    uint256 liquidityTotalAfter = LiquidityMath.addDelta(uint128(liquidityTotalBefore), liquidityDelta);
    if (liquidityTotalAfter > Constants.MAX_LIQUIDITY_PER_TICK) revert IAlgebraPoolErrors.liquidityOverflow();

    int128 liquidityDeltaBefore = data.liquidityDelta;
    data.liquidityDelta = isTopTick 
      ? int128(int256(liquidityDeltaBefore) - liquidityDelta) 
      : int128(int256(liquidityDeltaBefore) + liquidityDelta);
    data.liquidityTotal = liquidityTotalAfter;

    flipped = (liquidityTotalAfter == 0);
    if (liquidityTotalBefore == 0) {
      flipped = !flipped;
      // Initialize outerFeeGrowth from real pool when tick is first initialized
      data.outerFeeGrowth0Token = poolOuterFeeGrowth0;
      data.outerFeeGrowth1Token = poolOuterFeeGrowth1;
    }
  }

  /// @dev Cross tick without modifying outerFeeGrowth (it's handled separately in crossTo)
  function _crossTick(int24 tick) internal view returns (int128 liquidityDelta, int24 prevTick, int24 nextTick) {
    TickManagement.Tick storage data = ticks[tick];
    return (data.liquidityDelta, data.prevTick, data.nextTick);
  }
}
