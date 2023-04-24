// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;

import '../libraries/IncentiveId.sol';

/// @dev Test contract for IncentiveId
contract TestIncentiveId {
  function compute(IncentiveKey memory key) public pure returns (bytes32) {
    return IncentiveId.compute(key);
  }
}
