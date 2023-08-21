// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './interfaces/IDataStorageFactory.sol';
import './libraries/AdaptiveFee.sol';
import './DataStorageOperator.sol';

/// @title Algebra default plugin factory
/// @notice This contract creates Algebra default plugins for Algebra liquidity pools
contract DataStorageFactory is IDataStorageFactory {
  /// @inheritdoc IDataStorageFactory
  bytes32 public constant override ALGEBRA_BASE_PLUGIN_ADMINISTRATOR = keccak256('ALGEBRA_BASE_PLUGIN_ADMINISTRATOR');

  /// @inheritdoc IDataStorageFactory
  address public immutable override algebraFactory;

  /// @inheritdoc IDataStorageFactory
  AlgebraFeeConfiguration public override defaultFeeConfiguration; // values of constants for sigmoids in fee calculation formula

  /// @inheritdoc IDataStorageFactory
  address public override farmingAddress;

  /// @inheritdoc IDataStorageFactory
  mapping(address => address) public override pluginByPool;

  modifier onlyAdministrator() {
    require(IAlgebraFactory(algebraFactory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_ADMINISTRATOR, msg.sender), 'only administrator');
    _;
  }

  constructor(address _algebraFactory) {
    algebraFactory = _algebraFactory;
    defaultFeeConfiguration = AdaptiveFee.initialFeeConfiguration();
    emit DefaultFeeConfiguration(defaultFeeConfiguration);
  }

  /// @inheritdoc IAlgebraPluginFactory
  function createPlugin(address pool) external override returns (address) {
    require(msg.sender == algebraFactory);
    return _createPlugin(pool);
  }

  /// @inheritdoc IDataStorageFactory
  function createPluginForExistingPool(address token0, address token1) external override returns (address) {
    IAlgebraFactory factory = IAlgebraFactory(algebraFactory);
    require(factory.hasRoleOrOwner(factory.POOLS_ADMINISTRATOR_ROLE(), msg.sender));

    address pool = factory.poolByPair(token0, token1);
    require(pool != address(0), 'pool not exist');

    return _createPlugin(pool);
  }

  function _createPlugin(address pool) internal returns (address) {
    IDataStorageOperator dataStorage = new DataStorageOperator(pool, algebraFactory, address(this));
    dataStorage.changeFeeConfiguration(defaultFeeConfiguration);
    pluginByPool[pool] = address(dataStorage);
    return address(dataStorage);
  }

  /// @inheritdoc IDataStorageFactory
  function setDefaultFeeConfiguration(AlgebraFeeConfiguration calldata newConfig) external override onlyAdministrator {
    AdaptiveFee.validateFeeConfiguration(newConfig);
    defaultFeeConfiguration = newConfig;
    emit DefaultFeeConfiguration(newConfig);
  }

  /// @inheritdoc IDataStorageFactory
  function setFarmingAddress(address newFarmingAddress) external override onlyAdministrator {
    require(farmingAddress != newFarmingAddress);
    farmingAddress = newFarmingAddress;
    emit FarmingAddress(newFarmingAddress);
  }
}
