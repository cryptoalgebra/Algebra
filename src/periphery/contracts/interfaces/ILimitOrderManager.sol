// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.5;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol';

import './IERC721Permit.sol';
import './IPeripheryPayments.sol';
import './IPeripheryImmutableState.sol';
import '../libraries/PoolAddress.sol';

interface ILimitOrderManager is
    IPeripheryPayments,
    IPeripheryImmutableState,
    IERC721Metadata,
    IERC721Enumerable,
    IERC721Permit
{
    function limitPositions(uint256 tokenId)
        external
        view
        returns (
            LimitPosition memory position,
            address token0,
            address token1
        );

    struct LimitPosition {
        uint96 nonce;
        address operator;
        uint80 poolId;
        uint128 liquidity;
        uint128 liquidityInit;
        int24 tick;
        bool depositedToken;
        uint128 depositedAmount;
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    struct addLimitOrderParams {
        address token0;
        address token1;
        bool depositedToken;
        uint128 amount;
        int24 tick;
    }

    function decreaseLimitOrder(uint256 tokenId, uint128 liquidity) external payable;

    function collectLimitOrder(uint256 tokenId, address recipient)
        external
        payable
        returns (uint256 amount0, uint256 amount1);

    function addLimitOrder(addLimitOrderParams calldata params) external payable returns (uint256 tokenId);

    /// @notice Burns a token ID, which deletes it from the NFT contract. The token must have 0 liquidity and all tokens
    /// must be collected first.
    /// @param tokenId The ID of the token that is being burned
    function burn(uint256 tokenId) external payable;
}
