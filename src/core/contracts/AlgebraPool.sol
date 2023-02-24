// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;
pragma abicoder v1;

import './interfaces/IAlgebraPool.sol';
import './interfaces/IAlgebraPoolErrors.sol';
import './interfaces/IDataStorageOperator.sol';
import './interfaces/IAlgebraVirtualPool.sol';

import './base/PoolState.sol';
import './base/PoolImmutables.sol';

import './libraries/TokenDeltaMath.sol';
import './libraries/PriceMovementMath.sol';
import './libraries/TickManager.sol';
import './libraries/LimitOrderManager.sol';
import './libraries/TickTree.sol';

import './libraries/LowGasSafeMath.sol';
import './libraries/SafeCast.sol';

import './libraries/FullMath.sol';
import './libraries/Constants.sol';
import './libraries/SafeTransfer.sol';
import './libraries/TickMath.sol';
import './libraries/LiquidityMath.sol';

import './interfaces/IAlgebraFactory.sol';
import './interfaces/IERC20Minimal.sol';
import './interfaces/callback/IAlgebraMintCallback.sol';
import './interfaces/callback/IAlgebraSwapCallback.sol';
import './interfaces/callback/IAlgebraFlashCallback.sol';

/// @title Algebra concentrated liquidity pool
/// @notice This contract is responsible for liquidity positions, swaps and flashloans
contract AlgebraPool is PoolState, PoolImmutables, IAlgebraPool, IAlgebraPoolErrors {
  using LowGasSafeMath for uint256;
  using LowGasSafeMath for int256;
  using LowGasSafeMath for uint128;
  using SafeCast for uint256;
  using SafeCast for int256;
  using TickTree for mapping(int16 => uint256);
  using TickManager for mapping(int24 => TickManager.Tick);
  using LimitOrderManager for mapping(int24 => LimitOrderManager.LimitOrder);

  struct Position {
    uint256 liquidity; // The amount of liquidity concentrated in the range
    uint256 innerFeeGrowth0Token; // The last updated fee growth per unit of liquidity
    uint256 innerFeeGrowth1Token;
    uint128 fees0; // The amount of token0 owed to a LP
    uint128 fees1; // The amount of token1 owed to a LP
  }

  /// @inheritdoc IAlgebraPoolState
  mapping(bytes32 => Position) public override positions;

  modifier onlyValidTicks(int24 bottomTick, int24 topTick) {
    TickManager.checkTickRangeValidity(bottomTick, topTick);
    _;
  }

  constructor() PoolImmutables(msg.sender) {
    globalState.fee = Constants.BASE_FEE;
    globalState.prevInitializedTick = TickMath.MIN_TICK;
    tickSpacing = Constants.INIT_TICK_SPACING;
    ticks.initTickState();
  }

  function balanceToken0() private view returns (uint256) {
    return IERC20Minimal(token0).balanceOf(address(this));
  }

  function balanceToken1() private view returns (uint256) {
    return IERC20Minimal(token1).balanceOf(address(this));
  }

  /// @inheritdoc IAlgebraPoolDerivedState
  function getInnerCumulatives(
    int24 bottomTick,
    int24 topTick
  ) external view override onlyValidTicks(bottomTick, topTick) returns (uint160 innerSecondsSpentPerLiquidity, uint32 innerSecondsSpent) {
    TickManager.Tick storage _bottomTick = ticks[bottomTick];
    TickManager.Tick storage _topTick = ticks[topTick];

    if (_bottomTick.nextTick == _bottomTick.prevTick || _topTick.nextTick == _topTick.prevTick) revert tickIsNotInitialized();
    (uint160 lowerOuterSecondPerLiquidity, uint32 lowerOuterSecondsSpent) = (_bottomTick.outerSecondsPerLiquidity, _bottomTick.outerSecondsSpent);
    (uint160 upperOuterSecondPerLiquidity, uint32 upperOuterSecondsSpent) = (_topTick.outerSecondsPerLiquidity, _topTick.outerSecondsSpent);

    int24 currentTick = globalState.tick;
    unchecked {
      if (currentTick < bottomTick) {
        return (lowerOuterSecondPerLiquidity - upperOuterSecondPerLiquidity, lowerOuterSecondsSpent - upperOuterSecondsSpent);
      }

      if (currentTick < topTick) {
        uint32 time = _blockTimestamp();
        return (
          _getSecondsPerLiquidityCumulative(time, liquidity) - lowerOuterSecondPerLiquidity - upperOuterSecondPerLiquidity,
          time - lowerOuterSecondsSpent - upperOuterSecondsSpent
        );
      }

      return (upperOuterSecondPerLiquidity - lowerOuterSecondPerLiquidity, upperOuterSecondsSpent - lowerOuterSecondsSpent);
    }
  }

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

  /**
   * @notice Increases amounts of tokens owed to owner of the position
   * @param _position The position object to operate with
   * @param liquidityDelta The amount on which to increase\decrease the liquidity
   * @param innerFeeGrowth0Token Total fee token0 fee growth per 1/liquidity between position's lower and upper ticks
   * @param innerFeeGrowth1Token Total fee token1 fee growth per 1/liquidity between position's lower and upper ticks
   */
  function _recalculatePosition(
    Position storage _position,
    int128 liquidityDelta,
    uint256 innerFeeGrowth0Token,
    uint256 innerFeeGrowth1Token
  ) internal {
    uint128 liquidityBefore = uint128(_position.liquidity);

    if (liquidityDelta == 0) {
      if (liquidityBefore == 0) return; // Do not recalculate the empty ranges
    } else {
      // change position liquidity
      _position.liquidity = LiquidityMath.addDelta(liquidityBefore, liquidityDelta);
    }

    unchecked {
      // update the position
      uint256 _innerFeeGrowth0Token;
      uint128 fees0;
      if ((_innerFeeGrowth0Token = _position.innerFeeGrowth0Token) != innerFeeGrowth0Token) {
        _position.innerFeeGrowth0Token = innerFeeGrowth0Token;
        fees0 = uint128(FullMath.mulDiv(innerFeeGrowth0Token - _innerFeeGrowth0Token, liquidityBefore, Constants.Q128));
      }
      uint256 _innerFeeGrowth1Token;
      uint128 fees1;
      if ((_innerFeeGrowth1Token = _position.innerFeeGrowth1Token) != innerFeeGrowth1Token) {
        _position.innerFeeGrowth1Token = innerFeeGrowth1Token;
        fees1 = uint128(FullMath.mulDiv(innerFeeGrowth1Token - _innerFeeGrowth1Token, liquidityBefore, Constants.Q128));
      }

      // To avoid overflow owner has to collect fee before it
      if (fees0 | fees1 != 0) {
        _position.fees0 += fees0;
        _position.fees1 += fees1;
      }
    }
  }

  struct UpdatePositionCache {
    uint160 price; // The square root of the current price in Q64.96 format
    int24 prevInitializedTick; // The previous initialized tick in linked list
    uint16 fee; // The current fee in hundredths of a bip, i.e. 1e-6
    uint16 timepointIndex; // The index of the last written timepoint
  }

  /**
   * @dev Updates position's ticks and its fees
   * @return amount0 The abs amount of token0 that corresponds to liquidityDelta
   * @return amount1 The abs amount of token1 that corresponds to liquidityDelta
   */
  function _updatePositionTicksAndFees(
    Position storage position,
    int24 bottomTick,
    int24 topTick,
    int128 liquidityDelta
  ) private returns (uint256 amount0, uint256 amount1) {
    UpdatePositionCache memory cache = UpdatePositionCache(
      globalState.price,
      globalState.prevInitializedTick,
      globalState.fee,
      globalState.timepointIndex
    );

    int24 currentTick = globalState.tick;

    bool toggledBottom;
    bool toggledTop;
    {
      // scope to prevent "stack too deep"
      (uint256 _totalFeeGrowth0Token, uint256 _totalFeeGrowth1Token) = (totalFeeGrowth0Token, totalFeeGrowth1Token);
      if (liquidityDelta != 0) {
        uint32 time = _blockTimestamp();
        uint160 _secondsPerLiquidityCumulative = _getSecondsPerLiquidityCumulative(time, liquidity);

        toggledBottom = ticks.update(
          bottomTick,
          currentTick,
          liquidityDelta,
          _totalFeeGrowth0Token,
          _totalFeeGrowth1Token,
          _secondsPerLiquidityCumulative,
          time,
          false // isTopTick: false
        );

        toggledTop = ticks.update(
          topTick,
          currentTick,
          liquidityDelta,
          _totalFeeGrowth0Token,
          _totalFeeGrowth1Token,
          _secondsPerLiquidityCumulative,
          time,
          true // isTopTick: true
        );
      }

      (uint256 feeGrowthInside0X128, uint256 feeGrowthInside1X128) = ticks.getInnerFeeGrowth(
        bottomTick,
        topTick,
        currentTick,
        _totalFeeGrowth0Token,
        _totalFeeGrowth1Token
      );

      _recalculatePosition(position, liquidityDelta, feeGrowthInside0X128, feeGrowthInside1X128);
    }

    if (liquidityDelta != 0) {
      // if liquidityDelta is negative and the tick was toggled, it means that it should not be initialized anymore, so we delete it
      if (toggledBottom || toggledTop) {
        uint256 newTickTreeRoot = tickTreeRoot;
        uint256 oldTickTreeRoot = newTickTreeRoot;
        int24 previousTick = cache.prevInitializedTick;
        if (toggledBottom) {
          (previousTick, newTickTreeRoot) = _insertOrRemoveTick(bottomTick, currentTick, previousTick, newTickTreeRoot, liquidityDelta < 0);
        }
        if (toggledTop) {
          (previousTick, newTickTreeRoot) = _insertOrRemoveTick(topTick, currentTick, previousTick, newTickTreeRoot, liquidityDelta < 0);
        }

        if (oldTickTreeRoot != newTickTreeRoot) tickTreeRoot = newTickTreeRoot;
        cache.prevInitializedTick = previousTick;
      }

      int128 globalLiquidityDelta;
      (amount0, amount1, globalLiquidityDelta) = _getAmountsForLiquidity(bottomTick, topTick, liquidityDelta, currentTick, cache.price);
      if (globalLiquidityDelta != 0) {
        uint128 liquidityBefore = liquidity;
        (uint16 newTimepointIndex, uint16 newFee) = _writeTimepoint(cache.timepointIndex, _blockTimestamp(), currentTick, liquidityBefore);
        if (cache.timepointIndex != newTimepointIndex) {
          cache.timepointIndex = newTimepointIndex;
          if (cache.fee != newFee) {
            cache.fee = newFee;
            emit Fee(newFee);
          }
        }
        liquidity = LiquidityMath.addDelta(liquidityBefore, liquidityDelta);
      }

      (globalState.prevInitializedTick, globalState.fee, globalState.timepointIndex) = (cache.prevInitializedTick, cache.fee, cache.timepointIndex);
    }
  }

  function _insertOrRemoveTick(
    int24 tick,
    int24 currentTick,
    int24 prevInitializedTick,
    uint256 oldTickTreeRoot,
    bool remove
  ) private returns (int24 newPrevInitializedTick, uint256 newTickTreeRoot) {
    int24 prevTick;
    if (remove) {
      prevTick = ticks.removeTick(tick);
      if (prevInitializedTick == tick) prevInitializedTick = prevTick;
    } else {
      int24 nextTick;
      if (prevInitializedTick < tick && tick <= currentTick) {
        nextTick = ticks[prevInitializedTick].nextTick;
        prevTick = prevInitializedTick;
        prevInitializedTick = tick;
      } else {
        nextTick = tickTable.getNextTick(tickSecondLayer, oldTickTreeRoot, tick);
        prevTick = ticks[nextTick].prevTick;
      }
      ticks.insertTick(tick, prevTick, nextTick);
    }
    return (prevInitializedTick, tickTable.toggleTick(tickSecondLayer, tick, oldTickTreeRoot));
  }

  function _getAmountsForLiquidity(
    int24 bottomTick,
    int24 topTick,
    int128 liquidityDelta,
    int24 currentTick,
    uint160 currentPrice
  ) private pure returns (uint256 amount0, uint256 amount1, int128 globalLiquidityDelta) {
    uint160 priceAtBottomTick = TickMath.getSqrtRatioAtTick(bottomTick);
    uint160 priceAtTopTick = TickMath.getSqrtRatioAtTick(topTick);

    int256 amount0Int;
    int256 amount1Int;
    if (currentTick < bottomTick) {
      // If current tick is less than the provided bottom one then only the token0 has to be provided
      amount0Int = TokenDeltaMath.getToken0Delta(priceAtBottomTick, priceAtTopTick, liquidityDelta);
    } else if (currentTick < topTick) {
      amount0Int = TokenDeltaMath.getToken0Delta(currentPrice, priceAtTopTick, liquidityDelta);
      amount1Int = TokenDeltaMath.getToken1Delta(priceAtBottomTick, currentPrice, liquidityDelta);
      globalLiquidityDelta = liquidityDelta;
    } else {
      // If current tick is greater than the provided top one then only the token1 has to be provided
      amount1Int = TokenDeltaMath.getToken1Delta(priceAtBottomTick, priceAtTopTick, liquidityDelta);
    }

    unchecked {
      (amount0, amount1) = liquidityDelta < 0 ? (uint256(-amount0Int), uint256(-amount1Int)) : (uint256(amount0Int), uint256(amount1Int));
    }
  }

  /**
   * @notice This function fetches certain position object
   * @param owner The address owing the position
   * @param bottomTick The position's bottom tick
   * @param topTick The position's top tick
   * @return position The Position object
   */
  function getOrCreatePosition(address owner, int24 bottomTick, int24 topTick) private view returns (Position storage) {
    bytes32 key;
    assembly {
      key := or(shl(24, or(shl(24, owner), and(bottomTick, 0xFFFFFF))), and(topTick, 0xFFFFFF))
    }
    return positions[key];
  }

  function _updateReserves() internal returns (uint256 balance0, uint256 balance1) {
    (balance0, balance1) = (balanceToken0(), balanceToken1());
    unchecked {
      if (balance0 > type(uint128).max) {
        SafeTransfer.safeTransfer(token0, communityVault, balance0 - type(uint128).max);
        balance0 = type(uint128).max;
      }
      if (balance1 > type(uint128).max) {
        SafeTransfer.safeTransfer(token1, communityVault, balance1 - type(uint128).max);
        balance1 = type(uint128).max;
      }
    }

    uint128 _liquidity = liquidity;
    if (_liquidity == 0) return (balance0, balance1);

    (uint128 _reserve0, uint128 _reserve1) = (reserve0, reserve1);
    if (balance0 > _reserve0 || balance1 > _reserve1) {
      unchecked {
        if (balance0 > _reserve0) {
          totalFeeGrowth0Token += FullMath.mulDiv(balance0 - _reserve0, Constants.Q128, _liquidity);
        }
        if (balance1 > _reserve1) {
          totalFeeGrowth1Token += FullMath.mulDiv(balance1 - _reserve1, Constants.Q128, _liquidity);
        }
        (reserve0, reserve1) = (uint128(balance0), uint128(balance1));
      }
    }
  }

  /**
   * @notice Applies deltas to reserves and pays communityFees
   * @param deltaR0 Amount of token0 to add/subtract to/from reserve0
   * @param deltaR1 Amount of token1 to add/subtract to/from reserve1
   * @param communityFee0 Amount of token0 to pay as communityFee
   * @param communityFee1 Amount of token1 to pay as communityFee
   */
  function _changeReserves(int256 deltaR0, int256 deltaR1, uint256 communityFee0, uint256 communityFee1) internal {
    if (communityFee0 | communityFee1 != 0) {
      unchecked {
        (uint256 _cfPending0, uint256 _cfPending1) = (communityFeePending0 + communityFee0, communityFeePending1 + communityFee1);
        uint32 currentTimestamp = _blockTimestamp();
        // underflow is desired
        if (
          currentTimestamp - communityFeeLastTimestamp >= Constants.COMMUNITY_FEE_TRANSFER_FREQUENCY ||
          _cfPending0 > type(uint128).max ||
          _cfPending1 > type(uint128).max
        ) {
          if (_cfPending0 > 0) SafeTransfer.safeTransfer(token0, communityVault, _cfPending0);
          if (_cfPending1 > 0) SafeTransfer.safeTransfer(token1, communityVault, _cfPending1);
          communityFeeLastTimestamp = currentTimestamp;
          (deltaR0, deltaR1) = (deltaR0 - int256(_cfPending0), deltaR1 - int256(_cfPending1));
          (_cfPending0, _cfPending1) = (0, 0);
        }
        (communityFeePending0, communityFeePending1) = (uint128(_cfPending0), uint128(_cfPending1));
      }
    }

    if (deltaR0 | deltaR1 == 0) return;
    (uint128 _reserve0, uint128 _reserve1) = (reserve0, reserve1);
    if (deltaR0 != 0) _reserve0 = uint128(int128(_reserve0) + int128(deltaR0));
    if (deltaR1 != 0) _reserve1 = uint128(int128(_reserve1) + int128(deltaR1));
    (reserve0, reserve1) = (_reserve0, _reserve1);
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
      int24 _tickSpacing = tickSpacing;
      if (bottomTick % _tickSpacing | topTick % _tickSpacing != 0) revert tickIsNotSpaced();
    }
    if (bottomTick == topTick) {
      (amount0, amount1) = bottomTick > globalState.tick ? (uint256(liquidityDesired), uint256(0)) : (uint256(0), uint256(liquidityDesired));
    } else {
      (amount0, amount1, ) = _getAmountsForLiquidity(bottomTick, topTick, int128(liquidityDesired), globalState.tick, globalState.price);
    }
    liquidityActual = liquidityDesired;

    (uint256 receivedAmount0, uint256 receivedAmount1) = _updateReserves();
    IAlgebraMintCallback(msg.sender).algebraMintCallback(amount0, amount1, data);

    if (amount0 == 0) receivedAmount0 = 0;
    else {
      receivedAmount0 = balanceToken0() - receivedAmount0;
      if (receivedAmount0 < amount0) {
        liquidityActual = uint128(FullMath.mulDiv(uint256(liquidityActual), receivedAmount0, amount0));
      }
    }

    if (amount1 == 0) receivedAmount1 = 0;
    else {
      receivedAmount1 = balanceToken1() - receivedAmount1;
      if (receivedAmount1 < amount1) {
        uint128 liquidityForRA1 = uint128(FullMath.mulDiv(uint256(liquidityActual), receivedAmount1, amount1));
        if (liquidityForRA1 < liquidityActual) liquidityActual = liquidityForRA1;
      }
    }

    if (liquidityActual == 0) revert insufficientInputAmount();
    // scope to prevent "stack too deep"
    {
      Position storage _position = getOrCreatePosition(recipient, bottomTick, topTick);
      if (bottomTick == topTick) {
        liquidityActual = receivedAmount0 > 0 ? uint128(receivedAmount0) : uint128(receivedAmount1);
        _updateLimitOrderPosition(_position, bottomTick, int128(liquidityActual));
      } else {
        liquidityActual = liquidityDesired;
        if (receivedAmount0 < amount0) {
          liquidityActual = uint128(FullMath.mulDiv(uint256(liquidityActual), receivedAmount0, amount0));
        }
        if (receivedAmount1 < amount1) {
          uint128 liquidityForRA1 = uint128(FullMath.mulDiv(uint256(liquidityActual), receivedAmount1, amount1));
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

  function _recalculateLimitOrderPosition(Position storage position, int24 tick, int128 amountToSellDelta) private {
    uint256 amountToSell;
    uint256 amountToSellInitial;
    unchecked {
      (amountToSell, amountToSellInitial) = (position.liquidity >> 128, uint128(position.liquidity)); // unpack data
    }
    if (amountToSell == 0 && amountToSellDelta == 0) return;

    if (amountToSell == 0) {
      if (position.innerFeeGrowth0Token == 0) position.innerFeeGrowth0Token = 1;
      if (position.innerFeeGrowth1Token == 0) position.innerFeeGrowth1Token = 1;
    }
    LimitOrderManager.LimitOrder storage _limitOrder = limitOrders[tick];
    unchecked {
      uint256 _cumulativeDelta;
      bool zeroToOne;
      {
        uint256 _bought1Cumulative = _limitOrder.boughtAmount1Cumulative;
        if (_bought1Cumulative == 0) {
          (_limitOrder.boughtAmount0Cumulative, _limitOrder.boughtAmount1Cumulative) = (1, 1); // maker pays for storage slots
          _bought1Cumulative = 1;
        }
        _cumulativeDelta = _bought1Cumulative - position.innerFeeGrowth1Token;
        zeroToOne = _cumulativeDelta > 0;
        if (!zeroToOne) _cumulativeDelta = _limitOrder.boughtAmount0Cumulative - position.innerFeeGrowth0Token;
      }

      if (_cumulativeDelta > 0) {
        uint256 boughtAmount;
        if (amountToSellInitial > 0) {
          boughtAmount = FullMath.mulDiv(_cumulativeDelta, amountToSellInitial, Constants.Q128);
          uint160 sqrtPrice = TickMath.getSqrtRatioAtTick(tick);
          uint256 price = FullMath.mulDiv(sqrtPrice, sqrtPrice, Constants.Q96);
          (uint256 nominator, uint256 denominator) = zeroToOne ? (price, Constants.Q96) : (Constants.Q96, price);
          uint256 amountToBuy = FullMath.mulDiv(amountToSell, nominator, denominator);

          if (boughtAmount < amountToBuy) {
            amountToSell = FullMath.mulDiv(amountToBuy - boughtAmount, denominator, nominator); // unspent input
          } else {
            boughtAmount = amountToBuy;
            amountToSell = 0;
          }
        }
        if (zeroToOne) {
          position.innerFeeGrowth1Token = position.innerFeeGrowth1Token + _cumulativeDelta;
          if (boughtAmount > 0) position.fees1 = position.fees1.add128(uint128(boughtAmount));
        } else {
          position.innerFeeGrowth0Token = position.innerFeeGrowth0Token + _cumulativeDelta;
          if (boughtAmount > 0) position.fees0 = position.fees0.add128(uint128(boughtAmount));
        }
      }
      if (amountToSell == 0) amountToSellInitial = 0; // reset if all amount sold

      if (amountToSellDelta != 0) {
        int128 amountToSellInitialDelta = amountToSellDelta;
        // add/remove liquidity to tick with partly executed limit order
        if (amountToSell != amountToSellInitial && amountToSell != 0) {
          amountToSellInitialDelta = amountToSellDelta < 0
            ? -int256(FullMath.mulDiv(uint128(-amountToSellDelta), amountToSellInitial, amountToSell)).toInt128()
            : int256(FullMath.mulDiv(uint128(amountToSellDelta), amountToSellInitial, amountToSell)).toInt128();

          limitOrders.addVirtualLiquidity(tick, amountToSellInitialDelta - amountToSellDelta);
        }
        amountToSell = LiquidityMath.addDelta(uint128(amountToSell), amountToSellDelta);
        amountToSellInitial = LiquidityMath.addDelta(uint128(amountToSellInitial), amountToSellInitialDelta);
      }
      if (amountToSell == 0) amountToSellInitial = 0; // reset if all amount cancelled

      (position.liquidity) = ((amountToSell << 128) | amountToSellInitial); // tightly pack data
    }
  }

  function _updateLimitOrderPosition(
    Position storage position,
    int24 tick,
    int128 amountToSellDelta
  ) private returns (uint256 amount0, uint256 amount1) {
    _recalculateLimitOrderPosition(position, tick, amountToSellDelta);

    if (amountToSellDelta != 0) {
      bool remove = amountToSellDelta < 0;
      (int24 currentTick, int24 prevTick) = (globalState.tick, globalState.prevInitializedTick);

      if (limitOrders.addOrRemoveLimitOrder(tick, amountToSellDelta)) {
        // if tick flipped
        TickManager.Tick storage _tickData = ticks[tick];
        _tickData.hasLimitOrders = !remove;
        if (_tickData.nextTick == _tickData.prevTick) {
          // tick isn't initialized
          uint256 _tickTreeRoot = tickTreeRoot;
          (int24 newPrevTick, uint256 newTickTreeRoot) = _insertOrRemoveTick(tick, currentTick, prevTick, _tickTreeRoot, remove);
          if (_tickTreeRoot != newTickTreeRoot) tickTreeRoot = newTickTreeRoot;
          if (newPrevTick != prevTick) globalState.prevInitializedTick = newPrevTick;
        }
      }

      if (remove) {
        unchecked {
          return (tick > currentTick) ? (uint256(int256(-amountToSellDelta)), uint256(0)) : (uint256(0), uint256(int256(-amountToSellDelta)));
        }
      }
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
  function burn(
    int24 bottomTick,
    int24 topTick,
    uint128 amount
  ) external override nonReentrant onlyValidTicks(bottomTick, topTick) returns (uint256 amount0, uint256 amount1) {
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

  function _writeTimepoint(uint16 timepointIndex, uint32 blockTimestamp, int24 tick, uint128 currentLiquidity) private returns (uint16, uint16) {
    uint32 _lastTs = lastTimepointTimestamp;
    if (_lastTs == blockTimestamp) return (timepointIndex, 0); // writing should only happen once per block

    unchecked {
      secondsPerLiquidityCumulative += ((uint160(blockTimestamp - _lastTs) << 128) / (currentLiquidity > 0 ? currentLiquidity : 1));
    }
    lastTimepointTimestamp = blockTimestamp;

    // failure should not occur. But in case of failure, the pool will remain operational
    try IDataStorageOperator(dataStorageOperator).write(timepointIndex, blockTimestamp, tick) returns (uint16 newTimepointIndex, uint16 newFee) {
      return (newTimepointIndex, newFee);
    } catch {
      emit DataStorageFailure();
      return (timepointIndex, 0);
    }
  }

  function _getSecondsPerLiquidityCumulative(uint32 blockTimestamp, uint128 currentLiquidity) private view returns (uint160 _secPerLiqCumulative) {
    uint32 _lastTs;
    (_lastTs, _secPerLiqCumulative) = (lastTimepointTimestamp, secondsPerLiquidityCumulative);
    unchecked {
      if (_lastTs != blockTimestamp)
        _secPerLiqCumulative += ((uint160(blockTimestamp - _lastTs) << 128) / (currentLiquidity > 0 ? currentLiquidity : 1));
    }
  }

  /// @dev using function to save bytecode
  function _swapCallback(int256 amount0, int256 amount1, bytes calldata data) private {
    IAlgebraSwapCallback(msg.sender).algebraSwapCallback(amount0, amount1, data);
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
      if (balance0Before + uint256(amount0) > balanceToken0()) revert insufficientInputAmount();
      _changeReserves(amount0, amount1, communityFee, 0); // reflect reserve change and pay communityFee
    } else {
      unchecked {
        if (amount0 < 0) SafeTransfer.safeTransfer(token0, recipient, uint256(-amount0));
      }
      _swapCallback(amount0, amount1, data); // callback to get tokens from the caller
      if (balance1Before + uint256(amount1) > balanceToken1()) revert insufficientInputAmount();
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
    unchecked {
      if (amountRequired < 0) amountRequired = -amountRequired; // we support only exactInput here
    }

    // Since the pool can get less tokens then sent, firstly we are getting tokens from the
    // original caller of the transaction. And change the _amountRequired_
    {
      // scope to prevent "stack too deep"
      (uint256 balance0Before, uint256 balance1Before) = _updateReserves();
      int256 amountReceived;
      if (zeroToOne) {
        _swapCallback(amountRequired, 0, data);
        amountReceived = int256(balanceToken0() - balance0Before);
      } else {
        _swapCallback(0, amountRequired, data);
        amountReceived = int256(balanceToken1() - balance1Before);
      }
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

  struct SwapCalculationCache {
    uint256 communityFee; // The community fee of the selling token, uint256 to minimize casts
    uint160 secondsPerLiquidityCumulative; // The global secondPerLiquidity at the moment
    bool computedLatestTimepoint; //  If we have already wrote a timepoint in the DataStorageOperator
    int256 amountRequiredInitial; // The initial value of the exact input\output amount
    int256 amountCalculated; // The additive amount of total output\input calculated trough the swap
    uint256 totalFeeGrowth; // The initial totalFeeGrowth + the fee growth during a swap
    uint256 totalFeeGrowthB;
    address activeIncentive; // Address of an active incentive at the moment or address(0)
    bool exactInput; // Whether the exact input or output is specified
    uint16 fee; // The current dynamic fee
    uint16 timepointIndex; // The index of last written timepoint
    int24 prevInitializedTick; // The previous initialized tick in linked list
    uint32 blockTimestamp; // The timestamp of current block
  }

  struct PriceMovementCache {
    uint160 stepSqrtPrice; // The Q64.96 sqrt of the price at the start of the step
    int24 nextTick; // The tick till the current step goes
    bool initialized; // True if the _nextTick_ is initialized
    uint160 nextTickPrice; // The Q64.96 sqrt of the price calculated from the _nextTick_
    uint256 input; // The additive amount of tokens that have been provided
    uint256 output; // The additive amount of token that have been withdrawn
    uint256 feeAmount; // The total amount of fee earned within a current step
    bool inLimitOrder; // If a limit order is currently being executed
  }

  function _calculateSwap(
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice
  ) private returns (int256 amount0, int256 amount1, uint160 currentPrice, int24 currentTick, uint128 currentLiquidity, uint256 communityFeeAmount) {
    SwapCalculationCache memory cache;
    {
      // load from one storage slot
      currentPrice = globalState.price;
      currentTick = globalState.tick;
      cache.fee = globalState.fee;
      cache.timepointIndex = globalState.timepointIndex;
      cache.communityFee = globalState.communityFee;
      cache.prevInitializedTick = globalState.prevInitializedTick;

      if (amountRequired == 0) revert zeroAmountRequired();
      (cache.amountRequiredInitial, cache.exactInput) = (amountRequired, amountRequired > 0);

      currentLiquidity = liquidity;

      if (zeroToOne) {
        if (limitSqrtPrice >= currentPrice || limitSqrtPrice <= TickMath.MIN_SQRT_RATIO) revert invalidLimitSqrtPrice();
        cache.totalFeeGrowth = totalFeeGrowth0Token;
      } else {
        if (limitSqrtPrice <= currentPrice || limitSqrtPrice >= TickMath.MAX_SQRT_RATIO) revert invalidLimitSqrtPrice();
        cache.totalFeeGrowth = totalFeeGrowth1Token;
      }

      cache.blockTimestamp = _blockTimestamp();

      cache.activeIncentive = activeIncentive;

      (uint16 newTimepointIndex, uint16 newFee) = _writeTimepoint(cache.timepointIndex, cache.blockTimestamp, currentTick, currentLiquidity);

      // new timepoint appears only for first swap/mint/burn in block
      if (newTimepointIndex != cache.timepointIndex) {
        cache.timepointIndex = newTimepointIndex;
        if (cache.fee != newFee) {
          cache.fee = newFee;
          emit Fee(newFee);
        }
      }
    }

    PriceMovementCache memory step;
    step.nextTick = zeroToOne ? cache.prevInitializedTick : ticks[cache.prevInitializedTick].nextTick;
    unchecked {
      // swap until there is remaining input or output tokens or we reach the price limit
      while (true) {
        step.stepSqrtPrice = currentPrice;
        step.initialized = true;

        step.nextTickPrice = TickMath.getSqrtRatioAtTick(step.nextTick);

        if (step.stepSqrtPrice == step.nextTickPrice && ticks[step.nextTick].hasLimitOrders) {
          // calculate the amounts from LO
          // TODO fee
          step.feeAmount = 0;
          (step.inLimitOrder, step.output, step.input) = limitOrders.executeLimitOrders(step.nextTick, currentPrice, zeroToOne, amountRequired);
          if (step.inLimitOrder) {
            if (ticks[step.nextTick].liquidityTotal == 0) {
              uint256 _tickTreeRoot = tickTreeRoot;
              (int24 newPrevTick, uint256 newTickTreeRoot) = _insertOrRemoveTick(
                step.nextTick,
                currentTick,
                cache.prevInitializedTick,
                _tickTreeRoot,
                true
              );
              if (_tickTreeRoot != newTickTreeRoot) tickTreeRoot = newTickTreeRoot;
              cache.prevInitializedTick = newPrevTick;
              step.initialized = false;
            } else {
              ticks[step.nextTick].hasLimitOrders = false;
            }
          }
          step.inLimitOrder = !step.inLimitOrder;
        } else {
          (currentPrice, step.input, step.output, step.feeAmount) = PriceMovementMath.movePriceTowardsTarget(
            zeroToOne,
            currentPrice,
            (zeroToOne == (step.nextTickPrice < limitSqrtPrice)) // move the price to the target or to the limit
              ? limitSqrtPrice
              : step.nextTickPrice,
            currentLiquidity,
            amountRequired,
            cache.fee
          );
        }

        if (cache.exactInput) {
          amountRequired -= (step.input + step.feeAmount).toInt256(); // decrease remaining input amount
          cache.amountCalculated = cache.amountCalculated.sub(step.output.toInt256()); // decrease calculated output amount
        } else {
          amountRequired += step.output.toInt256(); // increase remaining output amount (since its negative)
          cache.amountCalculated = cache.amountCalculated.add((step.input + step.feeAmount).toInt256()); // increase calculated input amount
        }

        if (cache.communityFee > 0) {
          uint256 delta = (step.feeAmount.mul(cache.communityFee)) / Constants.COMMUNITY_FEE_DENOMINATOR;
          step.feeAmount -= delta;
          communityFeeAmount += delta;
        }

        if (currentLiquidity > 0) cache.totalFeeGrowth += FullMath.mulDiv(step.feeAmount, Constants.Q128, currentLiquidity);

        if (currentPrice == step.nextTickPrice && !step.inLimitOrder) {
          // if the reached tick is initialized then we need to cross it
          if (step.initialized) {
            // once at a swap we have to get the last timepoint of the observation
            if (!cache.computedLatestTimepoint) {
              cache.secondsPerLiquidityCumulative = secondsPerLiquidityCumulative;
              cache.computedLatestTimepoint = true;
              cache.totalFeeGrowthB = zeroToOne ? totalFeeGrowth1Token : totalFeeGrowth0Token;
            }

            // we have opened LOs
            if (ticks[step.nextTick].hasLimitOrders) {
              currentTick = zeroToOne ? step.nextTick : step.nextTick - 1;
              continue;
            }

            // every tick cross is needed to be duplicated in a virtual pool
            if (cache.activeIncentive != address(0)) {
              bool isIncentiveActive; // if the incentive is stopped or faulty, the active incentive will be reset to 0
              try IAlgebraVirtualPool(cache.activeIncentive).cross(step.nextTick, zeroToOne) returns (bool success) {
                isIncentiveActive = success;
              } catch {}
              if (!isIncentiveActive) {
                cache.activeIncentive = address(0);
                activeIncentive = address(0);
                emit Incentive(address(0));
              }
            }
            int128 liquidityDelta;
            if (zeroToOne) {
              liquidityDelta = -ticks.cross(
                step.nextTick,
                cache.totalFeeGrowth, // A == 0
                cache.totalFeeGrowthB, // B == 1
                cache.secondsPerLiquidityCumulative,
                cache.blockTimestamp
              );
              cache.prevInitializedTick = ticks[cache.prevInitializedTick].prevTick;
            } else {
              liquidityDelta = ticks.cross(
                step.nextTick,
                cache.totalFeeGrowthB, // B == 0
                cache.totalFeeGrowth, // A == 1
                cache.secondsPerLiquidityCumulative,
                cache.blockTimestamp
              );
              cache.prevInitializedTick = step.nextTick;
            }
            currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
          }

          (currentTick, step.nextTick) = zeroToOne
            ? (step.nextTick - 1, cache.prevInitializedTick)
            : (step.nextTick, ticks[cache.prevInitializedTick].nextTick);
        } else if (currentPrice != step.stepSqrtPrice) {
          // if the price has changed but hasn't reached the target
          currentTick = TickMath.getTickAtSqrtRatio(currentPrice);
          break; // since the price hasn't reached the target, amountRequired should be 0
        }
        // check stop condition
        if (amountRequired == 0 || currentPrice == limitSqrtPrice) {
          break;
        }
      }

      (amount0, amount1) = zeroToOne == cache.exactInput // the amount to provide could be less than initially specified (e.g. reached limit)
        ? (cache.amountRequiredInitial - amountRequired, cache.amountCalculated) // the amount to get could be less than initially specified (e.g. reached limit)
        : (cache.amountCalculated, cache.amountRequiredInitial - amountRequired);
    }

    (globalState.price, globalState.tick, globalState.fee, globalState.timepointIndex, globalState.prevInitializedTick) = (
      currentPrice,
      currentTick,
      cache.fee,
      cache.timepointIndex,
      cache.prevInitializedTick
    );

    liquidity = currentLiquidity;
    if (zeroToOne) {
      totalFeeGrowth0Token = cache.totalFeeGrowth;
    } else {
      totalFeeGrowth1Token = cache.totalFeeGrowth;
    }
  }

  /// @inheritdoc IAlgebraPoolActions
  function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external override nonReentrant {
    (uint256 balance0Before, uint256 balance1Before) = _updateReserves();
    uint256 fee0;
    if (amount0 > 0) {
      fee0 = FullMath.mulDivRoundingUp(amount0, Constants.BASE_FEE, 1e6);
      SafeTransfer.safeTransfer(token0, recipient, amount0);
    }
    uint256 fee1;
    if (amount1 > 0) {
      fee1 = FullMath.mulDivRoundingUp(amount1, Constants.BASE_FEE, 1e6);
      SafeTransfer.safeTransfer(token1, recipient, amount1);
    }

    IAlgebraFlashCallback(msg.sender).algebraFlashCallback(fee0, fee1, data);

    uint256 paid0 = balanceToken0();
    if (balance0Before + fee0 > paid0) revert flashInsufficientPaid0();
    uint256 paid1 = balanceToken1();
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
  function setTickSpacing(int24 newTickSpacing) external override nonReentrant {
    _checkIfAdministrator();
    if (newTickSpacing <= 0 || newTickSpacing > 500 || tickSpacing == newTickSpacing) revert invalidNewTickSpacing();
    tickSpacing = newTickSpacing;
    emit TickSpacing(newTickSpacing);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setIncentive(address newIncentiveAddress) external override {
    if (msg.sender != IAlgebraFactory(factory).farmingAddress()) revert onlyFarming();
    activeIncentive = newIncentiveAddress;

    emit Incentive(newIncentiveAddress);
  }
}
