//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import './BytesLib.sol';

library CompressedEncoding {
    using BytesLib for bytes;

    uint256 private constant BYTE_SIZE = 8;

    enum AddressEncoding {
        SMALL,
        MEDIUM,
        BIG
    }

    function tightlyPackTokens(address[] memory _tokens) internal pure returns (bytes memory result) {
        unchecked {
            uint256 _length = _tokens.length;
            for (uint256 i = 0; i < _length; i++) {
                result = result.concat(abi.encodePacked(_tokens[i]));
            }
        }
    }

    function parsePath(
        mapping(uint256 => address) storage indexToToken,
        bytes32 word,
        uint256 offset,
        AddressEncoding tokenAddressEncoding,
        uint256 _pathLength
    ) internal view returns (bytes memory path, uint256 newOffset) {
        uint256 size;
        if (tokenAddressEncoding == AddressEncoding.SMALL) size = 2;
        else if (tokenAddressEncoding == AddressEncoding.MEDIUM) size = 4;
        else if (tokenAddressEncoding == AddressEncoding.BIG) size = 8;
        else size = 16;

        address[] memory _tokens = new address[](_pathLength);
        unchecked {
            for (uint256 i; i < _pathLength; ++i) {
                offset += size;
                uint256 tokenIndex;
                assembly {
                    tokenIndex := and(shr(sub(256, offset), word), sub(shl(size, 1), 1))
                }

                _tokens[i] = indexToToken[tokenIndex];
            }
        }
        if (_pathLength == 2) return (abi.encodePacked(_tokens[0], _tokens[1]), offset);
        else return (tightlyPackTokens(_tokens), offset);
    }

    function parseAmount(uint256 memPointer, uint256 offset) internal pure returns (uint128 amount, uint256 newOffset) {
        uint256 byteNum = offset / BYTE_SIZE;
        uint256 _offset = offset % BYTE_SIZE;

        bytes32 word;
        uint256 size;
        assembly {
            word := mload(add(memPointer, byteNum))
            _offset := add(_offset, BYTE_SIZE)
            size := and(shr(sub(256, _offset), word), 255)
        }

        // most significant bit is used as encoding mode flag
        if (size >= 128) {
            // encoding with multiplier
            size -= 128; // remove flag from data
            uint128 power;
            uint128 multiplier;
            // 4 bits for power encoding
            // rest for multiplier
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

        newOffset = byteNum * BYTE_SIZE + _offset;
    }

    function parse160(uint256 memPointer, uint256 offset) internal pure returns (uint160 value, uint256 newOffset) {
        uint256 _value;
        (_value, newOffset) = _parseN(memPointer, offset, 160);
        return (uint160(_value), newOffset);
    }

    function parse32(uint256 memPointer, uint256 offset) internal pure returns (uint32 value, uint256 newOffset) {
        uint256 _value;
        (_value, newOffset) = _parseN(memPointer, offset, 32);
        return (uint32(_value), newOffset);
    }

    function _parseN(
        uint256 memPointer,
        uint256 offset,
        uint256 size
    ) private pure returns (uint256 value, uint256 newOffset) {
        uint256 byteNum = offset / BYTE_SIZE;
        uint256 _offset = offset % BYTE_SIZE;
        bytes32 word;
        assembly {
            word := mload(add(memPointer, byteNum))
            _offset := add(_offset, size)
            value := and(shr(sub(256, _offset), word), sub(shl(size, 1), 1))
        }
        newOffset = byteNum * BYTE_SIZE + _offset;
    }
}
