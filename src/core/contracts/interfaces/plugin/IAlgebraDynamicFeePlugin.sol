// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

/// @title The interface for the Algebra plugin with dynamic fee logic
interface IAlgebraDynamicFeePlugin {
  // TODO
  function getCurrentFee() external view returns (uint16 fee);
}
