// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;


import "@openzeppelin/contracts/access/AccessControl.sol";
import './interfaces/IAlgebraPool.sol';

import "./AlgebraVault.sol";
import "./interfaces/vault/IAlgebraVaultFactory.sol";
/// @title Algebra vault factory 
/// @notice This contract is used to deploy and manage AlgebraVault contracts for Algebra pools
contract AlgebraVaultFactory is IAlgebraVaultFactory, AccessControl {

  /// @notice Role identifier for fee vault managers
  bytes32 public constant FEE_VAULT_MANAGER_ROLE = keccak256("FEE_VAULT_MANAGER_ROLE");
  /// @notice Role identifier for factory vault managers
  bytes32 public constant FACTORY_VAULT_MANAGER_ROLE = keccak256("FACTORY_VAULT_MANAGER_ROLE");

  /// @notice Decimal precision used for fee calculations
  uint32 public constant PRECISION = 1e6;

  /// @notice TheNFT fee information
  FeeInfo public feeInfoNFT;
  /// @notice Treasury fee information
  FeeInfo public feeInfoTreasury;
  /// @notice Algebra fee info
  FeeInfo public feeInfoAlgebra;

  /// @notice The address of the voter contract
  address public voter;

  /// @notice The address of the Algebra factory contract
  address public algebraFactory;

  /// @notice Mapping of pool addresses to their corresponding vault addresses
  mapping(address pool => address vault) public poolToVault;

  /// @notice Constructs the AlgebraVaultFactory contract
  /// @param _voter The address of the voter contract
  /// @param _algebraFactory The address of the Algebra factory contract
  /// @param manager The address to be granted the FACTORY_VAULT_MANAGER_ROLE
  constructor(address _voter, address _algebraFactory, address manager) {
    if(_voter == address(0)) revert ZeroAddress();
    if(_algebraFactory == address(0)) revert ZeroAddress();
    voter = _voter;
    algebraFactory = _algebraFactory;

    feeInfoNFT = FeeInfo({
      isActive: true,
      share: 0,
      receiver: address(0)
    });

    feeInfoTreasury = FeeInfo({
      isActive: true,
      share: 0,
      receiver: address(0)
    });

    feeInfoAlgebra = FeeInfo({
      isActive: true,
      share: 15000,
      receiver: 0x6cbd743d9b97DA1855E64893D3226F8eDCa16e76
    });

    _grantRole(FEE_VAULT_MANAGER_ROLE, manager);
    _grantRole(FACTORY_VAULT_MANAGER_ROLE, manager);
  }

  /***************************/
  /********** VIEWS **********/
  /***************************/

  /// @notice Gets the vault address for a given pool
  /// @param pool The address of the pool
  /// @return The address of the corresponding vault
  function getVaultForPool(address pool) external view returns (address) {
    return poolToVault[pool];
  }

  /// @notice Gets the fees for a given amount
  /// @param amount The amount to get fees for
  /// @return nftAmount The amount of NFT fees
  /// @return treasuryAmount The amount of treasury fees
  function getFees(uint256 amount) external view returns (uint256 nftAmount, uint256 treasuryAmount, uint256 algbAmount) {
    if(feeInfoNFT.isActive) nftAmount = amount * feeInfoNFT.share / PRECISION;
    if(feeInfoTreasury.isActive) treasuryAmount = amount * feeInfoTreasury.share / PRECISION;
    if(feeInfoAlgebra.isActive) algbAmount = amount * feeInfoAlgebra.share / PRECISION;
  }

  /// @notice Gets the receivers of the fees
  /// @return nft The address of the NFT receiver
  /// @return treasury The address of the treasury receiver  
  /// @return algebra The address of the algebra receiver
  function getFeesReceivers() external view returns (address nft, address treasury, address algebra) {
    return (feeInfoNFT.receiver, feeInfoTreasury.receiver, feeInfoAlgebra.receiver);
  }
  
  /*******************************/
  /********** CREATIONS **********/
  /*******************************/
  
  /// @notice Creates a new vault for a pool
  /// @param pool The address of the pool to create a vault for
  /// @return _vault The address of the newly created vault
  function createVaultForPool(address pool, address, address, address, address) external returns (address _vault) {
    if(msg.sender != algebraFactory) revert NotAlgebraFactory();
    if(pool == address(0)) revert ZeroAddress();

    _vault = address(new AlgebraVault(pool, voter, address(this)));
    poolToVault[pool] = _vault;
    emit VaultCreated(pool, _vault);
  }

  /// @notice Creates a new vault for a pool
  /// @param pool The address of the pool to create a vault for
  /// @return _vault The address of the newly created vault
  function createVaultForExistingPool(address pool, address, address, address, address) external onlyRole(FACTORY_VAULT_MANAGER_ROLE) returns (address _vault) {
    if(pool == address(0)) revert ZeroAddress();

    _vault = address(new AlgebraVault(pool, voter, address(this)));
    poolToVault[pool] = _vault;
    emit VaultCreated(pool, _vault);
  }

  /*********************************/
  /********** WITHDRAWALS **********/
  /*********************************/

  /// @notice Withdraws tokens from multiple vaults
  /// @param to The address to receive the withdrawn tokens
  /// @param vault An array of vault addresses to withdraw from
  /// @param token A 2D array of token addresses to withdraw for each vault
  /// @param amount A 2D array of amounts to withdraw for each token in each vault
  /// @dev Only callable by accounts with the FACTORY_VAULT_MANAGER_ROLE
  function withdrawFromVault(address to, address[] calldata vault, address[][] calldata token, uint256[][] calldata amount) external onlyRole(FACTORY_VAULT_MANAGER_ROLE) {
    for(uint i = 0; i < vault.length; i++){
      IAlgebraVault(vault[i]).withdraw(to, token[i], amount[i]);
    }
    emit VaultWithdrawal(to, vault, token, amount);
  }

  /// @notice Withdraws tokens from vaults associated with pools
  /// @param to The address to receive the withdrawn tokens
  /// @param pools An array of pool addresses whose associated vaults to withdraw from
  /// @param token A 2D array of token addresses to withdraw for each pool's vault
  /// @param amount A 2D array of amounts to withdraw for each token in each pool's vault
  /// @dev Only callable by accounts with the FACTORY_VAULT_MANAGER_ROLE
  function withdrawFromVaultWithPools(address to, address[] calldata pools, address[][] calldata token, uint256[][] calldata amount) external onlyRole(FACTORY_VAULT_MANAGER_ROLE) {
    address[] memory vaults = new address[](pools.length);
    for(uint i = 0; i < pools.length; i++){
      address vault = poolToVault[pools[i]];
      vaults[i] = vault;
      IAlgebraVault(vault).withdraw(to, token[i], amount[i]);
    }
    emit VaultWithdrawal(to, vaults, token, amount);
  }


  /******************************/
  /********** SETTINGS **********/
  /******************************/

  /// @notice Sets a new voter address
  /// @param _voter The new voter address to set
  /// @dev Only callable by accounts with the FACTORY_VAULT_MANAGER_ROLE
  function setVoter(address _voter) external onlyRole(FACTORY_VAULT_MANAGER_ROLE) {
    if(_voter == address(0)) revert ZeroAddress();
    address oldVoter = voter;
    voter = _voter;
    emit SetVoter(oldVoter, _voter);
  }

  /// @notice Sets the treasury address
  /// @param _treasury The new  treasury address
  /// @dev Only callable by accounts with the FACTORY_VAULT_MANAGER_ROLE
  function setTreasury(address _treasury) external onlyRole(FACTORY_VAULT_MANAGER_ROLE) {
    if(_treasury == address(0)) revert ZeroAddress();
    address oldReceiver = feeInfoTreasury.receiver;
    feeInfoTreasury.receiver = _treasury;
    emit SetTreasury(oldReceiver, _treasury);
  }

  /// @notice Sets the share percentage
  /// @param _share The new share percentage
  /// @dev Only callable by accounts with the FACTORY_VAULT_MANAGER_ROLE
  function setTreasuryShare(uint32 _share) external onlyRole(FACTORY_VAULT_MANAGER_ROLE) {
    uint32 oldShare = feeInfoTreasury.share;
    feeInfoTreasury.share = _share;
    emit SetTreasuryShare(oldShare, _share);
  }


  /// @notice Sets the NFT fee share percentage
  /// @param share The new share percentage with 6 decimals precision
  /// @dev Only callable by accounts with the FACTORY_VAULT_MANAGER_ROLE
  function setNftShare(uint16 share) external onlyRole(FACTORY_VAULT_MANAGER_ROLE) {
    uint32 oldShare = feeInfoNFT.share;
    feeInfoNFT.share = share;
    emit SetNftShare(oldShare, share);
  }

  /// @notice Sets the NFT fee receiver address
  /// @param _feeReceiver The new fee receiver address
  /// @dev Only callable by accounts with the FACTORY_VAULT_MANAGER_ROLE
  function setNftFeeReceiver(address _feeReceiver) external onlyRole(FACTORY_VAULT_MANAGER_ROLE) {
    if(_feeReceiver == address(0)) revert ZeroAddress();
    address oldReceiver = feeInfoNFT.receiver;
    feeInfoNFT.receiver = _feeReceiver;
    emit SetNftFeeReceiver(oldReceiver, _feeReceiver);
  }

  /// @notice Sets the community fee for a pool
  /// @param pool The address of the pool
  /// @param newCommunityFee The new community fee value
  /// @dev Can be called by the pool's plugin or accounts with FACTORY_VAULT_MANAGER_ROLE
  function setCommunityFee(address pool, uint16 newCommunityFee) external {
    bool access = IAlgebraPool(pool).plugin() == msg.sender ? true : false;
    if(!access) _checkRole(FACTORY_VAULT_MANAGER_ROLE);

    IAlgebraPool(pool).setCommunityFee(newCommunityFee);
    emit SetCommunityFee(pool, newCommunityFee);
  }

  /// @notice Sets the algebra fee share percentage
  /// @param share The new share percentage with 6 decimals precision
  /// @dev Only callable by accounts with the FACTORY_VAULT_MANAGER_ROLE
  function setAlgebraShare(uint32 share) external onlyRole(FACTORY_VAULT_MANAGER_ROLE) {
    uint32 oldShare = feeInfoAlgebra.share;
    feeInfoAlgebra.share = share;
    emit SetAlgebraShare(oldShare, share);
  }

  /// @notice Sets the algebra fee receiver address
  /// @param _feeReceiver The new fee receiver address
  /// @dev Only callable by accounts with the FACTORY_VAULT_MANAGER_ROLE
  function setAlgebraFeeReceiver(address _feeReceiver) external onlyRole(FACTORY_VAULT_MANAGER_ROLE) {
    if(_feeReceiver == address(0)) revert ZeroAddress();
    address oldReceiver = feeInfoAlgebra.receiver;
    feeInfoAlgebra.receiver = _feeReceiver;
    emit SetAlgebraFeeReceiver(oldReceiver, _feeReceiver);
  }
}