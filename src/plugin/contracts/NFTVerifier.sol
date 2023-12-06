// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';

import './interfaces/ISlotValueVerifier.sol';
import './interfaces/INFTVerifier.sol';

contract NFTVerifier is INFTVerifier {
  address public immutable factory;

  uint64 public constant CHAIN_ID = 1;
  bytes32 public constant ALGEBRA_NFTVERIFIER_ADMINISTRATOR = keccak256('ALGEBRA_NFTVERIFIER_ADMINISTRATOR');

  mapping(address => bool) public override isVerified;

  address public override slotValueVerifier;
  address public override nftAddress;
  uint256 public override slotNum;

  uint64 public override lastBlock;

  modifier onlyAdministrator() {
    require(IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_NFTVERIFIER_ADMINISTRATOR, msg.sender), 'Only administrator');
    _;
  }

  constructor(address _factory) {
    factory = _factory;
  }

  function setSlotVerifier(address _slotValueVerifier) external override onlyAdministrator {
    slotValueVerifier = _slotValueVerifier;
    emit SlotValueVerifier(_slotValueVerifier);
  }

  function setNftAddress(address _newNftAddress) external override onlyAdministrator {
    nftAddress = _newNftAddress;
    emit NftAddress(_newNftAddress);
  }

  function setSlotNumber(uint256 _newSlot) external override onlyAdministrator {
    slotNum = _newSlot;
    emit SlotNumber(_newSlot);
  }

  function setLastBlock(uint32 _lastBlock) external override onlyAdministrator {
    lastBlock = _lastBlock;
    emit LastBlock(_lastBlock);
  }

  function verifyNft(uint32 blockNumber, uint256 tokenId, bytes calldata proofData, bytes calldata blkVerifyInfo) external override {
    require(blockNumber >= lastBlock);
    ISlotValueVerifier.SlotInfo memory info = ISlotValueVerifier(slotValueVerifier).verifySlotValue(CHAIN_ID, proofData, blkVerifyInfo);
    require(info.slotKey == keccak256(abi.encode(keccak256(abi.encode(tokenId, slotNum)))), 'slot key not match');
    require(uint256(info.slotValue) == (uint256(uint160(msg.sender)) << 96), 'slot value not match');
    require(info.addrHash == keccak256(abi.encodePacked(nftAddress)), 'contract address not match');
    isVerified[msg.sender] = true;
    emit NftVerification(msg.sender, true);
  }

  function deactivateVerify() external override {
    isVerified[msg.sender] = false;
    emit NftVerification(msg.sender, false);
  }
}
