// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../interfaces/pool/IAlgebraPoolState.sol';
import '../interfaces/pool/IAlgebraPoolErrors.sol';
import '../libraries/TickManager.sol';
import '../libraries/LimitOrderManager.sol';
import './Timestamp.sol';

abstract contract PoolState is IAlgebraPoolState, IAlgebraPoolErrors, Timestamp {
  struct GlobalState {
    uint160 price; // The square root of the current price in Q64.96 format
    int24 tick; // The current tick
    int24 prevInitializedTick;
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
  uint32 public communityFeeLastTimestamp;

  uint128 public communityFeePending0;
  uint128 public communityFeePending1;

  uint128 public reserve0; // TODO
  uint128 public reserve1;

  uint32 internal lastTimepointTimestamp; // TODO
  uint160 public secondsPerLiquidityCumulative;

  /// @inheritdoc IAlgebraPoolState
  address public override activeIncentive;

  /// @inheritdoc IAlgebraPoolState
  mapping(int24 => TickManager.Tick) public override ticks;
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

  function _lock() private {
    if (!globalState.unlocked) revert LOK();
    globalState.unlocked = false;
  }

  function _unlock() private {
    globalState.unlocked = true;
  }
}
