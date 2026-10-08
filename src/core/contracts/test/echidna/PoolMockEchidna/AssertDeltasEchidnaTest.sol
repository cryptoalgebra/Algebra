// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import './PoolMockEchidna.sol';
import '../../MockDeltaPlugin.sol';

/// @notice Checks that plugin amount deltas never leak into the pool: the pool moves exactly by the swap math amounts,
/// the plugin gets exactly the deltas and the caller never pays more than requested on exactIn
/// @dev The pool is initialized and the plugin is connected in the constructor, so every sequence starts with a working
/// pool. The fee mode, the community fee and the vault can be changed by the inherited setters: a payment to the vault
/// is told apart from the swapper's and the plugin's, and the community fee of a swap may land only in its fee token
contract AssertDeltasEchidnaTest is PoolMockEchidna {
  MockDeltaPlugin internal deltaPlugin;

  // what the pool sent to each party during the checked swap and what the swapper paid in, indexed by token
  uint256[2] internal sentToPlugin;
  uint256[2] internal sentToVault;
  uint256[2] internal sentToSwapper;
  uint256[2] internal paidBySwapper;
  uint256[2] internal balanceBefore;
  uint160 internal priceBefore;
  uint256 internal feeToken;
  uint256 internal otherTokenFeePendingBefore;

  struct Deltas {
    uint24 inDecreaseShare;
    uint32 inIncreaseShare;
    uint24 outDecreaseShare;
    uint8 addend;
    uint8 target;
  }
  Deltas internal deltas;

  constructor() {
    deltaPlugin = new MockDeltaPlugin();
    _setPlugin(address(deltaPlugin));
    _setPluginConfig(uint16(Plugins.BEFORE_SWAP_FLAG | Plugins.AFTER_SWAP_FLAG | Plugins.AFTER_SWAP_CALCULATION_FLAG | Plugins.DYNAMIC_FEE));

    globalState.price = uint160(Constants.Q96);
    globalState.tick = 0;
    (, int24 _tickSpacing, uint16 _fee) = _getDefaultConfiguration();
    _setFee(_fee);
    _setTickSpacing(_tickSpacing);
  }

  /// @dev Shares are in 1e-6 of the base. The addend is added to one of the deltas to step over the bounds, such swaps must revert
  function setDeltasWrapped(uint24 inDecreaseShare, uint32 inIncreaseShare, uint24 outDecreaseShare, uint8 addend, uint8 target) public {
    deltas = Deltas(inDecreaseShare % 1e6, inIncreaseShare % 5e6, outDecreaseShare % (1e6 + 1), addend, target % 3);
  }

  function setOverrideFeeWrapped(uint24 overrideFee) public {
    deltaPlugin.setOverrideFee(overrideFee % 1e6);
  }

  function swapWithDeltasWrapped(bool zeroToOne, int128 amountRequired, uint160 limitSqrtPrice) public {
    require(amountRequired != 0);
    limitSqrtPrice = _beforeCheckedSwap(zeroToOne, amountRequired > 0, limitSqrtPrice);

    (int256 amount0, int256 amount1) = IAlgebraPool(this).swap(address(this), zeroToOne, amountRequired, limitSqrtPrice, '');

    (int256 amountIn, int256 amountOut) = _checkSwap(zeroToOne, amountRequired, amount0, amount1, limitSqrtPrice, false);
    // the empty callback data makes the mock pay exactly what the pool asks for: the reported input, deltas included
    (uint256 tokenIn, ) = _tokens(zeroToOne);
    assert(paidBySwapper[tokenIn] == uint256(amountIn));
    assert(sentToSwapper[tokenIn] == 0);
    if (amountRequired > 0) assert(amountIn <= amountRequired);
    else assert(-amountOut <= -int256(amountRequired));
  }

  function swapWithPaymentInAdvanceDeltasWrapped(bool zeroToOne, uint128 amountToSell, uint160 limitSqrtPrice) public {
    require(amountToSell > 0);
    limitSqrtPrice = _beforeCheckedSwap(zeroToOne, true, limitSqrtPrice);

    (int256 amount0, int256 amount1) = IAlgebraPool(this).swapWithPaymentInAdvance(
      address(this),
      address(this),
      zeroToOne,
      int256(uint256(amountToSell)),
      limitSqrtPrice,
      ''
    );

    (int256 spent, ) = _checkSwap(zeroToOne, int256(uint256(amountToSell)), amount0, amount1, limitSqrtPrice, true);
    // the whole amount is paid upfront, the leftovers are returned, the plugin part is spent
    (uint256 tokenIn, ) = _tokens(zeroToOne);
    assert(spent >= 0 && spent <= int256(uint256(amountToSell)));
    assert(paidBySwapper[tokenIn] == amountToSell);
    assert(sentToSwapper[tokenIn] == uint256(amountToSell) - uint256(spent));
  }

  /// @dev Sets the deltas allowed for the swap type, so that most of the swaps succeed
  function _beforeCheckedSwap(bool zeroToOne, bool exactIn, uint160 limitSqrtPrice) private returns (uint160) {
    // the setters are reachable, so the plugin or its hooks may have been swapped out
    require(plugin == address(deltaPlugin));
    uint16 pluginConfig = globalState.pluginConfig;
    require(Plugins.hasFlag(pluginConfig, Plugins.BEFORE_SWAP_FLAG));
    require(Plugins.hasFlag(pluginConfig, Plugins.AFTER_SWAP_FLAG));
    require(Plugins.hasFlag(pluginConfig, Plugins.AFTER_SWAP_CALCULATION_FLAG));
    // a vault at either address would make its payments indistinguishable from theirs
    require(communityVault != plugin && communityVault != address(this));

    Deltas memory d = deltas;
    deltaPlugin.setInDecrease(exactIn ? d.inDecreaseShare : 0, true, d.target == 0 ? d.addend : 0);
    deltaPlugin.setInIncrease(exactIn ? 0 : d.inIncreaseShare, true, d.target == 1 ? d.addend : 0);
    deltaPlugin.setOutDecrease(exactIn ? d.outDecreaseShare : 0, true, d.target == 2 ? d.addend : 0);

    // an excess from `donate` is absorbed by the swap, which is covered by the other suites
    require(balance0 == reserve0 && balance1 == reserve1);
    delete sentToPlugin;
    delete sentToVault;
    delete sentToSwapper;
    delete paidBySwapper;
    balanceBefore = [balance0, balance1];
    priceBefore = globalState.price;

    uint8 feeMode = globalState.feeMode;
    feeToken = (feeMode == Constants.FEE_MODE_DEFAULT ? zeroToOne : feeMode == Constants.FEE_MODE_TOKEN0) ? 0 : 1;
    otherTokenFeePendingBefore = feeToken == 0 ? communityFeePending1 : communityFeePending0;
    return _clampLimit(zeroToOne, limitSqrtPrice);
  }

  function _checkSwap(
    bool zeroToOne,
    int256 amountRequired,
    int256 amount0,
    int256 amount1,
    uint160 limitSqrtPrice,
    bool withPaymentInAdvance
  ) private view returns (int256 amountIn, int256 amountOut) {
    (uint256 tokenIn, uint256 tokenOut) = _tokens(zeroToOne);
    (amountIn, amountOut) = zeroToOne ? (amount0, amount1) : (amount1, amount0);
    (int256 calcIn, int256 calcOut) = zeroToOne
      ? (deltaPlugin.seenCalc0(), deltaPlugin.seenCalc1())
      : (deltaPlugin.seenCalc1(), deltaPlugin.seenCalc0());

    // the deltas only move tokens between the caller and the plugin, exactly as the plugin set them
    assert(calcIn >= 0 && calcOut <= 0);
    assert(sentToPlugin[tokenIn] == _expectedInputDeltas(amountRequired, uint256(calcIn)));
    assert(sentToPlugin[tokenOut] == _expectedOutputDelta(uint256(-calcOut)));
    assert(amountIn == calcIn + int256(sentToPlugin[tokenIn]));
    assert(amountOut == calcOut + int256(sentToPlugin[tokenOut]));
    assert(sentToSwapper[tokenOut] == uint256(-amountOut));
    assert(paidBySwapper[tokenOut] == 0);

    // the hooks get the amount as the caller gave it, not reduced by amountInDecrease
    assert(deltaPlugin.seenAmountRequired() == amountRequired);
    assert(deltaPlugin.seenCalcAmountRequired() == amountRequired);
    assert(deltaPlugin.seenWithPaymentInAdvance() == withPaymentInAdvance);

    // the pool, together with what it sent to the vault, moves exactly by the swap math amounts and stays in sync
    assert(int256(_balanceOf(tokenIn) + sentToVault[tokenIn]) - int256(balanceBefore[tokenIn]) == calcIn);
    assert(int256(_balanceOf(tokenOut) + sentToVault[tokenOut]) - int256(balanceBefore[tokenOut]) == calcOut);
    assert(balance0 == reserve0 && balance1 == reserve1);

    // the community fee of the swap stays in its fee token
    uint256 otherTokenFee = (feeToken == 0 ? communityFeePending1 : communityFeePending0) + sentToVault[1 - feeToken];
    assert(otherTokenFee == otherTokenFeePendingBefore);

    // the plugin sees what the caller paid and received
    assert(deltaPlugin.seenAfterSwap0() == amount0 && deltaPlugin.seenAfterSwap1() == amount1);

    uint160 priceAfter = globalState.price;
    if (zeroToOne) assert(priceAfter <= priceBefore && priceAfter >= limitSqrtPrice);
    else assert(priceAfter >= priceBefore && priceAfter <= limitSqrtPrice);
  }

  /// @dev What the plugin returns for the input side, with the same rounding as `MockDeltaPlugin`
  function _expectedInputDeltas(int256 amountRequired, uint256 calcIn) private view returns (uint256) {
    Deltas memory d = deltas;
    if (amountRequired > 0) {
      uint256 base = uint256(amountRequired);
      return FullMath.mulDiv(base, d.inDecreaseShare, 1e6) + (d.target == 0 ? d.addend : 0);
    }
    return FullMath.mulDiv(calcIn, d.inIncreaseShare, 1e6) + (d.target == 1 ? d.addend : 0);
  }

  function _expectedOutputDelta(uint256 calcOut) private view returns (uint256) {
    if (deltaPlugin.seenCalcAmountRequired() < 0) return 0;
    Deltas memory d = deltas;
    return FullMath.mulDiv(calcOut, d.outDecreaseShare, 1e6) + (d.target == 2 ? d.addend : 0);
  }

  function _tokens(bool zeroToOne) private pure returns (uint256 tokenIn, uint256 tokenOut) {
    (tokenIn, tokenOut) = zeroToOne ? (0, 1) : (1, 0);
  }

  function _balanceOf(uint256 token) private view returns (uint256) {
    return token == 0 ? balance0 : balance1;
  }

  function _transfer(address token, address to, uint256 amount) internal override {
    super._transfer(token, to, amount);
    uint256 index = token == token0 ? 0 : 1;
    // the counters are reset before each checked swap, but other calls may pile up more than a checked sum can hold
    unchecked {
      if (to == address(deltaPlugin)) sentToPlugin[index] += amount;
      else if (to == communityVault) sentToVault[index] += amount;
      else if (to == address(this)) sentToSwapper[index] += amount;
    }
  }

  function _swapCallback(int256 amount0, int256 amount1, bytes calldata data) internal override {
    super._swapCallback(amount0, amount1, data);
    if (data.length == 0) {
      unchecked {
        if (amount0 > 0) paidBySwapper[0] += uint256(amount0);
        else if (amount1 > 0) paidBySwapper[1] += uint256(amount1);
      }
    }
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
