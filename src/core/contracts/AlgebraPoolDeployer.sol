// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import './interfaces/IAlgebraPoolDeployer.sol';
import './AlgebraPool.sol';

contract AlgebraPoolDeployer is IAlgebraPoolDeployer {
  struct Parameters {
    address dataStorage;
    address factory;
    address token0;
    address token1;
  }

  /// @inheritdoc IAlgebraPoolDeployer
  Parameters public override parameters;

  address private factory;
  address private owner;

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
    emit Factory(_factory);
    factory = _factory;
  }

  /// @inheritdoc IAlgebraPoolDeployer
  function deploy(
    address dataStorage,
    address _factory,
    address token0,
    address token1
  ) external override onlyFactory returns (address pool) {
    parameters = Parameters({dataStorage: dataStorage, factory: _factory, token0: token0, token1: token1});
    pool = address(new AlgebraPool{salt: keccak256(abi.encode(token0, token1))}());
  }
}
