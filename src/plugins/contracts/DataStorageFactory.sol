// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './libraries/AdaptiveFee.sol';

import './DataStorageOperator.sol';
import './interfaces/IDataStorageFactory.sol';

/// TODO
contract DataStorageFactory is IDataStorageFactory {
  address public immutable algebraFactory;

  /// @dev values of constants for sigmoids in fee calculation formula
  AlgebraFeeConfiguration public defaultFeeConfiguration;

  /// @inheritdoc IDataStorageFactory
  address public farmingAddress;

  mapping(address => address) public pluginByPool;

  modifier onlyOwner() {
    require(msg.sender == IAlgebraFactory(algebraFactory).owner(), 'onlyOwner');
    _;
  }

  constructor(address _algebraFactory) {
    algebraFactory = _algebraFactory;
    defaultFeeConfiguration = AdaptiveFee.initialFeeConfiguration();
  }

  /// @inheritdoc IAlgebraPluginFactory
  function createPlugin(address pool) external override returns (address) {
    require(msg.sender == algebraFactory);
    return _createPlugin(pool);
  }

  //TODO
  function createPluginForExistingPool(address token0, address token1) external returns (address) {
    IAlgebraFactory factory = IAlgebraFactory(algebraFactory);
    require(factory.hasRoleOrOwner(factory.POOLS_ADMINISTRATOR_ROLE(), msg.sender));

    address pool = factory.poolByPair(token0, token1);
    require(pool != address(0), 'pool not exist');

    return _createPlugin(pool);
  }

  function _createPlugin(address pool) internal returns (address) {
    IDataStorageOperator dataStorage = new DataStorageOperator(pool, algebraFactory, address(this)); // TODO address this
    dataStorage.changeFeeConfiguration(defaultFeeConfiguration);
    pluginByPool[pool] = address(dataStorage);
    return address(dataStorage);
  }

  /// @inheritdoc IDataStorageFactory
  function setDefaultFeeConfiguration(AlgebraFeeConfiguration calldata newConfig) external override onlyOwner {
    AdaptiveFee.validateFeeConfiguration(newConfig);
    defaultFeeConfiguration = newConfig;
    emit DefaultFeeConfiguration(newConfig);
  }

  /// @inheritdoc IDataStorageFactory
  function setFarmingAddress(address newFarmingAddress) external override onlyOwner {
    require(farmingAddress != newFarmingAddress);
    farmingAddress = newFarmingAddress;
    emit FarmingAddress(newFarmingAddress);
  }
}
