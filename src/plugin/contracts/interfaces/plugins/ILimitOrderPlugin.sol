// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import '@cryptoalgebra/integral-periphery/contracts/libraries/PoolAddress.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/callback/IAlgebraMintCallback.sol';

import '../../libraries/EpochLibrary.sol';

interface ILimitOrderPlugin is IAlgebraMintCallback {
  error ZeroLiquidity();
  error InRange();
  error CrossedRange();
  error Filled();
  error NotFilled();
  error NotPoolManagerToken();
  error NotPlugin();

  event Place(address indexed owner, Epoch indexed epoch, int24 tickLower, bool zeroForOne, uint128 liquidity);

  event Fill(Epoch indexed epoch, int24 tickLower, bool zeroForOne);

  event Kill(address indexed owner, Epoch indexed epoch, int24 tickLower, bool zeroForOne, uint128 liquidity);

  event Withdraw(address indexed owner, Epoch indexed epoch, uint128 liquidity);

  function place(PoolAddress.PoolKey memory poolKey, int24 tickLower, bool zeroForOne, uint128 liquidity) external;

  function kill(
    PoolAddress.PoolKey memory poolKey,
    int24 tickLower,
    int24 tickUpper,
    bool zeroForOne,
    address to
  ) external returns (uint256 amount0, uint256 amount1);

  function withdraw(Epoch epoch, address to) external returns (uint256 amount0, uint256 amount1);

  function afterSwap(address pool, bool zeroToOne, int24 tick) external;

  function afterInitialize(address pool, int24 tick) external;

  function setTickSpacing(address pool, int24 tickSpacing) external;
}
