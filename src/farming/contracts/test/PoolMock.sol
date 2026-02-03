// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

import '../interfaces/IAlgebraEternalVirtualPool.sol';

/// @dev Test contract for virtual pool onlyPool methods
contract PoolMock {
  address public plugin;

  address public virtualPool;

  // Mock globalState values
  uint160 private _sqrtPrice;
  int24 private _tick;
  uint16 private _fee;
  uint8 private _pluginConfig;
  uint16 private _communityFee;
  bool private _unlocked;
  uint128 private _liquidity;

  function setPlugin(address newPlugin) external {
    plugin = newPlugin;
  }

  function setVirtualPool(address newVirtualPool) external {
    virtualPool = newVirtualPool;
  }

  function setGlobalState(
    uint160 sqrtPrice,
    int24 tick,
    uint16 fee,
    uint8 pluginConfig,
    uint16 communityFee,
    bool unlocked
  ) external {
    _sqrtPrice = sqrtPrice;
    _tick = tick;
    _fee = fee;
    _pluginConfig = pluginConfig;
    _communityFee = communityFee;
    _unlocked = unlocked;
  }

  function setLiquidity(uint128 liquidity_) external {
    _liquidity = liquidity_;
  }

  function globalState() external view returns (
    uint160 sqrtPrice,
    int24 tick,
    uint16 fee,
    uint8 pluginConfig,
    uint16 communityFee,
    bool unlocked
  ) {
    return (_sqrtPrice, _tick, _fee, _pluginConfig, _communityFee, _unlocked);
  }

  function liquidity() external view returns (uint128) {
    return _liquidity;
  }

  function afterCross(
    bool zeroToOne,
    uint256 feeAmount,
    int24 tick,
    uint128 poolLiquidity
  ) external {
    IAlgebraEternalVirtualPool(virtualPool).afterCross(zeroToOne, feeAmount, tick, poolLiquidity);
  }

  function afterSwap(
    bool zeroToOne,
    uint256 feeAmount,
    int24 currentTick,
    uint128 poolLiquidity
  ) external {
    IAlgebraEternalVirtualPool(virtualPool).afterSwap(zeroToOne, feeAmount, currentTick, poolLiquidity);
  }
}
