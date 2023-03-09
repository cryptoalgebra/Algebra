//SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
import './BytesLib.sol';
import 'hardhat/console.sol';

library CompressedEncoding {
    using BytesLib for bytes;

    function tightlyPackTokens(address[] memory _tokens) internal pure returns (bytes memory result) {
        for (uint i = 0; i < _tokens.length; i++) {
            result = result.concat(abi.encodePacked(_tokens[i]));
        }
    }

    function parsePath(
        mapping(uint256 => address) storage indexToToken,
        bytes32 word,
        uint256 offset,
        uint256 tokenAddressEncoding,
        uint256 _pathLength
    ) internal view returns (bytes memory path, uint256 newOffset) {
        address[] memory _tokens = new address[](_pathLength);
        uint256 size;
        if (tokenAddressEncoding == 0) size = 2;
        else if (tokenAddressEncoding == 1) size = 4;
        else if (tokenAddressEncoding == 2) size = 8;
        else size = 16;

        for (uint256 i; i < _pathLength; ++i) {
            offset += size;
            uint256 tokenIndex;
            assembly {
                tokenIndex := and(shr(sub(256, offset), word), sub(shl(size, 1), 1))
            }

            _tokens[i] = indexToToken[tokenIndex];
        }
        return (tightlyPackTokens(_tokens), offset);
    }

    function parseAmount(uint256 memPointer, uint256 offset) internal pure returns (uint128 amount, uint256 newOffset) {
        uint256 byteNum = offset / 8;
        uint256 _offset = offset % 8;
        bytes32 word;
        uint256 size;
        assembly {
            word := mload(add(memPointer, byteNum))
            _offset := add(_offset, 8)
            size := and(shr(sub(256, _offset), word), 255)
        }

        if (size >= 128) {
            // encoding with mulpitlier
            size -= 128;
            uint128 power;
            uint128 multiplier;
            assembly {
                _offset := add(_offset, 4)
                power := and(shr(sub(256, _offset), word), 15)
                _offset := add(_offset, add(size, 1))
                multiplier := and(shr(sub(256, _offset), word), sub(shl(size, 2), 1))
            }
            amount = uint128(multiplier * 10 ** (power + 1));
        } else {
            assembly {
                _offset := add(_offset, add(size, 1))
                amount := and(shr(sub(256, _offset), word), sub(shl(size, 2), 1))
            }
        }

        newOffset = byteNum * 8 + _offset;
    }

    function parse160(uint256 memPointer, uint256 offset) internal pure returns (uint160 value, uint256 newOffset) {
        uint256 byteNum = offset / 8;
        uint256 _offset = offset % 8;
        bytes32 word;
        assembly {
            word := mload(add(memPointer, byteNum))
        }
        assembly {
            _offset := add(_offset, 160)
            value := and(shr(sub(256, _offset), word), sub(shl(161, 2), 1))
        }
        newOffset = byteNum * 8 + _offset;
    }

    function parse32(uint256 memPointer, uint256 offset) internal pure returns (uint32 value, uint256 newOffset) {
        uint256 byteNum = offset / 8;
        uint256 _offset = offset % 8;
        bytes32 word;
        assembly {
            word := mload(add(memPointer, byteNum))
        }
        assembly {
            _offset := add(_offset, 32)
            value := and(shr(sub(256, _offset), word), sub(shl(33, 2), 1))
        }
        newOffset = byteNum * 8 + _offset;
    }
}
