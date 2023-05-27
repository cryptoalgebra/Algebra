// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../../interfaces/IAlgebraPoolDeployer.sol';
import './SimulationTimeAlgebraPool.sol';

contract SimulationTimePoolDeployer is IAlgebraPoolDeployer {
  struct Parameters {
    address dataStorage;
    address factory;
    address communityVault;
    address token0;
    address token1;
  }

  /// @inheritdoc IAlgebraPoolDeployer
  Parameters public override getDeployParameters;

  address private factory;
  address private vault;
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

  function setFactory(address _factory, address _vault) external onlyOwner {
    require(_factory != address(0));
    require(factory == address(0));
    factory = _factory;
    vault = _vault;
  }

  /// @inheritdoc IAlgebraPoolDeployer
  function deploy(address dataStorage, address token0, address token1) external override onlyFactory returns (address pool) {
    getDeployParameters = Parameters({dataStorage: dataStorage, factory: factory, communityVault: vault, token0: token0, token1: token1});
    pool = address(new SimulationTimeAlgebraPool{salt: keccak256(abi.encode(token0, token1))}());
  }
}
