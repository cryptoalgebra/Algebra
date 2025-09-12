// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title The interface for the Algebra Vault Factory
/// @notice This contract can be used for automatic vaults creation
/// @dev Version: Algebra Integral
interface IAlgebraVaultFactory {

  /// @notice Struct to store fee information
  /// @param isActive Whether the fee is active
  /// @param share The fee share percentage with 6 decimals precision
  /// @param receiver The address of the fee receiver
  struct FeeInfo {
    bool isActive;
    uint32 share;
    address receiver;
  }

  
  function getVaultForPool(address pool) external view returns (address);
  function getFees(uint256 amount) external view returns (uint256 thenftAmount, uint256 treasuryAmount, uint256 algebraAmount);
  function getFeesReceivers() external view returns (address thenft, address treasury, address algebra);
  function createVaultForPool(address pool, address, address, address, address) external returns (address _vault);
  function withdrawFromVault(address to, address[] calldata vault, address[][] calldata token, uint256[][] calldata amount) external;
  function withdrawFromVaultWithPools(address to, address[] calldata pools, address[][] calldata token, uint256[][] calldata amount) external;
  function setVoter(address _voter) external; 
  function setTreasury(address _Treasury) external;
  function setTreasuryShare(uint32 _thenaShare) external;
  function setNftShare(uint16 share) external;
  function setNftFeeReceiver(address _feeReceiver) external;
  function setAlgebraShare(uint32 share) external;
  function setAlgebraFeeReceiver(address _feeReceiver) external;
  function setCommunityFee(address pool, uint16 newCommunityFee) external;
  

  /// @notice Error thrown when a zero address is provided where a non-zero address is required
  error ZeroAddress();
  /// @notice Error thrown when caller is not the Algebra factory
  error NotAlgebraFactory();
  /// @notice Emitted when a new vault is created for a pool
  event VaultCreated(address indexed pool, address indexed vault);
  /// @notice Emitted when voter address is updated
  event SetVoter(address indexed oldVoter, address indexed newVoter);
  /// @notice Emitted when theNFT fee share is updated
  event SetNftShare(uint32 oldShare, uint32 newShare);
  /// @notice Emitted when theNFT fee receiver is updated
  event SetNftFeeReceiver(address indexed oldReceiver, address indexed newReceiver);
  /// @notice Emitted when algebra fee share is updated
  event SetAlgebraShare(uint32 oldShare, uint32 newShare);
  /// @notice Emitted when algebra fee receiver is updated
  event SetAlgebraFeeReceiver(address indexed oldReceiver, address indexed newReceiver);
  /// @notice Emitted when community fee is updated for a pool
  event SetCommunityFee(address indexed pool, uint16 newFee);
  /// @notice Emitted when tokens are withdrawn from vaults
  event VaultWithdrawal(address indexed to, address[] vaults, address[][] tokens, uint256[][] amounts);
  /// @notice Emitted when a gauge is set to a vault
  event SetGauge(address indexed pool, address indexed vault, address indexed gauge);
  /// @notice Emitted when the thena treasury address is updated
  event SetTreasury(address indexed oldTreasury, address indexed newTreasury);
  /// @notice Emitted when the thena share percentage is updated
  event SetTreasuryShare(uint32 indexed oldShare, uint32 indexed newShare);

}