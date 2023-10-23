// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../base/AlgebraFeeConfiguration.sol';
import '../libraries/AdaptiveFee.sol';

import '@cryptoalgebra/integral-core/contracts/libraries/Constants.sol';

contract AdaptiveFeeTest {
  using AlgebraFeeConfigurationU144Lib for AlgebraFeeConfiguration;

  AlgebraFeeConfiguration public feeConfig;

  constructor() {
    feeConfig = AdaptiveFee.initialFeeConfiguration();
  }

  function getFee(uint88 volatility) external view returns (uint256 fee) {
    return AdaptiveFee.getFee(volatility, feeConfig.pack());
  }

  function getGasCostOfGetFee(uint88 volatility) external view returns (uint256) {
    AlgebraFeeConfigurationU144 _packed = feeConfig.pack();
    unchecked {
      uint256 gasBefore = gasleft();
      AdaptiveFee.getFee(volatility, _packed);
      return gasBefore - gasleft();
    }
  }

  function packAndUnpackFeeConfig(AlgebraFeeConfiguration calldata config) external pure returns (AlgebraFeeConfiguration memory unpacked) {
    AlgebraFeeConfigurationU144 _packed = AlgebraFeeConfigurationU144Lib.pack(config);
    unpacked.alpha1 = _packed.alpha1();
    unpacked.alpha2 = _packed.alpha2();
    unpacked.beta1 = _packed.beta1();
    unpacked.beta2 = _packed.beta2();
    unpacked.gamma1 = _packed.gamma1();
    unpacked.gamma2 = _packed.gamma2();
    unpacked.baseFee = _packed.baseFee();
  }
}
