// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../../interfaces/IAlgebraFarming.sol';

/// @title Algebra Farming Interface
/// @notice Allows farming nonfungible liquidity tokens in exchange for reward tokens
interface IAlgebraIncentiveFarming is IAlgebraFarming {
    /// @notice Returns information about a farmd liquidity NFT
    /// @param tokenId The ID of the farmd token
    /// @param incentiveId The ID of the incentive for which the token is farmd
    /// @return liquidity The amount of liquidity in the NFT as of the last time the rewards were computed
    function farms(uint256 tokenId, bytes32 incentiveId)
        external
        view
        returns (
            uint128 liquidity,
            int24 tickLower,
            int24 tickUpper
        );

    /// @notice Creates a new liquidity mining incentive program
    /// @param key Details of the incentive to create
    /// @param reward The amount of reward tokens to be distributed
    /// @param bonusReward The amount of bonus reward tokens to be distributed
    /// @return virtualPool The virtual pool
    function createIncentive(
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward
    ) external returns (address virtualPool);
}
