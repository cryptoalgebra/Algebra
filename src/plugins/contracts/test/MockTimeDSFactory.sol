// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '../base/AlgebraFeeConfiguration.sol';
import '../libraries/AdaptiveFee.sol';

import './MockTimeDataStorageOperator.sol';

import '../interfaces/IDataStorageFactory.sol';

import '@cryptoalgebra/core/contracts/interfaces/plugin/IAlgebraPluginFactory.sol';

contract MockTimeDSFactory is IDataStorageFactory {
  address public immutable algebraFactory;

  /// @dev values of constants for sigmoids in fee calculation formula
  AlgebraFeeConfiguration public defaultFeeConfiguration;

  /// @inheritdoc IDataStorageFactory
  mapping(address => address) public pluginByPool;

  /// @inheritdoc IDataStorageFactory
  address public farmingAddress;

  constructor(address _algebraFactory) {
    algebraFactory = _algebraFactory;
    defaultFeeConfiguration = AdaptiveFee.initialFeeConfiguration();
  }

  /// @inheritdoc IAlgebraPluginFactory
  function createPlugin(address pool) external override returns (address) {
    return _createPlugin(pool);
  }

  function createPluginForExistingPool(address token0, address token1) external override returns (address) {
    IAlgebraFactory factory = IAlgebraFactory(algebraFactory);
    require(factory.hasRoleOrOwner(factory.POOLS_ADMINISTRATOR_ROLE(), msg.sender));

    address pool = factory.poolByPair(token0, token1);
    require(pool != address(0), 'pool not exist');

    return _createPlugin(pool);
  }

  function _createPlugin(address pool) internal returns (address) {
    MockTimeDataStorageOperator dataStorage = new MockTimeDataStorageOperator(pool, algebraFactory, address(this));
    dataStorage.changeFeeConfiguration(defaultFeeConfiguration);
    pluginByPool[pool] = address(dataStorage);
    return address(dataStorage);
  }

  /// @inheritdoc IDataStorageFactory
  function setDefaultFeeConfiguration(AlgebraFeeConfiguration calldata newConfig) external override {
    AdaptiveFee.validateFeeConfiguration(newConfig);
    defaultFeeConfiguration = newConfig;
    emit DefaultFeeConfiguration(newConfig);
  }

  /// @inheritdoc IDataStorageFactory
  function setFarmingAddress(address newFarmingAddress) external override {
    require(farmingAddress != newFarmingAddress);
    farmingAddress = newFarmingAddress;
    emit FarmingAddress(newFarmingAddress);
  }
}
