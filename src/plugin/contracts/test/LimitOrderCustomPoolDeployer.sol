// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-periphery/contracts/interfaces/IAlgebraCustomPoolEntryPoint.sol';

import '../interfaces/ILimitOrderPluginFactory.sol';
import '../AlgebraLimitOrderPlugin.sol';

/// @title Algebra Integral limit plugin factory
contract LimitOrderCustomPoolDeployer is ILimitOrderPluginFactory {
  /// @inheritdoc ILimitOrderPluginFactory
  bytes32 public constant override ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR = keccak256('ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR');

  /// @inheritdoc ILimitOrderPluginFactory
  address public immutable override algebraFactory;

  address public immutable entryPoint;

  address public limitOrderPlugin;

  /// @inheritdoc ILimitOrderPluginFactory
  mapping(address poolAddress => address pluginAddress) public override pluginByPool;

  modifier onlyAdministrator() {
    require(IAlgebraFactory(algebraFactory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR, msg.sender), 'Only administrator');
    _;
  }

  constructor(address _algebraFactory, address _entryPoint) {
    entryPoint = _entryPoint;
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

  /// @inheritdoc ILimitOrderPluginFactory
  function createPluginForExistingPool(address token0, address token1) external override returns (address) {
    IAlgebraFactory factory = IAlgebraFactory(algebraFactory);
    require(factory.hasRoleOrOwner(factory.POOLS_ADMINISTRATOR_ROLE(), msg.sender));

    address pool = factory.poolByPair(token0, token1);
    require(pool != address(0), 'Pool not exist');

    return _createPlugin(pool);
  }

  function _createPlugin(address pool) internal returns (address) {
    require(pluginByPool[pool] == address(0), 'Already created');
    IAlgebraLimitOrderPlugin plugin = new AlgebraLimitOrderPlugin(pool, algebraFactory, address(this));
    if (limitOrderPlugin != address(0)) {
      plugin.setLimitOrderPlugin(limitOrderPlugin);
    }
    pluginByPool[pool] = address(plugin);
    return address(plugin);
  }

  function setLimitOrderPlugin(address newLimitOrderPlugin) external override onlyAdministrator {
    require(limitOrderPlugin != newLimitOrderPlugin);
    limitOrderPlugin = newLimitOrderPlugin;
    emit LimitOrderPlugin(newLimitOrderPlugin);
  }

  function createCustomPool(
    address deployer,
    address creator,
    address tokenA,
    address tokenB,
    bytes calldata data
  ) external returns (address customPool) {
    return IAlgebraCustomPoolEntryPoint(entryPoint).createCustomPool(deployer, creator, tokenA, tokenB, data);
  }

  function setTickSpacing(address pool, int24 newTickSpacing) external {
    IAlgebraCustomPoolEntryPoint(entryPoint).setTickSpacing(pool, newTickSpacing);
  }

  function setPlugin(address pool, address newPluginAddress) external {
    IAlgebraCustomPoolEntryPoint(entryPoint).setPlugin(pool, newPluginAddress);
  }

  function setPluginConfig(address pool, uint8 newConfig) external {
    IAlgebraCustomPoolEntryPoint(entryPoint).setPluginConfig(pool, newConfig);
  }

  function setFee(address pool, uint16 newFee) external {
    IAlgebraCustomPoolEntryPoint(entryPoint).setFee(pool, newFee);
  }
}
