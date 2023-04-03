// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;
pragma abicoder v1;

import '../base/AlgebraFeeConfiguration.sol';
import '../libraries/AdaptiveFee.sol';
import '../libraries/Constants.sol';

contract AdaptiveFeeTest {
  AlgebraFeeConfiguration public feeConfig;

  constructor() {
    feeConfig = AdaptiveFee.initialFeeConfiguration();
  }

  function getFee(uint88 volatility) external view returns (uint256 fee) {
    return AdaptiveFee.getFee(volatility, feeConfig);
  }

  function getGasCostOfGetFee(uint88 volatility) external view returns (uint256) {
    unchecked {
      uint256 gasBefore = gasleft();
      AdaptiveFee.getFee(volatility, feeConfig);
      return gasBefore - gasleft();
    }
  }
}
