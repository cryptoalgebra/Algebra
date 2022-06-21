// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import '../interfaces/pool/IAlgebraPoolImmutables.sol';
import '../interfaces/IAlgebraPoolDeployer.sol';
import '../libraries/Constants.sol';

abstract contract PoolImmutables is IAlgebraPoolImmutables {
  /// @inheritdoc IAlgebraPoolImmutables
  address public immutable override dataStorageOperator;

  /// @inheritdoc IAlgebraPoolImmutables
  address public immutable override factory;
  /// @inheritdoc IAlgebraPoolImmutables
  address public immutable override token0;
  /// @inheritdoc IAlgebraPoolImmutables
  address public immutable override token1;

  /// @inheritdoc IAlgebraPoolImmutables
  function tickSpacing() external pure override returns (int24) {
    return Constants.TICK_SPACING;
  }

  /// @inheritdoc IAlgebraPoolImmutables
  function maxLiquidityPerTick() external pure override returns (uint128) {
    return Constants.MAX_LIQUIDITY_PER_TICK;
  }

  constructor(address deployer) {
    (dataStorageOperator, factory, token0, token1) = IAlgebraPoolDeployer(deployer).parameters();
  }
}
