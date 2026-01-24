// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';

/// @title Mock Algebra Pool for testing FeeAuctionPlugin
contract MockTimeAlgebraPool {
  address public token0;
  address public token1;
  address public plugin;
  address public factory;

  uint160 public sqrtPriceX96;
  int24 public tick;
  uint16 public fee;
  uint8 public pluginConfig;
  bool public unlocked = true;

  constructor(address _token0, address _token1, address _factory) {
    token0 = _token0;
    token1 = _token1;
    factory = _factory;
  }

  function setPlugin(address _plugin) external {
    plugin = _plugin;
  }

  function setPluginConfig(uint8 _pluginConfig) external {
    pluginConfig = _pluginConfig;
  }

  function globalState() external view returns (uint160, int24, uint16, uint8, uint16, bool) {
    return (sqrtPriceX96, tick, fee, pluginConfig, 0, unlocked);
  }

  function initialize(uint160 _sqrtPriceX96) external {
    sqrtPriceX96 = _sqrtPriceX96;
    if (plugin != address(0)) {
      IAlgebraPlugin(plugin).beforeInitialize(msg.sender, _sqrtPriceX96);
    }
  }

  /// @notice Simulates a swap call to test the plugin's beforeSwap hook
  function simulateSwap(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice
  ) external returns (uint24 feeOverride, uint24 pluginFee) {
    require(plugin != address(0), 'Plugin not set');

    bytes4 selector;
    (selector, feeOverride, pluginFee) = IAlgebraPlugin(plugin).beforeSwap(sender, recipient, zeroToOne, amountRequired, limitSqrtPrice, false, '');

    require(selector == IAlgebraPlugin.beforeSwap.selector, 'Invalid selector');
  }

  /// @notice Simulates plugin fee handling
  function simulateHandlePluginFee(uint256 pluginFee0, uint256 pluginFee1) external {
    require(plugin != address(0), 'Plugin not set');
    IAlgebraPlugin(plugin).handlePluginFee(pluginFee0, pluginFee1);
  }
}
