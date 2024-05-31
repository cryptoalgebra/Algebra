// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './interfaces/IBasePluginV1Factory.sol';
import './interfaces/IAlgebraModuleFactory.sol';
import './base/AlgebraModuleFactory.sol';
import './libraries/AdaptiveFee.sol';

import '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/AlgebraModularHub.sol';
import '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/interfaces/IAlgebraModularHub.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';

import 'hardhat/console.sol';

/// @title Algebra Integral 1.1 default plugin factory
/// @notice This contract creates Algebra default plugins for Algebra liquidity pools
/// @dev This plugin factory can only be used for Algebra base pools
contract BasePluginV1Factory is IBasePluginV1Factory {
  /// @inheritdoc IBasePluginV1Factory
  bytes32 public constant override ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR = keccak256('ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR');

  /// @inheritdoc IBasePluginV1Factory
  address public immutable override algebraFactory;

  /// @inheritdoc IBasePluginV1Factory
  mapping(address poolAddress => address pluginAddress) public override pluginByPool;

  mapping(uint256 factoryIndex => address factoryAddress) public factoryByIndex;
  uint256 public factoriesCounter;

  modifier onlyAdministrator() {
    require(IAlgebraFactory(algebraFactory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR, msg.sender), 'Only administrator');
    _;
  }

  constructor(address _algebraFactory, address[] memory factories) {
    algebraFactory = _algebraFactory;

    for (uint256 i = 0; i < factories.length; ++i) {
      factoryByIndex[i] = factories[i];
    }

    factoriesCounter = factories.length;
  }

  /// @inheritdoc IAlgebraPluginFactory
  function beforeCreatePoolHook(address pool, address, address, address, address, bytes calldata) external override returns (address) {
    require(msg.sender == algebraFactory);
    return _createPlugin(pool);
  }

  function afterCreatePoolHook(address modularHub, address pool, address) external {
    console.log('afterCreatePoolHook called');
    require(msg.sender == algebraFactory);
    console.log(1);
    IAlgebraPool(pool).setPluginConfig(uint8(Plugins.DYNAMIC_FEE));
    console.log(2);
    _insertModules(modularHub);
  }

  /// @inheritdoc IBasePluginV1Factory
  function createPluginForExistingPool(address token0, address token1) external override returns (address pluginAddress) {
    IAlgebraFactory factory = IAlgebraFactory(algebraFactory);
    require(factory.hasRoleOrOwner(factory.POOLS_ADMINISTRATOR_ROLE(), msg.sender));

    address pool = factory.poolByPair(token0, token1);
    require(pool != address(0), 'Pool not exist');

    pluginAddress = _createPlugin(pool);

    _insertModules(pluginAddress);
  }

  function _createPlugin(address pool) internal returns (address) {
    require(pluginByPool[pool] == address(0), 'Already created');

    AlgebraModularHub modularHub = new AlgebraModularHub(pool, algebraFactory);
    console.log('modular Hub in contract: ', address(modularHub));

    // IAlgebraPool(pool).setPlugin(address(modularHub));

    for (uint256 i = 0; i < factoriesCounter; ++i) {
      address moduleFactoryAddress = factoryByIndex[i];
      address moduleAddress = IAlgebraModuleFactory(moduleFactoryAddress).deploy(address(modularHub));

      modularHub.registerModule(moduleAddress);

      // console.log('module', i, moduleAddress, globalIndex);

      // InsertModuleParams[] memory insertModuleParams = IAlgebraModuleFactory(moduleFactoryAddress).getInsertModuleParams(globalModuleIndex);

      // modularHub.insertModulesToHookLists(insertModuleParams);
    }

    pluginByPool[pool] = address(modularHub);
    return address(modularHub);
  }

  function _insertModules(address modularHub) internal {
    for (uint256 i = factoriesCounter - 1; i > 0; --i) {
      address moduleFactoryAddress = factoryByIndex[i];
      InsertModuleParams[] memory insertModuleParams = IAlgebraModuleFactory(moduleFactoryAddress).getInsertModuleParams(i + 1);
      IAlgebraModularHub(modularHub).insertModulesToHookLists(
        insertModuleParams
      );
    }
  }
}
