// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../interfaces/INonfungiblePositionManager.sol';

/// @title Mock ALM Vault
/// @notice Reproduces the rebalance flow from AlgebraVault
contract MockAlmVault is IERC721Receiver {
    INonfungiblePositionManager public immutable nftManager;

    address immutable public token0;
    address immutable public token1;

    uint32 public basePositionId;
    uint32 public limitPositionId;

    constructor(INonfungiblePositionManager _nftManager, address _token0, address _token1) {
        nftManager = _nftManager;
        token0 = _token0;
        token1 = _token1;
        IERC20(_token0).approve(address(_nftManager), type(uint256).max);
        IERC20(_token1).approve(address(_nftManager), type(uint256).max);
    }

    /// @notice Full rebalance: dismantle both positions, then mint new base + limit positions
    function rebalance(
        int24 baseLower,
        int24 baseUpper,
        int24 limitLower,
        int24 limitUpper
    ) external {
        (uint32 _basePositionId, uint32 _limitPositionId) = (basePositionId, limitPositionId);
        // 1. Dismantle existing positions, collect fees
        (uint256 fees0, uint256 fees1) = _dismantlePosition(_basePositionId);
        (uint256 _fees0, uint256 _fees1) = _dismantlePosition(_limitPositionId);
        fees0 += _fees0;
        fees1 += _fees1;

        // 2. Mint new base position
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));

        _basePositionId = _mintPosition(baseLower, baseUpper, balance0, balance1);

        // 3. Mint new limit position with remaining balances
        balance0 = IERC20(token0).balanceOf(address(this));
        balance1 = IERC20(token1).balanceOf(address(this));

        _limitPositionId = _mintPosition(limitLower, limitUpper, balance0, balance1);
        (basePositionId, limitPositionId) = (_basePositionId, _limitPositionId);
    }

    /// @notice Rebalance only the base position (single position rebalance)
    function rebalanceSingle(
        int24 newLower,
        int24 newUpper
    ) external {
        (uint256 fees0, uint256 fees1) = _dismantlePosition(basePositionId);

        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));

        basePositionId = _mintPosition(newLower, newUpper, balance0, balance1);
    }

    /// @notice Optimized single position rebalance via NFPM.rebalance
    function rebalanceSingleOptimized(
        int24 newLower,
        int24 newUpper
    ) external {
        (, , , uint256 fees0, uint256 fees1) = nftManager.rebalance(
            INonfungiblePositionManager.RebalanceParams({
                tokenId: basePositionId,
                newTickLower: newLower,
                newTickUpper: newUpper,
                amount0Desired: type(uint256).max,
                amount1Desired: type(uint256).max,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );
    }

    /// @notice Optimized full rebalance via NFPM.rebalanceMultiple
    function rebalanceOptimized(
        int24 baseLower,
        int24 baseUpper,
        int24 limitLower,
        int24 limitUpper
    ) external {
        (uint32 _basePositionId, uint32 _limitPositionId) = (basePositionId, limitPositionId);
        bool hasLimit = _limitPositionId != 0;

        INonfungiblePositionManager.RebalanceParams[] memory params =
            new INonfungiblePositionManager.RebalanceParams[](hasLimit ? 2 : 1);

        params[0] = INonfungiblePositionManager.RebalanceParams({
            tokenId: _basePositionId,
            newTickLower: baseLower,
            newTickUpper: baseUpper,
            amount0Desired: type(uint256).max,
            amount1Desired: type(uint256).max,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 0
        });

        if (hasLimit) {
            params[1] = INonfungiblePositionManager.RebalanceParams({
                tokenId: _limitPositionId,
                newTickLower: limitLower,
                newTickUpper: limitUpper,
                amount0Desired: type(uint256).max,
                amount1Desired: type(uint256).max,
                amount0Min: 0,
                amount1Min: 0,
                deadline: 0
            });
        }

        (uint256 fees0, uint256 fees1) = nftManager.rebalanceMultiple(params, block.timestamp);
    }

    /// @dev Dismantle a position
    /// @return fee0 collected fees in token0
    /// @return fee1 collected fees in token1
    function _dismantlePosition(uint256 positionId) internal returns (uint256 fee0, uint256 fee1) {
        if (positionId == 0) return (0, 0);

        (, , , , , , , uint128 positionLiquidity, , , , ) = nftManager.positions(positionId);

        uint256 burntAmount0;
        uint256 burntAmount1;

        if (positionLiquidity > 0) {
            (burntAmount0, burntAmount1) = nftManager.decreaseLiquidity(
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: positionId,
                    liquidity: positionLiquidity,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                })
            );
        }

        (uint256 collectedAmount0, uint256 collectedAmount1) = nftManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: positionId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        nftManager.burn(positionId);

        fee0 = collectedAmount0 - burntAmount0;
        fee1 = collectedAmount1 - burntAmount1;
    }

    /// @dev Mint a new position via NFPM
    function _mintPosition(
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) internal returns (uint32) {
        if (amount0Desired == 0 && amount1Desired == 0) return 0;

        (uint256 positionId, , , ) = nftManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                deployer: address(0),
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );

        return uint32(positionId);
    }

    /// @dev ERC721 receiver to accept NFTs
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
