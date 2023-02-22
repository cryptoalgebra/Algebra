// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../interfaces/pool/IAlgebraPoolState.sol';
import '../interfaces/IAlgebraPoolErrors.sol';

import '../libraries/TickManager.sol';
import '../libraries/LimitOrderManager.sol';
import './Timestamp.sol';

abstract contract PoolState is IAlgebraPoolState, Timestamp {
  struct GlobalState {
    uint160 price; // The square root of the current price in Q64.96 format
    int24 tick; // The current tick
    int24 prevInitializedTick; // The previous initialized tick
    uint16 fee; // The current fee in hundredths of a bip, i.e. 1e-6
    uint16 timepointIndex; // The index of the last written timepoint
    uint8 communityFee; // The community fee represented as a percent of all collected fee in thousandths (1e-3)
    bool unlocked; // True if the contract is unlocked, otherwise - false
  }

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
  uint32 public override communityFeeLastTimestamp;

  /// @dev The amounts of token0 and token1 that will be sent to the vault
  uint128 internal communityFeePending0;
  uint128 internal communityFeePending1;

  /// @dev The tracked token0 and token1 reserves of pool
  uint128 internal reserve0;
  uint128 internal reserve1;

  /// @dev The timestamp of the last timepoint write to the DataStorage
  uint32 internal lastTimepointTimestamp;
  /// @inheritdoc IAlgebraPoolState
  uint160 public override secondsPerLiquidityCumulative;

  /// @inheritdoc IAlgebraPoolState
  address public override activeIncentive;

  /// @inheritdoc IAlgebraPoolState
  mapping(int24 => TickManager.Tick) public override ticks;
  /// @inheritdoc IAlgebraPoolState
  mapping(int24 => LimitOrderManager.LimitOrder) public override limitOrders;

  /// @inheritdoc IAlgebraPoolState
  mapping(int16 => uint256) public override tickTable;
  mapping(int16 => uint256) internal tickSecondLayer;
  uint256 internal tickTreeRoot;

  modifier nonReentrant() {
    _lock();
    _;
    _unlock();
  }

  /// @inheritdoc IAlgebraPoolState
  function getCommunityFeePending() external view returns (uint128, uint128) {
    return (communityFeePending0, communityFeePending1);
  }

  /// @inheritdoc IAlgebraPoolState
  function getReserves() external view returns (uint128, uint128) {
    return (reserve0, reserve1);
  }

  function _lock() private {
    if (!globalState.unlocked) revert IAlgebraPoolErrors.locked();
    globalState.unlocked = false;
  }

  function _unlock() private {
    globalState.unlocked = true;
  }
}
