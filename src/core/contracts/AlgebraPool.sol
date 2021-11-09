// SPDX-License-Identifier: GPL-2.0-or-later
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
    using SafeCast for uint256;
    using SafeCast for int256;
    using TickTable for mapping(int16 => uint256);
    using TickManager for mapping(int24 => TickManager.Tick);

    struct Position {
        // The amount of liquidity concentrated in the range
        uint128 liquidity;
        // The last updated fee growth per unit of liquidity
        uint256 innerFeeGrowth0Token;
        uint256 innerFeeGrowth1Token;
        // The amount of token0 owed to a LP
        uint128 fees0;
        // The amount of token1 owed to a LP
        uint128 fees1;
    }

    // @inheritdoc IAlgebraPoolState
    mapping(bytes32 => Position) public override positions;

    struct Incentive {
        // The address of a virtual pool associated with the current active incentive
        address virtualPool;
        // The timestamp when the active incentive is finished
        uint32 endTimestamp;
        // The first swap after this timestamp is going to initialize the virtual pool
        uint32 startTimestamp;
    }

    // @inheritdoc IAlgebraPoolState
    Incentive public override activeIncentive;

    // @dev Restricts everyone calling a function except factory owner
    modifier onlyFactoryOwner() {
        require(msg.sender == IAlgebraFactory(factory).owner());
        _;
    }

    constructor() PoolImmutables(msg.sender) {
        globalState.fee = Constants.BASE_FEE;
    }

    function balanceToken0() private view returns (uint256) {
        return IERC20Minimal(token0).balanceOf(address(this));
    }

    function balanceToken1() private view returns (uint256) {
        return IERC20Minimal(token1).balanceOf(address(this));
    }

    // @inheritdoc IDataStorageOperator
    function timepoints(uint256 index)
        external
        view
        override
        returns (
            bool initialized,
            uint32 blockTimestamp,
            int56 tickCumulative,
            uint160 secondsPerLiquidityCumulative,
            uint112 volatilityCumulative,
            uint256 volumePerAvgLiquidity
        )
    {
        return IDataStorageOperator(dataStorageOperator).timepoints(index);
    }

    function tickValidation(int24 bottomTick, int24 topTick) private pure {
        require(bottomTick < topTick, 'TLU');
        require(bottomTick >= TickMath.MIN_TICK, 'TLM');
        require(topTick <= TickMath.MAX_TICK, 'TUM');
    }

    struct cumulatives {
        int56 tickCumulative;
        uint160 outerSecondPerLiquidity;
        uint32 outerSecondsSpent;
    }

    // @inheritdoc IAlgebraPoolDerivedState
    function getInnerCumulatives(int24 bottomTick, int24 topTick)
        external
        view
        override
        returns (
            int56 innerTickCumulative,
            uint160 innerSecondsSpentPerLiquidity,
            uint32 innerSecondsSpent
        )
    {
        tickValidation(bottomTick, topTick);

        cumulatives memory upper;
        cumulatives memory lower;

        {
            TickManager.Tick storage _lower = ticks[bottomTick];
            TickManager.Tick storage _upper = ticks[topTick];
            (lower.tickCumulative, lower.outerSecondPerLiquidity, lower.outerSecondsSpent) = (
                _lower.outerTickCumulative,
                _lower.outerSecondsPerLiquidity,
                _lower.outerSecondsSpent
            );

            (upper.tickCumulative, upper.outerSecondPerLiquidity, upper.outerSecondsSpent) = (
                _upper.outerTickCumulative,
                _upper.outerSecondsPerLiquidity,
                _upper.outerSecondsSpent
            );
            require(_lower.initialized);
            require(_upper.initialized);
        }

        GlobalState memory _globalState = globalState;

        if (_globalState.tick < bottomTick) {
            return (
                lower.tickCumulative - upper.tickCumulative,
                lower.outerSecondPerLiquidity - upper.outerSecondPerLiquidity,
                lower.outerSecondsSpent - upper.outerSecondsSpent
            );
        } else if (_globalState.tick < topTick) {
            uint32 globalTime = _blockTimestamp();
            (int56 globalTickCumulative, uint160 globalSecondsPerLiquidityCumulative, , ) = IDataStorageOperator(
                dataStorageOperator
            ).getSingleTimepoint(globalTime, 0, _globalState.tick, _globalState.timepointIndex, liquidity);
            return (
                globalTickCumulative - lower.tickCumulative - upper.tickCumulative,
                globalSecondsPerLiquidityCumulative - lower.outerSecondPerLiquidity - upper.outerSecondPerLiquidity,
                globalTime - lower.outerSecondsSpent - upper.outerSecondsSpent
            );
        } else {
            return (
                upper.tickCumulative - lower.tickCumulative,
                upper.outerSecondPerLiquidity - lower.outerSecondPerLiquidity,
                upper.outerSecondsSpent - lower.outerSecondsSpent
            );
        }
    }

    // @inheritdoc IAlgebraPoolDerivedState
    function getTimepoints(uint32[] calldata secondsAgos)
        external
        view
        override
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulatives,
            uint112[] memory volatilityCumulatives,
            uint256[] memory volumePerAvgLiquiditys
        )
    {
        return
            IDataStorageOperator(dataStorageOperator).getTimepoints(
                _blockTimestamp(),
                secondsAgos,
                globalState.tick,
                globalState.timepointIndex,
                liquidity
            );
    }

    // @inheritdoc IAlgebraPoolActions
    function initialize(uint160 initialPrice) external override {
        require(globalState.price == 0, 'AI');

        int24 tick = TickMath.getTickAtSqrtRatio(initialPrice);

        // initialize DataStorageOperator
        IDataStorageOperator(dataStorageOperator).initialize(_blockTimestamp());

        // initialize the pool
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
        uint256 _innerFeeGrowth0Token = _position.innerFeeGrowth0Token;
        uint256 _innerFeeGrowth1Token = _position.innerFeeGrowth1Token;

        uint128 liquidityNext;
        if (liquidityDelta == 0) {
            require(currentLiquidity > 0, 'NP'); // Do not recalculate the empty ranges
        } else {
            liquidityNext = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
        }

        (uint128 fees0, uint128 fees1) = (
            uint128(FullMath.mulDiv(innerFeeGrowth0Token - _innerFeeGrowth0Token, currentLiquidity, Constants.Q128)),
            uint128(FullMath.mulDiv(innerFeeGrowth1Token - _innerFeeGrowth1Token, currentLiquidity, Constants.Q128))
        );

        // update the position
        if (liquidityDelta != 0) _position.liquidity = liquidityNext;
        _position.innerFeeGrowth0Token = innerFeeGrowth0Token;
        _position.innerFeeGrowth1Token = innerFeeGrowth1Token;

        // To avoid overflow owner has to collect fee before it
        if (fees0 != 0 || fees1 != 0) {
            _position.fees0 += fees0;
            _position.fees1 += fees1;
        }
    }

    /**
     * @dev Updates position's ticks and its fees
     * @return position The Position object to operate with
     * @return amount0 The amount of token0 the caller needs to send, negative if the pool needs to send it
     * @return amount1 The amount of token1 the caller needs to send, negative if the pool needs to send it
     */
    function _modifyPosition(
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
        GlobalState memory _globalState = globalState;

        position = getOrCreatePosition(owner, bottomTick, topTick);

        (uint256 _totalFeeGrowth0Token, uint256 _totalFeeGrowth1Token) = (totalFeeGrowth0Token, totalFeeGrowth1Token);

        bool toggledBottom;
        bool toggledTop;
        if (liquidityDelta != 0) {
            uint32 time = _blockTimestamp();
            (int56 tickCumulative, uint160 secondsPerLiquidityCumulative, , ) = IDataStorageOperator(
                dataStorageOperator
            ).getSingleTimepoint(time, 0, globalState.tick, globalState.timepointIndex, liquidity);

            if (
                ticks.update(
                    bottomTick,
                    _globalState.tick,
                    liquidityDelta,
                    _totalFeeGrowth0Token,
                    _totalFeeGrowth1Token,
                    secondsPerLiquidityCumulative,
                    tickCumulative,
                    time,
                    false
                )
            ) {
                toggledBottom = true;
                tickTable.toggleTick(bottomTick);
            }

            if (
                ticks.update(
                    topTick,
                    _globalState.tick,
                    liquidityDelta,
                    _totalFeeGrowth0Token,
                    _totalFeeGrowth1Token,
                    secondsPerLiquidityCumulative,
                    tickCumulative,
                    time,
                    true
                )
            ) {
                toggledTop = true;
                tickTable.toggleTick(topTick);
            }
        }

        (uint256 feeGrowthInside0X128, uint256 feeGrowthInside1X128) = ticks.getInnerFeeGrowth(
            bottomTick,
            topTick,
            _globalState.tick,
            _totalFeeGrowth0Token,
            _totalFeeGrowth1Token
        );

        _recalculatePosition(position, liquidityDelta, feeGrowthInside0X128, feeGrowthInside1X128);

        // if liquidityDelta is negative, i.e. the liquidity was removed, and also the tick was toggled, it
        // means that it should not be initialized anymore, so we delete it
        if (liquidityDelta < 0) {
            if (toggledBottom) {
                delete ticks[bottomTick];
            }
            if (toggledTop) {
                delete ticks[topTick];
            }
        }

        if (liquidityDelta != 0) {
            int128 globalLiquidityDelta;
            (amount0, amount1, globalLiquidityDelta) = _getAmountsForLiquidity(
                bottomTick,
                topTick,
                liquidityDelta,
                _globalState
            );
            if (globalLiquidityDelta != 0) {
                uint128 liquidityBefore = liquidity;
                uint16 newTimepointIndex = IDataStorageOperator(dataStorageOperator).write(
                    _globalState.timepointIndex,
                    _blockTimestamp(),
                    _globalState.tick,
                    liquidityBefore,
                    volumePerLiquidityInBlock
                );
                if (globalState.timepointIndex != newTimepointIndex) {
                    globalState.timepointIndex = newTimepointIndex;
                    _changeFee(_blockTimestamp(), _globalState.tick, newTimepointIndex, liquidityBefore);
                    volumePerLiquidityInBlock = 0;
                }
                liquidity = LiquidityMath.addDelta(liquidityBefore, liquidityDelta);
            }
        }
    }

    function _getAmountsForLiquidity(
        int24 bottomTick,
        int24 topTick,
        int128 liquidityDelta,
        GlobalState memory _globalState
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
        if (_globalState.tick < bottomTick) {
            amount0 = TokenDeltaMath.getToken0Delta(
                TickMath.getSqrtRatioAtTick(bottomTick),
                TickMath.getSqrtRatioAtTick(topTick),
                liquidityDelta
            );
        } else if (_globalState.tick < topTick) {
            amount0 = TokenDeltaMath.getToken0Delta(
                _globalState.price,
                TickMath.getSqrtRatioAtTick(topTick),
                liquidityDelta
            );
            amount1 = TokenDeltaMath.getToken1Delta(
                TickMath.getSqrtRatioAtTick(bottomTick),
                _globalState.price,
                liquidityDelta
            );

            globalLiquidityDelta = liquidityDelta;
        }
        // If current tick is greater than the provided top one then only the token1 has to be provided
        else {
            amount1 = TokenDeltaMath.getToken1Delta(
                TickMath.getSqrtRatioAtTick(bottomTick),
                TickMath.getSqrtRatioAtTick(topTick),
                liquidityDelta
            );
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

    // @inheritdoc IAlgebraPoolActions
    function mint(
        address sender,
        address recipient,
        int24 bottomTick,
        int24 topTick,
        uint128 _liquidity,
        bytes calldata data
    )
        external
        override
        lock
        returns (
            uint256 amount0,
            uint256 amount1,
            uint256 liquidityAmount
        )
    {
        require(_liquidity > 0, 'IL');
        tickValidation(bottomTick, topTick);
        {
            (int256 amount0Int, int256 amount1Int, ) = _getAmountsForLiquidity(
                bottomTick,
                topTick,
                int256(_liquidity).toInt128(),
                globalState
            );

            amount0 = uint256(amount0Int);
            amount1 = uint256(amount1Int);
        }

        uint256 receivedAmount0;
        uint256 receivedAmount1;
        {
            if (amount0 > 0) receivedAmount0 = balanceToken0();
            if (amount1 > 0) receivedAmount1 = balanceToken1();
            IAlgebraMintCallback(msg.sender).AlgebraMintCallback(amount0, amount1, data);
            if (amount0 > 0) require((receivedAmount0 = balanceToken0() - receivedAmount0) > 0, 'IIAM');
            if (amount1 > 0) require((receivedAmount1 = balanceToken1() - receivedAmount1) > 0, 'IIAM');
        }

        if (receivedAmount0 < amount0) {
            _liquidity = uint128(FullMath.mulDiv(uint256(_liquidity), receivedAmount0, amount0));
        }
        if (receivedAmount1 < amount1) {
            uint128 liquidityForRA1 = uint128(FullMath.mulDiv(uint256(_liquidity), receivedAmount1, amount1));
            if (liquidityForRA1 < _liquidity) {
                _liquidity = liquidityForRA1;
            }
        }

        require(_liquidity > 0, 'IIL2');

        {
            (, int256 amount0Int, int256 amount1Int) = _modifyPosition(
                recipient,
                bottomTick,
                topTick,
                int256(_liquidity).toInt128()
            );

            require((amount0 = uint256(amount0Int)) <= receivedAmount0, 'IIAM2');
            require((amount1 = uint256(amount1Int)) <= receivedAmount1, 'IIAM2');
        }

        if (receivedAmount0 > amount0) {
            TransferHelper.safeTransfer(token0, sender, receivedAmount0 - amount0);
        }
        if (receivedAmount1 > amount1) {
            TransferHelper.safeTransfer(token1, sender, receivedAmount1 - amount1);
        }
        liquidityAmount = _liquidity;
        emit Mint(msg.sender, recipient, bottomTick, topTick, _liquidity, amount0, amount1);
    }

    // @inheritdoc IAlgebraPoolActions
    function collect(
        address recipient,
        int24 bottomTick,
        int24 topTick,
        uint128 amount0Requested,
        uint128 amount1Requested
    ) external override lock returns (uint128 amount0, uint128 amount1) {
        Position storage position = getOrCreatePosition(msg.sender, bottomTick, topTick);

        amount0 = amount0Requested > position.fees0 ? position.fees0 : amount0Requested;
        amount1 = amount1Requested > position.fees1 ? position.fees1 : amount1Requested;

        if (amount0 > 0) {
            position.fees0 -= amount0;
            TransferHelper.safeTransfer(token0, recipient, amount0);
        }
        if (amount1 > 0) {
            position.fees1 -= amount1;
            TransferHelper.safeTransfer(token1, recipient, amount1);
        }

        emit Collect(msg.sender, recipient, bottomTick, topTick, amount0, amount1);
    }

    // @inheritdoc IAlgebraPoolActions
    function burn(
        int24 bottomTick,
        int24 topTick,
        uint128 amount
    ) external override lock returns (uint256 amount0, uint256 amount1) {
        tickValidation(bottomTick, topTick);
        (Position storage position, int256 amount0Int, int256 amount1Int) = _modifyPosition(
            msg.sender,
            bottomTick,
            topTick,
            -int256(amount).toInt128()
        );

        amount0 = uint256(-amount0Int);
        amount1 = uint256(-amount1Int);

        if (amount0 > 0 || amount1 > 0) {
            (position.fees0, position.fees1) = (position.fees0 + uint128(amount0), position.fees1 + uint128(amount1));
        }

        emit Burn(msg.sender, bottomTick, topTick, amount, amount0, amount1);
    }

    // @dev Changes fee according combination of sigmoids
    function _changeFee(
        uint32 _time,
        int24 _tick,
        uint16 _index,
        uint128 _liquidity
    ) private {
        globalState.fee = IDataStorageOperator(dataStorageOperator).getFee(_time, _tick, _index, _liquidity);
        emit ChangeFee(globalState.fee);
    }

    // @inheritdoc IAlgebraPoolActions
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountRequired,
        uint160 limitSqrtPrice,
        bytes calldata data
    ) external override returns (int256 amount0, int256 amount1) {
        uint160 currentPrice;
        int24 currentTick;
        uint128 currentLiquidity;

        (amount0, amount1, currentPrice, currentTick, currentLiquidity) = _calculateSwap(
            zeroForOne,
            amountRequired,
            limitSqrtPrice
        );

        if (zeroForOne) {
            // transfer to recipient
            if (amount1 < 0) TransferHelper.safeTransfer(token1, recipient, uint256(-amount1));

            uint256 balance0Before = balanceToken0();
            // callback to get tokens from the caller
            IAlgebraSwapCallback(msg.sender).AlgebraSwapCallback(amount0, amount1, data);
            require(balance0Before.add(uint256(amount0)) <= balanceToken0(), 'IIA');
        } else {
            // transfer to recipient
            if (amount0 < 0) TransferHelper.safeTransfer(token0, recipient, uint256(-amount0));

            uint256 balance1Before = balanceToken1();
            // callback to get tokens from the caller
            IAlgebraSwapCallback(msg.sender).AlgebraSwapCallback(amount0, amount1, data);
            require(balance1Before.add(uint256(amount1)) <= balanceToken1(), 'IIA');
        }

        uint256 _communityFee = communityFee;
        if (_communityFee > 0) {
            address vault = IAlgebraFactory(factory).vaultAddress();
            TransferHelper.safeTransfer(zeroForOne ? token0 : token1, vault, _communityFee);
        }

        emit Swap(msg.sender, recipient, amount0, amount1, currentPrice, currentLiquidity, currentTick);
        globalState.unlocked = true;
    }

    // @inheritdoc IAlgebraPoolActions
    function swapSupportingFeeOnInputTokens(
        address sender,
        address recipient,
        bool zeroForOne,
        int256 amountRequired,
        uint160 limitSqrtPrice,
        bytes calldata data
    ) external override returns (int256 amount0, int256 amount1) {
        uint160 currentPrice;
        int24 currentTick;
        uint128 currentLiquidity;

        // Since the pool can get less tokens then sent, firstly we are getting tokens from the
        // original caller of the transaction. And change the _amountRequired_
        if (zeroForOne) {
            uint256 balance0Before = balanceToken0();
            IAlgebraSwapCallback(msg.sender).AlgebraSwapCallback(amountRequired, 0, data);
            require((amountRequired = int256(balanceToken0().sub(balance0Before))) > 0, 'IIA');
        } else {
            uint256 balance1Before = balanceToken1();
            IAlgebraSwapCallback(msg.sender).AlgebraSwapCallback(0, amountRequired, data);
            require((amountRequired = int256(balanceToken1().sub(balance1Before))) > 0, 'IIA');
        }

        (amount0, amount1, currentPrice, currentTick, currentLiquidity) = _calculateSwap(
            zeroForOne,
            amountRequired,
            limitSqrtPrice
        );

        // only transfer to the recipient
        if (zeroForOne) {
            if (amount1 < 0) TransferHelper.safeTransfer(token1, recipient, uint256(-amount1));

            // return the leftovers
            if (amount0 < amountRequired) {
                TransferHelper.safeTransfer(token0, sender, uint256(amountRequired.sub(amount0)));
            }
        } else {
            if (amount0 < 0) TransferHelper.safeTransfer(token0, recipient, uint256(-amount0));

            // return the leftovers
            if (amount1 < amountRequired) {
                TransferHelper.safeTransfer(token1, sender, uint256(amountRequired.sub(amount1)));
            }
        }

        uint256 _communityFee = communityFee;
        if (_communityFee > 0) {
            address vault = IAlgebraFactory(factory).vaultAddress();
            TransferHelper.safeTransfer(zeroForOne ? token0 : token1, vault, _communityFee);
        }

        emit Swap(msg.sender, recipient, amount0, amount1, currentPrice, currentLiquidity, currentTick);
        globalState.unlocked = true;
    }

    struct SwapCache {
        // The community fee of the selling token
        uint8 communityFee;
        // The liquidity at the start of a swap
        uint128 liquidityStart;
        uint128 volumePerLiquidityInBlock;
        // The global tickCumulative at the moment
        int56 tickCumulative;
        // The global secondPerLiquidity at the moment
        uint160 secondsPerLiquidityCumulative;
        // True if we have already fetched _tickCumulative_ and _secondPerLiquidity_ from the DataOperator
        bool computedLatestTimepoint;
        // The initial value of the exact input\output amount
        int256 amountRequiredInitial;
        // The additive amount of total output\input calculated trough the swap
        int256 amountCalculated;
        // The initial totalFeeGrowth + the fee growth during a swap
        uint256 totalFeeGrowth;
        uint256 totalFeeGrowthB;
        // The accumulator of the community fee earned during a swap
        uint256 communityFeeAccumulated;
        // True if there is an active incentive at the moment
        bool hasActiveIncentive;
        // Whether the exact input or output is specified
        bool exactInput;
        // The current dynamic fee
        uint16 fee;
        // The tick at the start of a swap
        int24 startTick;
    }

    struct StepComputations {
        // The sqrt of the price at the star
        uint160 stepSqrtPrice;
        // The tick till the current step goes
        int24 nextTick;
        // True if the _nextTick is initialized
        bool initialized;
        // The sqrt of the price calculated from the _nextTick
        uint160 nextTickPrice;
        // The additive amount of tokens that have been provided
        uint256 input;
        // The additive amount of token that have been withdrawn
        uint256 output;
        // The total amount of fee earned within a current step
        uint256 feeAmount;
    }

    function _calculateSwap(
        bool zeroForOne,
        int256 amountRequired,
        uint160 limitSqrtPrice
    )
        private
        returns (
            int256 amount0,
            int256 amount1,
            uint160 currentPrice,
            int24 currentTick,
            uint128 currentLiquidity
        )
    {
        uint32 blockTimestamp;
        uint16 timepointIndex;
        SwapCache memory cache;
        {
            GlobalState memory _globalState = globalState;
            globalState.unlocked = false;
            require(_globalState.unlocked, 'LOK');
            require(amountRequired != 0, 'AS');

            require(
                zeroForOne
                    ? limitSqrtPrice < _globalState.price && limitSqrtPrice > TickMath.MIN_SQRT_RATIO
                    : limitSqrtPrice > _globalState.price && limitSqrtPrice < TickMath.MAX_SQRT_RATIO,
                'SPL'
            );

            currentPrice = _globalState.price;
            currentTick = _globalState.tick;
            timepointIndex = _globalState.timepointIndex; // The index of the last written timepoint
            currentLiquidity = liquidity;

            (cache.liquidityStart, cache.volumePerLiquidityInBlock) = (currentLiquidity, volumePerLiquidityInBlock);
            cache.amountRequiredInitial = amountRequired;
            cache.exactInput = amountRequired > 0;

            cache.totalFeeGrowth = zeroForOne ? totalFeeGrowth0Token : totalFeeGrowth1Token;
            cache.communityFee = zeroForOne ? (_globalState.communityFeeToken0) : (_globalState.communityFeeToken1);
            cache.fee = _globalState.fee;
            cache.startTick = _globalState.tick;

            blockTimestamp = _blockTimestamp();
            if (activeIncentive.virtualPool != address(0)) {
                cache.hasActiveIncentive = true;
                (, uint32 _time, , , , ) = IDataStorageOperator(dataStorageOperator).timepoints(
                    _globalState.timepointIndexSwap
                );
                if (_time != blockTimestamp) {
                    if (
                        activeIncentive.endTimestamp > blockTimestamp && activeIncentive.startTimestamp < blockTimestamp
                    ) {
                        IAlgebraVirtualPool(activeIncentive.virtualPool).increaseCumulative(_time, blockTimestamp);
                    }
                }
            }

            // try to write a timepoint into the data storage
            uint16 newTimepointIndex = IDataStorageOperator(dataStorageOperator).write(
                timepointIndex,
                blockTimestamp,
                cache.startTick,
                cache.liquidityStart,
                cache.volumePerLiquidityInBlock
            );

            // new timepoint appears only for first swap in block
            if (newTimepointIndex != timepointIndex) {
                timepointIndex = newTimepointIndex;
                cache.volumePerLiquidityInBlock = 0;
                _changeFee(blockTimestamp, currentTick, timepointIndex, currentLiquidity);
            }
        }

        StepComputations memory step;
        // swap until there is remaining input or output tokens or we reach the price limit
        while (amountRequired != 0 && currentPrice != limitSqrtPrice) {
            step.stepSqrtPrice = currentPrice;

            (step.nextTick, step.initialized) = tickTable.nextTickInTheSameRow(currentTick, zeroForOne);

            step.nextTickPrice = TickMath.getSqrtRatioAtTick(step.nextTick);

            // calculate the amounts needed to move the price to the next target if it is possible or as much
            // as possible
            (currentPrice, step.input, step.output, step.feeAmount) = PriceMovementMath.movePriceTowardsTarget(
                zeroForOne,
                currentPrice,
                (zeroForOne == (step.nextTickPrice < limitSqrtPrice)) // move the price to the target or to the limit
                    ? limitSqrtPrice
                    : step.nextTickPrice,
                currentLiquidity,
                amountRequired,
                cache.fee
            );

            if (cache.exactInput) {
                // decrease remaining input amount
                amountRequired -= (step.input + step.feeAmount).toInt256();
                // decrease calculated output amount
                cache.amountCalculated = cache.amountCalculated.sub(step.output.toInt256());
            } else {
                // increase remaining output amount (since its negative)
                amountRequired += step.output.toInt256();
                // increase calculated input amount
                cache.amountCalculated = cache.amountCalculated.add((step.input + step.feeAmount).toInt256());
            }

            if (cache.communityFee > 0) {
                uint256 delta = (step.feeAmount * cache.communityFee) / 100;
                step.feeAmount -= delta;
                cache.communityFeeAccumulated += delta;
            }

            if (currentLiquidity > 0)
                cache.totalFeeGrowth += FullMath.mulDiv(step.feeAmount, Constants.Q128, currentLiquidity);

            if (currentPrice == step.nextTickPrice) {
                // if the reached tick is initialized then we need to cross it
                if (step.initialized) {
                    // once at a swap we have to get the last timepoint of the observation
                    if (!cache.computedLatestTimepoint) {
                        (cache.tickCumulative, cache.secondsPerLiquidityCumulative, , ) = IDataStorageOperator(
                            dataStorageOperator
                        ).getSingleTimepoint(blockTimestamp, 0, cache.startTick, timepointIndex, cache.liquidityStart);
                        cache.computedLatestTimepoint = true;
                        cache.totalFeeGrowthB = zeroForOne ? totalFeeGrowth1Token : totalFeeGrowth0Token;
                    }
                    // every tick cross is needed to be duplicated in a virtual pool
                    if (cache.hasActiveIncentive) {
                        if (activeIncentive.endTimestamp > blockTimestamp) {
                            IAlgebraVirtualPool(activeIncentive.virtualPool).cross(step.nextTick, zeroForOne);
                        }
                    }
                    int128 liquidityDelta;
                    if (zeroForOne) {
                        // <-----------------------
                        //    delta=-x  delta=x
                        //         ________
                        // _______|        |________
                        liquidityDelta = -ticks.cross(
                            step.nextTick,
                            cache.totalFeeGrowth, // A == 0
                            cache.totalFeeGrowthB, // B == 1
                            cache.secondsPerLiquidityCumulative,
                            cache.tickCumulative,
                            blockTimestamp
                        );
                    } else {
                        // ----------------------->
                        //    delta=x  delta=-x
                        //         ________
                        // _______|        |________
                        //
                        liquidityDelta = ticks.cross(
                            step.nextTick,
                            cache.totalFeeGrowthB, // B == 0
                            cache.totalFeeGrowth, // A == 1
                            cache.secondsPerLiquidityCumulative,
                            cache.tickCumulative,
                            blockTimestamp
                        );
                    }

                    currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
                }
                //                          nextTick=x+1
                //      currentTick=x<------------------
                //          tick=x  |    tick=x+1
                // ___________|_____|_______|___________
                //
                //
                //  nextTick=x
                //  ---------------> currentTick=x
                //          tick=x  |    tick=x+1
                // ___________|_____|_______|___________

                currentTick = zeroForOne ? step.nextTick - 1 : step.nextTick;
            } else if (currentPrice != step.stepSqrtPrice) {
                // if the price has changed but hasn't reached the target

                currentTick = TickMath.getTickAtSqrtRatio(currentPrice);
            }
        }

        (amount0, amount1) = zeroForOne == cache.exactInput // the amount to provide could be less then initially specified (e.g. reached limit)
            ? (cache.amountRequiredInitial - amountRequired, cache.amountCalculated) // the amount to get could be less then initially specified (e.g. reached limit)
            : (cache.amountCalculated, cache.amountRequiredInitial - amountRequired);

        (globalState.price, globalState.tick, globalState.timepointIndex, globalState.timepointIndexSwap) = (
            currentPrice,
            currentTick,
            timepointIndex,
            timepointIndex
        );

        // the swap results should be provided to a virtual pool
        if (cache.hasActiveIncentive) {
            if (activeIncentive.startTimestamp <= blockTimestamp) {
                if (activeIncentive.endTimestamp < blockTimestamp) {
                    activeIncentive.endTimestamp = 0;
                    activeIncentive.virtualPool = address(0);
                } else {
                    IAlgebraVirtualPool(activeIncentive.virtualPool).processSwap();
                }
            }
        }

        (liquidity, volumePerLiquidityInBlock) = (
            currentLiquidity,
            cache.volumePerLiquidityInBlock +
                IDataStorageOperator(dataStorageOperator).calculateVolumePerLiquidity(
                    currentLiquidity,
                    amount0,
                    amount1
                )
        );

        communityFee = cache.communityFeeAccumulated;
        if (zeroForOne) {
            totalFeeGrowth0Token = cache.totalFeeGrowth;
        } else {
            totalFeeGrowth1Token = cache.totalFeeGrowth;
        }
    }

    // @inheritdoc IAlgebraPoolActions
    function flash(
        address recipient,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external override lock {
        uint128 _liquidity = liquidity;
        require(_liquidity > 0, 'L');

        uint16 _fee = globalState.fee;

        uint256 fee0;
        uint256 balance0Before = balanceToken0();
        if (amount0 > 0) {
            fee0 = FullMath.mulDivRoundingUp(amount0, _fee, 1e6);
            TransferHelper.safeTransfer(token0, recipient, amount0);
        }

        uint256 fee1;
        uint256 balance1Before = balanceToken1();
        if (amount1 > 0) {
            fee1 = FullMath.mulDivRoundingUp(amount1, _fee, 1e6);
            TransferHelper.safeTransfer(token1, recipient, amount1);
        }

        IAlgebraFlashCallback(msg.sender).AlgebraFlashCallback(fee0, fee1, data);

        address vault = IAlgebraFactory(factory).vaultAddress();

        uint256 paid0 = balanceToken0();
        require(balance0Before.add(fee0) <= paid0, 'F0');
        paid0 -= balance0Before;

        if (paid0 > 0) {
            uint8 _communityFeeToken0 = globalState.communityFeeToken0;
            uint256 fees0;
            if (_communityFeeToken0 > 0) {
                if (paid0 > 0) {
                    fees0 = (paid0 * _communityFeeToken0) / 100;
                    TransferHelper.safeTransfer(token0, vault, fees0);
                }
            }
            totalFeeGrowth0Token += FullMath.mulDiv(paid0 - fees0, Constants.Q128, _liquidity);
        }

        uint256 paid1 = balanceToken1();
        require(balance1Before.add(fee1) <= paid1, 'F1');
        paid1 -= balance1Before;

        if (paid1 > 0) {
            uint8 _communityFeeToken1 = globalState.communityFeeToken1;
            uint256 fees1;
            if (_communityFeeToken1 > 0) {
                if (paid1 > 0) {
                    fees1 = (paid1 * _communityFeeToken1) / 100;
                    TransferHelper.safeTransfer(token1, vault, fees1);
                }
            }
            totalFeeGrowth1Token += FullMath.mulDiv(paid1 - fees1, Constants.Q128, _liquidity);
        }

        emit Flash(msg.sender, recipient, amount0, amount1, paid0, paid1);
    }

    // @inheritdoc IAlgebraPoolPermissionedActions
    function setCommunityFee(uint8 communityFee0, uint8 communityFee1) external override lock onlyFactoryOwner {
        require((communityFee0 < 26) && (communityFee1 < 26));
        (uint8 communityFeeOld0, uint8 communityFeeOld1) = (
            globalState.communityFeeToken0,
            globalState.communityFeeToken1
        );
        (globalState.communityFeeToken0, globalState.communityFeeToken1) = (communityFee0, communityFee1);
        emit SetCommunityFee(communityFeeOld0, communityFeeOld1, communityFee0, communityFee1);
    }

    // @inheritdoc IAlgebraPoolPermissionedActions
    function setIncentive(
        address virtualPoolAddress,
        uint32 endTimestamp,
        uint32 startTimestamp
    ) external override {
        require(msg.sender == IAlgebraFactory(factory).farmingAddress());
        require(activeIncentive.endTimestamp < _blockTimestamp());
        activeIncentive = Incentive(virtualPoolAddress, endTimestamp, startTimestamp);

        emit IncentiveSet(virtualPoolAddress, endTimestamp, startTimestamp);
    }
}
