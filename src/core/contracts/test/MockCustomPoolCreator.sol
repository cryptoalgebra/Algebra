// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '../interfaces/IAlgebraFactory.sol';
import '../interfaces/plugin/IAlgebraPluginFactory.sol';

contract MockCustomPoolCreator is IAlgebraPluginFactory {
  event BeforeCreateHook(address pool, address creator, address deployer, address token0, address token1, bytes data);

  mapping(address => address) public pluginsForPools;

  function beforeCreatePoolHook(
    address pool,
    address creator,
    address deployer,
    address token0,
    address token1,
    bytes calldata data
  ) external override returns (address plugin) {
    plugin = address(0);
    pluginsForPools[pool] = plugin;

    emit BeforeCreateHook(pool, creator, deployer, token0, token1, data);
  }

  function afterCreatePoolHook(address plugin, address pool, address deployer) external override {}

  function createCustomPool(address factory, address tokenA, address tokenB, bytes calldata data) external returns (address pool) {
    pool = IAlgebraFactory(factory).createCustomPool(address(this), msg.sender, tokenA, tokenB, data);
  }
}
