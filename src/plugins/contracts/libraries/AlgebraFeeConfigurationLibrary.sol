// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '../base/AlgebraFeeConfiguration.sol';

type AlgebraFeeConfigurationPacked is uint144;

using AlgebraFeeConfigurationLibrary for AlgebraFeeConfigurationPacked global;

/// @title AdaptiveFee packed configuration library
/// @notice Used to interact with uint144-packed fee config
/// @dev Structs are not packed in storage with neighboring values, but uint144 can be packed
library AlgebraFeeConfigurationLibrary {
  uint256 constant UINT16_MASK = 0xFFFF;
  uint256 constant UINT32_MASK = 0xFFFFFFFF;

  // alpha1 offset is 0
  uint144 constant ALPHA2_OFFSET = 16;
  uint144 constant BETA1_OFFSET = 32;
  uint144 constant BETA2_OFFSET = 64;
  uint144 constant GAMMA1_OFFSET = 96;
  uint144 constant GAMMA2_OFFSET = 112;
  uint144 constant BASE_FEE_OFFSET = 128;

  function pack(AlgebraFeeConfiguration memory config) internal pure returns (AlgebraFeeConfigurationPacked) {
    uint144 _config = (uint144(config.baseFee) << BASE_FEE_OFFSET) |
      (uint144(config.gamma2) << GAMMA2_OFFSET) |
      (uint144(config.gamma1) << GAMMA1_OFFSET) |
      (uint144(config.beta2) << BETA2_OFFSET) |
      (uint144(config.beta1) << BETA1_OFFSET) |
      (uint144(config.alpha2) << ALPHA2_OFFSET) |
      uint144(config.alpha1);

    return AlgebraFeeConfigurationPacked.wrap(_config);
  }

  function alpha1(AlgebraFeeConfigurationPacked config) internal pure returns (uint16 _alpha1) {
    assembly {
      _alpha1 := and(UINT16_MASK, config)
    }
  }

  function alpha2(AlgebraFeeConfigurationPacked config) internal pure returns (uint16 _alpha2) {
    assembly {
      _alpha2 := and(UINT16_MASK, shr(16, config))
    }
  }

  function beta1(AlgebraFeeConfigurationPacked config) internal pure returns (uint32 _beta1) {
    assembly {
      _beta1 := and(UINT32_MASK, shr(BETA1_OFFSET, config))
    }
  }

  function beta2(AlgebraFeeConfigurationPacked config) internal pure returns (uint32 _beta2) {
    assembly {
      _beta2 := and(UINT32_MASK, shr(BETA2_OFFSET, config))
    }
  }

  function gamma1(AlgebraFeeConfigurationPacked config) internal pure returns (uint16 _gamma1) {
    assembly {
      _gamma1 := and(UINT16_MASK, shr(GAMMA1_OFFSET, config))
    }
  }

  function gamma2(AlgebraFeeConfigurationPacked config) internal pure returns (uint16 _gamma2) {
    assembly {
      _gamma2 := and(UINT16_MASK, shr(GAMMA2_OFFSET, config))
    }
  }

  function baseFee(AlgebraFeeConfigurationPacked config) internal pure returns (uint16 _baseFee) {
    assembly {
      _baseFee := and(UINT16_MASK, shr(BASE_FEE_OFFSET, config))
    }
  }
}
