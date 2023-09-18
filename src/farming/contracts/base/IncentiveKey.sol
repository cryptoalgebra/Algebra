// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.6;
pragma abicoder v2;

import '@cryptoalgebra/integral-core/contracts/interfaces/IERC20Minimal.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';

/// @param rewardToken The token being distributed as a reward (token0)
/// @param bonusRewardToken The bonus token being distributed as a reward (token1)
/// @param pool The Algebra pool
/// @param nonce The nonce of incentive
struct IncentiveKey {
  IERC20Minimal rewardToken;
  IERC20Minimal bonusRewardToken;
  IAlgebraPool pool;
  uint256 nonce;
}
