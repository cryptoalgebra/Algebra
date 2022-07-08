// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '../interfaces/IAlgebraFarming.sol';

/// @title Functions for liquidity attraction programs with liquidity multipliers
/// @notice Allows computing liquidity multiplier based on locked tokens amount
library LiquidityTier {
    uint32 constant DENOMINATOR = 10000;
    uint32 constant MAX_MULTIPLIER = 50000;

    /// @notice Get the multiplier by tokens locked amount
    /// @param tokenAmount The amount of locked tokens
    /// @param tiers The structure showing the dependence of the multiplier on the amount of locked tokens
    /// @return multiplier The value represent percent of liquidity in ten thousands(1 = 0.01%)
    function getLiquidityMultiplier(uint256 tokenAmount, IAlgebraFarming.Tiers memory tiers)
        internal
        pure
        returns (uint32 multiplier)
    {
        if (tokenAmount >= tiers.tokenAmountForTier3) {
            return tiers.tier3Multiplier;
        } else if (tokenAmount >= tiers.tokenAmountForTier2) {
            return tiers.tier2Multiplier;
        } else if (tokenAmount >= tiers.tokenAmountForTier1) {
            return tiers.tier1Multiplier;
        } else {
            return DENOMINATOR;
        }
    }
}
