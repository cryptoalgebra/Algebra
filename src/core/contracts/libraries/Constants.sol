// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

/// @title Contains common constants for Algebra contracts
/// @dev Constants moved to the library, not the base contract, to further emphasize their constant nature
library Constants {
  uint8 internal constant RESOLUTION = 96;
  uint256 internal constant Q96 = 1 << 96;
  uint256 internal constant Q128 = 1 << 128;

  uint24 internal constant FEE_DENOMINATOR = 1e6;
  uint16 internal constant FLASH_FEE = 0.0001e6; // fee for flash loan in hundredths of a bip (0.01%)
  uint16 internal constant INIT_DEFAULT_FEE = 0.0005e6; // init default fee value in hundredths of a bip (0.05%)
  uint16 internal constant MAX_DEFAULT_FEE = 0.05e6;

  int24 internal constant INIT_DEFAULT_TICK_SPACING = 60;
  int24 internal constant MAX_TICK_SPACING = 500;
  int24 internal constant MIN_TICK_SPACING = 1;

  // the frequency with which the accumulated community fees are sent to the vault
  uint32 internal constant COMMUNITY_FEE_TRANSFER_FREQUENCY = 8 hours;

  // max(uint128) / (MAX_TICK - MIN_TICK)
  uint128 internal constant MAX_LIQUIDITY_PER_TICK = 191757638537527648490752896198553;

  uint16 internal constant MAX_COMMUNITY_FEE = 1e3; // 100%
  uint256 internal constant COMMUNITY_FEE_DENOMINATOR = 1e3;
  // role that can change communityFee and tickspacing in pools
  bytes32 internal constant POOLS_ADMINISTRATOR_ROLE = keccak256('POOLS_ADMINISTRATOR');
}
