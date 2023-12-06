// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface ISlotValueVerifier {
  struct SlotInfo {
    uint64 chainId;
    bytes32 addrHash;
    bytes32 blkHash;
    bytes32 slotKey;
    bytes32 slotValue;
    uint32 blkNum;
  }

  function verifySlotValue(uint64 chainId, bytes calldata proofData, bytes calldata blkVerifyInfo) external view returns (SlotInfo memory slotInfo);
}
