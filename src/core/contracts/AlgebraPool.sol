// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import './interfaces/IAlgebraPool.sol';
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
import './libraries/TransferHelper.sol';
import './libraries/TickMath.sol';
import './libraries/LiquidityMath.sol';

import './interfaces/IAlgebraFactory.sol';
import './interfaces/IERC20Minimal.sol';
import './interfaces/callback/IAlgebraMintCallback.sol';
import './interfaces/callback/IAlgebraSwapCallback.sol';
import './interfaces/callback/IAlgebraFlashCallback.sol';

contract AlgebraPool is PoolState, PoolImmutables, IAlgebraPool {
  using LowGasSafeMath for uint256;
  using LowGasSafeMath for int256;
  using LowGasSafeMath for uint128;
  using SafeCast for uint256;
  using SafeCast for int256;
  using TickTree for mapping(int16 => uint256);
  using TickManager for mapping(int24 => TickManager.Tick);
  using LimitOrderManager for mapping(int24 => LimitOrderManager.LimitOrder);

  struct Position {
    uint128 liquidity; // The amount of liquidity concentrated in the range
    uint128 liquidityInitial;
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
    (uint160 lowerOuterSecondPerLiquidity, uint32 lowerOuterSecondsSpent) = (
      ticks[bottomTick].outerSecondsPerLiquidity,
      ticks[bottomTick].outerSecondsSpent
    );
    (uint160 upperOuterSecondPerLiquidity, uint32 upperOuterSecondsSpent) = (
      ticks[topTick].outerSecondsPerLiquidity,
      ticks[topTick].outerSecondsSpent
    );

    // TODO uninitialized ticks
    int24 currentTick = globalState.tick;

    if (currentTick < bottomTick) {
      return (lowerOuterSecondPerLiquidity - upperOuterSecondPerLiquidity, lowerOuterSecondsSpent - upperOuterSecondsSpent);
    }

    if (currentTick < topTick) {
      uint32 globalTime = _blockTimestamp();
      uint160 globalSecondsPerLiquidityCumulative = _getSecondsPerLiquidityCumulative(globalTime, liquidity);
      return (
        globalSecondsPerLiquidityCumulative - lowerOuterSecondPerLiquidity - upperOuterSecondPerLiquidity,
        globalTime - lowerOuterSecondsSpent - upperOuterSecondsSpent
      );
    }

    return (upperOuterSecondPerLiquidity - lowerOuterSecondPerLiquidity, upperOuterSecondsSpent - lowerOuterSecondsSpent);
  }

  /// @inheritdoc IAlgebraPoolActions
  function initialize(uint160 initialPrice) external override {
    require(globalState.price == 0, 'AI');
    // getTickAtSqrtRatio checks validity of initialPrice inside
    int24 tick = TickMath.getTickAtSqrtRatio(initialPrice);
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
    uint128 currentLiquidity = _position.liquidity;

    if (liquidityDelta == 0) {
      // TODO MB REMOVE?
      require(currentLiquidity != 0, 'NP'); // Do not recalculate the empty ranges
    } else {
      // change position liquidity
      _position.liquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
    }

    // update the position
    uint256 _innerFeeGrowth0Token;
    uint128 fees0;
    if ((_innerFeeGrowth0Token = _position.innerFeeGrowth0Token) != innerFeeGrowth0Token) {
      _position.innerFeeGrowth0Token = innerFeeGrowth0Token;
      fees0 = uint128(FullMath.mulDiv(innerFeeGrowth0Token - _innerFeeGrowth0Token, currentLiquidity, Constants.Q128));
    }
    uint256 _innerFeeGrowth1Token;
    uint128 fees1;
    if ((_innerFeeGrowth1Token = _position.innerFeeGrowth1Token) != innerFeeGrowth1Token) {
      _position.innerFeeGrowth1Token = innerFeeGrowth1Token;
      fees1 = uint128(FullMath.mulDiv(innerFeeGrowth1Token - _innerFeeGrowth1Token, currentLiquidity, Constants.Q128));
    }

    // To avoid overflow owner has to collect fee before it
    if (fees0 | fees1 != 0) {
      _position.fees0 += fees0;
      _position.fees1 += fees1;
    }
  }

  struct UpdatePositionCache {
    uint160 price; // The square root of the current price in Q64.96 format
    int24 tick; // The current tick
    int24 prevInitializedTick;
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
      globalState.tick,
      globalState.prevInitializedTick,
      globalState.timepointIndex
    );

    bool toggledBottom;
    bool toggledTop;
    {
      (uint256 _totalFeeGrowth0Token, uint256 _totalFeeGrowth1Token) = (totalFeeGrowth0Token, totalFeeGrowth1Token);
      if (liquidityDelta != 0) {
        uint32 time = _blockTimestamp();
        uint160 secondsPerLiquidityCumulative = _getSecondsPerLiquidityCumulative(time, liquidity);

        toggledBottom = ticks.update(
          bottomTick,
          cache.tick,
          liquidityDelta,
          _totalFeeGrowth0Token,
          _totalFeeGrowth1Token,
          secondsPerLiquidityCumulative,
          time,
          false // isTopTick
        );

        toggledTop = ticks.update(
          topTick,
          cache.tick,
          liquidityDelta,
          _totalFeeGrowth0Token,
          _totalFeeGrowth1Token,
          secondsPerLiquidityCumulative,
          time,
          true // isTopTick
        );
      }

      (uint256 feeGrowthInside0X128, uint256 feeGrowthInside1X128) = ticks.getInnerFeeGrowth(
        bottomTick,
        topTick,
        cache.tick,
        _totalFeeGrowth0Token,
        _totalFeeGrowth1Token
      );

      _recalculatePosition(position, liquidityDelta, feeGrowthInside0X128, feeGrowthInside1X128);
    }

    if (liquidityDelta != 0) {
      // if liquidityDelta is negative and the tick was toggled, it means that it should not be initialized anymore, so we delete it
      if (toggledBottom || toggledTop) {
        uint256 _tickTreeRoot = tickTreeRoot;
        uint256 _initialTickTreeRoot = _tickTreeRoot;
        int24 _prevInitializedTick = cache.prevInitializedTick;
        if (toggledBottom) {
          (_prevInitializedTick, _tickTreeRoot) = _insertOrRemoveTick(
            bottomTick,
            cache.tick,
            _prevInitializedTick,
            _tickTreeRoot,
            liquidityDelta < 0
          );
        }
        if (toggledTop) {
          (_prevInitializedTick, _tickTreeRoot) = _insertOrRemoveTick(topTick, cache.tick, _prevInitializedTick, _tickTreeRoot, liquidityDelta < 0);
        }

        if (_initialTickTreeRoot != _tickTreeRoot) tickTreeRoot = _tickTreeRoot;
        if (_prevInitializedTick != cache.prevInitializedTick) globalState.prevInitializedTick = _prevInitializedTick;
      }

      int128 globalLiquidityDelta;
      (amount0, amount1, globalLiquidityDelta) = _getAmountsForLiquidity(bottomTick, topTick, liquidityDelta, cache.tick, cache.price);
      if (globalLiquidityDelta != 0) {
        uint128 liquidityBefore = liquidity;
        (uint16 newTimepointIndex, uint16 newFee) = _writeTimepoint(cache.timepointIndex, _blockTimestamp(), cache.tick, liquidityBefore);
        if (cache.timepointIndex != newTimepointIndex) {
          globalState.fee = newFee;
          globalState.timepointIndex = newTimepointIndex;
          emit Fee(newFee); // TODO not emit if fee unchanged
        }
        liquidity = LiquidityMath.addDelta(liquidityBefore, liquidityDelta);
      }
    }
  }

  function _insertOrRemoveTick(
    int24 tick,
    int24 currentTick,
    int24 prevInitializedTick,
    uint256 tickTreeRoot,
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
        nextTick = tickTable.getNextTick(tickSecondLayer, tickTreeRoot, tick);
        prevTick = ticks[nextTick].prevTick;
      }
      ticks.insertTick(tick, prevTick, nextTick);
    }
    return (prevInitializedTick, tickTable.toggleTick(tickSecondLayer, tick, tickTreeRoot));
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

    (amount0, amount1) = liquidityDelta < 0 ? (uint256(-amount0Int), uint256(-amount1Int)) : (uint256(amount0Int), uint256(amount1Int));
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

  function _syncBalances() internal returns (uint256 balance0, uint256 balance1) {
    (balance0, balance1) = (balanceToken0(), balanceToken1());
    uint128 _liquidity = liquidity;
    if (_liquidity == 0) return (balance0, balance1);

    uint256 _reserve0 = reserve0;
    if (balance0 > _reserve0) {
      totalFeeGrowth0Token += FullMath.mulDiv(balance0 - _reserve0, Constants.Q128, _liquidity);
      reserve0 = balance0;
    }
    uint256 _reserve1 = reserve1;
    if (balance1 > _reserve1) {
      totalFeeGrowth1Token += FullMath.mulDiv(balance1 - _reserve1, Constants.Q128, _liquidity);
      reserve1 = balance1;
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
  ) external override nonReentrant onlyValidTicks(bottomTick, topTick) returns (uint256 amount0, uint256 amount1, uint128 liquidityActual) {
    require(liquidityDesired != 0, 'IL');
    {
      int24 _tickSpacing = tickSpacing;
      require(bottomTick % _tickSpacing | topTick % _tickSpacing == 0, 'tick is not spaced');
    }
    if (bottomTick == topTick) {
      (amount0, amount1) = bottomTick > globalState.tick ? (uint256(liquidityDesired), uint256(0)) : (uint256(0), uint256(liquidityDesired));
    } else {
      (amount0, amount1, ) = _getAmountsForLiquidity(bottomTick, topTick, int256(liquidityDesired).toInt128(), globalState.tick, globalState.price);
    }
    liquidityActual = liquidityDesired;

    (uint256 receivedAmount0, uint256 receivedAmount1) = _syncBalances();
    IAlgebraMintCallback(msg.sender).algebraMintCallback(amount0, amount1, data);

    if (amount0 == 0) receivedAmount0 = 0;
    else {
      receivedAmount0 = balanceToken0().sub(receivedAmount0);
      if (receivedAmount0 < amount0) {
        liquidityActual = uint128(FullMath.mulDiv(uint256(liquidityActual), receivedAmount0, amount0));
      }
    }

    if (amount1 == 0) receivedAmount1 = 0;
    else {
      receivedAmount1 = balanceToken1().sub(receivedAmount1);
      if (receivedAmount1 < amount1) {
        uint128 liquidityForRA1 = uint128(FullMath.mulDiv(uint256(liquidityActual), receivedAmount1, amount1));
        if (liquidityForRA1 < liquidityActual) liquidityActual = liquidityForRA1;
      }
    }

    require(liquidityActual != 0, 'IIAM');

    {
      Position storage _position = getOrCreatePosition(recipient, bottomTick, topTick);
      if (bottomTick == topTick) {
        liquidityActual = receivedAmount0 > 0 ? uint128(receivedAmount0) : uint128(receivedAmount1);
        _updateLimitOrderPosition(_position, bottomTick, int256(liquidityActual).toInt128());
      } else {
        liquidityActual = liquidityDesired;
        if (receivedAmount0 < amount0) {
          liquidityActual = uint128(FullMath.mulDiv(uint256(liquidityActual), receivedAmount0, amount0));
        }
        if (receivedAmount1 < amount1) {
          uint128 liquidityForRA1 = uint128(FullMath.mulDiv(uint256(liquidityActual), receivedAmount1, amount1));
          if (liquidityForRA1 < liquidityActual) liquidityActual = liquidityForRA1;
        }
        require(liquidityActual > 0, 'IIL2');

        (amount0, amount1) = _updatePositionTicksAndFees(_position, bottomTick, topTick, int256(liquidityActual).toInt128());
      }
    }

    if (amount0 > 0) {
      if (receivedAmount0 > amount0) TransferHelper.safeTransfer(token0, sender, receivedAmount0 - amount0);
      else require(receivedAmount0 == amount0, 'IIAM2');
      reserve0 += amount0;
    }

    if (amount1 > 0) {
      if (receivedAmount1 > amount1) TransferHelper.safeTransfer(token1, sender, receivedAmount1 - amount1);
      else require(receivedAmount1 == amount1, 'IIAM2');
      reserve1 += amount1;
    }
    emit Mint(msg.sender, recipient, bottomTick, topTick, liquidityActual, amount0, amount1);
  }

  function _recalculateLimitOrderPosition(Position storage position, int24 tick, int128 liquidityDelta) private {
    (uint256 _positionLiquidity, uint256 _positionLiquidityInitial) = (position.liquidity, position.liquidityInitial);
    if (_positionLiquidity == 0) require(liquidityDelta > 0, 'NP');

    LimitOrderManager.LimitOrder storage _limitOrder = limitOrders[tick];
    uint256 _cumulativeDelta = _limitOrder.spentAsk1Cumulative - position.innerFeeGrowth1Token;
    bool zto = _cumulativeDelta > 0;
    if (!zto) _cumulativeDelta = _limitOrder.spentAsk0Cumulative - position.innerFeeGrowth0Token;

    if (_cumulativeDelta > 0) {
      uint256 closedAmount;
      if (_positionLiquidityInitial > 0) {
        closedAmount = FullMath.mulDiv(_cumulativeDelta, _positionLiquidityInitial, Constants.Q128);
        uint160 sqrtPrice = TickMath.getSqrtRatioAtTick(tick);
        uint256 price = FullMath.mulDiv(sqrtPrice, sqrtPrice, Constants.Q96);
        (uint256 nominator, uint256 denominator) = zto ? (price, Constants.Q96) : (Constants.Q96, price);
        uint256 fullAmount = FullMath.mulDiv(_positionLiquidity, nominator, denominator);

        if (closedAmount >= fullAmount) {
          closedAmount = fullAmount;
          _positionLiquidity = 0;
        } else {
          _positionLiquidity = FullMath.mulDiv(fullAmount - closedAmount, denominator, nominator); // unspent input
        }
      }
      if (zto) {
        position.innerFeeGrowth1Token = position.innerFeeGrowth1Token + _cumulativeDelta;
        if (closedAmount > 0) position.fees1 = position.fees1.add128(uint128(closedAmount));
      } else {
        position.innerFeeGrowth0Token = position.innerFeeGrowth0Token + _cumulativeDelta;
        if (closedAmount > 0) position.fees0 = position.fees0.add128(uint128(closedAmount));
      }
    }
    if (_positionLiquidity == 0) _positionLiquidityInitial = 0;

    if (liquidityDelta != 0) {
      // add/remove liquidity to tick with partly executed limit order
      if (_positionLiquidity != _positionLiquidityInitial && _positionLiquidity != 0) {
        int128 liquidityInitialDelta;
        if (liquidityDelta < 0) {
          liquidityInitialDelta = -int256(FullMath.mulDiv(uint128(-liquidityDelta), _positionLiquidityInitial, _positionLiquidity)).toInt128();
        } else {
          liquidityInitialDelta = int256(FullMath.mulDiv(uint128(liquidityDelta), _positionLiquidityInitial, _positionLiquidity)).toInt128();
        }
        limitOrders.addVirtualLiquidity(tick, liquidityInitialDelta - liquidityDelta);
        _positionLiquidity = LiquidityMath.addDelta(uint128(_positionLiquidity), liquidityDelta);
        _positionLiquidityInitial = LiquidityMath.addDelta(uint128(_positionLiquidityInitial), liquidityInitialDelta);
      } else {
        _positionLiquidity = LiquidityMath.addDelta(uint128(_positionLiquidity), liquidityDelta);
        _positionLiquidityInitial = LiquidityMath.addDelta(uint128(_positionLiquidityInitial), liquidityDelta);
      }
    }
    if (_positionLiquidity == 0) _positionLiquidityInitial = 0;
    (position.liquidity, position.liquidityInitial) = (uint128(_positionLiquidity), uint128(_positionLiquidityInitial));
  }

  function _updateLimitOrderPosition(
    Position storage position,
    int24 tick,
    int128 liquidityDelta
  ) private returns (uint256 amount0, uint256 amount1) {
    _recalculateLimitOrderPosition(position, tick, liquidityDelta);

    if (liquidityDelta != 0) {
      bool remove = liquidityDelta < 0;

      (int24 _globalTick, int24 _prevInitializedTick) = (globalState.tick, globalState.prevInitializedTick);
      if (limitOrders.addOrRemoveLimitOrder(tick, liquidityDelta)) {
        TickManager.Tick storage _tickData = ticks[tick];
        _tickData.hasLimitOrders = !remove;
        if (_tickData.nextTick == _tickData.prevTick) {
          uint256 _initTickTreeRoot = tickTreeRoot;
          (int24 newPrevInitializedTick, uint256 _tickTreeRoot) = _insertOrRemoveTick(
            tick,
            _globalTick,
            _prevInitializedTick,
            _initTickTreeRoot,
            remove
          );
          if (_initTickTreeRoot != _tickTreeRoot) tickTreeRoot = _tickTreeRoot;
          if (newPrevInitializedTick != _prevInitializedTick) globalState.prevInitializedTick = newPrevInitializedTick;
        }
      }

      if (remove) {
        return (tick > _globalTick) ? (uint256(-liquidityDelta), uint256(0)) : (uint256(0), uint256(-liquidityDelta));
      }
    }
  }

  function _payFromReserve(address token, address recipient, uint256 amount) internal {
    TransferHelper.safeTransfer(token, recipient, amount);
    if (token == token0) {
      reserve0 -= amount;
    } else {
      reserve1 -= amount;
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
      // single SSTORE
      (position.fees0, position.fees1) = (positionFees0 - amount0, positionFees1 - amount1);

      if (amount0 > 0) _payFromReserve(token0, recipient, amount0);
      if (amount1 > 0) _payFromReserve(token1, recipient, amount1);
    }

    emit Collect(msg.sender, recipient, bottomTick, topTick, amount0, amount1);
  }

  /// @inheritdoc IAlgebraPoolActions
  function burn(
    int24 bottomTick,
    int24 topTick,
    uint128 amount
  ) external override nonReentrant onlyValidTicks(bottomTick, topTick) returns (uint256 amount0, uint256 amount1) {
    _syncBalances();

    Position storage position = getOrCreatePosition(msg.sender, bottomTick, topTick);
    int128 liquidityDelta = -int256(amount).toInt128();
    (amount0, amount1) = (bottomTick == topTick)
      ? _updateLimitOrderPosition(position, bottomTick, liquidityDelta)
      : _updatePositionTicksAndFees(position, bottomTick, topTick, liquidityDelta);

    if (amount0 | amount1 != 0) {
      (position.fees0, position.fees1) = (position.fees0.add128(uint128(amount0)), position.fees1.add128(uint128(amount1)));
    }
    emit Burn(msg.sender, bottomTick, topTick, amount, amount0, amount1);
  }

  function _payCommunityFee(uint256 amount0, uint256 amount1) private {
    (uint128 _communityFeePending0, uint128 _communityFeePending1) = (communityFeePending0, communityFeePending1);
    if (amount0 > 0) _communityFeePending0 += uint128(amount0);
    if (amount1 > 0) _communityFeePending1 += uint128(amount1);

    if (_blockTimestamp() - communityFeeLastTimestamp >= 8 hours) {
      // TODO CONST
      // underflow is desired
      if (_communityFeePending0 > 0) {
        TransferHelper.safeTransfer(token0, communityVault, _communityFeePending0);
        reserve0 -= _communityFeePending0;
      }
      if (_communityFeePending1 > 0) {
        TransferHelper.safeTransfer(token1, communityVault, _communityFeePending1);
        reserve1 -= _communityFeePending1;
      }
      (communityFeePending0, communityFeePending1) = (0, 0);
      communityFeeLastTimestamp = _blockTimestamp();
    } else {
      (communityFeePending0, communityFeePending1) = (_communityFeePending0, _communityFeePending1);
    }
  }

  function _writeTimepoint(
    uint16 timepointIndex,
    uint32 blockTimestamp,
    int24 tick,
    uint128 currentLiquidity
  ) private returns (uint16 newTimepointIndex, uint16 newFee) {
    uint32 _lastTs = lastTimepointTimestamp;
    if (_lastTs == blockTimestamp) return (timepointIndex, 0);

    secondsPerLiquidityCumulative += ((uint160(blockTimestamp - _lastTs) << 128) / (currentLiquidity > 0 ? currentLiquidity : 1));
    lastTimepointTimestamp = blockTimestamp;

    return IDataStorageOperator(dataStorageOperator).write(timepointIndex, blockTimestamp, tick);
  }

  function _getSecondsPerLiquidityCumulative(uint32 blockTimestamp, uint128 currentLiquidity) private view returns (uint160 _secPerLiqCumulative) {
    uint32 _lastTs;
    (_lastTs, _secPerLiqCumulative) = (lastTimepointTimestamp, secondsPerLiquidityCumulative);
    if (_lastTs != blockTimestamp)
      _secPerLiqCumulative += ((uint160(blockTimestamp - _lastTs) << 128) / (currentLiquidity > 0 ? currentLiquidity : 1));
  }

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

    if (zeroToOne) {
      (uint256 balanceBefore, ) = _syncBalances();
      if (amount1 < 0) _payFromReserve(token1, recipient, uint256(-amount1)); // transfer to recipient
      _swapCallback(amount0, amount1, data); // callback to get tokens from the caller
      require(balanceBefore.add(uint256(amount0)) <= balanceToken0(), 'IIA');
      reserve0 = balanceBefore + uint256(amount0);
      if (communityFee > 0) _payCommunityFee(communityFee, 0);
    } else {
      (, uint256 balanceBefore) = _syncBalances();
      if (amount0 < 0) _payFromReserve(token0, recipient, uint256(-amount0)); // transfer to recipient
      _swapCallback(amount0, amount1, data); // callback to get tokens from the caller
      require(balanceBefore.add(uint256(amount1)) <= balanceToken1(), 'IIA');
      reserve1 = balanceBefore + uint256(amount1);
      if (communityFee > 0) _payCommunityFee(0, communityFee);
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
    if (amountRequired < 0) amountRequired = -amountRequired; // we support only exactInput here
    // Since the pool can get less tokens then sent, firstly we are getting tokens from the
    // original caller of the transaction. And change the _amountRequired_
    {
      (uint256 balance0Before, uint256 balance1Before) = _syncBalances();
      int256 amountReceived;
      if (zeroToOne) {
        _swapCallback(amountRequired, 0, data);
        amountReceived = int256(balanceToken0().sub(balance0Before));
      } else {
        _swapCallback(0, amountRequired, data);
        amountReceived = int256(balanceToken1().sub(balance1Before));
      }
      if (amountReceived < amountRequired) amountRequired = amountReceived;
    }
    require(amountRequired != 0, 'IIA');

    uint160 currentPrice;
    int24 currentTick;
    uint128 currentLiquidity;
    uint256 communityFee;
    (amount0, amount1, currentPrice, currentTick, currentLiquidity, communityFee) = _calculateSwap(zeroToOne, amountRequired, limitSqrtPrice);

    // only transfer to the recipient
    if (zeroToOne) {
      if (amount1 < 0) _payFromReserve(token1, recipient, uint256(-amount1));
      // return the leftovers
      if (amount0 < amountRequired) {
        TransferHelper.safeTransfer(token0, sender, uint256(amountRequired - amount0));
        amountRequired = int256(amount0);
      }
      reserve0 = reserve0 + uint256(amountRequired);
      if (communityFee > 0) _payCommunityFee(communityFee, 0);
    } else {
      if (amount0 < 0) _payFromReserve(token0, recipient, uint256(-amount0));
      // return the leftovers
      if (amount1 < amountRequired) {
        TransferHelper.safeTransfer(token1, sender, uint256(amountRequired - amount1));
        amountRequired = int256(amount1);
      }
      reserve1 = reserve1 + uint256(amountRequired);
      if (communityFee > 0) _payCommunityFee(0, communityFee);
    }

    emit Swap(msg.sender, recipient, amount0, amount1, currentPrice, currentLiquidity, currentTick);
  }

  struct SwapCalculationCache {
    uint256 communityFee; // The community fee of the selling token, uint256 to minimize casts
    uint160 secondsPerLiquidityCumulative; // The global secondPerLiquidity at the moment
    bool computedLatestTimepoint; //  if we have already fetched _tickCumulative_ and _secondPerLiquidity_ from the DataOperator
    int256 amountRequiredInitial; // The initial value of the exact input\output amount
    int256 amountCalculated; // The additive amount of total output\input calculated trough the swap
    uint256 totalFeeGrowth; // The initial totalFeeGrowth + the fee growth during a swap
    uint256 totalFeeGrowthB;
    address activeIncentive; // Address an active incentive at the moment or address(0)
    bool exactInput; // Whether the exact input or output is specified
    uint16 fee; // The current dynamic fee
    uint16 timepointIndex; // The index of last written timepoint
    int24 startTick; // The tick at the start of a swap
    int24 prevInitializedTick;
    uint32 blockTimestamp;
  }

  struct PriceMovementCache {
    uint160 stepSqrtPrice; // The Q64.96 sqrt of the price at the start of the step
    int24 nextTick; // The tick till the current step goes
    bool initialized; // True if the _nextTick is initialized
    uint160 nextTickPrice; // The Q64.96 sqrt of the price calculated from the _nextTick
    uint256 input; // The additive amount of tokens that have been provided
    uint256 output; // The additive amount of token that have been withdrawn
    uint256 feeAmount; // The total amount of fee earned within a current step
    bool limitOrder;
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

      require(amountRequired != 0, 'AS');
      (cache.amountRequiredInitial, cache.exactInput) = (amountRequired, amountRequired > 0);

      currentLiquidity = liquidity;

      if (zeroToOne) {
        require(limitSqrtPrice < currentPrice && limitSqrtPrice > TickMath.MIN_SQRT_RATIO, 'SPL');
        cache.totalFeeGrowth = totalFeeGrowth0Token;
      } else {
        require(limitSqrtPrice > currentPrice && limitSqrtPrice < TickMath.MAX_SQRT_RATIO, 'SPL');
        cache.totalFeeGrowth = totalFeeGrowth1Token;
      }

      cache.startTick = currentTick;

      cache.blockTimestamp = _blockTimestamp();

      cache.activeIncentive = activeIncentive;

      (uint16 newTimepointIndex, uint16 newFee) = _writeTimepoint(cache.timepointIndex, cache.blockTimestamp, cache.startTick, currentLiquidity);

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
    // swap until there is remaining input or output tokens or we reach the price limit
    while (true) {
      step.stepSqrtPrice = currentPrice;
      step.initialized = true;

      step.nextTickPrice = TickMath.getSqrtRatioAtTick(step.nextTick);

      if (step.stepSqrtPrice == step.nextTickPrice && ticks[step.nextTick].hasLimitOrders) {
        // calculate the amounts from LO
        // TODO fee
        step.feeAmount = 0;
        (step.limitOrder, step.output, step.input) = limitOrders.executeLimitOrders(step.nextTick, currentPrice, zeroToOne, amountRequired);
        if (step.limitOrder) {
          ticks[step.nextTick].hasLimitOrders = false;
          if (ticks[step.nextTick].liquidityTotal == 0) {
            uint256 _initialTickTreeRoot = tickTreeRoot;
            (int24 newPrevInitializedTick, uint256 _tickTreeRoot) = _insertOrRemoveTick(
              step.nextTick,
              currentTick,
              cache.prevInitializedTick,
              _initialTickTreeRoot,
              true
            );
            if (_initialTickTreeRoot != _tickTreeRoot) tickTreeRoot = _tickTreeRoot;
            cache.prevInitializedTick = newPrevInitializedTick;
            step.initialized = false;
          }
        }
        step.limitOrder = !step.limitOrder;
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

      if (currentPrice == step.nextTickPrice && !step.limitOrder) {
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
    (uint256 balance0Before, uint256 balance1Before) = _syncBalances();
    uint256 fee0;
    if (amount0 > 0) {
      fee0 = FullMath.mulDivRoundingUp(amount0, Constants.BASE_FEE, 1e6);
      TransferHelper.safeTransfer(token0, recipient, amount0);
    }
    uint256 fee1;
    if (amount1 > 0) {
      fee1 = FullMath.mulDivRoundingUp(amount1, Constants.BASE_FEE, 1e6);
      TransferHelper.safeTransfer(token1, recipient, amount1);
    }

    IAlgebraFlashCallback(msg.sender).algebraFlashCallback(fee0, fee1, data);

    uint256 paid0 = balanceToken0();
    require(balance0Before.add(fee0) <= paid0, 'F0');
    paid0 -= balance0Before;
    uint256 paid1 = balanceToken1();
    require(balance1Before.add(fee1) <= paid1, 'F1');
    paid1 -= balance1Before;

    uint256 _communityFee = globalState.communityFee;
    if (_communityFee > 0) {
      uint128 communityFee0;
      if (paid0 > 0) {
        communityFee0 = uint128((paid0 * _communityFee) / Constants.COMMUNITY_FEE_DENOMINATOR);
        reserve0 += communityFee0;
      }

      uint128 communityFee1;
      if (paid1 > 0) {
        communityFee1 = uint128((paid1 * _communityFee) / Constants.COMMUNITY_FEE_DENOMINATOR);
        reserve1 += communityFee1;
      }

      _payCommunityFee(communityFee0, communityFee1);
    }

    emit Flash(msg.sender, recipient, amount0, amount1, paid0, paid1);
  }

  function onlyFactoryOwner() private view {
    require(msg.sender == IAlgebraFactory(factory).owner());
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setCommunityFee(uint8 communityFee) external override nonReentrant {
    onlyFactoryOwner();
    require(communityFee <= Constants.MAX_COMMUNITY_FEE);
    require(communityFee != globalState.communityFee);
    globalState.communityFee = communityFee;
    emit CommunityFee(communityFee);
  }

  //TODO interface and natspec
  function setTickSpacing(int24 newTickSpacing) external nonReentrant {
    onlyFactoryOwner();
    require(newTickSpacing > 0);
    require(tickSpacing != newTickSpacing);
    tickSpacing = newTickSpacing;
    emit TickSpacing(newTickSpacing);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setIncentive(address virtualPoolAddress) external override {
    require(msg.sender == IAlgebraFactory(factory).farmingAddress());
    activeIncentive = virtualPoolAddress;

    emit Incentive(virtualPoolAddress);
  }
}
