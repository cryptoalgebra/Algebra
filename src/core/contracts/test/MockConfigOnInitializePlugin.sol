// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.26;
pragma abicoder v1;

import '../interfaces/plugin/IAlgebraPlugin.sol';
import '../interfaces/IAlgebraPool.sol';

/// @dev Sets its config from beforeInitialize, as real plugins do, and reports afterInitialize
contract MockConfigOnInitializePlugin {
  event AfterInitialize(address sender, uint160 sqrtPriceX96, int24 tick);

  address public immutable pool;
  uint16 public immutable config;

  constructor(address _pool, uint16 _config) {
    (pool, config) = (_pool, _config);
  }

  function beforeInitialize(address, uint160) external returns (bytes4) {
    IAlgebraPool(pool).setPluginConfig(config);
    return IAlgebraPlugin.beforeInitialize.selector;
  }

  function afterInitialize(address sender, uint160 sqrtPriceX96, int24 tick) external returns (bytes4) {
    emit AfterInitialize(sender, sqrtPriceX96, tick);
    return IAlgebraPlugin.afterInitialize.selector;
  }
}
