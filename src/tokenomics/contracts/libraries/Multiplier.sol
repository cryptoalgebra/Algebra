pragma solidity = 0.7.6;

import "../incentiveFarming/interfaces/IAlgebraIncentiveFarming.sol";

library Multiplier{

    function getMultiplier(uint256 tokenAmount, IAlgebraIncentiveFarming.Levels memory levels) internal pure returns(uint32 multiplier){

        if (tokenAmount >= levels.tokenAmountForLevel3) {
            multiplier = levels.level3multiplier;
        }
        else if (tokenAmount >= levels.tokenAmountForLevel2) {
                 multiplier = levels.level2multiplier;
             }
             else if (tokenAmount >= levels.tokenAmountForLevel1) {
                      multiplier = levels.level1multiplier;
                  }
    }

}