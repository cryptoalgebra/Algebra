// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../interfaces/IAlgebraPoolDeployer.sol';

import './MockTimeAlgebraPool.sol';
import '../DataStorageOperator.sol';

contract MockTimeAlgebraPoolDeployer {
  struct Parameters {
    address dataStorage;
    address factory;
    address token0;
    address token1;
  }

  Parameters public parameters;

  event PoolDeployed(address pool);

  AdaptiveFee.Configuration baseFeeConfiguration =
    AdaptiveFee.Configuration(
      3000 - Constants.BASE_FEE, // alpha1
      15000 - 3000, // alpha2
      360, // beta1
      60000, // beta2
      59, // gamma1
      8500, // gamma2
      0, // volumeBeta
      10, // volumeGamma
      Constants.BASE_FEE // baseFee
    );

  function deployMock(
    address factory,
    address token0,
    address token1
  ) external returns (address pool) {
    bytes32 initCodeHash = keccak256(type(MockTimeAlgebraPool).creationCode);
    DataStorageOperator dataStorage = (new DataStorageOperator(computeAddress(initCodeHash, token0, token1)));

    dataStorage.changeFeeConfiguration(baseFeeConfiguration);

    parameters = Parameters({dataStorage: address(dataStorage), factory: factory, token0: token0, token1: token1});
    pool = address(new MockTimeAlgebraPool{salt: keccak256(abi.encode(token0, token1))}());
    emit PoolDeployed(pool);
  }

  /// @notice Deterministically computes the pool address given the factory and PoolKey
  /// @param token0 first token
  /// @param token1 second token
  /// @return pool The contract address of the V3 pool
  function computeAddress(
    bytes32 initCodeHash,
    address token0,
    address token1
  ) internal view returns (address pool) {
    pool = address(uint256(keccak256(abi.encodePacked(hex'ff', address(this), keccak256(abi.encode(token0, token1)), initCodeHash))));
  }
}
