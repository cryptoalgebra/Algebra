// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './interfaces/IAlgebraPoolDeployer.sol';
import './AlgebraPool.sol';

/// @title Algebra pool deployer
/// @notice Is used by AlgebraFactory to deploy pools
/// @dev Version: Algebra V2.1
contract AlgebraPoolDeployer is IAlgebraPoolDeployer {
  /// @dev two storage slots for dense cache packing
  bytes32 private cache0;
  bytes32 private cache1;

  address private immutable factory;
  address private immutable communityVault;

  constructor(address _factory, address _communityVault) {
    require(_factory != address(0) && _communityVault != address(0));
    (factory, communityVault) = (_factory, _communityVault);
  }

  /// @inheritdoc IAlgebraPoolDeployer
  function getDeployParameters()
    external
    view
    override
    returns (address _dataStorage, address _factory, address _communityVault, address _token0, address _token1)
  {
    (_dataStorage, _token0, _token1) = _readFromCache();
    (_factory, _communityVault) = (factory, communityVault);
  }

  /// @inheritdoc IAlgebraPoolDeployer
  function deploy(address dataStorage, address token0, address token1) external override returns (address pool) {
    require(msg.sender == factory);

    _writeToCache(dataStorage, token0, token1);
    pool = address(new AlgebraPool{salt: keccak256(abi.encode(token0, token1))}());
    (cache0, cache1) = (bytes32(0), bytes32(0));
  }

  /// @notice densely packs three addresses into two storage slots
  function _writeToCache(address dataStorage, address token0, address token1) private {
    assembly {
      // cache0 = [dataStorage, token0[0, 96]], cache1 = [token0[0, 64], 0-s x32 , token1]
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
