// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import '../interfaces/pool/IAlgebraPoolState.sol';
import '../libraries/TickManager.sol';

abstract contract PoolState is IAlgebraPoolState {
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

  int32 blockStartTickX100;
  uint32 startPriceUpdated;

  uint256 public reserve0;
  uint256 public reserve1;

  /// @inheritdoc IAlgebraPoolState
  address public override activeIncentive;

  /// @inheritdoc IAlgebraPoolState
  mapping(int24 => TickManager.Tick) public override ticks;
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
    require(globalState.unlocked, 'LOK');
    globalState.unlocked = false;
  }

  function _unlock() private {
    globalState.unlocked = true;
  }

  /// @dev This function is created for testing by overriding it.
  /// @return A timestamp converted to uint32
  function _blockTimestamp() internal view virtual returns (uint32) {
    return uint32(block.timestamp); // truncation is desired
  }
}
