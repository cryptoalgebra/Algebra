// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;

import '../interfaces/IAlgebraFeeConfiguration.sol';
import '../libraries/AdaptiveFee.sol';
import '../libraries/Constants.sol';

contract AdaptiveFeeTest {
  IAlgebraFeeConfiguration.Configuration public feeConfig =
    IAlgebraFeeConfiguration.Configuration(
      3000 - Constants.BASE_FEE, // alpha1
      15000 - 3000, // alpha2
      360, // beta1
      60000, // beta2
      59, // gamma1
      8500, // gamma2
      Constants.BASE_FEE // baseFee
    );

  function getFee(uint88 volatility) external view returns (uint256 fee) {
    return AdaptiveFee.getFee(volatility, feeConfig);
  }

  function getGasCostOfGetFee(uint88 volatility) external view returns (uint256) {
    uint256 gasBefore = gasleft();
    AdaptiveFee.getFee(volatility, feeConfig);
    return gasBefore - gasleft();
  }
}
