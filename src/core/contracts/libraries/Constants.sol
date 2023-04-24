// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;

library Constants {
  uint8 internal constant RESOLUTION = 96;
  uint256 internal constant Q32 = 1 << 32;
  uint256 internal constant Q48 = 1 << 48;
  uint256 internal constant Q64 = 1 << 64;
  uint256 internal constant Q96 = 1 << 96;
  uint256 internal constant Q128 = 1 << 128;
  uint256 internal constant Q144 = 1 << 144;
  int256 internal constant Q160 = 1 << 160;

  uint16 internal constant BASE_FEE = 0.0001e6; // init minimum fee value in hundredths of a bip (0.01%)
  uint24 internal constant FEE_DENOMINATOR = 1e6;
  int24 internal constant INIT_TICK_SPACING = 60;
  int24 internal constant MAX_TICK_SPACING = 500;

  // Defines the maximum and minimum ticks allowed for limit orders. Corresponds to the range of possible
  // price values ​​in UniswapV2. Due to this limitation, sufficient accuracy is achieved even with the minimum allowable tick
  int24 constant MAX_LIMIT_ORDER_TICK = 776363;

  // the frequency with which the accumulated community fees are sent to the vault
  uint32 internal constant COMMUNITY_FEE_TRANSFER_FREQUENCY = 8 hours;

  // max(uint128) / ( (MAX_TICK - MIN_TICK) )
  uint128 internal constant MAX_LIQUIDITY_PER_TICK = 40564824043007195767232224305152;

  uint8 internal constant MAX_COMMUNITY_FEE = 0.25e3; // 25%
  uint256 internal constant COMMUNITY_FEE_DENOMINATOR = 1e3;
  // role that can change communityFee and tickspacing in pools
  bytes32 internal constant POOLS_ADMINISTRATOR_ROLE = keccak256('POOLS_ADMINISTRATOR');
}
