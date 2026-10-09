// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import './PoolMockEchidna.sol';
import '../../MockDeltaPlugin.sol';

/// @notice Checks that plugin amount deltas never leak into the pool: the pool moves exactly by the swap math amounts,
/// the plugin gets exactly the deltas and the caller never pays more than requested on exactIn
/// @dev The mock has no extension, so the pool is initialized and the plugin is connected directly in the constructor.
/// The community fee is zero, so nothing goes to the vault
contract AssertDeltasEchidnaTest is PoolMockEchidna {
  MockDeltaPlugin internal deltaPlugin;

  uint256 internal sentToPlugin0;
  uint256 internal sentToPlugin1;
  uint256 internal sentToOthers0;
  uint256 internal sentToOthers1;
  uint256 internal balance0Before;
  uint256 internal balance1Before;
  uint160 internal priceBefore;

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
    _setPluginConfig(uint16(Plugins.BEFORE_SWAP_FLAG | Plugins.AFTER_SWAP_FLAG | Plugins.AFTER_SWAP_CALCULATION_FLAG | Plugins.DYNAMIC_FEE | Plugins.AMOUNT_DELTAS_FLAG));

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

    _checkSwap(zeroToOne, amountRequired, amount0, amount1, limitSqrtPrice);
    // the empty callback data makes the mock pay exactly the requested amount
    if (amountRequired > 0) assert((zeroToOne ? amount0 : amount1) <= amountRequired);
    else assert(-(zeroToOne ? amount1 : amount0) <= -int256(amountRequired));
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

    _checkSwap(zeroToOne, int256(uint256(amountToSell)), amount0, amount1, limitSqrtPrice);
    // the leftovers are returned, the plugin part is spent
    int256 spent = zeroToOne ? amount0 : amount1;
    assert(spent >= 0 && spent <= int256(uint256(amountToSell)));
    assert((zeroToOne ? sentToOthers0 : sentToOthers1) == uint256(amountToSell) - uint256(spent));
  }

  /// @dev Sets the deltas allowed for the swap type, so that most of the swaps succeed
  function _beforeCheckedSwap(bool zeroToOne, bool exactIn, uint160 limitSqrtPrice) private returns (uint160) {
    Deltas memory d = deltas;
    deltaPlugin.setInDecrease(exactIn ? d.inDecreaseShare : 0, true, d.target == 0 ? d.addend : 0);
    deltaPlugin.setInIncrease(exactIn ? 0 : d.inIncreaseShare, true, d.target == 1 ? d.addend : 0);
    deltaPlugin.setOutDecrease(exactIn ? d.outDecreaseShare : 0, true, d.target == 2 ? d.addend : 0);

    // an excess from `donate` is absorbed by the swap, which is covered by the other suites
    require(balance0 == reserve0 && balance1 == reserve1);
    (sentToPlugin0, sentToPlugin1, sentToOthers0, sentToOthers1) = (0, 0, 0, 0);
    (balance0Before, balance1Before, priceBefore) = (balance0, balance1, globalState.price);
    return _clampLimit(zeroToOne, limitSqrtPrice);
  }

  function _checkSwap(bool zeroToOne, int256 amountRequired, int256 amount0, int256 amount1, uint160 limitSqrtPrice) private view {
    (int256 calcIn, int256 calcOut) = zeroToOne
      ? (deltaPlugin.seenCalc0(), deltaPlugin.seenCalc1())
      : (deltaPlugin.seenCalc1(), deltaPlugin.seenCalc0());

    // the deltas only move tokens between the caller and the plugin
    assert(calcIn >= 0 && calcOut <= 0);
    assert((zeroToOne ? amount0 : amount1) == calcIn + int256(zeroToOne ? sentToPlugin0 : sentToPlugin1));
    assert((zeroToOne ? amount1 : amount0) == calcOut + int256(zeroToOne ? sentToPlugin1 : sentToPlugin0));
    assert((zeroToOne ? sentToOthers1 : sentToOthers0) == uint256(-(zeroToOne ? amount1 : amount0)));
    assert(deltaPlugin.seenAmountRequired() == amountRequired);

    // the pool moves exactly by the swap math amounts and stays in sync with its reserves
    assert(int256(balance0) - int256(balance0Before) == (zeroToOne ? calcIn : calcOut));
    assert(int256(balance1) - int256(balance1Before) == (zeroToOne ? calcOut : calcIn));
    assert(balance0 == reserve0 && balance1 == reserve1);

    // the plugin sees what the caller paid and received
    assert(deltaPlugin.seenAfterSwap0() == amount0 && deltaPlugin.seenAfterSwap1() == amount1);

    uint160 priceAfter = globalState.price;
    if (zeroToOne) assert(priceAfter <= priceBefore && priceAfter >= limitSqrtPrice);
    else assert(priceAfter >= priceBefore && priceAfter <= limitSqrtPrice);
  }

  function _transfer(address token, address to, uint256 amount) internal override {
    super._transfer(token, to, amount);
    if (token == token0) {
      if (to == address(deltaPlugin)) sentToPlugin0 += amount;
      else sentToOthers0 += amount;
    } else {
      if (to == address(deltaPlugin)) sentToPlugin1 += amount;
      else sentToOthers1 += amount;
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
