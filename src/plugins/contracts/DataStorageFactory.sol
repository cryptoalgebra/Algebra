// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './base/AlgebraFeeConfiguration.sol';
import './libraries/AdaptiveFee.sol';

import './DataStorageOperator.sol';

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPluginFactory.sol';

/// TODO
contract DataStorageFactory is IAlgebraPluginFactory {
  /// @notice Emitted when the default fee configuration is changed
  /// @param newConfig The structure with dynamic fee parameters
  /// @dev See the AdaptiveFee library for more details
  event DefaultFeeConfiguration(AlgebraFeeConfiguration newConfig);

  address public immutable algebraFactory;

  /// @dev values of constants for sigmoids in fee calculation formula
  AlgebraFeeConfiguration public defaultFeeConfiguration;

  constructor(address _algebraFactory) {
    algebraFactory = _algebraFactory;
    defaultFeeConfiguration = AdaptiveFee.initialFeeConfiguration();
  }

  /// @inheritdoc IAlgebraPluginFactory
  function createPlugin(address pool) external override returns (address) {
    require(msg.sender == algebraFactory);

    IDataStorageOperator dataStorage = new DataStorageOperator(pool, algebraFactory);
    dataStorage.changeFeeConfiguration(defaultFeeConfiguration);

    return address(dataStorage);
  }

  /// @notice Changes initial fee configuration for new pools
  /// @dev changes coefficients for sigmoids: α / (1 + e^( (β-x) / γ))
  /// alpha1 + alpha2 + baseFee (max possible fee) must be <= type(uint16).max and gammas must be > 0
  /// @param newConfig new default fee configuration. See the #AdaptiveFee.sol library for details
  function setDefaultFeeConfiguration(AlgebraFeeConfiguration calldata newConfig) external {
    require(msg.sender == IAlgebraFactory(algebraFactory).owner(), 'onlyOwner');

    AdaptiveFee.validateFeeConfiguration(newConfig);
    defaultFeeConfiguration = newConfig;
    emit DefaultFeeConfiguration(newConfig);
  }
}
