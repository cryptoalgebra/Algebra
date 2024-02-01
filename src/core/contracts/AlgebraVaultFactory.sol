// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './interfaces/IAlgebraVaultFactory.sol';

/// @title Algebra vault factory stub
/// @notice This contract is used to set AlgebraCommunityVault as communityVault in new pools
contract AlgebraVaultFactoryStub is IAlgebraVaultFactory {
  /// @notice the address of AlgebraCommunityVault
  address public immutable defaultAlgebraCommunityVault;

  constructor(address _algebraCommunityVault) {
    require(_algebraCommunityVault != address(0));
    defaultAlgebraCommunityVault = _algebraCommunityVault;
  }

  /// @inheritdoc IAlgebraVaultFactory
  function getVaultForPool(address) external view override returns (address) {
    return defaultAlgebraCommunityVault;
  }

  /// @inheritdoc IAlgebraVaultFactory
  function createVaultForPool(address) external view override returns (address) {
    return defaultAlgebraCommunityVault;
  }
}
