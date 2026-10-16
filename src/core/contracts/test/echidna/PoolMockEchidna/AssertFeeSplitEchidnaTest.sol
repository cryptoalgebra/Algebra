// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.26;

import './PoolMockEchidna.sol';

/// @dev Records the fees the pool hands to the plugin in afterCross and afterSwap
contract FeeSplitRecorder {
  uint256 public crossFees;
  uint256 public swapFee;

  function reset() external {
    crossFees = 0;
  }

  function afterCross(bool, uint256, uint256 feeStepAmount, int24, int128, uint128) external returns (bytes4) {
    crossFees += feeStepAmount;
    return IAlgebraPlugin.afterCross.selector;
  }

  function afterSwap(address, address, bool, int256, uint160, int256, int256, uint256 feeAmount, bytes calldata) external returns (bytes4) {
    swapFee = feeAmount;
    return IAlgebraPlugin.afterSwap.selector;
  }
}

/// @notice With afterCross the fee of a swap is split between the hooks, and the parts add up to the whole fee
/// @dev The whole fee is what afterSwap gets with afterCross off. That swap runs in a self-call that always reverts,
/// which leaves the pool as it was, and the fee comes back in the revert reason
contract AssertFeeSplitEchidnaTest is PoolMockEchidna {
  FeeSplitRecorder internal recorder;

  error WholeFee(uint256 fee);

  constructor() {
    recorder = new FeeSplitRecorder();
    _setPlugin(address(recorder));

    globalState.price = uint160(Constants.Q96);
    globalState.tick = 0;
    (, int24 _tickSpacing, uint16 _fee) = _getDefaultConfiguration();
    _setFee(_fee);
    _setTickSpacing(_tickSpacing);
  }

  function swapAndCheckFeeSplitWrapped(bool zeroToOne, int128 amountRequired, uint160 limitSqrtPrice) public {
    require(amountRequired != 0);
    // the setters are reachable, so the plugin may have been swapped out
    require(plugin == address(recorder));
    limitSqrtPrice = _clampLimit(zeroToOne, limitSqrtPrice);

    uint256 wholeFee;
    try this.swapWithoutAfterCross(zeroToOne, amountRequired, limitSqrtPrice) {} catch (bytes memory reason) {
      // any other revert is the swap itself failing, which is not what is checked here
      require(reason.length == 36 && bytes4(reason) == WholeFee.selector);
      assembly {
        wholeFee := mload(add(reason, 36))
      }
    }
    _setPluginConfig(uint16(Plugins.AFTER_CROSS_FLAG | Plugins.AFTER_SWAP_FLAG));
    recorder.reset();
    IAlgebraPool(this).swap(address(this), zeroToOne, amountRequired, limitSqrtPrice, '');
    assert(recorder.crossFees() + recorder.swapFee() == wholeFee);
  }

  function swapWithoutAfterCross(bool zeroToOne, int128 amountRequired, uint160 limitSqrtPrice) external {
    require(msg.sender == address(this));
    _setPluginConfig(uint16(Plugins.AFTER_SWAP_FLAG));
    IAlgebraPool(this).swap(address(this), zeroToOne, amountRequired, limitSqrtPrice, '');
    revert WholeFee(recorder.swapFee());
  }

  function _clampLimit(bool zeroToOne, uint160 limitSqrtPrice) private view returns (uint160) {
    uint160 currentPrice = globalState.price;
    require(currentPrice > TickMath.MIN_SQRT_RATIO + 1 && currentPrice < TickMath.MAX_SQRT_RATIO - 1);
    if (zeroToOne) {
      if (limitSqrtPrice >= currentPrice) limitSqrtPrice = currentPrice - 1;
      if (limitSqrtPrice <= TickMath.MIN_SQRT_RATIO) limitSqrtPrice = TickMath.MIN_SQRT_RATIO + 1;
    } else {
      if (limitSqrtPrice <= currentPrice) limitSqrtPrice = currentPrice + 1;
      if (limitSqrtPrice >= TickMath.MAX_SQRT_RATIO) limitSqrtPrice = TickMath.MAX_SQRT_RATIO - 1;
    }
    return limitSqrtPrice;
  }
}
