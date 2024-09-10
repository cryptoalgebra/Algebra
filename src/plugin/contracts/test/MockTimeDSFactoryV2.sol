// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './MockTimeAlgebraBasePluginV2.sol';

import '../interfaces/IBasePluginV2Factory.sol';

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPluginFactory.sol';

contract MockTimeDSFactoryV2 is IBasePluginV2Factory {
  /// @inheritdoc IBasePluginV2Factory
  bytes32 public constant override ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR = keccak256('ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR');

  address public immutable override algebraFactory;

  /// @inheritdoc IBasePluginV2Factory
  mapping(address => address) public override pluginByPool;

  /// @inheritdoc IBasePluginV2Factory
  address public override farmingAddress;

  /// @inheritdoc IBasePluginV2Factory
  uint16 public override defaultBaseFee = 500;

  constructor(address _algebraFactory) {
    algebraFactory = _algebraFactory;
  }

  /// @inheritdoc IAlgebraPluginFactory
  function beforeCreatePoolHook(address pool, address, address, address, address, bytes calldata) external override returns (address) {
    return _createPlugin(pool);
  }

  /// @inheritdoc IAlgebraPluginFactory
  function afterCreatePoolHook(address, address, address) external view override {
    require(msg.sender == algebraFactory);
  }

  function createPluginForExistingPool(address token0, address token1) external override returns (address) {
    IAlgebraFactory factory = IAlgebraFactory(algebraFactory);
    require(factory.hasRoleOrOwner(factory.POOLS_ADMINISTRATOR_ROLE(), msg.sender));

    address pool = factory.poolByPair(token0, token1);
    require(pool != address(0), 'Pool not exist');

    return _createPlugin(pool);
  }

  function setPluginForPool(address pool, address plugin) external {
    pluginByPool[pool] = plugin;
  }

  function _createPlugin(address pool) internal returns (address) {
    MockTimeAlgebraBasePluginV2 plugin = new MockTimeAlgebraBasePluginV2(pool, algebraFactory, address(this));
    plugin.setBaseFee(defaultBaseFee);
    pluginByPool[pool] = address(plugin);
    return address(plugin);
  }

  /// @inheritdoc IBasePluginV2Factory
  function setDefaultBaseFee(uint16 newDefaultBaseFee) external override {
    require(defaultBaseFee != newDefaultBaseFee);
    defaultBaseFee = newDefaultBaseFee;
    emit DefaultBaseFee(newDefaultBaseFee);
  }

  /// @inheritdoc IBasePluginV2Factory
  function setFarmingAddress(address newFarmingAddress) external override {
    require(farmingAddress != newFarmingAddress);
    farmingAddress = newFarmingAddress;
    emit FarmingAddress(newFarmingAddress);
  }
}
