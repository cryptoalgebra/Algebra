// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './interfaces/ISecurityPluginFactory.sol';
import './interfaces/plugins/ISecurityPlugin.sol';
import './AlgebraSecurityPlugin.sol';

/// @title Algebra Integral 1.2 security plugin factory
contract SecurityPluginFactory is ISecurityPluginFactory {
  /// @inheritdoc ISecurityPluginFactory
  bytes32 public constant override ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR = keccak256('ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR');

  /// @inheritdoc ISecurityPluginFactory
  address public immutable override algebraFactory;

  /// @inheritdoc ISecurityPluginFactory
  address public override securityRegistry;

  /// @inheritdoc ISecurityPluginFactory
  mapping(address poolAddress => address pluginAddress) public override pluginByPool;

  modifier onlyAdministrator() {
    require(IAlgebraFactory(algebraFactory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR, msg.sender), 'Only administrator');
    _;
  }

  constructor(address _algebraFactory) {
    algebraFactory = _algebraFactory;
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

  /// @inheritdoc ISecurityPluginFactory
  function createPluginForExistingPool(address token0, address token1) external override returns (address) {
    IAlgebraFactory factory = IAlgebraFactory(algebraFactory);
    require(factory.hasRoleOrOwner(factory.POOLS_ADMINISTRATOR_ROLE(), msg.sender));

    address pool = factory.poolByPair(token0, token1);
    require(pool != address(0), 'Pool not exist');

    return _createPlugin(pool);
  }

  function _createPlugin(address pool) internal returns (address) {
    require(pluginByPool[pool] == address(0), 'Already created');
    ISecurityPlugin plugin = new AlgebraSecurityPlugin(pool, algebraFactory, address(this));
    plugin.setSecurityRegistry(securityRegistry);
    pluginByPool[pool] = address(plugin);
    return address(plugin);
  }

  /// @inheritdoc ISecurityPluginFactory
  function setSecurityRegistry(address _securityRegistry) external override onlyAdministrator {
    require(securityRegistry != _securityRegistry);
    securityRegistry = _securityRegistry;
    emit SecurityRegistry(_securityRegistry);
  }
}
