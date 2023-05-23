// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;
pragma abicoder v1;

import './interfaces/IDataStorageOperator.sol';

import './base/AlgebraPoolBase.sol';
import './base/DerivedState.sol';
import './base/ReentrancyGuard.sol';
import './base/Positions.sol';
import './base/LimitOrderPositions.sol';
import './base/SwapCalculation.sol';
import './base/ReservesManager.sol';
import './base/TickStructure.sol';

import './libraries/FullMath.sol';
import './libraries/Constants.sol';
import './libraries/SafeTransfer.sol';
import './libraries/SafeCast.sol';
import './libraries/TickMath.sol';
import './libraries/LiquidityMath.sol';

import './interfaces/IAlgebraFactory.sol';
import './interfaces/callback/IAlgebraMintCallback.sol';
import './interfaces/callback/IAlgebraFlashCallback.sol';

/// @title Algebra concentrated liquidity pool
/// @notice This contract is responsible for liquidity positions, swaps and flashloans
/// @dev Version: Algebra V2.1
contract AlgebraPool is
  AlgebraPoolBase,
  DerivedState,
  ReentrancyGuard,
  Positions,
  LimitOrderPositions,
  SwapCalculation,
  ReservesManager,
  TickStructure
{
  using SafeCast for uint256;

  /// @inheritdoc IAlgebraPoolActions
  function initialize(uint160 initialPrice) external override {
    if (globalState.price != 0) revert alreadyInitialized(); // after initialization, the price can never become zero
    int24 tick = TickMath.getTickAtSqrtRatio(initialPrice); // getTickAtSqrtRatio checks validity of initialPrice inside
    IDataStorageOperator(dataStorageOperator).initialize(_blockTimestamp(), tick);
    lastTimepointTimestamp = _blockTimestamp();

    globalState.price = initialPrice;
    globalState.communityFee = IAlgebraFactory(factory).defaultCommunityFee();
    globalState.unlocked = true;
    globalState.tick = tick;

    emit Initialize(initialPrice, tick);
  }

  /// @inheritdoc IAlgebraPoolActions
  function mint(
    address sender,
    address recipient,
    int24 bottomTick,
    int24 topTick,
    uint128 liquidityDesired,
    bytes calldata data
  ) external override nonReentrant onlyValidTicks(bottomTick, topTick) returns (uint256 amount0, uint256 amount1, uint128 liquidityActual) {
    if (liquidityDesired == 0) revert zeroLiquidityDesired();
    unchecked {
      int24 _tickSpacing = bottomTick == topTick ? tickSpacingLimitOrders : tickSpacing;
      if (bottomTick % _tickSpacing | topTick % _tickSpacing != 0 || _tickSpacing == type(int24).max) revert tickIsNotSpaced();
    }
    if (bottomTick == topTick) {
      (amount0, amount1) = bottomTick > globalState.tick ? (uint256(liquidityDesired), uint256(0)) : (uint256(0), uint256(liquidityDesired));
    } else {
      (amount0, amount1, ) = LiquidityMath.getAmountsForLiquidity(bottomTick, topTick, int128(liquidityDesired), globalState.tick, globalState.price);
    }

    (uint256 receivedAmount0, uint256 receivedAmount1) = _updateReserves();
    IAlgebraMintCallback(msg.sender).algebraMintCallback(amount0, amount1, data);

    receivedAmount0 = amount0 == 0 ? 0 : _balanceToken0() - receivedAmount0;
    receivedAmount1 = amount1 == 0 ? 0 : _balanceToken1() - receivedAmount1;

    // scope to prevent "stack too deep"
    {
      Position storage _position = getOrCreatePosition(recipient, bottomTick, topTick);
      if (bottomTick == topTick) {
        liquidityActual = receivedAmount0 > 0 ? uint128(receivedAmount0) : uint128(receivedAmount1);
        if (liquidityActual == 0) revert insufficientInputAmount();
        _updateLimitOrderPosition(_position, bottomTick, int128(liquidityActual));
      } else {
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

        (amount0, amount1) = _updatePositionTicksAndFees(_position, bottomTick, topTick, int128(liquidityActual));
      }
    }

    unchecked {
      if (amount0 > 0) {
        if (receivedAmount0 > amount0) SafeTransfer.safeTransfer(token0, sender, receivedAmount0 - amount0);
        else if (receivedAmount0 != amount0) revert insufficientAmountReceivedAtMint();
      }

      if (amount1 > 0) {
        if (receivedAmount1 > amount1) SafeTransfer.safeTransfer(token1, sender, receivedAmount1 - amount1);
        else if (receivedAmount1 != amount1) revert insufficientAmountReceivedAtMint();
      }
    }

    _changeReserves(int256(amount0), int256(amount1), 0, 0);
    emit Mint(msg.sender, recipient, bottomTick, topTick, liquidityActual, amount0, amount1);
  }

  /// @inheritdoc IAlgebraPoolActions
  function burn(
    int24 bottomTick,
    int24 topTick,
    uint128 amount
  ) external override nonReentrant onlyValidTicks(bottomTick, topTick) returns (uint256 amount0, uint256 amount1) {
    if (amount > uint128(type(int128).max)) revert arithmeticError();
    _updateReserves();
    Position storage position = getOrCreatePosition(msg.sender, bottomTick, topTick);

    int128 liquidityDelta = -int128(amount);
    (amount0, amount1) = (bottomTick == topTick)
      ? _updateLimitOrderPosition(position, bottomTick, liquidityDelta)
      : _updatePositionTicksAndFees(position, bottomTick, topTick, liquidityDelta);

    if (amount0 | amount1 != 0) {
      (position.fees0, position.fees1) = (position.fees0 + uint128(amount0), position.fees1 + uint128(amount1));
    }

    if (amount | amount0 | amount1 != 0) emit Burn(msg.sender, bottomTick, topTick, amount, amount0, amount1);
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
  ) external override nonReentrant returns (int256 amount0, int256 amount1) {
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
  }

  /// @inheritdoc IAlgebraPoolActions
  function swapSupportingFeeOnInputTokens(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    bytes calldata data
  ) external override nonReentrant returns (int256 amount0, int256 amount1) {
    if (amountRequired < 0) revert invalidAmountRequired(); // we support only exactInput here

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
  }

  /// @inheritdoc IAlgebraPoolActions
  function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external override nonReentrant {
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

  /// @dev using function to save bytecode
  function _checkIfAdministrator() private view {
    if (!IAlgebraFactory(factory).hasRoleOrOwner(Constants.POOLS_ADMINISTRATOR_ROLE, msg.sender)) revert notAllowed();
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setCommunityFee(uint8 newCommunityFee) external override nonReentrant {
    _checkIfAdministrator();
    if (newCommunityFee > Constants.MAX_COMMUNITY_FEE || newCommunityFee == globalState.communityFee) revert invalidNewCommunityFee();
    globalState.communityFee = newCommunityFee;
    emit CommunityFee(newCommunityFee);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setTickSpacing(int24 newTickSpacing, int24 newTickspacingLimitOrders) external override nonReentrant {
    _checkIfAdministrator();
    if (
      newTickSpacing <= 0 ||
      newTickSpacing > Constants.MAX_TICK_SPACING ||
      (tickSpacing == newTickSpacing && tickSpacingLimitOrders == newTickspacingLimitOrders)
    ) revert invalidNewTickSpacing();
    // newTickspacingLimitOrders isn't limited, so it is possible to forbid new limit orders completely
    if (newTickspacingLimitOrders <= 0) revert invalidNewTickSpacing();
    tickSpacing = newTickSpacing;
    tickSpacingLimitOrders = newTickspacingLimitOrders;
    emit TickSpacing(newTickSpacing, newTickspacingLimitOrders);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setIncentive(address newIncentiveAddress) external override {
    if (msg.sender != IAlgebraFactory(factory).farmingAddress()) revert onlyFarming();
    activeIncentive = newIncentiveAddress;
    emit Incentive(newIncentiveAddress);
  }
}
