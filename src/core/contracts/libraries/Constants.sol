// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;

library Constants {
  uint8 internal constant RESOLUTION = 96;
  uint256 internal constant Q64 = 1 << 64;
  uint256 internal constant Q96 = 1 << 96;
  uint256 internal constant Q128 = 1 << 128;
  int256 internal constant Q160 = 1 << 160;
  // fee value in hundredths of a bip, i.e. 1e-6
  uint16 internal constant BASE_FEE = 100;
  int24 internal constant INIT_TICK_SPACING = 60;

  // the frequency with which the accumulated community fees are sent to the vault
  uint32 internal constant COMMUNITY_FEE_TRANSFER_FREQUENCY = 8 hours;

  // max(uint128) / ( (MAX_TICK - MIN_TICK) )
  uint128 internal constant MAX_LIQUIDITY_PER_TICK = 40564824043007195767232224305152;

  uint8 internal constant MAX_COMMUNITY_FEE = 250;
  uint256 internal constant COMMUNITY_FEE_DENOMINATOR = 1000;
  // role that can change communityFee and tickspacing in pools
  bytes32 internal constant POOLS_ADMINISTRATOR_ROLE = keccak256('POOLS_ADMINISTRATOR');
}
