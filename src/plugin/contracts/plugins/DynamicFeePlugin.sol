// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';

import '../interfaces/IBasePluginV1Factory.sol';
import '../interfaces/plugins/IDynamicFeeManager.sol';

import '../libraries/AdaptiveFee.sol';
import '../types/AlgebraFeeConfigurationU144.sol';
import '../base/BasePlugin.sol';

/// @title Algebra Integral 1.1 default plugin
/// @notice This contract stores timepoints and calculates adaptive fee and statistical averages
abstract contract DynamicFeePlugin is BasePlugin, IDynamicFeeManager {
  using Plugins for uint8;
  using AlgebraFeeConfigurationU144Lib for AlgebraFeeConfiguration;

  bytes32 internal constant ADAPTIVE_FEE_NAMESPACE = keccak256('namespace.adaptive.fee');

  uint8 private constant defaultPluginConfig = uint8(Plugins.BEFORE_SWAP_FLAG | Plugins.DYNAMIC_FEE);
  struct AdaptiveFeeLayout {
    AlgebraFeeConfigurationU144 feeConfig;
  }

  /// @dev Fetch pointer of Adaptive fee plugin's storage
  function getAdaptiveFeePointer() internal pure returns (AdaptiveFeeLayout storage afl) {
    bytes32 position = ADAPTIVE_FEE_NAMESPACE;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      afl.slot := position
    }
  }

  /// @inheritdoc IDynamicFeeManager
  function feeConfig()
    external
    view
    override
    returns (uint16 alpha1, uint16 alpha2, uint32 beta1, uint32 beta2, uint16 gamma1, uint16 gamma2, uint16 baseFee)
  {
    AdaptiveFeeLayout memory afl = getAdaptiveFeePointer();
    AlgebraFeeConfigurationU144 _feeConfig = afl.feeConfig;
    (alpha1, alpha2) = (_feeConfig.alpha1(), _feeConfig.alpha2());
    (beta1, beta2) = (_feeConfig.beta1(), _feeConfig.beta2());
    (gamma1, gamma2) = (_feeConfig.gamma1(), _feeConfig.gamma2());
    baseFee = _feeConfig.baseFee();
  }

  // ###### Fee manager ######

  /// @inheritdoc IDynamicFeeManager
  function changeFeeConfiguration(AlgebraFeeConfiguration calldata _config) external override {
    require(msg.sender == pluginFactory || IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));
    AdaptiveFee.validateFeeConfiguration(_config);
    AdaptiveFeeLayout storage afl = getAdaptiveFeePointer();

    afl.feeConfig = _config.pack(); // pack struct to uint144 and write in storage
    emit FeeConfiguration(_config);
  }

  function _getCurrentFee(uint88 volatilityAverage) internal view returns (uint16 fee) {
    AdaptiveFeeLayout memory afl = getAdaptiveFeePointer();
    AlgebraFeeConfigurationU144 feeConfig_ = afl.feeConfig;
    if (feeConfig_.alpha1() | feeConfig_.alpha2() == 0) return feeConfig_.baseFee();

    return AdaptiveFee.getFee(volatilityAverage, feeConfig_);
  }

  function _updateFee(uint88 volatilityAverage) internal {
    uint16 newFee;
    AdaptiveFeeLayout memory afl = getAdaptiveFeePointer();
    AlgebraFeeConfigurationU144 feeConfig_ = afl.feeConfig;

    (, , uint16 fee, ) = _getPoolState();
    if (feeConfig_.alpha1() | feeConfig_.alpha2() == 0) {
      newFee = feeConfig_.baseFee();
    } else {
      newFee = AdaptiveFee.getFee(volatilityAverage, feeConfig_);
    }

    if (newFee != fee) {
      IAlgebraPool(pool).setFee(newFee);
    }
  }

  function getBaseFee() public view returns (uint16 baseFee) {
    AdaptiveFeeLayout memory afl = getAdaptiveFeePointer();
    AlgebraFeeConfigurationU144 feeConfig_ = afl.feeConfig;

    return feeConfig_.baseFee();
  }
}
