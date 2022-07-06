// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/AdaptiveFee.sol';
import '../libraries/Constants.sol';

contract AdaptiveFeeTest {
  AdaptiveFee.Configuration public feeConfig =
    AdaptiveFee.Configuration(
      3000 - Constants.BASE_FEE, // alpha1
      15000 - 3000, // alpha2
      360, // beta1
      60000, // beta2
      59, // gamma1
      8500, // gamma2
      0, // volumeBeta
      10, // volumeGamma
      Constants.BASE_FEE // baseFee
    );

  function getFee(uint88 volatility, uint256 volumePerLiquidity) external view returns (uint256 fee) {
    return AdaptiveFee.getFee(volatility, volumePerLiquidity, feeConfig);
  }

  function getGasCostOfGetFee(uint88 volatility, uint256 volumePerLiquidity) external view returns (uint256) {
    uint256 gasBefore = gasleft();
    AdaptiveFee.getFee(volatility, volumePerLiquidity, feeConfig);
    return gasBefore - gasleft();
  }
}
