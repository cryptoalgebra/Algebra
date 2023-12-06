// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface INFTVerifier {
  event SlotValueVerifier(address newSlotValueVerifier);
  event NftAddress(address newNftAddress);
  event SlotNumber(uint256 newSlotNumber);
  event LastBlock(uint64 newLastBlock);
  event NftVerification(address owner, bool result);

  function isVerified(address owner) external view returns (bool);

  function slotValueVerifier() external view returns (address);

  function nftAddress() external view returns (address);

  function slotNum() external view returns (uint256);

  function lastBlock() external view returns (uint64);

  function setSlotVerifier(address _slotValueVerifier) external;

  function setNftAddress(address _newNftAddress) external;

  function setSlotNumber(uint256 _newSlot) external;

  function setLastBlock(uint32 _lastBlock) external;

  function verifyNft(uint32 blockNumber, uint256 tokenId, bytes calldata proofData, bytes calldata blkVerifyInfo) external;

  function deactivateVerify() external;
}
