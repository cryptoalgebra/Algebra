// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/core/contracts/libraries/TickMath.sol';

import './interfaces/ILimitOrderManager.sol';
import './libraries/PositionKey.sol';
import './libraries/PoolAddress.sol';
import './base/LimitOrderManagement.sol';
import './base/PeripheryImmutableState.sol';
import './base/Multicall.sol';
import './base/ERC721Permit.sol';
import './base/PeripheryValidation.sol';
import './base/SelfPermit.sol';
import './base/PoolInitializer.sol';

import 'hardhat/console.sol';

/// @title NFT limitPositions
/// @notice Wraps Algebra  limitPositions in the ERC721 non-fungible token interface
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-periphery
contract LimitOrderManager is
    ILimitOrderManager,
    Multicall,
    ERC721Permit,
    PeripheryImmutableState,
    LimitOrderManagment,
    PeripheryValidation,
    SelfPermit
{
    struct UpdatePositionCache {
        uint256 cumulativeDelta;
        uint160 sqrtPrice;
        uint256 price;
        uint128 liquidityLast;
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
    }

    /// @dev IDs of pools assigned by this contract
    mapping(address => uint80) private _poolIds;

    /// @dev Pool keys by pool ID, to save on SSTOREs for limitPosition data
    mapping(uint80 => PoolAddress.PoolKey) private _poolIdToPoolKey;

    /// @dev The token ID limitPosition data
    mapping(uint256 => LimitPosition) private _limitPositions;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint176 private _nextId = 1;
    /// @dev The ID of the next pool that is used for the first time. Skips 0
    uint80 private _nextPoolId = 1;

    constructor(
        address _factory,
        address _WNativeToken,
        address _poolDeployer
    )
        ERC721Permit('Algebra Positions NFT-V1', 'ALGB-POS', '1')
        PeripheryImmutableState(_factory, _WNativeToken, _poolDeployer)
    {}

    function limitPositions(uint256 tokenId)
        external
        view
        override
        returns (
            LimitPosition memory limitPosition,
            address token0,
            address token1
        )
    {
        limitPosition = _limitPositions[tokenId];
        require(limitPosition.poolId != 0, 'Invalid token ID');
        PoolAddress.PoolKey memory poolKey = _poolIdToPoolKey[limitPosition.poolId];
        return (limitPosition, poolKey.token0, poolKey.token1);
    }

    /// @dev Caches a pool key
    function cachePoolKey(address pool, PoolAddress.PoolKey memory poolKey) private returns (uint80 poolId) {
        poolId = _poolIds[pool];
        if (poolId == 0) {
            _poolIds[pool] = (poolId = _nextPoolId++);
            _poolIdToPoolKey[poolId] = poolKey;
        }
    }

    function addLimitOrder(addLimitOrderParams calldata params) external payable override returns (uint256 tokenId) {
        IAlgebraPool pool;
        bool depositedToken;

        (pool, depositedToken) = createLimitOrder(params.token0, params.token1, params.tick, params.amount);
        _mint(msg.sender, (tokenId = _nextId++));

        // idempotent set
        uint80 poolId = cachePoolKey(
            address(pool),
            PoolAddress.PoolKey({token0: params.token0, token1: params.token1})
        );

        bytes32 positionKey = PositionKey.compute(address(this), params.tick, params.tick);
        (
            uint128 liquidity,
            uint128 liquidityInit,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            ,

        ) = pool.positions(positionKey);
        console.log(liquidity, liquidityInit);
        require(depositedToken == params.depositedToken, 'depositedToken changed');
        require(liquidity == liquidityInit || liquidity - params.amount == 0, 'partly executed');
        _limitPositions[tokenId] = LimitPosition({
            nonce: 0,
            operator: address(0),
            poolId: poolId,
            tick: params.tick,
            depositedToken: depositedToken,
            depositedAmount: params.amount,
            liquidity: params.amount,
            liquidityInit: liquidityInit,
            feeGrowthInside0LastX128: feeGrowthInside0LastX128,
            feeGrowthInside1LastX128: feeGrowthInside1LastX128,
            tokensOwed0: 0,
            tokensOwed1: 0
        });
    }

    modifier isAuthorizedForToken(uint256 tokenId) {
        require(_isApprovedOrOwner(msg.sender, tokenId), 'Not approved');
        _;
    }

    function decreaseLimitOrder(uint256 tokenId, uint128 liquidity)
        external
        payable
        override
        isAuthorizedForToken(tokenId)
        returns (uint256 amount0, uint256 amount1)
    {
        LimitPosition storage position = _limitPositions[tokenId];
        UpdatePositionCache memory cache;

        uint128 positionLiquidity = position.liquidity;
        int24 tick = position.tick;

        PoolAddress.PoolKey memory poolKey = _poolIdToPoolKey[position.poolId];
        IAlgebraPool pool = IAlgebraPool(PoolAddress.computeAddress(poolDeployer, poolKey));
        // update position state
        bytes32 positionKey = PositionKey.compute(address(this), tick, tick);
        (cache.liquidityLast, , cache.feeGrowthInside0LastX128, cache.feeGrowthInside1LastX128, , ) = pool.positions(
            positionKey
        );

        if (cache.liquidityLast > 0) {
            pool.burn(tick, tick, liquidity);
            // this is now updated to the current transaction
            (, , cache.feeGrowthInside0LastX128, cache.feeGrowthInside1LastX128, , ) = pool.positions(positionKey);
        }
        // update lomanager position state

        cache.sqrtPrice = TickMath.getSqrtRatioAtTick(tick);
        cache.price = FullMath.mulDiv(cache.sqrtPrice, cache.sqrtPrice, Constants.Q96);

        if (position.depositedToken) {
            cache.cumulativeDelta = cache.feeGrowthInside0LastX128 - position.feeGrowthInside0LastX128;
            uint128 closedAmount0 = uint128(
                FullMath.mulDiv(cache.cumulativeDelta, position.liquidityInit, Constants.Q128)
            );
            uint128 closedAmountInToken1 = uint128(FullMath.mulDiv(closedAmount0, Constants.Q96, cache.price));
            if (closedAmountInToken1 > positionLiquidity) {
                closedAmountInToken1 = positionLiquidity;
                closedAmount0 = uint128(FullMath.mulDiv(positionLiquidity, cache.price, Constants.Q96));
            }
            positionLiquidity -= closedAmountInToken1;
            require(positionLiquidity >= liquidity);
            position.liquidity = positionLiquidity - liquidity;
            position.tokensOwed0 += closedAmount0;
            position.tokensOwed1 += liquidity;
            (amount0, amount1) = (closedAmount0, liquidity);
        } else {
            cache.cumulativeDelta = cache.feeGrowthInside1LastX128 - position.feeGrowthInside1LastX128;
            uint128 closedAmount1 = uint128(
                FullMath.mulDiv(cache.cumulativeDelta, position.liquidityInit, Constants.Q128)
            );
            uint128 closedAmountInToken0 = uint128(FullMath.mulDiv(closedAmount1, cache.price, Constants.Q96));
            if (closedAmountInToken0 > positionLiquidity) {
                closedAmountInToken0 = positionLiquidity;
                closedAmount1 = uint128(FullMath.mulDiv(positionLiquidity, Constants.Q96, cache.price));
            }
            positionLiquidity -= closedAmountInToken0;
            require(positionLiquidity >= liquidity);
            position.liquidity = positionLiquidity - liquidity;
            position.tokensOwed1 += closedAmount1;
            position.tokensOwed0 += liquidity;
            (amount0, amount1) = (liquidity, closedAmount1);
        }

        position.feeGrowthInside0LastX128 = cache.feeGrowthInside0LastX128;
        position.feeGrowthInside1LastX128 = cache.feeGrowthInside1LastX128;
    }

    function collectLimitOrder(uint256 tokenId, address recipient)
        external
        payable
        override
        isAuthorizedForToken(tokenId)
        returns (uint256 amount0, uint256 amount1)
    {
        // allow collecting to the nft position manager address with address 0
        recipient = recipient == address(0) ? address(this) : recipient;

        LimitPosition storage position = _limitPositions[tokenId];
        int24 tick = position.tick;

        PoolAddress.PoolKey memory poolKey = _poolIdToPoolKey[position.poolId];

        IAlgebraPool pool = IAlgebraPool(PoolAddress.computeAddress(poolDeployer, poolKey));

        // trigger an update of the position fees owed and fee growth snapshots if it has any liquidity
        if (position.liquidity > 0) {
            bytes32 positionKey = PositionKey.compute(address(this), tick, tick);

            uint128 positionLiquidity = position.liquidity;
            (uint128 liquidityLast, , uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, , ) = pool
                .positions(positionKey);

            if (liquidityLast > 0) {
                pool.burn(tick, tick, 0);
                // this is now updated to the current transaction
                (, , feeGrowthInside0LastX128, feeGrowthInside1LastX128, , ) = pool.positions(positionKey);
            }
            // update lomanager position state
            uint256 cumulativeDelta;
            uint160 sqrtPrice = TickMath.getSqrtRatioAtTick(tick);
            uint256 price = FullMath.mulDiv(sqrtPrice, sqrtPrice, Constants.Q96);

            if (position.depositedToken) {
                cumulativeDelta = feeGrowthInside0LastX128 - position.feeGrowthInside0LastX128;
                uint128 closedAmount0 = uint128(
                    FullMath.mulDiv(cumulativeDelta, position.liquidityInit, Constants.Q128)
                );
                uint128 closedAmountInToken1 = uint128(FullMath.mulDiv(closedAmount0, Constants.Q96, price));
                if (closedAmountInToken1 > positionLiquidity) {
                    closedAmountInToken1 = positionLiquidity;
                    closedAmount0 = uint128(FullMath.mulDiv(positionLiquidity, price, Constants.Q96));
                }
                position.liquidity -= closedAmountInToken1;
                position.tokensOwed0 += closedAmount0;
            } else {
                cumulativeDelta = feeGrowthInside1LastX128 - position.feeGrowthInside1LastX128;
                uint128 closedAmount1 = uint128(
                    FullMath.mulDiv(cumulativeDelta, position.liquidityInit, Constants.Q128)
                );
                uint128 closedAmountInToken0 = uint128(FullMath.mulDiv(closedAmount1, price, Constants.Q96));
                if (closedAmountInToken0 > positionLiquidity) {
                    closedAmountInToken0 = positionLiquidity;
                    closedAmount1 = uint128(FullMath.mulDiv(positionLiquidity, Constants.Q96, price));
                }
                position.liquidity -= closedAmountInToken0;
                position.tokensOwed1 += closedAmount1;
            }

            position.feeGrowthInside0LastX128 = feeGrowthInside0LastX128;
            position.feeGrowthInside1LastX128 = feeGrowthInside1LastX128;
        }

        // compute the arguments to give to the pool#collect method
        (uint128 amount0Collect, uint128 amount1Collect) = (position.tokensOwed0, position.tokensOwed1);

        // the actual amounts collected are returned
        (amount0, amount1) = pool.collect(recipient, tick, tick, amount0Collect, amount1Collect);

        // sometimes there will be a few less wei than expected due to rounding down in core, but we just subtract the full amount expected
        // instead of the actual amount so we can burn the token
        (position.tokensOwed0, position.tokensOwed1) = (
            position.tokensOwed0 - amount0Collect,
            position.tokensOwed1 - amount1Collect
        );
    }

    // save bytecode by removing implementation of unused method
    function baseURI() public pure override returns (string memory) {}

    function burn(uint256 tokenId) external payable override isAuthorizedForToken(tokenId) {
        delete _limitPositions[tokenId];
        _burn(tokenId);
    }

    function _getAndIncrementNonce(uint256 tokenId) internal override returns (uint256) {
        return uint256(_limitPositions[tokenId].nonce++);
    }

    /// @inheritdoc IERC721
    function getApproved(uint256 tokenId) public view override(ERC721, IERC721) returns (address) {
        require(_exists(tokenId), 'ERC721: approved query for nonexistent token');

        return _limitPositions[tokenId].operator;
    }

    /// @dev Overrides _approve to use the operator in the limitPosition, which is packed with the limitPosition permit nonce
    function _approve(address to, uint256 tokenId) internal override(ERC721) {
        _limitPositions[tokenId].operator = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }
}
