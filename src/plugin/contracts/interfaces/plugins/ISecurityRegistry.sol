// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

interface ISecurityRegistry {
  enum Status {
    ENABLED,
    BURN_ONLY,
    DISABLED
  }

  error OnlyOwner();

  event GlobalStatus(Status status);
  event PoolStatus(address pool, Status status);

  function setGlobalStatus(Status newStatus) external;
  function getPoolStatus(address pool) external returns (Status);
  function setPoolsStatus(address[] memory pools, Status[] memory newStatuses) external;

  function algebraFactory() external view returns (address);
  function GUARD() external pure returns (bytes32);
  function globalStatus() external view returns (Status);
  function isPoolStatusOverrided() external view returns (bool);
}
