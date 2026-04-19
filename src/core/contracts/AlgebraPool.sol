// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;
pragma abicoder v1;

import './base/AlgebraPoolBase.sol';
import './base/ReentrancyGuard.sol';
import './base/Positions.sol';
import './base/SwapCalculation.sol';
import './base/ReservesManager.sol';
import './base/TickStructure.sol';

import './libraries/FullMath.sol';
import './libraries/Constants.sol';
import './libraries/SafeCast.sol';
import './libraries/TickMath.sol';
import './libraries/LiquidityMath.sol';
import './libraries/Plugins.sol';

import './interfaces/plugin/IAlgebraPlugin.sol';
import './interfaces/IAlgebraFactory.sol';


/// @title Algebra concentrated liquidity pool
/// @notice This contract is responsible for liquidity positions, swaps and flashloans
/// @dev Version: Algebra Integral 1.3
contract AlgebraPool is AlgebraPoolBase, TickStructure, ReentrancyGuard, Positions, SwapCalculation, ReservesManager {
  using SafeCast for uint256;
  using SafeCast for uint128;
  using Plugins for uint16;
  using Plugins for bytes4;

  /// @inheritdoc IAlgebraPoolActions
  function initialize(uint160 initialPrice) external override {
    int24 tick = TickMath.getTickAtSqrtRatio(initialPrice); // getTickAtSqrtRatio checks validity of initialPrice inside
    if (globalState.price != 0) revert alreadyInitialized(); // after initialization, the price can never become zero
    globalState.price = initialPrice;
    globalState.tick = tick;
    emit Initialize(initialPrice, tick);

    if (plugin != address(0)) {
      IAlgebraPlugin(plugin).beforeInitialize(msg.sender, initialPrice).shouldReturn(IAlgebraPlugin.beforeInitialize.selector);
    }

    (uint16 _communityFee, int24 _tickSpacing, uint16 _fee, uint16 _algebraFee) = _getDefaultConfiguration();

    _setFee(_fee);
    _setTickSpacing(_tickSpacing);
    if (_communityFee != 0 && communityVault == address(0)) revert invalidNewCommunityFee(); // the pool should not accumulate a community fee without a vault
    _setCommunityFee(_communityFee);
    _setAlgebraFee(_algebraFee);

    if (globalState.pluginConfig.hasFlag(Plugins.AFTER_INIT_FLAG)) {
      IAlgebraPlugin(plugin).afterInitialize(msg.sender, initialPrice, tick).shouldReturn(IAlgebraPlugin.afterInitialize.selector);
    }
  }

  /// @inheritdoc IAlgebraPoolActions
  function mint(
    address leftoversRecipient,
    address recipient,
    int24 bottomTick,
    int24 topTick,
    uint128 liquidityDesired,
    bytes calldata data
  ) external override onlyValidTicks(bottomTick, topTick) returns (uint256 amount0, uint256 amount1, uint128 liquidityActual) {
    if (liquidityDesired == 0) revert zeroLiquidityDesired();

    _beforeModifyPos(recipient, bottomTick, topTick, liquidityDesired.toInt128(), data);
    _lock();

    {
      // scope to prevent stack too deep
      int24 currentTick = globalState.tick;
      uint160 currentPrice = globalState.price;
      if (currentPrice == 0) revert notInitialized();

      unchecked {
        int24 _tickSpacing = tickSpacing;
        if (bottomTick % _tickSpacing | topTick % _tickSpacing != 0) revert tickIsNotSpaced();
      }

      (amount0, amount1, ) = LiquidityMath.getAmountsForLiquidity(bottomTick, topTick, liquidityDesired.toInt128(), currentTick, currentPrice);
    }

    (uint256 receivedAmount0, uint256 receivedAmount1) = _updateReserves();
    _mintCallback(amount0, amount1, data); // IAlgebraMintCallback.algebraMintCallback to msg.sender

    receivedAmount0 = amount0 == 0 ? 0 : _balanceToken0() - receivedAmount0;
    receivedAmount1 = amount1 == 0 ? 0 : _balanceToken1() - receivedAmount1;

    if (receivedAmount0 < amount0) {
      liquidityActual = uint128(FullMath.mulDiv(uint256(liquidityDesired), receivedAmount0, amount0));
    } else {
      liquidityActual = liquidityDesired;
    }
    if (receivedAmount1 < amount1) {
      uint128 liquidityForRA1 = uint128(FullMath.mulDiv(uint256(liquidityDesired), receivedAmount1, amount1));
      if (liquidityForRA1 < liquidityActual) liquidityActual = liquidityForRA1;
    }
    if (liquidityActual == 0) revert zeroLiquidityActual();

    // scope to prevent "stack too deep"
    {
      Position storage _position = getOrCreatePosition(recipient, bottomTick, topTick);
      (amount0, amount1) = _updatePositionTicksAndFees(_position, bottomTick, topTick, liquidityActual.toInt128());
    }

    unchecked {
      // return leftovers
      if (amount0 > 0) {
        if (receivedAmount0 > amount0) _transfer(token0, leftoversRecipient, receivedAmount0 - amount0);
        else assert(receivedAmount0 == amount0); // must always be true
      }
      if (amount1 > 0) {
        if (receivedAmount1 > amount1) _transfer(token1, leftoversRecipient, receivedAmount1 - amount1);
        else assert(receivedAmount1 == amount1); // must always be true
      }
    }

    _changeReserves(int256(amount0), int256(amount1), 0, 0);
    emit Mint(msg.sender, recipient, bottomTick, topTick, liquidityActual, amount0, amount1);

    _unlock();
    _afterModifyPos(recipient, bottomTick, topTick, liquidityActual.toInt128(), amount0, amount1, data);
  }

  /// @inheritdoc IAlgebraPoolActions
  function burn(
    int24 bottomTick,
    int24 topTick,
    uint128 amount,
    bytes calldata data
  ) external override onlyValidTicks(bottomTick, topTick) returns (uint256 amount0, uint256 amount1) {
    if (amount > uint128(type(int128).max)) revert arithmeticError();

    int128 liquidityDelta = -int128(amount);

    _beforeModifyPos(msg.sender, bottomTick, topTick, liquidityDelta, data);
    _lock();

    _updateReserves();
    {
      Position storage position = getOrCreatePosition(msg.sender, bottomTick, topTick);

      (amount0, amount1) = _updatePositionTicksAndFees(position, bottomTick, topTick, liquidityDelta);

      if (amount0 | amount1 != 0) {
        // since we do not support tokens whose total supply can exceed uint128, these casts are safe
        // and, theoretically, unchecked cast prevents a complete blocking of burn
        (position.fees0, position.fees1) = (position.fees0 + uint128(amount0), position.fees1 + uint128(amount1));
      }
    }

    if (amount | amount0 | amount1 != 0) {
      emit Burn(msg.sender, bottomTick, topTick, amount, amount0, amount1);
    }

    _unlock();
    _afterModifyPos(msg.sender, bottomTick, topTick, liquidityDelta, amount0, amount1, data);
  }

  function _isPlugin() internal view returns (bool) {
    return msg.sender == plugin;
  }

  function _beforeModifyPos(
    address owner,
    int24 bottomTick,
    int24 topTick,
    int128 liquidityDelta,
    bytes calldata data
  ) internal {
    if (globalState.pluginConfig.hasFlag(Plugins.BEFORE_POSITION_MODIFY_FLAG)) {
      if (_isPlugin()) return;
      bytes4 selector = IAlgebraPlugin(plugin).beforeModifyPosition(msg.sender, owner, bottomTick, topTick, liquidityDelta, data);
      selector.shouldReturn(IAlgebraPlugin.beforeModifyPosition.selector);
    }
  }

  function _afterModifyPos(address owner, int24 bTick, int24 tTick, int128 deltaL, uint256 amount0, uint256 amount1, bytes calldata data) internal {
    if (_isPlugin()) return;
    if (globalState.pluginConfig.hasFlag(Plugins.AFTER_POSITION_MODIFY_FLAG)) {
      IAlgebraPlugin(plugin).afterModifyPosition(msg.sender, owner, bTick, tTick, deltaL, amount0, amount1, data).shouldReturn(
        IAlgebraPlugin.afterModifyPosition.selector
      );
    }
  }

  /// @inheritdoc IAlgebraPoolActions
  function collect(
    address recipient,
    int24 bottomTick,
    int24 topTick,
    uint128 amount0Requested,
    uint128 amount1Requested
  ) external override returns (uint128 amount0, uint128 amount1) {
    _lock();
    // we don't check tick range validity, because if ticks are incorrect, the position will be empty
    Position storage position = getOrCreatePosition(msg.sender, bottomTick, topTick);
    (uint128 positionFees0, uint128 positionFees1) = (position.fees0, position.fees1);

    if (amount0Requested > positionFees0) amount0Requested = positionFees0;
    if (amount1Requested > positionFees1) amount1Requested = positionFees1;

    if (amount0Requested | amount1Requested != 0) {
      // use one if since fees0 and fees1 are tightly packed
      (amount0, amount1) = (amount0Requested, amount1Requested);

      unchecked {
        // single SSTORE
        (position.fees0, position.fees1) = (positionFees0 - amount0, positionFees1 - amount1);

        if (amount0 > 0) _transfer(token0, recipient, amount0);
        if (amount1 > 0) _transfer(token1, recipient, amount1);
        _changeReserves(-int256(uint256(amount0)), -int256(uint256(amount1)), 0, 0);
      }
      emit Collect(msg.sender, recipient, bottomTick, topTick, amount0, amount1);
    }
    _unlock();
  }

  struct SwapEventParams {
    uint160 currentPrice;
    int24 currentTick;
    uint128 currentLiquidity;
  }

  struct SwapCache {
    address recipient;
    bool zeroToOne;
    int256 amountRequired;
    uint160 limitSqrtPrice;
    bytes data;
    uint24 overrideFee;
    uint256 amountInDecrease;
  }

  /// @inheritdoc IAlgebraPoolActions
  function swap(
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    bytes calldata data
  ) external override returns (int256 amount0, int256 amount1) {
    SwapCache memory _cache = SwapCache(recipient, zeroToOne, amountRequired, limitSqrtPrice, data, 0, 0);

    // amountInDecrease is either in token0 or token1 depending on zeroToOne
    // can only be non-zero if exactIn!
    // can only decrease the input token affecting the amount passed to the swap calculation
    (_cache.amountInDecrease, _cache.overrideFee) = _beforeSwap(
      _cache.recipient,
      _cache.zeroToOne,
      _cache.amountRequired,
      _cache.limitSqrtPrice,
      false,
      data
    );
    _lock();
    FeesAmount memory fees;
    {
      // scope to prevent "stack too deep"
      SwapEventParams memory eventParams;
      (amount0, amount1, eventParams.currentPrice, eventParams.currentTick, eventParams.currentLiquidity, fees) = _calculateSwap(
        _cache.overrideFee,
        _cache.zeroToOne,
        _cache.amountRequired - int256(_cache.amountInDecrease),
        _cache.limitSqrtPrice
      );

      // amountInIncrease, amountOutDecrease is either in token0 or token1 respectively depending on zeroToOne
      // can only increase the input (for the exactOut case)
      // can only decrease the output (for the exactIn case)
      (uint256 amountInIncrease, uint256 amountOutDecrease) = _afterSwapCalculation(
        _cache.recipient,
        _cache.zeroToOne,
        _cache.amountRequired,
        _cache.limitSqrtPrice,
        amount0,
        amount1,
        _cache.data
      );

      (uint256 balance0Before, uint256 balance1Before) = _updateReserves();

      if (_cache.zeroToOne) {
        // These amounts are representing pool <-> user payments
        // Increase because amount1 is negative. It makes the pool send less to the user
        amount1 += int256(amountOutDecrease);
        // Increase amount0. It makes the user send more to the pool (this excess part will go to a plugin)
        // amountInIncrease from _afterSwapCalculation() could be based on the amountIn as a result of swapCalculation (exactOut)
        amount0 += int256(amountInIncrease);
        unchecked {
          if (amount1 < 0) _transfer(token1, _cache.recipient, uint256(-amount1)); // amount1 cannot be > 0
        }
        // totalAmount0 represents total amount of input token that user must send to pool
        int256 totalAmount0 = amount0 + int256(_cache.amountInDecrease);
        // in case of exactIn amount0 returned from _calculateSwap should be equal to amountRequired - amountInDecrease
        // FAKE. Because if there is not enough liquidity then amountIn might be less then amountRequired
        //        if (_cache.amountRequired > 0 ) {
        //          assert(_cache.amountRequired == totalAmount0);
        //        }
        // optionally user also has to pay amountInDecrease to plugin
        // amountInDecrease from _beforeSwap() could be based on the amountIn given as input (exactIn)
        _swapCallback(totalAmount0, amount1, data); // callback to get tokens from the msg.sender
        if (balance0Before + uint256(totalAmount0) > _balanceToken0()) revert insufficientInputAmount();

        if (amountInIncrease + _cache.amountInDecrease > 0) _transfer(token0, plugin, amountInIncrease + _cache.amountInDecrease);
        if (amountOutDecrease > 0) _transfer(token1, plugin, amountOutDecrease);
        _changeReserves(amount0 - int256(amountInIncrease), amount1 - int256(amountOutDecrease), fees.communityFeeAmount, 0); // reflect reserve change and pay communityFee
      } else {
        // These amounts are representing pool <-> user payments
        // Increase because amount0 is negative. It makes the pool send less to the user
        amount0 += int256(amountOutDecrease);
        // Increase amount1. It makes the user send more to the pool
        amount1 += int256(amountInIncrease);

        unchecked {
          if (amount0 < 0) _transfer(token0, _cache.recipient, uint256(-amount0)); // amount0 cannot be > 0
        }
        // optionally user also has to pay amountInDecrease to plugin
        // amountInDecrease from _beforeSwap() could be based on the amountIn given as input (exactIn)
        int256 totalAmount1 = amount1 + int256(_cache.amountInDecrease);
        _swapCallback(amount0, totalAmount1, data); // callback to get tokens from the msg.sender
        if (balance1Before + uint256(totalAmount1) > _balanceToken1()) revert insufficientInputAmount();

        if ((amountInIncrease + _cache.amountInDecrease) > 0) _transfer(token1, plugin, amountInIncrease + _cache.amountInDecrease);
        if (amountOutDecrease > 0) _transfer(token0, plugin, amountOutDecrease);
        _changeReserves(amount0 - int256(amountOutDecrease), amount1 - int256(amountInIncrease), 0, fees.communityFeeAmount); // reflect reserve change and pay communityFee
      }

      _emitSwapEvent(
        _cache.recipient,
        amount0,
        amount1,
        eventParams.currentPrice,
        eventParams.currentLiquidity,
        eventParams.currentTick,
        _cache.overrideFee
      );
    }

    _unlock();
    _afterSwap(_cache.recipient, _cache.zeroToOne, _cache.amountRequired, _cache.limitSqrtPrice, amount0, amount1, fees.totalSwapFeeAmount, data);
  }

  /// @inheritdoc IAlgebraPoolActions
  function swapWithPaymentInAdvance(
    address leftoversRecipient,
    address recipient,
    bool zeroToOne,
    int256 amountToSell,
    uint160 limitSqrtPrice,
    bytes calldata data
  ) external override returns (int256 amount0, int256 amount1) {
    if (amountToSell < 0) revert invalidAmountRequired(); // we support only exactInput here

    _lock();
    // firstly we are getting tokens from the original caller of the transaction
    // since the pool can get less/more tokens then expected, _amountToSell_ can be changed
    {
      // scope to prevent "stack too deep"
      int256 amountReceived;
      if (zeroToOne) {
        uint256 balanceBefore = _balanceToken0();
        _swapCallback(amountToSell, 0, data); // callback to get tokens from the msg.sender
        uint256 balanceAfter = _balanceToken0();
        amountReceived = (balanceAfter - balanceBefore).toInt256();
        _changeReserves(amountReceived, 0, 0, 0);
      } else {
        uint256 balanceBefore = _balanceToken1();
        _swapCallback(0, amountToSell, data); // callback to get tokens from the msg.sender
        uint256 balanceAfter = _balanceToken1();
        amountReceived = (balanceAfter - balanceBefore).toInt256();
        _changeReserves(0, amountReceived, 0, 0);
      }
      if (amountReceived != amountToSell) amountToSell = amountReceived;
    }
    if (amountToSell == 0) revert insufficientInputAmount();

    _unlock();
    (, uint24 overrideFee) = _beforeSwap(recipient, zeroToOne, amountToSell, limitSqrtPrice, true, data);
    _lock();

    _updateReserves();

    SwapEventParams memory eventParams;
    FeesAmount memory fees;
    (amount0, amount1, eventParams.currentPrice, eventParams.currentTick, eventParams.currentLiquidity, fees) = _calculateSwap(
      overrideFee,
      zeroToOne,
      amountToSell,
      limitSqrtPrice
    );

    unchecked {
      // transfer to the recipient
      if (zeroToOne) {
        if (amount1 < 0) _transfer(token1, recipient, uint256(-amount1)); // amount1 cannot be > 0
        uint256 leftover = uint256(amountToSell - amount0); // return the leftovers
        if (leftover != 0) _transfer(token0, leftoversRecipient, leftover);
        _changeReserves(-leftover.toInt256(), amount1, fees.communityFeeAmount, 0); // reflect reserve change and pay communityFee
      } else {
        if (amount0 < 0) _transfer(token0, recipient, uint256(-amount0)); // amount0 cannot be > 0
        uint256 leftover = uint256(amountToSell - amount1); // return the leftovers
        if (leftover != 0) _transfer(token1, leftoversRecipient, leftover);
        _changeReserves(amount0, -leftover.toInt256(), 0, fees.communityFeeAmount); // reflect reserve change and pay communityFee
      }
    }

    _emitSwapEvent(
      recipient,
      amount0,
      amount1,
      eventParams.currentPrice,
      eventParams.currentLiquidity,
      eventParams.currentTick,
      overrideFee
    );

    _unlock();
    _afterSwap(recipient, zeroToOne, amountToSell, limitSqrtPrice, amount0, amount1, fees.totalSwapFeeAmount, data);
  }

  /// @dev internal function to reduce bytecode size
  function _emitSwapEvent(
    address recipient,
    int256 amount0,
    int256 amount1,
    uint160 newPrice,
    uint128 newLiquidity,
    int24 newTick,
    uint24 overrideFee
  ) private {
    emit SwapFee(msg.sender, overrideFee);
    emit Swap(msg.sender, recipient, amount0, amount1, newPrice, newLiquidity, newTick);
  }

  function _beforeSwap(
    address recipient,
    bool zto,
    int256 amount,
    uint160 limitPrice,
    bool payInAdvance,
    bytes calldata data
  ) internal returns (uint256 amountInDecrease, uint24 overrideFee) {
    uint16 pluginConfig = globalState.pluginConfig;
    if (pluginConfig.hasFlag(Plugins.BEFORE_SWAP_FLAG)) {
      if (_isPlugin()) return (0, 0);
      bytes4 selector;
      (amountInDecrease, selector, overrideFee) = IAlgebraPlugin(plugin).beforeSwap(
        msg.sender,
        recipient,
        zto,
        amount,
        limitPrice,
        payInAdvance,
        data
      );
      if (!pluginConfig.hasFlag(Plugins.DYNAMIC_FEE) && overrideFee > 0) revert dynamicFeeDisabled();
      // amountInDecrease is only valid for exactIn (amount > 0) and must be less than amount
      if (amountInDecrease != 0 && (amount < 0 || amountInDecrease >= uint256(amount))) revert invalidAmountInDecrease();
      // we will check that fee is less than denominator inside the swap calculation
      selector.shouldReturn(IAlgebraPlugin.beforeSwap.selector);
    }
  }

  function _afterSwapCalculation(
    address recipient,
    bool zto,
    int256 amount,
    uint160 limitPrice,
    int256 amount0,
    int256 amount1,
    bytes memory data
  ) internal returns (uint256 amountInIncrease, uint256 amountOutDecrease) {
    if (globalState.pluginConfig.hasFlag(Plugins.AFTER_SWAP_CALCULATION_FLAG)) {
      if (_isPlugin()) return (0, 0);
      bytes4 selector;
      (selector, amountInIncrease, amountOutDecrease) = IAlgebraPlugin(plugin).afterSwapCalculation(
        msg.sender,
        recipient,
        zto,
        amount,
        limitPrice,
        amount0,
        amount1,
        data
      );
      // cannot increase input amount if it's exactIn; must fit in int256 to prevent overflow
      if (amountInIncrease > 0 && (amount > 0 || amountInIncrease > uint256(type(int256).max))) revert invalidAmountInIncrease();
      if (amountOutDecrease > 0) {
        // cannot decrease output amount if it's exactOut; should not exceed the actual output amount
        if (amount < 0) revert invalidAmountOutDecrease();
        uint256 absOutput = zto ? uint256(-amount1) : uint256(-amount0);
        if (amountOutDecrease > absOutput) revert invalidAmountOutDecrease();
      }
      selector.shouldReturn(IAlgebraPlugin.afterSwapCalculation.selector);
    }
  }

  function _afterSwap(address recipient, bool zto, int256 amount, uint160 limitPrice, int256 amount0, int256 amount1, uint256 totalSwapFeeAmount, bytes calldata data) internal {
    if (globalState.pluginConfig.hasFlag(Plugins.AFTER_SWAP_FLAG)) {
      if (_isPlugin()) return;
      IAlgebraPlugin(plugin).afterSwap(msg.sender, recipient, zto, amount, limitPrice, amount0, amount1, totalSwapFeeAmount, data).shouldReturn(
        IAlgebraPlugin.afterSwap.selector
      );
    }
  }

  /// @inheritdoc IAlgebraPoolActions
  function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external override {
    if (globalState.pluginConfig.hasFlag(Plugins.BEFORE_FLASH_FLAG)) {
      IAlgebraPlugin(plugin).beforeFlash(msg.sender, recipient, amount0, amount1, data).shouldReturn(IAlgebraPlugin.beforeFlash.selector);
    }
    _lock();

    uint256 paid0;
    uint256 paid1;
    {
      (uint256 balance0Before, uint256 balance1Before) = _updateReserves();
      uint256 fee0;
      if (amount0 > 0) {
        fee0 = FullMath.mulDivRoundingUp(amount0, Constants.FLASH_FEE, Constants.FEE_DENOMINATOR);
        _transfer(token0, recipient, amount0);
      }
      uint256 fee1;
      if (amount1 > 0) {
        fee1 = FullMath.mulDivRoundingUp(amount1, Constants.FLASH_FEE, Constants.FEE_DENOMINATOR);
        _transfer(token1, recipient, amount1);
      }

      _flashCallback(fee0, fee1, data); // IAlgebraFlashCallback.algebraFlashCallback to msg.sender

      paid0 = _balanceToken0();
      if (balance0Before + fee0 > paid0) revert flashInsufficientPaid0();
      paid1 = _balanceToken1();
      if (balance1Before + fee1 > paid1) revert flashInsufficientPaid1();

      unchecked {
        paid0 -= balance0Before;
        paid1 -= balance1Before;
      }

      uint256 _communityFee = globalState.communityFee;
      if (_communityFee > 0) {
        uint256 communityFee0;
        if (paid0 > 0) communityFee0 = FullMath.mulDiv(paid0, _communityFee, Constants.COMMUNITY_FEE_DENOMINATOR);
        uint256 communityFee1;
        if (paid1 > 0) communityFee1 = FullMath.mulDiv(paid1, _communityFee, Constants.COMMUNITY_FEE_DENOMINATOR);

        _changeReserves(int256(communityFee0), int256(communityFee1), communityFee0, communityFee1);
      }
      emit Flash(msg.sender, recipient, amount0, amount1, paid0, paid1);
    }

    _unlock();
    if (globalState.pluginConfig.hasFlag(Plugins.AFTER_FLASH_FLAG)) {
      IAlgebraPlugin(plugin).afterFlash(msg.sender, recipient, amount0, amount1, paid0, paid1, data).shouldReturn(IAlgebraPlugin.afterFlash.selector);
    }
  }

  // Permissioned setters are delegated to the extension contract to reduce pool bytecode size.
  // Setters are called rarely, so the additional gas overhead of delegatecall is acceptable

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setCommunityFee(uint16) external override { _delegateToExtension(); }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setTickSpacing(int24) external override { _delegateToExtension(); }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setPlugin(address) external override { _delegateToExtension(); }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setPluginConfig(uint16) external override { _delegateToExtension(); }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setCommunityVault(address) external override { _delegateToExtension(); }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setFee(uint16) external override { _delegateToExtension(); }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setAlgebraFee(uint16) external override { _delegateToExtension(); }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setAlgebraFeeReceiver(address) external override { _delegateToExtension(); }

  /// @dev using function to save bytecode
  function _checkIfPlugin() private view {
    if (msg.sender != plugin) revert notAllowed();
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function sync() external override {
    _checkIfPlugin();
    _lock();
    _updateReserves();
    _unlock();
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function skim() external override {
    _checkIfPlugin();
    _lock();
    _skimReserves(msg.sender);
    _unlock();
  }
}
