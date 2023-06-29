// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;

library Plugins {
  function hasFlag(uint8 pluginConfig, uint256 flag) internal pure returns (bool res) {
    assembly {
      res := gt(and(pluginConfig, flag), 0)
    }
  }

  uint256 internal constant BEFORE_SWAP_FLAG = 1;
  uint256 internal constant AFTER_SWAP_FLAG = 1 << 1;
  uint256 internal constant BEFORE_POSITION_MODIFY_FLAG = 1 << 2;
  uint256 internal constant AFTER_POSITION_MODIFY_FLAG = 1 << 3;
  uint256 internal constant BEFORE_FLASH_FLAG = 1 << 4;
  uint256 internal constant AFTER_FLASH_FLAG = 1 << 5;
  uint256 internal constant AFTER_INIT_FLAG = 1 << 6;
  uint256 internal constant DYNAMIC_FEE = 1 << 7;
}
