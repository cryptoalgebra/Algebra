// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

type Epoch is uint232;

library EpochLibrary {
  function equals(Epoch a, Epoch b) internal pure returns (bool) {
    return Epoch.unwrap(a) == Epoch.unwrap(b);
  }

  function unsafeIncrement(Epoch a) internal pure returns (Epoch) {
    unchecked {
      return Epoch.wrap(Epoch.unwrap(a) + 1);
    }
  }
}
