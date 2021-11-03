// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/AdaptiveFee.sol';

contract AdaptiveFeeTest {
    AdaptiveFee.Configuration public feeConfig =
        AdaptiveFee.Configuration(
            3000 - 500, // alpha1
            10000 - 3000, // alpha2
            150, // beta1
            1500, // beta2
            30, // gamma1
            100, // gamma2
            30, // volumeBeta
            10 // volumeGamma
        );

    function getFee(uint112 volatility, uint256 volumePerLiquidity) external view returns (uint256 fee) {
        return AdaptiveFee.getFee(volatility, volumePerLiquidity, feeConfig);
    }

    function getGasCostOfGetFee(uint112 volatility, uint256 volumePerLiquidity) external view returns (uint256) {
        uint256 gasBefore = gasleft();
        AdaptiveFee.getFee(volatility, volumePerLiquidity, feeConfig);
        return gasBefore - gasleft();
    }
}
