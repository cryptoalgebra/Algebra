// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '../base/AlgebraFeeConfiguration.sol';
import '../libraries/AdaptiveFee.sol';

import './MockPool.sol';

import '../interfaces/IBasePluginV1Factory.sol';
import '../interfaces/IAlgebraModuleFactory.sol';

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPluginFactory.sol';
import '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/AlgebraModularHub.sol';

contract MockTimeDSFactory is IBasePluginV1Factory {
  /// @inheritdoc IBasePluginV1Factory
  bytes32 public constant override ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR = keccak256('ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR');

  address public immutable override algebraFactory;

  /// @inheritdoc IBasePluginV1Factory
  mapping(address => address) public override pluginByPool;

  mapping(uint256 factoryIndex => address factoryAddress) public factoryByIndex;
  uint256 factoriesCounter;

  constructor(address _algebraFactory, address[] memory factories) {
    algebraFactory = _algebraFactory;

    for (uint256 i = 0; i < factories.length; ++i) {
      factoryByIndex[i] = factories[i];
    }

    factoriesCounter = factories.length;
  }

  /// @inheritdoc IAlgebraPluginFactory
  function beforeCreatePoolHook(address pool, address, address, address, address, bytes calldata) external override returns (address) {
    return _createPlugin(pool);
  }

  function afterCreatePoolHook(address modularHub, address) external override {
    _insertModules(modularHub);
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
    require(pluginByPool[pool] == address(0), 'Already created');
    AlgebraModularHub modularHub = new AlgebraModularHub(pool, algebraFactory);
    // console.log("modular hub: ", address(modularHub));

    MockPool(pool).setPlugin(address(modularHub));
    MockPool(pool).setPluginConfig(uint8(Plugins.DYNAMIC_FEE));
    
    for (uint256 i = 0; i < factoriesCounter; ++i) {
      address moduleFactoryAddress = factoryByIndex[i];
      address moduleAddress = IAlgebraModuleFactory(moduleFactoryAddress).deploy(address(modularHub));

      modularHub.registerModule(moduleAddress);
    }

    pluginByPool[pool] = address(modularHub);
    return address(modularHub);
  }

  function _insertModules(address modularHub) internal {
    for (uint256 i = 0; i < factoriesCounter; ++i) {
      address moduleFactoryAddress = factoryByIndex[i];
      IAlgebraModularHub(modularHub).insertModulesToHookLists(
        IAlgebraModuleFactory(moduleFactoryAddress).getInsertModuleParams(i + 1)
      );
    }
  }
}
