// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '../base/AlgebraFeeConfiguration.sol';

type AlgebraFeeConfigurationPacked is uint144;

using AlgebraFeeConfigurationLibrary for AlgebraFeeConfigurationPacked global;

library AlgebraFeeConfigurationLibrary {
  function pack(AlgebraFeeConfiguration memory config) internal pure returns (AlgebraFeeConfigurationPacked) {
    uint144 _config = uint144(config.baseFee) << 128;
    _config |= uint144(config.gamma2) << 112;
    _config |= uint144(config.gamma1) << 96;
    _config |= uint144(config.beta2) << 64;
    _config |= uint144(config.beta1) << 32;
    _config |= uint144(config.alpha2) << 16;
    _config |= uint144(config.alpha1);

    return AlgebraFeeConfigurationPacked.wrap(_config);
  }

  function alpha1(AlgebraFeeConfigurationPacked config) internal pure returns (uint16 _alpha1) {
    /// @solidity memory-safe-assembly
    assembly {
      _alpha1 := and(0xFFFF, config)
    }
  }

  function alpha2(AlgebraFeeConfigurationPacked config) internal pure returns (uint16 _alpha2) {
    /// @solidity memory-safe-assembly
    assembly {
      _alpha2 := and(0xFFFF, shr(16, config))
    }
  }

  function beta1(AlgebraFeeConfigurationPacked config) internal pure returns (uint32 _beta1) {
    /// @solidity memory-safe-assembly
    assembly {
      _beta1 := and(0xFFFFFFFF, shr(32, config))
    }
  }

  function beta2(AlgebraFeeConfigurationPacked config) internal pure returns (uint32 _beta2) {
    /// @solidity memory-safe-assembly
    assembly {
      _beta2 := and(0xFFFFFFFF, shr(64, config))
    }
  }

  function gamma1(AlgebraFeeConfigurationPacked config) internal pure returns (uint16 _gamma1) {
    /// @solidity memory-safe-assembly
    assembly {
      _gamma1 := and(0xFFFF, shr(96, config))
    }
  }

  function gamma2(AlgebraFeeConfigurationPacked config) internal pure returns (uint16 _gamma2) {
    /// @solidity memory-safe-assembly
    assembly {
      _gamma2 := and(0xFFFF, shr(112, config))
    }
  }

  function baseFee(AlgebraFeeConfigurationPacked config) internal pure returns (uint16 _baseFee) {
    /// @solidity memory-safe-assembly
    assembly {
      _baseFee := and(0xFFFF, shr(128, config))
    }
  }
}
