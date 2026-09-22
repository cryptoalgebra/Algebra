// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import './PoolMockEchidna.sol';

/// @notice Checks that a pool with a fixed fee token never accrues swap fees in the other token
/// @dev The mode is pinned in the constructor and the setter is not exposed, so nothing in a sequence can
/// legitimately move the other accumulator
contract PropFeeTokenIsolationEchidnaTest is PoolMockEchidna {
  constructor() {
    globalState.feeMode = Constants.FEE_MODE_TOKEN0;
  }

  /// @dev An excess balance of the other token would bump its accumulator through `_updateReserves`
  function donate(uint256 amount0, uint256) public override {
    balance0 += amount0;
  }

  function echidna_check_other_token_never_accrues_fees() public view returns (bool) {
    return totalFeeGrowth1Token == 0;
  }

  function echidna_check_pending_fees_are_in_fee_token_only() public view returns (bool) {
    return communityFeePending1 == 0 && pluginFeePending1 == 0;
  }

  function echidna_check_balance0_reserve0() public view returns (bool) {
    return balance0 >= reserve0;
  }

  function echidna_check_balance1_reserve1() public view returns (bool) {
    return balance1 >= reserve1;
  }
}
