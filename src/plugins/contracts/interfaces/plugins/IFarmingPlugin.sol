// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title The interface for the Algebra farming plugin
/// @dev This contract used for virtual pools in farms
interface IFarmingPlugin {
  // TODO
  event Incentive(address newIncentive);

  // TODO
  function setIncentive(address newIncentive) external;

  // TODO
  function isIncentiveActive(address targetIncentive) external view returns (bool);

  // TODO
  function incentive() external view returns (address);
}
