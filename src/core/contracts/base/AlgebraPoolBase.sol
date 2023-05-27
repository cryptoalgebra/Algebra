// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../interfaces/callback/IAlgebraSwapCallback.sol';
import '../interfaces/IAlgebraPool.sol';
import '../interfaces/IAlgebraPoolDeployer.sol';
import '../interfaces/IAlgebraPoolErrors.sol';
import '../interfaces/IDataStorageOperator.sol';
import '../interfaces/IERC20Minimal.sol';
import '../libraries/TickManagement.sol';
import '../libraries/LimitOrderManagement.sol';
import '../libraries/Constants.sol';
import './common/Timestamp.sol';

/// @title Algebra pool base abstract contract
/// @notice Contains state variables, immutables and common internal functions
abstract contract AlgebraPoolBase is IAlgebraPool, IAlgebraPoolErrors, Timestamp {
  using TickManagement for mapping(int24 => TickManagement.Tick);

  struct GlobalState {
    uint160 price; // The square root of the current price in Q64.96 format
    int24 tick; // The current tick
    int24 prevInitializedTick; // The previous initialized tick in linked list
    uint16 fee; // The current fee in hundredths of a bip, i.e. 1e-6
    uint16 timepointIndex; // The index of the last written timepoint
    uint8 communityFee; // The community fee represented as a percent of all collected fee in thousandths (1e-3)
    bool unlocked; // True if the contract is unlocked, otherwise - false
  }

  /// @inheritdoc IAlgebraPoolImmutables
  address public immutable override dataStorageOperator;
  /// @inheritdoc IAlgebraPoolImmutables
  address public immutable override factory;
  /// @inheritdoc IAlgebraPoolImmutables
  address public immutable override token0;
  /// @inheritdoc IAlgebraPoolImmutables
  address public immutable override token1;
  /// @inheritdoc IAlgebraPoolImmutables
  address public immutable override communityVault;

  /// @inheritdoc IAlgebraPoolState
  uint256 public override totalFeeGrowth0Token;
  /// @inheritdoc IAlgebraPoolState
  uint256 public override totalFeeGrowth1Token;
  /// @inheritdoc IAlgebraPoolState
  GlobalState public override globalState;

  /// @inheritdoc IAlgebraPoolState
  uint128 public override liquidity;
  /// @inheritdoc IAlgebraPoolState
  int24 public override tickSpacing;
  /// @inheritdoc IAlgebraPoolState
  int24 public override tickSpacingLimitOrders;
  /// @inheritdoc IAlgebraPoolState
  uint32 public override communityFeeLastTimestamp;

  /// @dev The amounts of token0 and token1 that will be sent to the vault
  uint128 internal communityFeePending0;
  uint128 internal communityFeePending1;

  /// @dev The timestamp of the last timepoint write to the DataStorage
  uint32 internal lastTimepointTimestamp;
  /// @inheritdoc IAlgebraPoolState
  uint160 public override secondsPerLiquidityCumulative;

  /// @inheritdoc IAlgebraPoolState
  address public override activeIncentive;

  /// @inheritdoc IAlgebraPoolState
  mapping(int24 => TickManagement.Tick) public override ticks;
  /// @inheritdoc IAlgebraPoolState
  mapping(int24 => LimitOrderManagement.LimitOrder) public override limitOrders;

  /// @inheritdoc IAlgebraPoolState
  mapping(int16 => uint256) public override tickTable;

  /// @inheritdoc IAlgebraPoolImmutables
  function maxLiquidityPerTick() external pure override returns (uint128) {
    return Constants.MAX_LIQUIDITY_PER_TICK;
  }

  /// @inheritdoc IAlgebraPoolState
  function getCommunityFeePending() external view returns (uint128, uint128) {
    return (communityFeePending0, communityFeePending1);
  }

  modifier onlyValidTicks(int24 bottomTick, int24 topTick) {
    TickManagement.checkTickRangeValidity(bottomTick, topTick);
    _;
  }

  constructor() {
    (dataStorageOperator, factory, communityVault, token0, token1) = IAlgebraPoolDeployer(msg.sender).getDeployParameters();
    globalState.fee = Constants.BASE_FEE;
    globalState.prevInitializedTick = TickMath.MIN_TICK;
    tickSpacing = Constants.INIT_TICK_SPACING;
    tickSpacingLimitOrders = Constants.INIT_TICK_SPACING;
  }

  function _balanceToken0() internal view returns (uint256) {
    return IERC20Minimal(token0).balanceOf(address(this));
  }

  function _balanceToken1() internal view returns (uint256) {
    return IERC20Minimal(token1).balanceOf(address(this));
  }

  /// @dev Using function to save bytecode
  function _swapCallback(int256 amount0, int256 amount1, bytes calldata data) internal {
    IAlgebraSwapCallback(msg.sender).algebraSwapCallback(amount0, amount1, data);
  }

  /// @dev Once per block, writes data to dataStorage and updates the accumulator `secondsPerLiquidityCumulative`
  function _writeTimepoint(
    uint16 timepointIndex,
    uint32 blockTimestamp,
    int24 tick,
    uint128 currentLiquidity
  ) internal returns (uint16 newTimepointIndex, uint16 newFee) {
    uint32 _lastTs = lastTimepointTimestamp;
    if (_lastTs == blockTimestamp) return (timepointIndex, 0); // writing should only happen once per block

    unchecked {
      // just timedelta if liquidity == 0
      // overflow and underflow are desired
      secondsPerLiquidityCumulative += (uint160(blockTimestamp - _lastTs) << 128) / (currentLiquidity > 0 ? currentLiquidity : 1);
    }
    lastTimepointTimestamp = blockTimestamp;

    // failure should not occur. But in case of failure, the pool will remain operational
    try IDataStorageOperator(dataStorageOperator).write(timepointIndex, blockTimestamp, tick) returns (uint16 _newTimepointIndex, uint16 _newFee) {
      return (_newTimepointIndex, _newFee);
    } catch {
      emit DataStorageFailure();
      return (timepointIndex, 0);
    }
  }

  /// @dev Get secondsPerLiquidityCumulative accumulator value for current blockTimestamp
  function _getSecondsPerLiquidityCumulative(uint32 blockTimestamp, uint128 currentLiquidity) internal view returns (uint160 _secPerLiqCumulative) {
    uint32 _lastTs;
    (_lastTs, _secPerLiqCumulative) = (lastTimepointTimestamp, secondsPerLiquidityCumulative);
    unchecked {
      if (_lastTs != blockTimestamp)
        // just timedelta if liquidity == 0
        // overflow and underflow are desired
        _secPerLiqCumulative += (uint160(blockTimestamp - _lastTs) << 128) / (currentLiquidity > 0 ? currentLiquidity : 1);
    }
  }

  /// @dev Add or remove a tick to the corresponding data structure
  function _insertOrRemoveTick(
    int24 tick,
    int24 currentTick,
    int24 prevInitializedTick,
    bool remove
  ) internal virtual returns (int24 newPrevInitializedTick);
}
