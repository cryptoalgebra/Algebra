// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.6;

import '../base/IncentiveKey.sol';

library IncentiveId {
  /// @notice Calculate the key for a farming incentive
  /// @param key The components used to compute the incentive identifier
  /// @return incentiveId The identifier for the incentive
  function compute(IncentiveKey memory key) internal pure returns (bytes32 incentiveId) {
    return keccak256(abi.encode(key));
  }
}
