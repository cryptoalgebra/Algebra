// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import '../../interfaces/IAlgebraPoolDeployer.sol';
import './SimulationTimeAlgebraPool.sol';

contract SimulationTimePoolDeployer is IAlgebraPoolDeployer {
  struct Parameters {
    address dataStorage;
    address factory;
    address token0;
    address token1;
  }

  /// @inheritdoc IAlgebraPoolDeployer
  Parameters public override getDeployParameters;

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

  function setFactory(address _factory) external onlyOwner {
    require(_factory != address(0));
    require(factory == address(0));
    emit Factory(_factory);
    factory = _factory;
  }

  /// @inheritdoc IAlgebraPoolDeployer
  function deploy(address dataStorage, address token0, address token1) external override onlyFactory returns (address pool) {
    getDeployParameters = Parameters({dataStorage: dataStorage, factory: factory, token0: token0, token1: token1});
    pool = address(new SimulationTimeAlgebraPool{salt: keccak256(abi.encode(token0, token1))}());
  }
}
