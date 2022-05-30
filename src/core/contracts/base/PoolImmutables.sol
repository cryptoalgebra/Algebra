// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import '../interfaces/pool/IAlgebraPoolImmutables.sol';
import '../interfaces/IAlgebraPoolDeployer.sol';

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
  uint8 public constant override tickSpacing = 60;

  /// @inheritdoc IAlgebraPoolImmutables
  uint128 public constant override maxLiquidityPerTick = 11505743598341114571880798222544994;

  constructor(address deployer) {
    (dataStorageOperator, factory, token0, token1) = IAlgebraPoolDeployer(deployer).parameters();
  }
}
