// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../interfaces/IAlgebraPoolDeployer.sol';

import './MockTimeAlgebraPool.sol';
import '../DataStorageOperator.sol';

contract MockTimeAlgebraPoolDeployer {
  address private dataStorageCache;
  address private factory;
  address private token0Cache;
  address private token1Cache;

  function getDeployParameters()
    external
    view
    returns (
      address,
      address,
      address,
      address
    )
  {
    return (dataStorageCache, factory, token0Cache, token1Cache);
  }

  event PoolDeployed(address pool);

  AdaptiveFee.Configuration baseFeeConfiguration =
    AdaptiveFee.Configuration(
      3000 - Constants.BASE_FEE, // alpha1
      15000 - 3000, // alpha2
      360, // beta1
      60000, // beta2
      59, // gamma1
      8500, // gamma2
      Constants.BASE_FEE // baseFee
    );

  function deployMock(
    address _factory,
    address token0,
    address token1
  ) external returns (address pool) {
    bytes32 initCodeHash = keccak256(type(MockTimeAlgebraPool).creationCode);
    DataStorageOperator dataStorage = (new DataStorageOperator(computeAddress(initCodeHash, token0, token1)));

    dataStorage.changeFeeConfiguration(baseFeeConfiguration);

    (dataStorageCache, factory, token0Cache, token1Cache) = (address(dataStorage), _factory, token0, token1);
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
