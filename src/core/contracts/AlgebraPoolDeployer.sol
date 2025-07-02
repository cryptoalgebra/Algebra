// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;
pragma abicoder v1;

import './interfaces/IAlgebraPoolDeployer.sol';

import './AlgebraPool.sol';

/// @title Algebra pool deployer
/// @notice Is used by AlgebraFactory to deploy pools
/// @dev Version: Algebra Integral 1.2.2
contract AlgebraPoolDeployer is IAlgebraPoolDeployer {
  /// @dev two storage slots for dense cache packing
  bytes32 private cache0;
  bytes32 private cache1;

  address private immutable factory;

  constructor(address _factory) {
    require(_factory != address(0));
    factory = _factory;
  }

  /// @inheritdoc IAlgebraPoolDeployer
  function getDeployParameters() external view override returns (address _plugin, address _factory, address _token0, address _token1) {
    (_plugin, _token0, _token1) = _readFromCache();
    _factory = factory;
  }

  /// @inheritdoc IAlgebraPoolDeployer
  function deploy(address plugin, address token0, address token1, address deployer) external override returns (address pool) {
    require(msg.sender == factory);

    _writeToCache(plugin, token0, token1);
    bytes memory _encodedParams;
    if (deployer == address(0)) {
      _encodedParams = abi.encode(token0, token1);
    } else {
      _encodedParams = abi.encode(deployer, token0, token1);
    }
    pool = address(new AlgebraPool{salt: keccak256(_encodedParams)}());
    (cache0, cache1) = (bytes32(0), bytes32(0));
  }

  /// @notice densely packs three addresses into two storage slots
  function _writeToCache(address plugin, address token0, address token1) private {
    assembly {
      // cache0 = [plugin, token0[0, 96]], cache1 = [token0[0, 64], 0-s x32 , token1]
      token0 := and(token0, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) // clean higher bits, just in case
      sstore(cache0.slot, or(shr(64, token0), shl(96, plugin)))
      sstore(cache1.slot, or(shl(160, token0), and(token1, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)))
    }
  }

  /// @notice reads three densely packed addresses from two storage slots
  function _readFromCache() private view returns (address plugin, address token0, address token1) {
    (bytes32 _cache0, bytes32 _cache1) = (cache0, cache1);
    assembly {
      plugin := shr(96, _cache0)
      token0 := or(shl(64, and(_cache0, 0xFFFFFFFFFFFFFFFFFFFFFFFF)), shr(160, _cache1))
      token1 := and(_cache1, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
    }
  }
}
