// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

interface IBrevisPlugin {
  function cachedFee() external returns (uint16);
}
