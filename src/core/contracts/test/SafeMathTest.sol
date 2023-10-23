// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../libraries/LowGasSafeMath.sol';
import '../libraries/SafeCast.sol';

contract SafeMathTest {
  function add(uint256 x, uint256 y) external pure returns (uint256 z) {
    return LowGasSafeMath.add(x, y);
  }

  function sub(uint256 x, uint256 y) external pure returns (uint256 z) {
    return LowGasSafeMath.sub(x, y);
  }

  function mul(uint256 x, uint256 y) external pure returns (uint256 z) {
    return LowGasSafeMath.mul(x, y);
  }

  function addInt(int256 x, int256 y) external pure returns (int256 z) {
    return LowGasSafeMath.add(x, y);
  }

  function subInt(int256 x, int256 y) external pure returns (int256 z) {
    return LowGasSafeMath.sub(x, y);
  }

  function add128(uint128 x, uint128 y) external pure returns (uint128 z) {
    return LowGasSafeMath.add128(x, y);
  }

  function toUint160(uint256 y) external pure returns (uint160 z) {
    return SafeCast.toUint160(y);
  }

  function toInt128(int256 y) external pure returns (int128 z) {
    return SafeCast.toInt128(y);
  }

  function toUint128(uint256 y) external pure returns (uint128 z) {
    return SafeCast.toUint128(y);
  }

  function toInt128U(uint128 y) external pure returns (int128 z) {
    return SafeCast.toInt128(y);
  }

  function toInt256(uint256 y) external pure returns (int256 z) {
    return SafeCast.toInt256(y);
  }
}
