// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;

import '../interfaces/IAlgebraFeeConfiguration.sol';
import '../interfaces/IAlgebraPoolDeployer.sol';

import './MockTimeAlgebraPool.sol';
import './MockTimeDataStorageOperator.sol';

contract MockTimeAlgebraPoolDeployer {
  address private factory;
  address private vault;

  /// @dev two storage slots for dense cache packing
  bytes32 private cache0;
  bytes32 private cache1;

  function getDeployParameters() external view returns (address, address, address, address, address) {
    (address dataStorage, address token0, address token1) = _readFromCache();
    return (dataStorage, factory, vault, token0, token1);
  }

  event PoolDeployed(address pool);

  IAlgebraFeeConfiguration.Configuration baseFeeConfiguration =
    IAlgebraFeeConfiguration.Configuration(
      3000 - Constants.BASE_FEE, // alpha1
      15000 - 3000, // alpha2
      360, // beta1
      60000, // beta2
      59, // gamma1
      8500, // gamma2
      Constants.BASE_FEE // baseFee
    );

  function deployMock(address _factory, address _vault, address token0, address token1) external returns (address pool) {
    bytes32 initCodeHash = keccak256(type(MockTimeAlgebraPool).creationCode);
    DataStorageOperator dataStorage = (new MockTimeDataStorageOperator(computeAddress(initCodeHash, token0, token1)));

    dataStorage.changeFeeConfiguration(baseFeeConfiguration);

    (factory, vault) = (_factory, _vault);
    _writeToCache(address(dataStorage), token0, token1);
    pool = address(new MockTimeAlgebraPool{salt: keccak256(abi.encode(token0, token1))}());
    (cache0, cache1) = (bytes32(0), bytes32(0));
    emit PoolDeployed(pool);
  }

  /// @notice Deterministically computes the pool address given the factory and PoolKey
  /// @param token0 first token
  /// @param token1 second token
  /// @return pool The contract address of the V3 pool
  function computeAddress(bytes32 initCodeHash, address token0, address token1) internal view returns (address pool) {
    unchecked {
      pool = address(uint160(uint256(keccak256(abi.encodePacked(hex'ff', address(this), keccak256(abi.encode(token0, token1)), initCodeHash)))));
    }
  }

  /// @notice densely packs three addresses into two storage slots
  function _writeToCache(address dataStorage, address token0, address token1) private {
    assembly {
      token0 := and(token0, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) // clean higher bits, just in case
      sstore(cache0.slot, or(shr(64, token0), shl(96, and(dataStorage, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF))))
      sstore(cache1.slot, or(shl(160, token0), and(token1, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)))
    }
  }

  /// @notice reads three densely packed addresses from two storage slots
  function _readFromCache() private view returns (address dataStorage, address token0, address token1) {
    (bytes32 _cache0, bytes32 _cache1) = (cache0, cache1);
    assembly {
      dataStorage := shr(96, _cache0)
      token0 := or(shl(64, and(_cache0, 0xFFFFFFFFFFFFFFFFFFFFFFFF)), shr(160, _cache1))
      token1 := and(_cache1, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
    }
  }
}
