// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;
pragma abicoder v1;

import './base/AlgebraPoolBase.sol';
import './base/ReentrancyGuard.sol';
import './base/Positions.sol';
import './base/SwapCalculation.sol';
import './base/ReservesManager.sol';
import './base/TickStructure.sol';

import './libraries/FullMath.sol';
import './libraries/Constants.sol';
import './libraries/SafeTransfer.sol';
import './libraries/SafeCast.sol';
import './libraries/TickMath.sol';
import './libraries/LiquidityMath.sol';
import './libraries/Plugins.sol';

import './interfaces/IAlgebraFactory.sol';
import './interfaces/callback/IAlgebraMintCallback.sol';
import './interfaces/callback/IAlgebraFlashCallback.sol';

/// @title Algebra concentrated liquidity pool
/// @notice This contract is responsible for liquidity positions, swaps and flashloans
/// @dev Version: Algebra V2.1
contract AlgebraPool is AlgebraPoolBase, TickStructure, ReentrancyGuard, Positions, SwapCalculation, ReservesManager {
  using SafeCast for uint256;
  using SafeCast for uint128;
  using Plugins for uint8;

  /// @inheritdoc IAlgebraPoolActions
  function initialize(uint160 initialPrice) external override {
    if (globalState.price != 0) revert alreadyInitialized(); // after initialization, the price can never become zero

    int24 tick = TickMath.getTickAtSqrtRatio(initialPrice); // getTickAtSqrtRatio checks validity of initialPrice inside

    if (plugin != address(0)) {
      IAlgebraPlugin(plugin).beforeInitialize(msg.sender, initialPrice);
    }

    (uint16 _communityFee, int24 _tickSpacing, uint16 _fee) = IAlgebraFactory(factory).defaultConfigurationForPool();
    tickSpacing = _tickSpacing;

    uint8 pluginConfig = globalState.pluginConfig;

    globalState.price = initialPrice;
    globalState.tick = tick;
    globalState.fee = _fee;
    globalState.communityFee = _communityFee;
    globalState.unlocked = true;

    emit Initialize(initialPrice, tick);
    emit TickSpacing(_tickSpacing);
    emit CommunityFee(_communityFee);

    if (pluginConfig.hasFlag(Plugins.AFTER_INIT_FLAG)) {
      IAlgebraPlugin(plugin).afterInitialize(msg.sender, initialPrice, tick);
    }
  }

  /// @inheritdoc IAlgebraPoolActions
  function mint(
    address sender,
    address recipient,
    int24 bottomTick,
    int24 topTick,
    uint128 liquidityDesired,
    bytes calldata data
  ) external override onlyValidTicks(bottomTick, topTick) returns (uint256 amount0, uint256 amount1, uint128 liquidityActual) {
    if (liquidityDesired == 0) revert zeroLiquidityDesired();

    if (globalState.pluginConfig.hasFlag(Plugins.BEFORE_POSITION_MODIFY_FLAG)) {
      IAlgebraPlugin(plugin).beforeModifyPosition(msg.sender, bottomTick, topTick, liquidityDesired.toInt128()); // TODO REENTRANCY
    }

    unchecked {
      int24 _tickSpacing = tickSpacing;
      if (bottomTick % _tickSpacing | topTick % _tickSpacing != 0) revert tickIsNotSpaced();
    }

    _lock();

    (amount0, amount1, ) = LiquidityMath.getAmountsForLiquidity(
      bottomTick,
      topTick,
      liquidityDesired.toInt128(),
      globalState.tick,
      globalState.price
    );

    (uint256 receivedAmount0, uint256 receivedAmount1) = _updateReserves();
    IAlgebraMintCallback(msg.sender).algebraMintCallback(amount0, amount1, data);

    receivedAmount0 = amount0 == 0 ? 0 : _balanceToken0() - receivedAmount0;
    receivedAmount1 = amount1 == 0 ? 0 : _balanceToken1() - receivedAmount1;

    // scope to prevent "stack too deep"
    {
      Position storage _position = getOrCreatePosition(recipient, bottomTick, topTick);
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

      (amount0, amount1) = _updatePositionTicksAndFees(_position, bottomTick, topTick, liquidityActual.toInt128());
    }

    unchecked {
      if (amount0 > 0) {
        if (receivedAmount0 > amount0) SafeTransfer.safeTransfer(token0, sender, receivedAmount0 - amount0);
        else if (receivedAmount0 != amount0) revert insufficientAmountReceivedAtMint(); // should be impossible
      }

      if (amount1 > 0) {
        if (receivedAmount1 > amount1) SafeTransfer.safeTransfer(token1, sender, receivedAmount1 - amount1);
        else if (receivedAmount1 != amount1) revert insufficientAmountReceivedAtMint(); // should be impossible
      }
    }

    _changeReserves(int256(amount0), int256(amount1), 0, 0);
    emit Mint(msg.sender, recipient, bottomTick, topTick, liquidityActual, amount0, amount1);

    _unlock();

    if (globalState.pluginConfig.hasFlag(Plugins.AFTER_POSITION_MODIFY_FLAG)) {
      IAlgebraPlugin(plugin).afterModifyPosition(msg.sender, bottomTick, topTick, liquidityActual.toInt128(), amount0, amount1);
    }
  }

  /// @inheritdoc IAlgebraPoolActions
  function burn(
    int24 bottomTick,
    int24 topTick,
    uint128 amount
  ) external override onlyValidTicks(bottomTick, topTick) returns (uint256 amount0, uint256 amount1) {
    if (amount > uint128(type(int128).max)) revert arithmeticError();

    int128 liquidityDelta = -int128(amount);

    if (globalState.pluginConfig.hasFlag(Plugins.BEFORE_POSITION_MODIFY_FLAG)) {
      IAlgebraPlugin(plugin).beforeModifyPosition(msg.sender, bottomTick, topTick, liquidityDelta);
    }

    _lock();

    _updateReserves();
    Position storage position = getOrCreatePosition(msg.sender, bottomTick, topTick);

    (amount0, amount1) = _updatePositionTicksAndFees(position, bottomTick, topTick, liquidityDelta);

    if (amount0 | amount1 != 0) {
      (position.fees0, position.fees1) = (position.fees0 + uint128(amount0), position.fees1 + uint128(amount1));
    }

    if (amount | amount0 | amount1 != 0) emit Burn(msg.sender, bottomTick, topTick, amount, amount0, amount1);

    _unlock();

    if (globalState.pluginConfig.hasFlag(Plugins.AFTER_POSITION_MODIFY_FLAG)) {
      IAlgebraPlugin(plugin).afterModifyPosition(msg.sender, bottomTick, topTick, liquidityDelta, amount0, amount1);
    }
  }

  /// @inheritdoc IAlgebraPoolActions
  function collect(
    address recipient,
    int24 bottomTick,
    int24 topTick,
    uint128 amount0Requested,
    uint128 amount1Requested
  ) external override nonReentrant returns (uint128 amount0, uint128 amount1) {
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

        if (amount0 > 0) SafeTransfer.safeTransfer(token0, recipient, amount0);
        if (amount1 > 0) SafeTransfer.safeTransfer(token1, recipient, amount1);
        _changeReserves(-int256(uint256(amount0)), -int256(uint256(amount1)), 0, 0);
      }
      emit Collect(msg.sender, recipient, bottomTick, topTick, amount0, amount1);
    }
  }

  /// @inheritdoc IAlgebraPoolActions
  function swap(
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    bytes calldata data
  ) external override returns (int256 amount0, int256 amount1) {
    if (globalState.pluginConfig.hasFlag(Plugins.BEFORE_SWAP_FLAG)) {
      // TODO optimize
      IAlgebraPlugin(plugin).beforeSwap(msg.sender, zeroToOne, amountRequired, limitSqrtPrice);
    }

    _lock();

    uint160 currentPrice;
    int24 currentTick;
    uint128 currentLiquidity;
    uint256 communityFee;
    (amount0, amount1, currentPrice, currentTick, currentLiquidity, communityFee) = _calculateSwap(zeroToOne, amountRequired, limitSqrtPrice);
    (uint256 balance0Before, uint256 balance1Before) = _updateReserves();
    if (zeroToOne) {
      unchecked {
        if (amount1 < 0) SafeTransfer.safeTransfer(token1, recipient, uint256(-amount1));
      }
      _swapCallback(amount0, amount1, data); // callback to get tokens from the caller
      if (balance0Before + uint256(amount0) > _balanceToken0()) revert insufficientInputAmount();
      _changeReserves(amount0, amount1, communityFee, 0); // reflect reserve change and pay communityFee
    } else {
      unchecked {
        if (amount0 < 0) SafeTransfer.safeTransfer(token0, recipient, uint256(-amount0));
      }
      _swapCallback(amount0, amount1, data); // callback to get tokens from the caller
      if (balance1Before + uint256(amount1) > _balanceToken1()) revert insufficientInputAmount();
      _changeReserves(amount0, amount1, 0, communityFee); // reflect reserve change and pay communityFee
    }

    emit Swap(msg.sender, recipient, amount0, amount1, currentPrice, currentLiquidity, currentTick);

    _unlock();

    if (globalState.pluginConfig.hasFlag(Plugins.AFTER_SWAP_FLAG)) {
      // TODO optimize
      IAlgebraPlugin(plugin).afterSwap(msg.sender, zeroToOne, amountRequired, limitSqrtPrice, amount0, amount1);
    }
  }

  /// @inheritdoc IAlgebraPoolActions
  function swapSupportingFeeOnInputTokens(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    bytes calldata data
  ) external override returns (int256 amount0, int256 amount1) {
    if (amountRequired < 0) revert invalidAmountRequired(); // we support only exactInput here

    if (globalState.pluginConfig.hasFlag(Plugins.BEFORE_SWAP_FLAG)) {
      // TODO optimize
      IAlgebraPlugin(plugin).beforeSwap(msg.sender, zeroToOne, amountRequired, limitSqrtPrice); // TODO amountRequired can change
    }

    _lock();

    // Since the pool can get less tokens then sent, firstly we are getting tokens from the
    // original caller of the transaction. And change the _amountRequired_
    {
      // scope to prevent "stack too deep"
      (uint256 balance0Before, uint256 balance1Before) = _updateReserves();
      uint256 balanceBefore;
      uint256 balanceAfter;
      if (zeroToOne) {
        _swapCallback(amountRequired, 0, data);
        (balanceBefore, balanceAfter) = (balance0Before, _balanceToken0());
      } else {
        _swapCallback(0, amountRequired, data);
        (balanceBefore, balanceAfter) = (balance1Before, _balanceToken1());
      }

      int256 amountReceived = (balanceAfter - balanceBefore).toInt256();
      if (amountReceived < amountRequired) amountRequired = amountReceived;
    }
    if (amountRequired == 0) revert insufficientInputAmount();

    uint160 currentPrice;
    int24 currentTick;
    uint128 currentLiquidity;
    uint256 communityFee;
    (amount0, amount1, currentPrice, currentTick, currentLiquidity, communityFee) = _calculateSwap(zeroToOne, amountRequired, limitSqrtPrice);

    unchecked {
      // only transfer to the recipient
      if (zeroToOne) {
        if (amount1 < 0) SafeTransfer.safeTransfer(token1, recipient, uint256(-amount1));
        // return the leftovers
        if (amount0 < amountRequired) SafeTransfer.safeTransfer(token0, sender, uint256(amountRequired - amount0));
        _changeReserves(amount0, amount1, communityFee, 0); // reflect reserve change and pay communityFee
      } else {
        if (amount0 < 0) SafeTransfer.safeTransfer(token0, recipient, uint256(-amount0));
        // return the leftovers
        if (amount1 < amountRequired) SafeTransfer.safeTransfer(token1, sender, uint256(amountRequired - amount1));
        _changeReserves(amount0, amount1, 0, communityFee); // reflect reserve change and pay communityFee
      }
    }

    emit Swap(msg.sender, recipient, amount0, amount1, currentPrice, currentLiquidity, currentTick);
    _unlock();

    if (globalState.pluginConfig.hasFlag(Plugins.AFTER_SWAP_FLAG)) {
      // TODO optimize
      IAlgebraPlugin(plugin).afterSwap(msg.sender, zeroToOne, amountRequired, limitSqrtPrice, amount0, amount1);
    }
  }

  /// @inheritdoc IAlgebraPoolActions
  function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external override {
    uint8 pluginConfig = globalState.pluginConfig;
    if (pluginConfig.hasFlag(Plugins.BEFORE_FLASH_FLAG)) {
      IAlgebraPlugin(plugin).beforeFlash(msg.sender, amount0, amount1);
    }

    _lock();

    (uint256 balance0Before, uint256 balance1Before) = _updateReserves();
    uint256 fee0;
    if (amount0 > 0) {
      fee0 = FullMath.mulDivRoundingUp(amount0, Constants.BASE_FEE, Constants.FEE_DENOMINATOR);
      SafeTransfer.safeTransfer(token0, recipient, amount0);
    }
    uint256 fee1;
    if (amount1 > 0) {
      fee1 = FullMath.mulDivRoundingUp(amount1, Constants.BASE_FEE, Constants.FEE_DENOMINATOR);
      SafeTransfer.safeTransfer(token1, recipient, amount1);
    }

    IAlgebraFlashCallback(msg.sender).algebraFlashCallback(fee0, fee1, data);

    uint256 paid0 = _balanceToken0();
    if (balance0Before + fee0 > paid0) revert flashInsufficientPaid0();
    uint256 paid1 = _balanceToken1();
    if (balance1Before + fee1 > paid1) revert flashInsufficientPaid1();

    unchecked {
      paid0 -= balance0Before;
      paid1 -= balance1Before;
    }
    uint256 _communityFee = globalState.communityFee; // TODO optimize
    if (_communityFee > 0) {
      uint256 communityFee0;
      if (paid0 > 0) communityFee0 = FullMath.mulDiv(paid0, _communityFee, Constants.COMMUNITY_FEE_DENOMINATOR);
      uint256 communityFee1;
      if (paid1 > 0) communityFee1 = FullMath.mulDiv(paid1, _communityFee, Constants.COMMUNITY_FEE_DENOMINATOR);

      _changeReserves(int256(communityFee0), int256(communityFee1), communityFee0, communityFee1);
    }
    emit Flash(msg.sender, recipient, amount0, amount1, paid0, paid1);

    _unlock();

    if (pluginConfig.hasFlag(Plugins.AFTER_FLASH_FLAG)) {
      IAlgebraPlugin(plugin).afterFlash(msg.sender, amount0, amount1, paid0, paid1);
    }
  }

  /// @dev using function to save bytecode
  function _checkIfAdministrator() private view {
    if (!IAlgebraFactory(factory).hasRoleOrOwner(Constants.POOLS_ADMINISTRATOR_ROLE, msg.sender)) revert notAllowed();
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setCommunityFee(uint16 newCommunityFee) external override nonReentrant {
    _checkIfAdministrator();
    if (newCommunityFee > Constants.MAX_COMMUNITY_FEE || newCommunityFee == globalState.communityFee) revert invalidNewCommunityFee();
    globalState.communityFee = newCommunityFee;
    emit CommunityFee(newCommunityFee);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setTickSpacing(int24 newTickSpacing) external override nonReentrant {
    _checkIfAdministrator();
    if (newTickSpacing <= 0 || newTickSpacing > Constants.MAX_TICK_SPACING || tickSpacing == newTickSpacing) revert invalidNewTickSpacing();
    tickSpacing = newTickSpacing;
    emit TickSpacing(newTickSpacing);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setPlugin(address newPluginAddress) external override {
    _checkIfAdministrator();
    plugin = newPluginAddress;
    emit Plugin(newPluginAddress);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setPluginConfig(uint8 newConfig) external override {
    if (msg.sender != plugin) {
      _checkIfAdministrator();
    }
    globalState.pluginConfig = newConfig;
    emit PluginConfig(newConfig);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setFee(uint16 newFee) external override {
    bool isDynamicFeeEnabled = globalState.pluginConfig.hasFlag(Plugins.DYNAMIC_FEE);

    if (msg.sender == plugin) {
      if (!isDynamicFeeEnabled) revert dynamicFeeDisabled();
    } else {
      if (isDynamicFeeEnabled) revert dynamicFeeActive();
      _checkIfAdministrator();
    }
    globalState.fee = newFee;
    emit Fee(newFee);
  }
}
