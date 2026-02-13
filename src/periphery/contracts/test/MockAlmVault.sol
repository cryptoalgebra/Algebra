// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../interfaces/INonfungiblePositionManager.sol';

/// @title Mock ALM Vault for gas benchmarking of NFPM rebalance flows
/// @notice Reproduces the rebalance flow from AlgebraVault:
///   dismantle old positions (decreaseLiquidity → collect → burn) then mint new ones
contract MockAlmVault is IERC721Receiver {
    INonfungiblePositionManager public immutable nftManager;

    address public token0;
    address public token1;

    uint256 public basePositionId;
    uint256 public limitPositionId;

    /// @dev Accumulated fees from dismantled positions
    uint256 public accumulatedFees0;
    uint256 public accumulatedFees1;

    constructor(INonfungiblePositionManager _nftManager) {
        nftManager = _nftManager;
    }

    /// @notice Initialize vault with pool tokens and approve NFPM
    function initialize(address _token0, address _token1) external {
        token0 = _token0;
        token1 = _token1;
        IERC20(_token0).approve(address(nftManager), type(uint256).max);
        IERC20(_token1).approve(address(nftManager), type(uint256).max);
    }

    // ============ REBALANCE FLOW ============

    /// @notice Full rebalance: dismantle both positions, then mint new base + limit positions
    function rebalance(
        int24 baseLower,
        int24 baseUpper,
        int24 limitLower,
        int24 limitUpper
    ) external {
        // 1. Dismantle existing positions, collect fees
        (uint256 fees0, uint256 fees1) = _dismantlePosition(basePositionId);
        (uint256 _fees0, uint256 _fees1) = _dismantlePosition(limitPositionId);
        fees0 += _fees0;
        fees1 += _fees1;
        accumulatedFees0 += fees0;
        accumulatedFees1 += fees1;

        // 2. Mint new base position
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));

        basePositionId = _mintPosition(baseLower, baseUpper, balance0, balance1);

        // 3. Mint new limit position with remaining balances
        balance0 = IERC20(token0).balanceOf(address(this));
        balance1 = IERC20(token1).balanceOf(address(this));

        limitPositionId = _mintPosition(limitLower, limitUpper, balance0, balance1);
    }

    /// @notice Rebalance only the base position (single position rebalance)
    function rebalanceSingle(
        int24 newLower,
        int24 newUpper
    ) external {
        (uint256 fees0, uint256 fees1) = _dismantlePosition(basePositionId);
        accumulatedFees0 += fees0;
        accumulatedFees1 += fees1;

        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));

        basePositionId = _mintPosition(newLower, newUpper, balance0, balance1);
    }

    // ============ INTERNAL ============

    /// @dev Dismantle a position: decreaseLiquidity(all) → collect(max) → burn
    /// @return fee0 collected fees in token0 (collected - burnt)
    /// @return fee1 collected fees in token1 (collected - burnt)
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
    ) internal returns (uint256 positionId) {
        if (amount0Desired == 0 && amount1Desired == 0) return 0;

        (positionId, , , ) = nftManager.mint(
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
    }

    /// @dev ERC721 receiver to accept NFTs
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
