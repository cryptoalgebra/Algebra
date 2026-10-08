// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../interfaces/plugin/IAlgebraDynamicFeePlugin.sol';

/// @dev Dynamic fee plugin whose fee is a hash of the swap parameters, so a test can see the pool passes them through
contract MockSwapFeePlugin is IAlgebraDynamicFeePlugin {
  function getSwapFee(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    bool withPaymentInAdvance,
    bytes calldata data
  ) external pure override returns (uint24) {
    bytes32 hash = keccak256(abi.encode(sender, recipient, zeroToOne, amountRequired, limitSqrtPrice, withPaymentInAdvance, data));
    return uint24(uint256(hash) % 1e6);
  }
}
