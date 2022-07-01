// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '../farmings/incentiveFarming/interfaces/IAlgebraIncentiveFarming.sol';

library LiquidityTier {
    uint128 constant DENOMINATOR = 10000;

    /// @notice Get the multiplier by tokens locked amount
    /// @param tokenAmount The amount of locked tokens
    /// @param tiers The structure showing the dependence of the multiplier on the amount of locked tokens
    /// @return multiplier The value represent persent of liquidity in ten thoushands(1 = 0.01%)
    function getLiquidityMultiplier(uint256 tokenAmount, IAlgebraIncentiveFarming.Tiers memory tiers)
        internal
        pure
        returns (uint32 multiplier)
    {
        if (tokenAmount >= tiers.tokenAmountForTier3) {
            multiplier = tiers.tier3multiplier;
        } else if (tokenAmount >= tiers.tokenAmountForTier2) {
            multiplier = tiers.tier2multiplier;
        } else if (tokenAmount >= tiers.tokenAmountForTier1) {
            multiplier = tiers.tier1multiplier;
        }
    }
}
