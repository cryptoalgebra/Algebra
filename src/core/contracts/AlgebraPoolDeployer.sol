// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './interfaces/IAlgebraPoolDeployer.sol';
import './AlgebraPool.sol';

contract AlgebraPoolDeployer is IAlgebraPoolDeployer {
  address private dataStorageCache; // TODO mb is better to store bytes?
  address private token0Cache;
  address private token1Cache;

  address private immutable factory;
  address private immutable communityVault;

  /// @inheritdoc IAlgebraPoolDeployer
  function getDeployParameters() external view override returns (address, address, address, address, address) {
    return (dataStorageCache, factory, communityVault, token0Cache, token1Cache);
  }

  constructor(address _factory, address _communityVault) {
    require(_factory != address(0));
    require(_communityVault != address(0));
    factory = _factory;
    communityVault = _communityVault;
    emit Factory(_factory);
  }

  /// @inheritdoc IAlgebraPoolDeployer
  function deploy(address dataStorage, address token0, address token1) external override returns (address pool) {
    require(msg.sender == factory);

    (dataStorageCache, token0Cache, token1Cache) = (dataStorage, token0, token1);
    pool = address(new AlgebraPool{salt: keccak256(abi.encode(token0, token1))}());
    (dataStorageCache, token0Cache, token1Cache) = (address(0), address(0), address(0));
  }
}
