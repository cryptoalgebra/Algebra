// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

abstract contract SwapCrossingBuffer {
  function _allocateCrossingBuffer() internal pure returns (uint256 buffer) {
    assembly {
      buffer := mload(0x40)
    }
  }

  function _appendCrossing(uint256 buffer, uint256 index, int24 tick, uint256 feeGrowthInput) internal pure {
    assembly {
      let slot := add(buffer, shl(6, index))
      mstore(slot, signextend(2, tick))
      mstore(add(slot, 0x20), feeGrowthInput)
      mstore(0x40, add(slot, 0x40))
    }
  }

  function _loadCrossing(uint256 buffer, uint256 index) internal pure returns (int24 tick, uint256 feeGrowthInput) {
    assembly {
      let slot := add(buffer, shl(6, index))
      tick := signextend(2, mload(slot))
      feeGrowthInput := mload(add(slot, 0x20))
    }
  }
}
