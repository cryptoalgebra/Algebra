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

/// @title Algebra Integral 1.2.2 eternal virtual pool
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

  uint256 internal _totalFeeGrowth = 1;
  uint256 internal _totalFees = 1;

  uint256 private constant Q192 = 2**192;

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
  function totalFeeGrowth() external view override returns (uint256) {
    return _totalFeeGrowth;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function totalFees() external view override returns (uint256) {
    return _totalFees;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function afterCross(
    bool zeroToOne,
    uint256 feeAmount,
    int24 tick,
    uint160 sqrtPrice,
    uint128 poolLiquidity
  ) external override {
    if (msg.sender != plugin) revert onlyPlugin();

    uint128 _currentLiquidity = currentLiquidity;
    int24 _globalTick = globalTick;
    bool _deactivated = deactivated;

    int24 previousTick = globalPrevInitializedTick;
    int24 nextTick = globalNextInitializedTick;

    if (_deactivated) return; // early return if virtual pool is deactivated
    
    // Verify direction: for zeroToOne the tick being crossed should be below or equal to current global tick
    // for oneToZero the tick should be above current global tick
    bool virtualZtO = tick <= _globalTick; // TODO: remove check?

    if (virtualZtO != zeroToOne) {
      deactivated = true; // deactivate if invalid input params (possibly desynchronization)
      return;
    }

    _updateFeeGrowth(feeAmount, _currentLiquidity, poolLiquidity, zeroToOne, sqrtPrice);

    TickManagement.Tick storage tickData = ticks[tick];
    
    // For an uninitialized tick, prevTick == nextTick == 0
    if (tickData.prevTick == tickData.nextTick) {
      return;
    }

    if (zeroToOne) {
      unchecked {
        int128 liquidityDelta;
        nextTick = previousTick;
        (liquidityDelta, previousTick, ) = ticks.cross(previousTick, _totalFeeGrowth, 0);
        _currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, -liquidityDelta);
      }
    } else {
      int128 liquidityDelta;
      previousTick = nextTick;
      (liquidityDelta, , nextTick) = ticks.cross(nextTick, _totalFeeGrowth, 0);
      _currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, liquidityDelta);
    }

    currentLiquidity = _currentLiquidity;
    globalTick = tick;

    globalPrevInitializedTick = previousTick;
    globalNextInitializedTick = nextTick;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function afterSwap(
    bool zeroToOne,
    uint256 feeAmount,
    int24 currentTick,
    uint160 sqrtPrice,
    uint128 poolLiquidity
  ) external override {
    if (msg.sender != plugin) revert onlyPlugin();
    if (deactivated) return;

    _updateFeeGrowth(feeAmount, currentLiquidity, poolLiquidity, zeroToOne, sqrtPrice);

    // Update global tick position
    globalTick = currentTick;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function getInnerFeeGrowth(
    int24 bottomTick,
    int24 topTick
  ) external view override returns (uint256 feeGrowthInside) {
    unchecked {
      // check if ticks are initialized
      if (ticks[bottomTick].prevTick == ticks[bottomTick].nextTick || ticks[topTick].prevTick == ticks[topTick].nextTick)
        revert IAlgebraPoolErrors.tickIsNotInitialized();

      int24 _globalTick = globalTick;
      uint256 _totalFeeGrowthLocal = _totalFeeGrowth; // TODO: var naming

      // Get inner fee growth using tick management library
      // We use outerFeeGrowth0Token for fee-based tracking, outerFeeGrowth1Token is always 0
      (feeGrowthInside, ) = ticks.getInnerFeeGrowth(bottomTick, topTick, _globalTick, _totalFeeGrowthLocal, 0);
    }
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function deactivate() external override onlyFromFarming {
    deactivated = true;
  }

  /// @inheritdoc IAlgebraEternalVirtualPool
  function applyLiquidityDeltaToPosition(
    int24 bottomTick,
    int24 topTick,
    int128 liquidityDelta,
    int24 currentTick
  ) external override onlyFromFarming {
    uint128 _currentLiquidity = currentLiquidity;
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


  function _checkIsFromFarming() internal view {
    if (msg.sender != farmingAddress) revert onlyFarming();
  }

  function _isTickInsideRange(int24 tick, int24 bottomTick, int24 topTick) internal pure returns (bool) {
    return tick >= bottomTick && tick < topTick;
  }

  function _updateTick(int24 tick, int24 currentTick, int128 liquidityDelta, bool isTopTick) internal returns (bool updated) {
    return ticks.update(tick, currentTick, liquidityDelta, _totalFeeGrowth, 0, isTopTick);
  }

  /// @notice Converts fee amount to token0 equivalent
  function _convertFeeToToken0(
    bool zeroToOne,
    uint256 feeAmount,
    uint160 sqrtPrice // TODO: chose price for fee conversion, not sure this one is correct
  ) internal pure returns (uint256 feeInToken0) {
    if (zeroToOne) {
      // Fee is already in token0
      feeInToken0 = feeAmount;
    } else {
      feeInToken0 = FullMath.mulDiv(feeAmount, Q192, uint256(sqrtPrice) * sqrtPrice); // TODO: price mul overflow
    }
  }

  /// @notice Updates the total fee accumulators
  /// @dev Distributes fee proportionally to current liquidity
  function _updateFeeGrowth(uint256 feeAmount, uint128 _currentLiquidity, uint128 poolLiquidity, bool zeroToOne, uint160 sqrtPrice) internal {
    if (_currentLiquidity > 0 && feeAmount > 0) {

      uint256 farmingFees = FullMath.mulDiv(feeAmount, _currentLiquidity, poolLiquidity);
      
      // Convert fee to token0 equivalent
      uint256 feeInToken0 = _convertFeeToToken0(zeroToOne, farmingFees, sqrtPrice);

      _totalFeeGrowth += FullMath.mulDiv(feeInToken0, Constants.Q128, _currentLiquidity);
      _totalFees += feeInToken0;
    }
  }

}
