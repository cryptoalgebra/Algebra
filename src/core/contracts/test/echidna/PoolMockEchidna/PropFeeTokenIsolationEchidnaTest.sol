// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import './PoolMockEchidna.sol';

/// @notice Checks that a pool with a fixed fee token never accrues swap fees in the other token
/// @dev The mode is pinned in the constructor. `setFeeMode`, `setFeeModeWrapped` and the pool's own `flash` are
/// blacklisted in the config: the mock inherits the whole pool and accepts every caller as an administrator, and
/// a raw flash can pay its fee in token1, which then accrues there whatever the mode
contract PropFeeTokenIsolationEchidnaTest is PoolMockEchidna {
  constructor() {
    globalState.feeMode = Constants.FEE_MODE_TOKEN0;
    exactPayments = true;
  }

  /// @dev An excess balance of the other token would bump its accumulator through `_updateReserves`
  function donate(uint256 amount0, uint256) public override {
    balance0 += amount0;
  }

  /// @dev Flash fees are charged in both tokens whatever the fee mode is. The flash itself only leaves them as an
  /// excess balance, but the next operation sweeps that into `totalFeeGrowth1Token`, so a token1 flash followed by
  /// anything would break the property for a legitimate reason
  function flashWrapped(address recipient, uint256 amount0, uint256) public override {
    super.flashWrapped(recipient, amount0, 0);
  }

  function echidna_check_other_token_never_accrues_fees() public view returns (bool) {
    return totalFeeGrowth1Token == 0;
  }

  /// @dev The community fee is the only fee the pool keeps pending
  function echidna_check_pending_fees_are_in_fee_token_only() public view returns (bool) {
    return communityFeePending1 == 0;
  }

  function echidna_check_balance0_reserve0() public view returns (bool) {
    return balance0 >= reserve0;
  }

  function echidna_check_balance1_reserve1() public view returns (bool) {
    return balance1 >= reserve1;
  }
}
