// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;
pragma abicoder v2;

import '../interfaces/vault/IAlgebraVaultFactory.sol';

/// @title Algebra vault factory stub
/// @notice This contract is used to set AlgebraCommunityVault as communityVault in new pools
contract FaultyVaultFactoryStub is IAlgebraVaultFactory {
  /// @notice the address of AlgebraCommunityVault
  address public immutable defaultAlgebraCommunityVault;

  constructor(address _algebraCommunityVault) {
    defaultAlgebraCommunityVault = _algebraCommunityVault;
  }

  /// @inheritdoc IAlgebraVaultFactory
  function getVaultForPool(address) external view override returns (address) {
    return defaultAlgebraCommunityVault;
  }

  /// @inheritdoc IAlgebraVaultFactory
  function createVaultForPool(address, address, address, address, address) external view override returns (address) {
    return defaultAlgebraCommunityVault;
  }

  /// @inheritdoc IAlgebraVaultFactory
  function getFees(uint256) external pure override returns (uint256, uint256, uint256) {
    return (0, 0, 0);
  }

  /// @inheritdoc IAlgebraVaultFactory
  function getFeesReceivers() external pure override returns (address, address, address) {
    return (address(0), address(0), address(0));
  }

  /// @inheritdoc IAlgebraVaultFactory
  function withdrawFromVault(address, address[] calldata, address[][] calldata, uint256[][] calldata) external pure override {}

  /// @inheritdoc IAlgebraVaultFactory
  function withdrawFromVaultWithPools(address, address[] calldata, address[][] calldata, uint256[][] calldata) external pure override {}

  /// @inheritdoc IAlgebraVaultFactory
  function setVoter(address) external pure override {}

  /// @inheritdoc IAlgebraVaultFactory
  function setTreasury(address) external pure override {}

  /// @inheritdoc IAlgebraVaultFactory
  function setTreasuryShare(uint32) external pure override {}

  /// @inheritdoc IAlgebraVaultFactory
  function setNftShare(uint16) external pure override {}

  /// @inheritdoc IAlgebraVaultFactory
  function setNftFeeReceiver(address) external pure override {}

  /// @inheritdoc IAlgebraVaultFactory
  function setAlgebraShare(uint32) external pure override {}

  /// @inheritdoc IAlgebraVaultFactory
  function setAlgebraFeeReceiver(address) external pure override {}

  /// @inheritdoc IAlgebraVaultFactory
  function setCommunityFee(address, uint16) external pure override {}
}
