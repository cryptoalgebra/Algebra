// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title An interface for a contract that is capable of deploying Algebra plugins
interface IAlgebraPluginFactory {
  // TODO
  function createPlugin(address pool) external returns (address);
}
