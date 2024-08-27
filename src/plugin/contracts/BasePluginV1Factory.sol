// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import './interfaces/IBasePluginV1Factory.sol';
import './libraries/AdaptiveFee.sol';
import './AlgebraBasePluginV1.sol';
import './base/BasePlugin.sol';

/// @title Algebra Integral 1.1 default plugin factory
/// @notice This contract creates Algebra default plugins for Algebra liquidity pools
/// @dev This plugin factory can only be used for Algebra base pools
contract BasePluginV1Factory is IBasePluginV1Factory {
  /// @inheritdoc IBasePluginV1Factory
  bytes32 public constant override ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR = keccak256('ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR');

  /// @inheritdoc IBasePluginV1Factory
  address public immutable override algebraFactory;

  /// @inheritdoc IBasePluginV1Factory
  AlgebraFeeConfiguration public override defaultFeeConfiguration; // values of constants for sigmoids in fee calculation formula

  /// @inheritdoc IBasePluginV1Factory
  address public override farmingAddress;

  address public defaultPluginImplementation;

  bytes public initData;

  /// @inheritdoc IBasePluginV1Factory
  mapping(address poolAddress => address pluginAddress) public override pluginByPool;

  modifier onlyAdministrator() {
    require(IAlgebraFactory(algebraFactory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR, msg.sender), 'Only administrator');
    _;
  }

  constructor(address _algebraFactory, address _defaultPluginImplementation) {
    algebraFactory = _algebraFactory;
    defaultPluginImplementation = _defaultPluginImplementation;
    defaultFeeConfiguration = AdaptiveFee.initialFeeConfiguration();
    emit DefaultFeeConfiguration(defaultFeeConfiguration);
  }

  /// @inheritdoc IAlgebraPluginFactory
  function beforeCreatePoolHook(address pool, address, address, address, address, bytes calldata) external override returns (address) {
    require(msg.sender == algebraFactory);
    return _createPlugin(pool);
  }

  /// @inheritdoc IAlgebraPluginFactory
  function afterCreatePoolHook(address, address, address) external view override {
    require(msg.sender == algebraFactory);
  }

  /// @inheritdoc IBasePluginV1Factory
  function createPluginForExistingPool(address token0, address token1) external override returns (address) {
    IAlgebraFactory factory = IAlgebraFactory(algebraFactory);
    require(factory.hasRoleOrOwner(factory.POOLS_ADMINISTRATOR_ROLE(), msg.sender));

    address pool = factory.poolByPair(token0, token1);
    require(pool != address(0), 'Pool not exist');

    return _createPlugin(pool);
  }

  function _createPlugin(address pool) internal returns (address) {
    require(pluginByPool[pool] == address(0), 'Already created');
    address admin = IAlgebraFactory(algebraFactory).owner();
    address pluginAddress = address(new TransparentUpgradeableProxy(defaultPluginImplementation, admin, initData));
    BasePlugin(pluginAddress).initialize(pool, algebraFactory, address(this));
    pluginByPool[pool] = pluginAddress;
    return pluginAddress;
  }

  function setDefaultImplementation(address newDefaultImplementation) external onlyAdministrator {
    defaultPluginImplementation = newDefaultImplementation;
  }

  function setDefaultInitData(bytes calldata _initData) external onlyAdministrator {
    initData = _initData;
  }

  /// @inheritdoc IBasePluginV1Factory
  function setDefaultFeeConfiguration(AlgebraFeeConfiguration calldata newConfig) external override onlyAdministrator {
    AdaptiveFee.validateFeeConfiguration(newConfig);
    defaultFeeConfiguration = newConfig;
    emit DefaultFeeConfiguration(newConfig);
  }

  /// @inheritdoc IBasePluginV1Factory
  function setFarmingAddress(address newFarmingAddress) external override onlyAdministrator {
    require(farmingAddress != newFarmingAddress);
    farmingAddress = newFarmingAddress;
    emit FarmingAddress(newFarmingAddress);
  }
}
