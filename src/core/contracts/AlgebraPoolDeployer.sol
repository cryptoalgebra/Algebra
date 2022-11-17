// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import './interfaces/IAlgebraPoolDeployer.sol';
import './AlgebraPool.sol';

contract AlgebraPoolDeployer is IAlgebraPoolDeployer {
  address private dataStorageCache;
  address private factory;
  address private token0Cache;
  address private token1Cache;

  address private owner;

  /// @inheritdoc IAlgebraPoolDeployer
  function parameters()
    external
    view
    override
    returns (
      address,
      address,
      address,
      address
    )
  {
    return (dataStorageCache, factory, token0Cache, token1Cache);
  }

  modifier onlyFactory() {
    require(msg.sender == factory);
    _;
  }

  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  constructor() {
    owner = msg.sender;
  }

  /// @inheritdoc IAlgebraPoolDeployer
  function setFactory(address _factory) external override onlyOwner {
    require(_factory != address(0));
    require(factory == address(0));
    factory = _factory;
    emit Factory(_factory);
  }

  /// @inheritdoc IAlgebraPoolDeployer
  function deploy(
    address dataStorage,
    address token0,
    address token1
  ) external override onlyFactory returns (address pool) {
    dataStorageCache = dataStorage;
    token0Cache = token0;
    token1Cache = token1;
    pool = address(new AlgebraPool{salt: keccak256(abi.encode(token0, token1))}());
  }
}
