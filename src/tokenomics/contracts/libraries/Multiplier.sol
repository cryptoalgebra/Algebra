pragma solidity = 0.7.6;

import "../incentiveFarming/interfaces/IAlgebraIncentiveFarming.sol";

library Multiplier{

    function getMultiplier(uint256 algbAmount, IAlgebraIncentiveFarming.Levels memory levels) internal pure returns(uint32 multiplier){

        if (algbAmount >= levels.algbAmountForLevel3) {
            multiplier = levels.level3multiplier;
        }
        else if (algbAmount >= levels.algbAmountForLevel2) {
                 multiplier = levels.level2multiplier;
             }
             else if (algbAmount >= levels.algbAmountForLevel1) {
                      multiplier = levels.level1multiplier;
                  }
    }

}