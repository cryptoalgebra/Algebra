// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../interfaces/vault/IAlgebraCommunityVaultFeeHandler.sol';

/// @dev Community vault that records the fee notifications it gets from pools
contract MockCommunityVaultFeeHandler is IAlgebraCommunityVaultFeeHandler {
  event HandleCommunityFee(address pool, address token0, address token1, uint256 amount0, uint256 amount1);

  function handleCommunityFee(address token0, address token1, uint256 amount0, uint256 amount1) external override {
    emit HandleCommunityFee(msg.sender, token0, token1, amount0, amount1);
  }
}
