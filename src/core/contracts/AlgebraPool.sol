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
import './libraries/TickTable.sol';

import './libraries/LowGasSafeMath.sol';
import './libraries/SafeCast.sol';

import './libraries/FullMath.sol';
import './libraries/Constants.sol';
import './libraries/TransferHelper.sol';
import './libraries/TickMath.sol';
import './libraries/LiquidityMath.sol';

import './interfaces/IAlgebraPoolDeployer.sol';
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
  using TickTable for mapping(int16 => uint256);
  using TickManager for mapping(int24 => TickManager.Tick);

  struct Position {
    uint128 liquidity; // The amount of liquidity concentrated in the range
    uint256 innerFeeGrowth0Token; // The last updated fee growth per unit of liquidity
    uint256 innerFeeGrowth1Token;
    uint128 fees0; // The amount of token0 owed to a LP
    uint128 fees1; // The amount of token1 owed to a LP
  }

  /// @inheritdoc IAlgebraPoolState
  mapping(bytes32 => Position) public override positions;

  modifier onlyValidTicks(int24 bottomTick, int24 topTick) {
    require(topTick < TickMath.MAX_TICK + 1, 'TUM');
    require(topTick > bottomTick, 'TLU');
    require(bottomTick > TickMath.MIN_TICK - 1, 'TLM');
    _;
  }

  constructor() PoolImmutables(msg.sender) {
    globalState.fee = Constants.BASE_FEE;
    globalState.prevInitializedTick = TickMath.MIN_TICK;
    ticks.initTickState();
  }

  function balanceToken0() private view returns (uint256) {
    return IERC20Minimal(token0).balanceOf(address(this));
  }

  function balanceToken1() private view returns (uint256) {
    return IERC20Minimal(token1).balanceOf(address(this));
  }

  struct Cumulatives {
    uint160 outerSecondPerLiquidity;
    uint32 outerSecondsSpent;
  }

  /// @inheritdoc IAlgebraPoolDerivedState
  function getInnerCumulatives(int24 bottomTick, int24 topTick)
    external
    view
    override
    onlyValidTicks(bottomTick, topTick)
    returns (uint160 innerSecondsSpentPerLiquidity, uint32 innerSecondsSpent)
  {
    Cumulatives memory lower;
    {
      TickManager.Tick storage _lower = ticks[bottomTick];
      (lower.outerSecondPerLiquidity, lower.outerSecondsSpent) = (_lower.outerSecondsPerLiquidity, _lower.outerSecondsSpent);
      require(_lower.initialized);
    }

    Cumulatives memory upper;
    {
      TickManager.Tick storage _upper = ticks[topTick];
      (upper.outerSecondPerLiquidity, upper.outerSecondsSpent) = (_upper.outerSecondsPerLiquidity, _upper.outerSecondsSpent);

      require(_upper.initialized);
    }

    (int24 currentTick, uint16 currentTimepointIndex) = (globalState.tick, globalState.timepointIndex);

    if (currentTick < bottomTick) {
      return (lower.outerSecondPerLiquidity - upper.outerSecondPerLiquidity, lower.outerSecondsSpent - upper.outerSecondsSpent);
    }

    if (currentTick < topTick) {
      uint32 globalTime = _blockTimestamp();
      (, uint160 globalSecondsPerLiquidityCumulative, ) = _getSingleTimepoint(globalTime, 0, currentTick, currentTimepointIndex, liquidity);
      return (
        globalSecondsPerLiquidityCumulative - lower.outerSecondPerLiquidity - upper.outerSecondPerLiquidity,
        globalTime - lower.outerSecondsSpent - upper.outerSecondsSpent
      );
    }

    return (upper.outerSecondPerLiquidity - lower.outerSecondPerLiquidity, upper.outerSecondsSpent - lower.outerSecondsSpent);
  }

  /// @inheritdoc IAlgebraPoolActions
  function initialize(uint160 initialPrice) external override {
    require(globalState.price == 0, 'AI');
    // getTickAtSqrtRatio checks validity of initialPrice inside
    int24 tick = TickMath.getTickAtSqrtRatio(initialPrice);

    uint32 timestamp = _blockTimestamp();
    IDataStorageOperator(dataStorageOperator).initialize(timestamp, tick);

    globalState.price = initialPrice;
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
      require(currentLiquidity > 0, 'NP'); // Do not recalculate the empty ranges
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
   * @return position The Position object to operate with
   * @return amount0 The amount of token0 the caller needs to send, negative if the pool needs to send it
   * @return amount1 The amount of token1 the caller needs to send, negative if the pool needs to send it
   */
  function _updatePositionTicksAndFees(
    address owner,
    int24 bottomTick,
    int24 topTick,
    int128 liquidityDelta
  )
    private
    returns (
      Position storage position,
      int256 amount0,
      int256 amount1
    )
  {
    UpdatePositionCache memory cache = UpdatePositionCache(
      globalState.price,
      globalState.tick,
      globalState.prevInitializedTick,
      globalState.timepointIndex
    );

    position = getOrCreatePosition(owner, bottomTick, topTick);

    (uint256 _totalFeeGrowth0Token, uint256 _totalFeeGrowth1Token) = (totalFeeGrowth0Token, totalFeeGrowth1Token);

    bool toggledBottom;
    bool toggledTop;
    if (liquidityDelta != 0) {
      uint32 time = _blockTimestamp();
      (, uint160 secondsPerLiquidityCumulative, ) = _getSingleTimepoint(time, 0, cache.tick, cache.timepointIndex, liquidity);

      if (
        ticks.update(
          bottomTick,
          cache.tick,
          liquidityDelta,
          _totalFeeGrowth0Token,
          _totalFeeGrowth1Token,
          secondsPerLiquidityCumulative,
          time,
          false // isTopTick
        )
      ) {
        toggledBottom = true;
        tickTable.toggleTick(bottomTick);
      }

      if (
        ticks.update(
          topTick,
          cache.tick,
          liquidityDelta,
          _totalFeeGrowth0Token,
          _totalFeeGrowth1Token,
          secondsPerLiquidityCumulative,
          time,
          true // isTopTick
        )
      ) {
        toggledTop = true;
        tickTable.toggleTick(topTick);
      }
    }

    (uint256 feeGrowthInside0X128, uint256 feeGrowthInside1X128) = ticks.getInnerFeeGrowth(
      bottomTick,
      topTick,
      cache.tick,
      _totalFeeGrowth0Token,
      _totalFeeGrowth1Token
    );

    _recalculatePosition(position, liquidityDelta, feeGrowthInside0X128, feeGrowthInside1X128);

    if (liquidityDelta != 0) {
      // if liquidityDelta is negative and the tick was toggled, it means that it should not be initialized anymore, so we delete it
      if (liquidityDelta < 0) {
        if (toggledBottom) {
          if (cache.prevInitializedTick == bottomTick) globalState.prevInitializedTick = ticks[bottomTick].prevTick;
          ticks.removeTick(bottomTick);
        }
        if (toggledTop) {
          if (cache.prevInitializedTick == topTick) globalState.prevInitializedTick = ticks[topTick].prevTick;
          ticks.removeTick(topTick);
        }
      } else {
        if (toggledBottom) {
          int24 prevBottomTick = tickTable.getNextWordWithInitializedTick(bottomTick, true);
          if (cache.prevInitializedTick == prevBottomTick) globalState.prevInitializedTick = bottomTick;
          ticks.insertTick(bottomTick, prevBottomTick, ticks[prevBottomTick].nextTick);
        }
        if (toggledTop) {
          int24 prevTopTick = tickTable.getNextWordWithInitializedTick(topTick, true);
          if (cache.prevInitializedTick == topTick) globalState.prevInitializedTick = topTick;
          ticks.insertTick(topTick, prevTopTick, ticks[prevTopTick].nextTick);
        }
      }

      int128 globalLiquidityDelta;
      (amount0, amount1, globalLiquidityDelta) = _getAmountsForLiquidity(bottomTick, topTick, liquidityDelta, cache.tick, cache.price);
      if (globalLiquidityDelta != 0) {
        uint128 liquidityBefore = liquidity;
        uint16 newTimepointIndex = _writeTimepoint(cache.timepointIndex, _blockTimestamp(), cache.tick, liquidityBefore);
        if (cache.timepointIndex != newTimepointIndex) {
          globalState.fee = _getNewFee(_blockTimestamp(), cache.tick, newTimepointIndex, liquidityBefore);
          globalState.timepointIndex = newTimepointIndex;
        }
        liquidity = LiquidityMath.addDelta(liquidityBefore, liquidityDelta);
      }
    }
  }

  function _getAmountsForLiquidity(
    int24 bottomTick,
    int24 topTick,
    int128 liquidityDelta,
    int24 currentTick,
    uint160 currentPrice
  )
    private
    pure
    returns (
      int256 amount0,
      int256 amount1,
      int128 globalLiquidityDelta
    )
  {
    // If current tick is less than the provided bottom one then only the token0 has to be provided
    if (currentTick < bottomTick) {
      amount0 = TokenDeltaMath.getToken0Delta(TickMath.getSqrtRatioAtTick(bottomTick), TickMath.getSqrtRatioAtTick(topTick), liquidityDelta);
    } else if (currentTick < topTick) {
      amount0 = TokenDeltaMath.getToken0Delta(currentPrice, TickMath.getSqrtRatioAtTick(topTick), liquidityDelta);
      amount1 = TokenDeltaMath.getToken1Delta(TickMath.getSqrtRatioAtTick(bottomTick), currentPrice, liquidityDelta);

      globalLiquidityDelta = liquidityDelta;
    }
    // If current tick is greater than the provided top one then only the token1 has to be provided
    else {
      amount1 = TokenDeltaMath.getToken1Delta(TickMath.getSqrtRatioAtTick(bottomTick), TickMath.getSqrtRatioAtTick(topTick), liquidityDelta);
    }
  }

  /**
   * @notice This function fetches certain position object
   * @param owner The address owing the position
   * @param bottomTick The position's bottom tick
   * @param topTick The position's top tick
   * @return position The Position object
   */
  function getOrCreatePosition(
    address owner,
    int24 bottomTick,
    int24 topTick
  ) private view returns (Position storage) {
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
  )
    external
    override
    lock
    onlyValidTicks(bottomTick, topTick)
    returns (
      uint256 amount0,
      uint256 amount1,
      uint128 liquidityActual
    )
  {
    require(liquidityDesired > 0, 'IL');
    {
      (int256 amount0Int, int256 amount1Int, ) = _getAmountsForLiquidity(
        bottomTick,
        topTick,
        int256(liquidityDesired).toInt128(),
        globalState.tick,
        globalState.price
      );

      (amount0, amount1) = (uint256(amount0Int), uint256(amount1Int));
    }

    uint256 receivedAmount0;
    uint256 receivedAmount1;
    {
      (receivedAmount0, receivedAmount1) = _syncBalances();
      IAlgebraMintCallback(msg.sender).algebraMintCallback(amount0, amount1, data);

      if (amount0 > 0) {
        require((receivedAmount0 = balanceToken0().sub(receivedAmount0)) > 0, 'IIAM');
      } else receivedAmount0 = 0;

      if (amount1 > 0) {
        require((receivedAmount1 = balanceToken1().sub(receivedAmount1)) > 0, 'IIAM');
      } else receivedAmount1 = 0;
    }

    liquidityActual = liquidityDesired;
    if (receivedAmount0 < amount0) {
      liquidityActual = uint128(FullMath.mulDiv(uint256(liquidityActual), receivedAmount0, amount0));
    }
    if (receivedAmount1 < amount1) {
      uint128 liquidityForRA1 = uint128(FullMath.mulDiv(uint256(liquidityActual), receivedAmount1, amount1));
      if (liquidityForRA1 < liquidityActual) liquidityActual = liquidityForRA1;
    }

    require(liquidityActual > 0, 'IIL2');

    {
      (, int256 amount0Int, int256 amount1Int) = _updatePositionTicksAndFees(recipient, bottomTick, topTick, int256(liquidityActual).toInt128());

      require((amount0 = uint256(amount0Int)) <= receivedAmount0, 'IIAM2');
      require((amount1 = uint256(amount1Int)) <= receivedAmount1, 'IIAM2');
    }

    if (amount0 > 0) {
      reserve0 += amount0;
      if (receivedAmount0 > amount0) TransferHelper.safeTransfer(token0, sender, receivedAmount0 - amount0);
    }

    if (amount1 > 0) {
      reserve1 += amount1;
      if (receivedAmount1 > amount1) TransferHelper.safeTransfer(token1, sender, receivedAmount1 - amount1);
    }
    emit Mint(msg.sender, recipient, bottomTick, topTick, liquidityActual, amount0, amount1);
  }

  function _payFromReserve(
    address token,
    address recipient,
    uint256 amount
  ) internal {
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
  ) external override lock returns (uint128 amount0, uint128 amount1) {
    Position storage position = getOrCreatePosition(msg.sender, bottomTick, topTick);
    (uint128 positionFees0, uint128 positionFees1) = (position.fees0, position.fees1);

    amount0 = amount0Requested > positionFees0 ? positionFees0 : amount0Requested;
    amount1 = amount1Requested > positionFees1 ? positionFees1 : amount1Requested;

    if (amount0 | amount1 != 0) {
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
  ) external override lock onlyValidTicks(bottomTick, topTick) returns (uint256 amount0, uint256 amount1) {
    _syncBalances();
    (Position storage position, int256 amount0Int, int256 amount1Int) = _updatePositionTicksAndFees(
      msg.sender,
      bottomTick,
      topTick,
      -int256(amount).toInt128()
    );

    (amount0, amount1) = (uint256(-amount0Int), uint256(-amount1Int));

    if (amount0 | amount1 != 0) {
      (position.fees0, position.fees1) = (position.fees0.add128(uint128(amount0)), position.fees1.add128(uint128(amount1)));
    }
    emit Burn(msg.sender, bottomTick, topTick, amount, amount0, amount1);
  }

  /// @dev Returns new fee according combination of sigmoids
  function _getNewFee(
    uint32 _time,
    int24 _tick,
    uint16 _index,
    uint128 _liquidity
  ) private returns (uint16 newFee) {
    newFee = IDataStorageOperator(dataStorageOperator).getFee(_time, _tick, _index, _liquidity);
    emit Fee(newFee);
  }

  function _payCommunityFee(address token, uint256 amount) private {
    address vault = IAlgebraFactory(factory).vaultAddress();
    TransferHelper.safeTransfer(token, vault, amount);
  }

  function _writeTimepoint(
    uint16 timepointIndex,
    uint32 blockTimestamp,
    int24 tick,
    uint128 liquidity
  ) private returns (uint16 newTimepointIndex) {
    return IDataStorageOperator(dataStorageOperator).write(timepointIndex, blockTimestamp, tick, liquidity);
  }

  function _getSingleTimepoint(
    uint32 blockTimestamp,
    uint32 secondsAgo,
    int24 startTick,
    uint16 timepointIndex,
    uint128 liquidityStart
  )
    private
    view
    returns (
      int56 tickCumulative,
      uint160 secondsPerLiquidityCumulative,
      uint112 volatilityCumulative
    )
  {
    return IDataStorageOperator(dataStorageOperator).getSingleTimepoint(blockTimestamp, secondsAgo, startTick, timepointIndex, liquidityStart);
  }

  function _swapCallback(
    int256 amount0,
    int256 amount1,
    uint256 feeAmount,
    bytes calldata data
  ) private {
    IAlgebraSwapCallback(msg.sender).algebraSwapCallback(amount0, amount1, feeAmount, data);
  }

  /// @inheritdoc IAlgebraPoolActions
  function swap(
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    bytes calldata data
  ) external override returns (int256 amount0, int256 amount1) {
    uint160 currentPrice;
    int24 currentTick;
    uint128 currentLiquidity;
    uint256 feeAmount;
    // function _calculateSwapAndLock locks globalState.unlocked and does not release
    (amount0, amount1, currentPrice, currentTick, currentLiquidity, feeAmount) = _calculateSwapAndLock(zeroToOne, amountRequired, limitSqrtPrice);

    uint256 communityFee = (feeAmount * globalState.communityFee) / Constants.COMMUNITY_FEE_DENOMINATOR;

    if (zeroToOne) {
      (uint256 balanceBefore, ) = _syncBalances();
      if (amount1 < 0) _payFromReserve(token1, recipient, uint256(-amount1)); // transfer to recipient
      _swapCallback(amount0, amount1, feeAmount, data); // callback to get tokens from the caller
      require(balanceBefore.add(uint256(amount0)) <= balanceToken0(), 'IIA');

      if (communityFee > 0) _payCommunityFee(token0, communityFee);
      reserve0 = balanceBefore + uint256(amount0) - communityFee;
    } else {
      (, uint256 balanceBefore) = _syncBalances();
      if (amount0 < 0) _payFromReserve(token0, recipient, uint256(-amount0)); // transfer to recipient
      _swapCallback(amount0, amount1, feeAmount, data); // callback to get tokens from the caller
      require(balanceBefore.add(uint256(amount1)) <= balanceToken1(), 'IIA');

      if (communityFee > 0) _payCommunityFee(token1, communityFee);
      reserve1 = balanceBefore + uint256(amount1) - communityFee;
    }

    emit Swap(msg.sender, recipient, amount0, amount1, currentPrice, currentLiquidity, currentTick);
    globalState.unlocked = true; // release after lock in _calculateSwapAndLock
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
    if (amountRequired < 0) amountRequired = -amountRequired; // we support only exactInput here
    // Since the pool can get less tokens then sent, firstly we are getting tokens from the
    // original caller of the transaction. And change the _amountRequired_
    require(globalState.unlocked, 'LOK');
    globalState.unlocked = false;
    if (zeroToOne) {
      (uint256 balance0Before, ) = _syncBalances();
      _swapCallback(amountRequired, 0, 0, data);
      int256 amountReceived = int256(balanceToken0().sub(balance0Before));
      if (amountReceived < amountRequired) amountRequired = amountReceived;
    } else {
      (, uint256 balance1Before) = _syncBalances();
      _swapCallback(0, amountRequired, 0, data);
      int256 amountReceived = int256(balanceToken1().sub(balance1Before));
      if (amountReceived < amountRequired) amountRequired = amountReceived;
    }
    require(amountRequired != 0, 'IIA');
    globalState.unlocked = true;

    uint160 currentPrice;
    int24 currentTick;
    uint128 currentLiquidity;
    uint256 feeAmount;
    // function _calculateSwapAndLock locks 'globalState.unlocked' and does not release
    (amount0, amount1, currentPrice, currentTick, currentLiquidity, feeAmount) = _calculateSwapAndLock(zeroToOne, amountRequired, limitSqrtPrice);
    uint256 communityFee = (feeAmount * globalState.communityFee) / Constants.COMMUNITY_FEE_DENOMINATOR;

    // only transfer to the recipient
    if (zeroToOne) {
      if (amount1 < 0) _payFromReserve(token1, recipient, uint256(-amount1));
      // return the leftovers
      if (amount0 < amountRequired) {
        TransferHelper.safeTransfer(token0, sender, uint256(amountRequired - amount0));
        amountRequired = int256(amount0);
      }

      if (communityFee > 0) _payCommunityFee(token0, communityFee);
      reserve0 = reserve0 + uint256(amountRequired) - communityFee;
    } else {
      if (amount0 < 0) _payFromReserve(token0, recipient, uint256(-amount0));
      // return the leftovers
      if (amount1 < amountRequired) {
        TransferHelper.safeTransfer(token1, sender, uint256(amountRequired - amount1));
        amountRequired = int256(amount1);
      }
      if (communityFee > 0) _payCommunityFee(token1, communityFee);
      reserve1 = reserve1 + uint256(amountRequired) - communityFee;
    }

    emit Swap(msg.sender, recipient, amount0, amount1, currentPrice, currentLiquidity, currentTick);
    globalState.unlocked = true; // release after lock in _calculateSwapAndLock
  }

  struct SwapCalculationCache {
    uint256 communityFee; // The community fee of the selling token, uint256 to minimize casts
    int56 tickCumulative; // The global tickCumulative at the moment
    uint160 secondsPerLiquidityCumulative; // The global secondPerLiquidity at the moment
    bool computedLatestTimepoint; //  if we have already fetched _tickCumulative_ and _secondPerLiquidity_ from the DataOperator
    int256 amountRequiredInitial; // The initial value of the exact input\output amount
    int256 amountCalculated; // The additive amount of total output\input calculated trough the swap
    uint256 totalFeeGrowth; // The initial totalFeeGrowth + the fee growth during a swap
    uint256 totalFeeGrowthB;
    address activeIncentive; // Address an active incentive at the moment or address(0)
    bool exactInput; // Whether the exact input or output is specified
    uint16 fee; // The current dynamic fee
    int24 startTick; // The tick at the start of a swap
    int32 blockStartTickX100; // The tick at the start of a swap
    uint16 timepointIndex; // The index of last written timepoint
  }

  struct PriceMovementCache {
    uint160 stepSqrtPrice; // The Q64.96 sqrt of the price at the start of the step
    int24 nextTick; // The tick till the current step goes
    bool initialized; // True if the _nextTick is initialized
    uint160 nextTickPrice; // The Q64.96 sqrt of the price calculated from the _nextTick
    uint256 input; // The additive amount of tokens that have been provided
    uint256 output; // The additive amount of token that have been withdrawn
    uint256 feeAmount; // The total amount of fee earned within a current step
  }

  /// @notice For gas optimization, locks 'globalState.unlocked' and does not release.
  function _calculateSwapAndLock(
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice
  )
    private
    returns (
      int256 amount0,
      int256 amount1,
      uint160 currentPrice,
      int24 currentTick,
      uint128 currentLiquidity,
      uint256 feeAmount
    )
  {
    uint32 blockTimestamp;
    SwapCalculationCache memory cache;
    {
      // load from one storage slot
      currentPrice = globalState.price;
      currentTick = globalState.tick;
      cache.fee = globalState.fee;
      cache.timepointIndex = globalState.timepointIndex;
      cache.communityFee = globalState.communityFee;
      bool unlocked = globalState.unlocked;

      globalState.unlocked = false; // lock will not be released in this function
      require(unlocked, 'LOK');

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

      blockTimestamp = _blockTimestamp();

      if (blockTimestamp != startPriceUpdated) {
        startPriceUpdated = blockTimestamp;
        (cache.blockStartTickX100, ) = TickMath.getTickX100(currentTick, currentPrice, true);
        blockStartTickX100 = cache.blockStartTickX100;
      } else {
        cache.blockStartTickX100 = blockStartTickX100;
      }

      cache.activeIncentive = activeIncentive;

      uint16 newTimepointIndex = _writeTimepoint(cache.timepointIndex, blockTimestamp, cache.startTick, currentLiquidity);

      // new timepoint appears only for first swap/mint/burn in block
      if (newTimepointIndex != cache.timepointIndex) {
        cache.timepointIndex = newTimepointIndex;
        cache.fee = _getNewFee(blockTimestamp, currentTick, newTimepointIndex, currentLiquidity);
      }
    }

    PriceMovementCache memory step;

    step.nextTick = zeroToOne ? ticks[globalState.prevInitializedTick].nextTick : globalState.prevInitializedTick;
    // swap until there is remaining input or output tokens or we reach the price limit
    while (true) {
      step.stepSqrtPrice = currentPrice;
      step.initialized = true;

      // TODO SIMPLIFY
      if (
        (cache.blockStartTickX100 / 100 < currentTick && step.nextTick < cache.blockStartTickX100 / 100) ||
        (cache.blockStartTickX100 / 100 > currentTick && step.nextTick > cache.blockStartTickX100 / 100)
      ) {
        step.nextTick = int24(cache.blockStartTickX100 / 100);
        step.initialized = false;
      }

      step.nextTickPrice = TickMath.getSqrtRatioAtTick(step.nextTick);

      // calculate the amounts needed to move the price to the next target if it is possible or as much as possible

      (currentPrice, step.input, step.output, step.feeAmount) = PriceMovementMath.movePriceTowardsTarget(
        zeroToOne,
        currentPrice,
        (zeroToOne == (step.nextTickPrice < limitSqrtPrice)) // move the price to the target or to the limit
          ? limitSqrtPrice
          : step.nextTickPrice,
        currentLiquidity,
        amountRequired,
        PriceMovementMath.ElasticFeeData(cache.blockStartTickX100, currentTick, cache.fee)
      );

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
      }

      feeAmount += step.feeAmount;

      if (currentLiquidity > 0) cache.totalFeeGrowth += FullMath.mulDiv(step.feeAmount, Constants.Q128, currentLiquidity);

      if (currentPrice == step.nextTickPrice) {
        // if the reached tick is initialized then we need to cross it
        if (step.initialized) {
          // once at a swap we have to get the last timepoint of the observation
          if (!cache.computedLatestTimepoint) {
            (, cache.secondsPerLiquidityCumulative, ) = _getSingleTimepoint(
              blockTimestamp,
              0,
              cache.startTick,
              cache.timepointIndex,
              currentLiquidity // currentLiquidity can be changed only after computedLatestTimepoint
            );
            cache.computedLatestTimepoint = true;
            cache.totalFeeGrowthB = zeroToOne ? totalFeeGrowth1Token : totalFeeGrowth0Token;
          }
          // every tick cross is needed to be duplicated in a virtual pool
          if (cache.activeIncentive != address(0)) {
            bool success = IAlgebraVirtualPool(cache.activeIncentive).cross(step.nextTick, zeroToOne);
            if (!success) {
              cache.activeIncentive = address(0);
              activeIncentive = address(0);
            }
          }
          int128 liquidityDelta;
          if (zeroToOne) {
            liquidityDelta = -ticks.cross(
              step.nextTick,
              cache.totalFeeGrowth, // A == 0
              cache.totalFeeGrowthB, // B == 1
              cache.secondsPerLiquidityCumulative,
              blockTimestamp
            );
          } else {
            liquidityDelta = ticks.cross(
              step.nextTick,
              cache.totalFeeGrowthB, // B == 0
              cache.totalFeeGrowth, // A == 1
              cache.secondsPerLiquidityCumulative,
              blockTimestamp
            );
          }

          currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
        }

        currentTick = zeroToOne ? step.nextTick - 1 : step.nextTick;
      } else if (currentPrice != step.stepSqrtPrice) {
        // if the price has changed but hasn't reached the target
        currentTick = TickMath.getTickAtSqrtRatio(currentPrice);
        break; // since the price hasn't reached the target, amountRequired should be 0
      }

      // check stop condition
      if (amountRequired == 0 || currentPrice == limitSqrtPrice) {
        break;
      }

      step.nextTick = zeroToOne ? ticks[step.nextTick].nextTick : ticks[step.nextTick].prevTick;
    }

    (amount0, amount1) = zeroToOne == cache.exactInput // the amount to provide could be less then initially specified (e.g. reached limit)
      ? (cache.amountRequiredInitial - amountRequired, cache.amountCalculated) // the amount to get could be less then initially specified (e.g. reached limit)
      : (cache.amountCalculated, cache.amountRequiredInitial - amountRequired);

    (globalState.price, globalState.tick, globalState.fee, globalState.timepointIndex) = (currentPrice, currentTick, cache.fee, cache.timepointIndex);

    liquidity = currentLiquidity;

    if (zeroToOne) {
      totalFeeGrowth0Token = cache.totalFeeGrowth;
      globalState.prevInitializedTick = ticks[step.nextTick].prevTick;
    } else {
      totalFeeGrowth1Token = cache.totalFeeGrowth;
      globalState.prevInitializedTick = step.nextTick;
    }
  }

  /// @inheritdoc IAlgebraPoolActions
  function flash(
    address recipient,
    uint256 amount0,
    uint256 amount1,
    bytes calldata data
  ) external override lock {
    require(liquidity > 0, 'L'); // TODO can be removed!

    uint8 _communityFee = globalState.communityFee;

    uint256 fee0;
    uint256 balance0Before = balanceToken0();
    if (amount0 > 0) {
      fee0 = FullMath.mulDivRoundingUp(amount0, Constants.BASE_FEE, 1e6);
      TransferHelper.safeTransfer(token0, recipient, amount0);
    }

    uint256 fee1;
    uint256 balance1Before = balanceToken1();
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

    if (_communityFee != 0) {
      address vault = IAlgebraFactory(factory).vaultAddress();
      if (paid0 > 0) {
        uint256 fees0 = (paid0 * _communityFee) / Constants.COMMUNITY_FEE_DENOMINATOR;
        TransferHelper.safeTransfer(token0, vault, fees0);
      }

      if (paid1 > 0) {
        uint256 fees1 = (paid1 * _communityFee) / Constants.COMMUNITY_FEE_DENOMINATOR;
        TransferHelper.safeTransfer(token1, vault, fees1);
      }
    }

    _syncBalances();
    emit Flash(msg.sender, recipient, amount0, amount1, paid0, paid1);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setCommunityFee(uint8 communityFee) external override lock {
    require(msg.sender == IAlgebraFactory(factory).owner());
    require(communityFee <= Constants.MAX_COMMUNITY_FEE);
    globalState.communityFee = communityFee;
    emit CommunityFee(communityFee);
  }

  /// @inheritdoc IAlgebraPoolPermissionedActions
  function setIncentive(address virtualPoolAddress) external override {
    require(msg.sender == IAlgebraFactory(factory).farmingAddress());
    activeIncentive = virtualPoolAddress;

    emit Incentive(virtualPoolAddress);
  }
}
