// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

interface IAlgebraLimitOrderCallback {
  function algebraLimitOrderCallback(
    uint128 amount0required,
    uint128 amount1required,
    bytes calldata data
  ) external;
}
