// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;
pragma abicoder v2;

import '../../interfaces/IAlgebraFactory.sol';
import '../../interfaces/IAlgebraPoolDeployer.sol';
import '../../interfaces/IDataStorageOperator.sol';
import '../../base/AlgebraFeeConfiguration.sol';
import '../../libraries/Constants.sol';
import '../../libraries/AdaptiveFee.sol';
import '../../DataStorageOperator.sol';

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/access/AccessControlEnumerable.sol';

/**
 * @title Algebra factory for simulation
 * @notice Is used to deploy pools and its dataStorages
 */
contract SimulationTimeFactory is IAlgebraFactory, Ownable2Step, AccessControlEnumerable {
  /// @inheritdoc IAlgebraFactory
  bytes32 public constant override POOLS_ADMINISTRATOR_ROLE = keccak256('POOLS_ADMINISTRATOR');

  /// @inheritdoc IAlgebraFactory
  address public immutable override poolDeployer;

  /// @inheritdoc IAlgebraFactory
  address public override farmingAddress;

  /// @inheritdoc IAlgebraFactory
  address public override communityVault;

  /// @inheritdoc IAlgebraFactory
  uint8 public override defaultCommunityFee;

  /// @inheritdoc IAlgebraFactory
  uint256 public override renounceOwnershipStartTimestamp;

  uint256 private constant RENOUNCE_OWNERSHIP_DELAY = 1 days;

  // values of constants for sigmoids in fee calculation formula
  AlgebraFeeConfiguration public defaultFeeConfiguration;
  /// @inheritdoc IAlgebraFactory
  mapping(address => mapping(address => address)) public override poolByPair;

  constructor(address _poolDeployer, address _vaultAddress) {
    poolDeployer = _poolDeployer;
    communityVault = _vaultAddress;
    defaultFeeConfiguration = AdaptiveFee.initialFeeConfiguration();
  }

  function owner() public view override(IAlgebraFactory, Ownable) returns (address) {
    return super.owner();
  }

  /// @inheritdoc IAlgebraFactory
  function hasRoleOrOwner(bytes32 role, address account) public view override returns (bool) {
    return (owner() == account || super.hasRole(role, account));
  }

  /// @inheritdoc IAlgebraFactory
  function createPool(address tokenA, address tokenB) external override returns (address pool) {
    require(tokenA != tokenB);
    (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    require(token0 != address(0));
    require(poolByPair[token0][token1] == address(0));

    IDataStorageOperator dataStorage = new DataStorageOperator(computeAddress(token0, token1));
    dataStorage.changeFeeConfiguration(defaultFeeConfiguration);

    pool = IAlgebraPoolDeployer(poolDeployer).deploy(address(dataStorage), token0, token1);

    poolByPair[token0][token1] = pool; // to avoid future addresses comparing we are populating the mapping twice
    poolByPair[token1][token0] = pool;
    emit Pool(token0, token1, pool);
  }

  /// @inheritdoc IAlgebraFactory
  function startRenounceOwnership() external override onlyOwner {
    renounceOwnershipStartTimestamp = block.timestamp;
    emit RenounceOwnershipStart(renounceOwnershipStartTimestamp, renounceOwnershipStartTimestamp + RENOUNCE_OWNERSHIP_DELAY);
  }

  /// @inheritdoc IAlgebraFactory
  function stopRenounceOwnership() external override onlyOwner {
    require(renounceOwnershipStartTimestamp != 0);
    renounceOwnershipStartTimestamp = 0;
    emit RenounceOwnershipStop(block.timestamp);
  }

  /**
   * @dev Leaves the contract without owner. It will not be possible to call
   * `onlyOwner` functions anymore. Can only be called by the current owner if RENOUNCE_OWNERSHIP_DELAY seconds
   * have passed since the call to the startRenounceOwnership() function.
   *
   * NOTE: Renouncing ownership will leave the factory without an owner,
   * thereby removing any functionality that is only available to the owner.
   */
  function renounceOwnership() public override onlyOwner {
    require(block.timestamp - renounceOwnershipStartTimestamp >= RENOUNCE_OWNERSHIP_DELAY);
    renounceOwnershipStartTimestamp = 0;

    super.renounceOwnership();
    emit RenounceOwnershipFinish(block.timestamp);
  }

  /// @inheritdoc IAlgebraFactory
  function setFarmingAddress(address _farmingAddress) external override onlyOwner {
    require(farmingAddress != _farmingAddress);
    emit FarmingAddress(_farmingAddress);
    farmingAddress = _farmingAddress;
  }

  function setVaultAddress(address _vaultAddress) external onlyOwner {
    require(communityVault != _vaultAddress);
    communityVault = _vaultAddress;
  }

  /// @inheritdoc IAlgebraFactory
  function setDefaultFeeConfiguration(AlgebraFeeConfiguration calldata newConfig) external override onlyOwner {
    AdaptiveFee.validateFeeConfiguration(newConfig);
    defaultFeeConfiguration = newConfig;
    emit DefaultFeeConfiguration(newConfig);
  }

  /// @inheritdoc IAlgebraFactory
  function setDefaultCommunityFee(uint8 newDefaultCommunityFee) external override onlyOwner {
    require(newDefaultCommunityFee <= Constants.MAX_COMMUNITY_FEE);
    emit DefaultCommunityFee(newDefaultCommunityFee);
    defaultCommunityFee = newDefaultCommunityFee;
  }

  bytes32 private constant POOL_INIT_CODE_HASH = 0x716c94dafd39c0ac909b7dc3abed963efa3a76da9ac57b358f1f3cee0295fccd;

  /// @notice Deterministically computes the pool address given the token0 and token1
  /// @param token0 first token
  /// @param token1 second token
  /// @return pool The contract address of the Algebra pool
  function computeAddress(address token0, address token1) private view returns (address pool) {
    pool = address(uint160(uint256(keccak256(abi.encodePacked(hex'ff', poolDeployer, keccak256(abi.encode(token0, token1)), POOL_INIT_CODE_HASH)))));
  }
}
