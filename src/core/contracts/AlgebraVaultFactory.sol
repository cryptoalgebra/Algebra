// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './interfaces/IAlgebraVaultFactory.sol';
import './interfaces/IAlgebraPool.sol';
import './AlgebraVault.sol';
import './libraries/Constants.sol';

/// @title Algebra vault factory
/// @notice This contract creates Algebra vaults for Algebra pools
contract AlgebraVaultFactory is IAlgebraVaultFactory {
  /// @inheritdoc IAlgebraVaultFactory
  address public immutable override algebraFactory;

  /// @inheritdoc IAlgebraVaultFactory
  address public override defaultCommunityVault;
  /// @inheritdoc IAlgebraVaultFactory
  mapping(address poolAddress => address vaultAddress) public override vaultByPool;

  modifier onlyAdministrator() {
    require(IAlgebraFactory(algebraFactory).hasRoleOrOwner(Constants.POOLS_ADMINISTRATOR_ROLE, msg.sender), 'Only administrator');
    _;
  }

  constructor(address _algebraFactory) {
    algebraFactory = _algebraFactory;
  }

  function getVaultForPool(address pool) external view override returns (address communityVault) {
    if (defaultCommunityVault == address(0)) {
      communityVault = vaultByPool[pool];
    } else {
      communityVault = defaultCommunityVault;
    }
  }

  /// @inheritdoc IAlgebraVaultFactory
  function createVault(address pool) external override returns (address) {
    require(msg.sender == algebraFactory);
    return _createVault(pool);
  }

  /// @inheritdoc IAlgebraVaultFactory
  function createVaultForExistingPool(address token0, address token1) external override onlyAdministrator returns (address) {
    IAlgebraFactory factory = IAlgebraFactory(algebraFactory);

    address pool = factory.poolByPair(token0, token1);
    require(pool != address(0), 'Pool not exist');

    return _createVault(pool);
  }

  /// @inheritdoc IAlgebraVaultFactory
  function setDefaultCommunityVault(address newDefaultCommunityVault) external override onlyAdministrator {
    require(defaultCommunityVault != newDefaultCommunityVault);
    defaultCommunityVault = newDefaultCommunityVault;
    emit DefaultCommunityVault(newDefaultCommunityVault);
  }

  function _createVault(address pool) internal returns (address) {
    require(vaultByPool[pool] == address(0), 'Already created');
    IAlgebraVault vault = new AlgebraVault(algebraFactory);
    vaultByPool[pool] = address(vault);
    return address(vault);
  }
}
