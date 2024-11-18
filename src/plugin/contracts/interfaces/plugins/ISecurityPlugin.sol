// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

interface ISecurityPlugin {
  function setSecurityRegistry(address registry) external;

  function getSecurityRegistry() external view returns (address);

  event SecurityRegistry(address registry);

  error PoolDisabled();
  error BurnOnly();
}
