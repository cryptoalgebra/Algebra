// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../../../AlgebraPool.sol';
import './PoolMockEchidnaExtension.sol';

contract PoolMockEchidna is AlgebraPool {
  uint256 internal balance0;
  uint256 internal balance1;

  /// @dev When set, callbacks never credit more than the pool asked for. An overpayment is swept into fee growth by
  /// the next `_updateReserves`, which a suite checking which accumulator moves has to rule out
  bool internal exactPayments;

  function donate(uint256 amount0, uint256 amount1) public virtual {
    balance0 += amount0;
    balance1 += amount1;
  }

  struct MintData {
    uint256 pay0;
    uint256 pay1;
  }

  struct PositionData {
    int24 bottomTick;
    int24 topTick;
  }

  PositionData lastMintedPosition;

  function mintWrapped(int24 bottomTick, int24 topTick, uint128 liquidityDesired, uint256 pay0, uint256 pay1) public {
    bytes memory data = abi.encode(MintData(pay0, pay1));
    IAlgebraPool(this).mint(msg.sender, address(this), bottomTick, topTick, liquidityDesired, data);
    lastMintedPosition = PositionData(bottomTick, topTick);
  }

  function mintAroundCurrentTickWrapped(int24 tickDelta, uint128 liquidityDesired, uint256 pay0, uint256 pay1) public {
    if (tickDelta < 0) tickDelta = -tickDelta;
    if (tickDelta > (2 * TickMath.MAX_TICK)) tickDelta = 2 * TickMath.MAX_TICK;
    int24 currentTick = globalState.tick;
    int24 bottomTick = currentTick - tickDelta;
    int24 topTick = currentTick + tickDelta;

    bytes memory data = abi.encode(MintData(pay0, pay1));
    IAlgebraPool(this).mint(msg.sender, address(this), bottomTick, topTick, liquidityDesired, data);
    lastMintedPosition = PositionData(bottomTick, topTick);
  }

  function burnLastMintedPosition(uint128 liquidityDelta) public {
    require(lastMintedPosition.bottomTick != lastMintedPosition.topTick);
    IAlgebraPool(this).burn(lastMintedPosition.bottomTick, lastMintedPosition.topTick, liquidityDelta, '');
  }

  function collectLastMintedPosition(uint128 amount0Requested, uint128 amount1Requested) public {
    require(lastMintedPosition.bottomTick != lastMintedPosition.topTick);
    IAlgebraPool(this).collect(address(this), lastMintedPosition.bottomTick, lastMintedPosition.topTick, amount0Requested, amount1Requested);
  }

  struct FlashData {
    uint256 amount0;
    uint256 amount1;
  }

  function flashWrapped(address recipient, uint256 amount0, uint256 amount1) public virtual {
    bytes memory data = abi.encode(FlashData(amount0, amount1));
    IAlgebraPool(this).flash(recipient, amount0, amount1, data);
  }

  function swapWithPaymentInAdvanceWrapped(bool zeroToOne, int256 amountRequired, uint160 limitSqrtPrice, uint256 pay0, uint256 pay1) public {
    bytes memory data = abi.encode(MintData(pay0, pay1));
    IAlgebraPool(this).swapWithPaymentInAdvance(address(this), address(this), zeroToOne, amountRequired, limitSqrtPrice, data);
  }

  /// @dev The fuzzer mostly draws small values, below the lowest valid price, so a raw `initialize` rarely lands
  /// and every later mint and swap reverts with `notInitialized`
  function initializeWrapped(uint160 initialPrice) public {
    initialPrice = uint160(TickMath.MIN_SQRT_RATIO + (uint256(initialPrice) % (TickMath.MAX_SQRT_RATIO - TickMath.MIN_SQRT_RATIO)));
    IAlgebraPool(this).initialize(initialPrice);
  }

  function setFeeModeWrapped(uint8 newFeeMode) public {
    newFeeMode = newFeeMode % (Constants.MAX_FEE_MODE + 1);
    if (newFeeMode == globalState.feeMode) return;
    IAlgebraPool(this).setFeeMode(newFeeMode);
  }

  function hasRoleOrOwner(bytes32, address) public pure returns (bool) {
    return true;
  }

  /// @dev The setters and `initialize` are delegated to the extension: a delegatecall to an address without code
  /// succeeds and does nothing, so without a real extension the pool is never even initialized
  function _getDeployParameters() internal override returns (address plugin, address factory, address token0, address token1, address extension) {
    plugin = address(0);
    factory = address(this);
    token0 = address(1);
    token1 = address(2);
    extension = address(new PoolMockEchidnaExtension());
  }

  function _getDefaultConfiguration() internal pure override returns (uint16 _communityFee, int24 _tickSpacing, uint16 _fee) {
    _communityFee = 0;
    _tickSpacing = 1;
    _fee = 100;
  }

  // The main external calls that are used by the pool

  function _balanceToken0() internal view override returns (uint256) {
    return balance0;
  }

  function _balanceToken1() internal view override returns (uint256) {
    return balance1;
  }

  function _transfer(address token, address, uint256 amount) internal virtual override {
    if (token == token0) {
      balance0 -= amount;
    } else {
      balance1 -= amount;
    }
  }

  // These 'callback' functions are wrappers over the callbacks that the pool calls on the msg.sender

  function _swapCallback(int256 amount0, int256 amount1, bytes calldata data) internal virtual override {
    if (data.length > 0) {
      MintData memory mintData = abi.decode(data, (MintData));
      balance0 += exactPayments ? _atMostOwed(mintData.pay0, amount0) : mintData.pay0;
      balance1 += exactPayments ? _atMostOwed(mintData.pay1, amount1) : mintData.pay1;
    } else {
      if (amount0 > 0) {
        balance0 += uint256(amount0);
      } else if (amount1 > 0) {
        balance1 += uint256(amount1); // one-side-pays is asserted in AssertSwapEchidnaTest
      }
    }
  }

  function _mintCallback(uint256 amount0, uint256 amount1, bytes calldata data) internal virtual override {
    if (data.length > 0) {
      MintData memory mintData = abi.decode(data, (MintData));
      balance0 += exactPayments ? _atMostOwed(mintData.pay0, int256(amount0)) : mintData.pay0;
      balance1 += exactPayments ? _atMostOwed(mintData.pay1, int256(amount1)) : mintData.pay1;
    } else {
      balance0 += amount0;
      balance1 += amount1;
    }
  }

  /// @dev An underpayment passes through unchanged, only the part above what the pool asked for is dropped
  function _atMostOwed(uint256 paid, int256 owed) private pure returns (uint256) {
    uint256 cap = owed > 0 ? uint256(owed) : 0;
    return paid < cap ? paid : cap;
  }

  function _flashCallback(uint256 fee0, uint256 fee1, bytes calldata data) internal override {
    FlashData memory flashData = abi.decode(data, (FlashData));

    balance0 += flashData.amount0 + fee0;
    balance1 += flashData.amount1 + fee1;
  }
}
