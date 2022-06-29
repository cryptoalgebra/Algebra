// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '../farmings/incentiveFarming/interfaces/IAlgebraIncentiveFarming.sol';

library Multiplier {
    uint128 constant DENOMINATOR = 10000;

    /// @notice Get the multiplier by tokens locked amount
    /// @param tokenAmount The amount of locked tokens
    /// @param levels The structure showing the dependence of the multiplier on the amount of locked tokens
    /// @return multiplier The value represent persent of liquidity in ten thoushands(1 = 0.01%)
    function getMultiplier(uint256 tokenAmount, IAlgebraIncentiveFarming.Levels memory levels)
        internal
        pure
        returns (uint32 multiplier)
    {
        if (tokenAmount >= levels.tokenAmountForLevel3) {
            multiplier = levels.level3multiplier;
        } else if (tokenAmount >= levels.tokenAmountForLevel2) {
            multiplier = levels.level2multiplier;
        } else if (tokenAmount >= levels.tokenAmountForLevel1) {
            multiplier = levels.level1multiplier;
        }
    }
}
