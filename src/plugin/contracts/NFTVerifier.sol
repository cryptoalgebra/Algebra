// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './interfaces/INFTVerifier.sol';
import './interfaces/ISlotValueVerifier.sol';

contract NFTVerifier is INFTVerifier{

    mapping(address => bool) public verified;

    address public slotValueVerifier;
    address public nftAddress;

    uint64 public lastBlock; 
    address public immutable factory;

    uint64 public constant CHAIN_ID = 1;

    constructor(address _factory) {
        factory = _factory;
    }

    function setSlotVerifier(address _slotValueVerifier) external override{
        slotValueVerifier = _slotValueVerifier;
        emit SlotValueVerifier(_slotValueVerifier);
    }
    
    function setNftAddress(address _newNftAddress) external override{
        nftAddress = _newNftAddress;
        emit NFTAddress(_newNftAddress); 
    }

    function setLastBlock(uint32 _lastBlock) external override{
        lastBlock = _lastBlock;
    }

    function verifyNft(bytes32 blockHash, uint32 blockNumber, bytes calldata proofData, bytes calldata blkVerifyInfo) external override{
        require(blockNumber > lastblock);
        bytes memory publicInput = abi.encode(blockHash, keccak256(nftAddress), keccak256(tokenId, 0), bytes32(msg.sender), blockNumber);
        bytes memory = _proofData + publicInput;
        SlotInfo memory info = ISlotValueVerifier(slotValueVerifier).verifySlotValue(CHAIN_ID, _proofData, blkVerifyInfo);
        require(info.slotKeyHash == slotKeyHash, "slot key not match");
        require(info.slotValue == msgHash, "slot value not match");
    }
}
