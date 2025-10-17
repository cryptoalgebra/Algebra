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
/// @dev Version: Algebra Integral 1.2.2
contract AlgebraPool is AlgebraPoolBase, TickStructure, ReentrancyGuard, Positions, SwapCalculation, ReservesManager {
  using SafeCast for uint256;
  using SafeCast for uint128;
  using Plugins for uint8;
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

    (uint16 _communityFee, int24 _tickSpacing, uint16 _fee) = _getDefaultConfiguration();

    _setFee(_fee);
    _setTickSpacing(_tickSpacing);
    if (_communityFee != 0 && communityVault == address(0)) revert invalidNewCommunityFee(); // the pool should not accumulate a community fee without a vault
    _setCommunityFee(_communityFee);

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

    _changeReserves(int256(amount0), int256(amount1), 0, 0, 0, 0);
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

    uint24 pluginFee = _beforeModifyPos(msg.sender, bottomTick, topTick, liquidityDelta, data);
    _lock();

    _updateReserves();
    {
      Position storage position = getOrCreatePosition(msg.sender, bottomTick, topTick);

      (amount0, amount1) = _updatePositionTicksAndFees(position, bottomTick, topTick, liquidityDelta);

      if (pluginFee > 0) {
        uint256 deltaPluginFeePending0;
        uint256 deltaPluginFeePending1;

        if (amount0 > 0) {
          deltaPluginFeePending0 = FullMath.mulDiv(amount0, pluginFee, Constants.FEE_DENOMINATOR);
          amount0 -= deltaPluginFeePending0;
        }
        if (amount1 > 0) {
          deltaPluginFeePending1 = FullMath.mulDiv(amount1, pluginFee, Constants.FEE_DENOMINATOR);
          amount1 -= deltaPluginFeePending1;
        }

        _changeReserves(0, 0, 0, 0, deltaPluginFeePending0, deltaPluginFeePending1);
      }

      if (amount0 | amount1 != 0) {
        // since we do not support tokens whose total supply can exceed uint128, these casts are safe
        // and, theoretically, unchecked cast prevents a complete blocking of burn
        (position.fees0, position.fees1) = (position.fees0 + uint128(amount0), position.fees1 + uint128(amount1));
      }
    }

    if (amount | amount0 | amount1 != 0) {
      emit BurnFee(msg.sender, pluginFee);
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
  ) internal returns (uint24 pluginFee) {
    if (globalState.pluginConfig.hasFlag(Plugins.BEFORE_POSITION_MODIFY_FLAG)) {
      if (_isPlugin()) return 0;
      bytes4 selector;
      (selector, pluginFee) = IAlgebraPlugin(plugin).beforeModifyPosition(msg.sender, owner, bottomTick, topTick, liquidityDelta, data);
      if (pluginFee >= 1e6) revert incorrectPluginFee();
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
        _changeReserves(-int256(uint256(amount0)), -int256(uint256(amount1)), 0, 0, 0, 0);
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

  /// @inheritdoc IAlgebraPoolActions
  function swap(
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    bytes calldata data
  ) external override returns (int256 amount0, int256 amount1) {
    (uint24 overrideFee, uint24 pluginFee) = _beforeSwap(recipient, zeroToOne, amountRequired, limitSqrtPrice, false, data);
    _lock();

    {
      // scope to prevent "stack too deep"
      SwapEventParams memory eventParams;
      FeesAmount memory fees;
      (amount0, amount1, eventParams.currentPrice, eventParams.currentTick, eventParams.currentLiquidity, fees) = _calculateSwap(
        overrideFee,
        pluginFee,
        zeroToOne,
        amountRequired,
        limitSqrtPrice
      );
      (uint256 balance0Before, uint256 balance1Before) = _updateReserves();
      if (zeroToOne) {
        unchecked {
          if (amount1 < 0) _transfer(token1, recipient, uint256(-amount1)); // amount1 cannot be > 0
        }
        _swapCallback(amount0, amount1, data); // callback to get tokens from the msg.sender
        if (balance0Before + uint256(amount0) > _balanceToken0()) revert insufficientInputAmount();
        _changeReserves(amount0, amount1, fees.communityFeeAmount, 0, fees.pluginFeeAmount, 0); // reflect reserve change and pay communityFee
      } else {
        unchecked {
          if (amount0 < 0) _transfer(token0, recipient, uint256(-amount0)); // amount0 cannot be > 0
        }
        _swapCallback(amount0, amount1, data); // callback to get tokens from the msg.sender
        if (balance1Before + uint256(amount1) > _balanceToken1()) revert insufficientInputAmount();
        _changeReserves(amount0, amount1, 0, fees.communityFeeAmount, 0, fees.pluginFeeAmount); // reflect reserve change and pay communityFee
      }

      _emitSwapEvent(
        recipient,
        amount0,
        amount1,
        eventParams.currentPrice,
        eventParams.currentLiquidity,
        eventParams.currentTick,
        overrideFee,
        pluginFee
      );
    }

    _unlock();
    _afterSwap(recipient, zeroToOne, amountRequired, limitSqrtPrice, amount0, amount1, data);
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
        _changeReserves(amountReceived, 0, 0, 0, 0, 0);
      } else {
        uint256 balanceBefore = _balanceToken1();
        _swapCallback(0, amountToSell, data); // callback to get tokens from the msg.sender
        uint256 balanceAfter = _balanceToken1();
        amountReceived = (balanceAfter - balanceBefore).toInt256();
        _changeReserves(0, amountReceived, 0, 0, 0, 0);
      }
      if (amountReceived != amountToSell) amountToSell = amountReceived;
    }
    if (amountToSell == 0) revert insufficientInputAmount();

    _unlock();
    (uint24 overrideFee, uint24 pluginFee) = _beforeSwap(recipient, zeroToOne, amountToSell, limitSqrtPrice, true, data);
    _lock();

    _updateReserves();

    SwapEventParams memory eventParams;
    FeesAmount memory fees;
    (amount0, amount1, eventParams.currentPrice, eventParams.currentTick, eventParams.currentLiquidity, fees) = _calculateSwap(
      overrideFee,
      pluginFee,
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
        _changeReserves(-leftover.toInt256(), amount1, fees.communityFeeAmount, 0, fees.pluginFeeAmount, 0); // reflect reserve change and pay communityFee
      } else {
        if (amount0 < 0) _transfer(token0, recipient, uint256(-amount0)); // amount0 cannot be > 0
        uint256 leftover = uint256(amountToSell - amount1); // return the leftovers
        if (leftover != 0) _transfer(token1, leftoversRecipient, leftover);
        _changeReserves(amount0, -leftover.toInt256(), 0, fees.communityFeeAmount, 0, fees.pluginFeeAmount); // reflect reserve change and pay communityFee
      }
    }

    _emitSwapEvent(
      recipient,
      amount0,
      amount1,
      eventParams.currentPrice,
      eventParams.currentLiquidity,
      eventParams.currentTick,
      overrideFee,
      pluginFee
    );

    _unlock();
    _afterSwap(recipient, zeroToOne, amountToSell, limitSqrtPrice, amount0, amount1, data);
  }

  /// @dev internal function to reduce bytecode size
  function _emitSwapEvent(
    address recipient,
    int256 amount0,
    int256 amount1,
    uint160 newPrice,
    uint128 newLiquidity,
    int24 newTick,
    uint24 overrideFee,
    uint24 pluginFee
  ) private {
    emit SwapFee(msg.sender, overrideFee, pluginFee);
    emit Swap(msg.sender, recipient, amount0, amount1, newPrice, newLiquidity, newTick);
  }

  function _beforeSwap(
    address recipient,
    bool zto,
    int256 amount,
    uint160 limitPrice,
    bool payInAdvance,
    bytes calldata data
  ) internal returns (uint24 overrideFee, uint24 pluginFee) {
    uint8 pluginConfig = globalState.pluginConfig;
    if (pluginConfig.hasFlag(Plugins.BEFORE_SWAP_FLAG)) {
      if (_isPlugin()) return (0, 0);
      bytes4 selector;
      (selector, overrideFee, pluginFee) = IAlgebraPlugin(plugin).beforeSwap(msg.sender, recipient, zto, amount, limitPrice, payInAdvance, data);
      if (!pluginConfig.hasFlag(Plugins.DYNAMIC_FEE) && (overrideFee > 0 || pluginFee > 0)) revert dynamicFeeDisabled();
      // we will check that fee is less than denominator inside the swap calculation
      selector.shouldReturn(IAlgebraPlugin.beforeSwap.selector);
    }
  }

  function _afterSwap(address recipient, bool zto, int256 amount, uint160 limitPrice, int256 amount0, int256 amount1, bytes calldata data) internal {
    if (globalState.pluginConfig.hasFlag(Plugins.AFTER_SWAP_FLAG)) {
      if (_isPlugin()) return;
      IAlgebraPlugin(plugin).afterSwap(msg.sender, recipient, zto, amount, limitPrice, amount0, amount1, data).shouldReturn(
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

        _changeReserves(int256(communityFee0), int256(communityFee1), communityFee0, communityFee1, 0, 0);
      }
      emit Flash(msg.sender, recipient, amount0, amount1, paid0, paid1);
    }

    _unlock();
    if (globalState.pluginConfig.hasFlag(Plugins.AFTER_FLASH_FLAG)) {
      IAlgebraPlugin(plugin).afterFlash(msg.sender, recipient, amount0, amount1, paid0, paid1, data).shouldReturn(IAlgebraPlugin.afterFlash.selector);
    }
  }

  /// @dev using function to save bytecode
  function _checkIfAdministrator() private view {
    if (!IAlgebraFactory(factory).hasRoleOrOwner(Constants.POOLS_ADMINISTRATOR_ROLE, msg.sender)) revert notAllowed();
  }

  // permissioned actions use reentrancy lock to prevent call from callback (to keep the correct order of events, etc.)

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setCommunityFee(uint16 newCommunityFee) external override onlyUnlocked {
    _checkIfAdministrator();
    if (
      newCommunityFee > Constants.MAX_COMMUNITY_FEE ||
      newCommunityFee == globalState.communityFee ||
      (newCommunityFee != 0 && communityVault == address(0))
    ) revert invalidNewCommunityFee();
    _setCommunityFee(newCommunityFee);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setTickSpacing(int24 newTickSpacing) external override onlyUnlocked {
    _checkIfAdministrator();
    if (newTickSpacing <= 0 || newTickSpacing > Constants.MAX_TICK_SPACING || tickSpacing == newTickSpacing) revert invalidNewTickSpacing();
    _setTickSpacing(newTickSpacing);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setPlugin(address newPluginAddress) external override onlyUnlocked {
    _checkIfAdministrator();
    _setPluginConfig(0);
    _setPlugin(newPluginAddress);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setPluginConfig(uint8 newConfig) external override onlyUnlocked {
    address _plugin = plugin;
    if (_plugin == address(0)) revert pluginIsNotConnected(); // it is not allowed to set plugin config without plugin

    if (msg.sender != _plugin) _checkIfAdministrator();

    _setPluginConfig(newConfig);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setCommunityVault(address newCommunityVault) external override onlyUnlocked {
    // factory is allowed to set initial vault
    if (msg.sender != factory) _checkIfAdministrator();
    if (newCommunityVault == address(0) && globalState.communityFee != 0) _setCommunityFee(0); // the pool should not accumulate a community fee without a vault
    _setCommunityFeeVault(newCommunityVault); // accumulated but not yet sent to the vault community fees once will be sent to the `newCommunityVault` address
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setFee(uint16 newFee) external override {
    _checkIfAdministrator();
    bool isDynamicFeeEnabled = globalState.pluginConfig.hasFlag(Plugins.DYNAMIC_FEE);
    if (!globalState.unlocked) revert locked(); // cheaper to check lock here
    if (isDynamicFeeEnabled) revert dynamicFeeActive();
    _setFee(newFee);
  }

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
