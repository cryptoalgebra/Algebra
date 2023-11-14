// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

interface IAlgebraStubPlugin {
  event newPluginConfig(uint8 newPluginConfig);

  error beforeInitializeHookDisabled();
  error afterInitializeHookDisabled();
  error beforePositionHookDisabled();
  error afterPositionHookDisabled();
  error beforeSwapHookDisabled();
  error afterSwapHookDisabled();
  error beforeFlashHookDisabled();
  error afterFlashHookDisabled();

  function setNewPluginConfig(uint8 newPluginConfig) external;

  function pluginConfig() external view returns (uint8 pluginConfig);
}
