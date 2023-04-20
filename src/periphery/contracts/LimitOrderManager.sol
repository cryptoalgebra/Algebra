// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;
pragma abicoder v2;

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/core/contracts/libraries/TickMath.sol';
import '@cryptoalgebra/core/contracts/libraries/FullMath.sol';
import '@cryptoalgebra/core/contracts/libraries/Constants.sol';

import './interfaces/ILimitOrderManager.sol';
import './libraries/PositionKey.sol';
import './libraries/PoolAddress.sol';
import './base/LimitOrderManagement.sol';
import './base/PeripheryImmutableState.sol';
import './base/Multicall.sol';
import './base/ERC721Permit.sol';
import './base/PeripheryValidation.sol';
import './base/SelfPermit.sol';

/// @title NFT limitPositions
/// @notice Wraps Algebra  limitPositions in the ERC721 non-fungible token interface
contract LimitOrderManager is
    ILimitOrderManager,
    Multicall,
    ERC721Permit,
    PeripheryImmutableState,
    LimitOrderManagement,
    PeripheryValidation,
    SelfPermit
{
    struct UpdatePositionCache {
        uint256 cumulativeDelta;
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
        ERC721Permit('Algebra Limit Orders NFT-V1', 'ALGB-LIMIT', '1')
        PeripheryImmutableState(_factory, _WNativeToken, _poolDeployer)
    {}

    function limitPositions(
        uint256 tokenId
    ) external view override returns (LimitPosition memory limitPosition, address token0, address token1) {
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
        PoolAddress.PoolKey memory poolKey = PoolAddress.PoolKey({token0: params.token0, token1: params.token1});
        IAlgebraPool pool = IAlgebraPool(PoolAddress.computeAddress(poolDeployer, poolKey));
        bool depositedToken;

        bytes32 positionKey = PositionKey.compute(address(this), params.tick, params.tick);
        uint128 liquidityPrev;
        uint128 liquidityInitPrev;

        unchecked {
            (uint256 _liquidity, , , , ) = pool.positions(positionKey);
            liquidityPrev = uint128(_liquidity >> 128);
            liquidityInitPrev = uint128(_liquidity);
        }

        (pool, depositedToken) = _createLimitOrder(params.token0, params.token1, params.tick, params.amount);
        _mint(msg.sender, (tokenId = _nextId++));

        // idempotent set
        uint80 poolId = cachePoolKey(address(pool), poolKey);

        (uint256 _liquidityAfter, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, , ) = pool
            .positions(positionKey);

        uint128 liquidity;
        uint128 liquidityInit;
        unchecked {
            liquidity = uint128(_liquidityAfter >> 128);
            liquidityInit = uint128(_liquidityAfter);
        }

        require(depositedToken == params.depositedToken, 'depositedToken changed');
        if (liquidity != liquidityInit && liquidityPrev != 0) {
            liquidityInit -= liquidityInitPrev;
        } else {
            liquidityInit = params.amount;
        }
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

    function decreaseLimitOrder(
        uint256 tokenId,
        uint128 liquidity
    ) external payable override isAuthorizedForToken(tokenId) {
        LimitPosition storage position = _limitPositions[tokenId];
        UpdatePositionCache memory cache;

        uint128 positionLiquidity = position.liquidity;
        int24 tick = position.tick;

        PoolAddress.PoolKey memory poolKey = _poolIdToPoolKey[position.poolId];
        IAlgebraPool pool = IAlgebraPool(PoolAddress.computeAddress(poolDeployer, poolKey));
        // update position state
        bytes32 positionKey = PositionKey.compute(address(this), tick, tick);
        uint128 liquidityInitialPrev;
        uint128 liquidityInitial;
        uint256 _liquidity;
        (_liquidity, cache.feeGrowthInside0LastX128, cache.feeGrowthInside1LastX128, , ) = pool.positions(positionKey);

        unchecked {
            cache.liquidityLast = uint128(_liquidity >> 128);
            liquidityInitialPrev = uint128(_liquidity);
        }

        if (cache.liquidityLast > 0) {
            pool.burn(tick, tick, liquidity);
            // this is now updated to the current transaction
            (_liquidity, cache.feeGrowthInside0LastX128, cache.feeGrowthInside1LastX128, , ) = pool.positions(
                positionKey
            );
            unchecked {
                liquidityInitial = uint128(_liquidity);
            }
        }
        // update lomanager position state
        if (position.depositedToken) {
            cache.cumulativeDelta = cache.feeGrowthInside0LastX128 - position.feeGrowthInside0LastX128;
        } else {
            cache.cumulativeDelta = cache.feeGrowthInside1LastX128 - position.feeGrowthInside1LastX128;
        }

        if (cache.cumulativeDelta > 0) {
            uint256 closedAmount = FullMath.mulDiv(cache.cumulativeDelta, position.liquidityInit, Constants.Q128);
            uint256 nominator;
            uint256 denominator;
            // scope to prevent stack too deep error
            {
                uint256 sqrtPrice = TickMath.getSqrtRatioAtTick(tick);
                uint256 priceX144 = FullMath.mulDiv(sqrtPrice, sqrtPrice, Constants.Q48);
                (nominator, denominator) = position.depositedToken
                    ? (Constants.Q144, priceX144)
                    : (priceX144, Constants.Q144);
            }
            uint256 fullAmount = FullMath.mulDiv(positionLiquidity, nominator, denominator);
            if (closedAmount >= fullAmount) {
                closedAmount = fullAmount;
                positionLiquidity = 0;
            } else {
                positionLiquidity = uint128(FullMath.mulDiv(fullAmount - closedAmount, denominator, nominator));
            }
            if (position.depositedToken) {
                position.feeGrowthInside0LastX128 = cache.feeGrowthInside0LastX128;
                if (closedAmount > 0) position.tokensOwed0 += uint128(closedAmount);
            } else {
                position.feeGrowthInside1LastX128 = cache.feeGrowthInside1LastX128;
                if (closedAmount > 0) position.tokensOwed1 += uint128(closedAmount);
            }
        }

        if (liquidity > 0) {
            require(positionLiquidity >= liquidity);
            positionLiquidity -= liquidity;
            if (position.depositedToken) {
                position.tokensOwed1 += liquidity;
            } else {
                position.tokensOwed0 += liquidity;
            }
        }
        position.liquidity = positionLiquidity;

        if (positionLiquidity == 0) {
            position.liquidityInit = 0;
        } else {
            position.liquidityInit -= liquidityInitialPrev - liquidityInitial;
        }
    }

    function collectLimitOrder(
        uint256 tokenId,
        address recipient
    ) external payable override isAuthorizedForToken(tokenId) returns (uint256 amount0, uint256 amount1) {
        // allow collecting to the nft position manager address with address 0
        recipient = recipient == address(0) ? address(this) : recipient;

        LimitPosition storage position = _limitPositions[tokenId];
        int24 tick = position.tick;

        PoolAddress.PoolKey memory poolKey = _poolIdToPoolKey[position.poolId];

        IAlgebraPool pool = IAlgebraPool(PoolAddress.computeAddress(poolDeployer, poolKey));

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
    function baseURI() public pure returns (string memory) {}

    function burn(uint256 tokenId) external payable override isAuthorizedForToken(tokenId) {
        LimitPosition storage position = _limitPositions[tokenId];
        require(position.liquidity == 0 && position.tokensOwed0 == 0 && position.tokensOwed1 == 0, 'Not cleared');
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
