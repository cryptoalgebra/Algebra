// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import '@cryptoalgebra/integral-core/contracts/interfaces/callback/IAlgebraMintCallback.sol';
import '@cryptoalgebra/integral-periphery/contracts/libraries/PoolAddress.sol';

interface IWithdrawalFeePlugin is IAlgebraMintCallback {
  struct Position {
    uint128 liquidity;
    uint32 lastUpdateTimestamp;
    uint128 token0Owed;
    uint128 token1Owed;
    uint256 feeGrowthInside0LastX128;
    uint256 feeGrowthInside1LastX128;
    uint128 withdrawalFees0;
    uint128 withdrawalFees1;
  }

  struct Aprs {
    uint128 apr0;
    uint128 apr1;
  }

  error ZeroLiquidity();

  function positions(
    address pool,
    bytes32 positionKey
  )
    external
    view
    returns (
      uint128 liquidity,
      uint32 lastUpdateTimestamp,
      uint128 token0Owed,
      uint128 token1Owed,
      uint256 feeGrowthInside0LastX128,
      uint256 feeGrowthInside1LastX128,
      uint128 withdrawalFees0,
      uint128 withdrawalFees1
    );

  function aprs(address pool) external view returns (uint128 apr0, uint128 apr1);

  function withdrawalFee() external view returns (uint32);

  function setWithdrawalFee(uint16 newWithdrawalFee) external;

  function setTokenAPR(address pool, uint128 _apr0, uint128 _apr1) external;

  function mint(
    PoolAddress.PoolKey memory poolKey,
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 liquidity,
    bytes memory _data
  ) external returns (uint256 amount0, uint256 amount1, uint128 liquidityActual);

  function burn(
    PoolAddress.PoolKey memory poolKey,
    int24 tickLower,
    int24 tickUpper,
    uint128 liqudity
  ) external returns (uint256 amount0, uint256 amount1);

  function collect(
    PoolAddress.PoolKey memory poolKey,
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount0,
    uint128 amount1
  ) external returns (uint128 collected0, uint128 collected1);
}
