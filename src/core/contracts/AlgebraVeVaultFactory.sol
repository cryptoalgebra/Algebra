// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './interfaces/vault/IAlgebraVeVaultFactory.sol';
import './interfaces/IAlgebraPool.sol';
import './AlgebraVeVault.sol';
import './libraries/Constants.sol';

/// @title Algebra vault factory
/// @notice This contract creates Algebra vaults for Algebra pools
contract AlgebraVeVaultFactory is IAlgebraVeVaultFactory {
  /// @inheritdoc IAlgebraVeVaultFactory
  address public immutable override algebraFactory;

  /// @inheritdoc IAlgebraVeVaultFactory
  address public override defaultCommunityVault;
  /// @inheritdoc IAlgebraVeVaultFactory
  mapping(address poolAddress => address vaultAddress) public override vaultByPool;

  modifier onlyAdministrator() {
    require(IAlgebraFactory(algebraFactory).hasRoleOrOwner(Constants.POOLS_ADMINISTRATOR_ROLE, msg.sender), 'Only administrator');
    _;
  }

  constructor(address _algebraFactory) {
    algebraFactory = _algebraFactory;
  }

  /// @inheritdoc IAlgebraVaultFactory
  function getVaultForPool(address pool) external view override returns (address communityVault) {
    if (defaultCommunityVault == address(0)) {
      communityVault = vaultByPool[pool];
    } else {
      communityVault = defaultCommunityVault;
    }
  }

  /// @inheritdoc IAlgebraVaultFactory
  function createVaultForPool(address pool) external override returns (address) {
    require(msg.sender == algebraFactory);
    return _createVault(pool);
  }

  /// @inheritdoc IAlgebraVeVaultFactory
  function createVaultForInitializedPool(address token0, address token1) external override onlyAdministrator returns (address) {
    IAlgebraFactory factory = IAlgebraFactory(algebraFactory);

    address pool = factory.poolByPair(token0, token1);
    require(pool != address(0), 'Pool not exist');

    return _createVault(pool);
  }

  /// @inheritdoc IAlgebraVeVaultFactory
  function setDefaultCommunityVault(address newDefaultCommunityVault) external override onlyAdministrator {
    require(defaultCommunityVault != newDefaultCommunityVault);
    defaultCommunityVault = newDefaultCommunityVault;
    emit DefaultCommunityVault(newDefaultCommunityVault);
  }

  function _createVault(address pool) internal returns (address) {
    require(vaultByPool[pool] == address(0), 'Already created');
    IAlgebraVeVault vault = new AlgebraVeVault(algebraFactory);
    vaultByPool[pool] = address(vault);
    return address(vault);
  }
}
