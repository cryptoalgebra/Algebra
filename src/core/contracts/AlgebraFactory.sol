// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './interfaces/IAlgebraFactory.sol';
import './interfaces/IAlgebraPoolDeployer.sol';
import './interfaces/IDataStorageOperator.sol';
import './interfaces/IAlgebraFeeConfiguration.sol';
import './libraries/Constants.sol';
import './DataStorageOperator.sol';
import './AlgebraCommunityVault.sol';

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/access/AccessControlEnumerable.sol';

/**
 * @title Algebra factory
 * @notice Is used to deploy pools and its dataStorages
 */
contract AlgebraFactory is IAlgebraFactory, Ownable2Step, AccessControlEnumerable {
  /// @inheritdoc IAlgebraFactory
  address public immutable override poolDeployer;

  /// @inheritdoc IAlgebraFactory
  address public immutable override communityVault;

  /// @inheritdoc IAlgebraFactory
  address public override farmingAddress;

  /// @inheritdoc IAlgebraFactory
  uint8 public override defaultCommunityFee;

  /// @inheritdoc IAlgebraFactory
  uint256 public override renounceOwnershipStartTimestamp;

  uint256 private constant RENOUNCE_OWNERSHIP_DELAY = 1 days;

  // values of constants for sigmoids in fee calculation formula
  IAlgebraFeeConfiguration.Configuration public baseFeeConfiguration =
    IAlgebraFeeConfiguration.Configuration(
      3000 - Constants.BASE_FEE, // alpha1
      15000 - 3000, // alpha2
      360, // beta1
      60000, // beta2
      59, // gamma1
      8500, // gamma2
      Constants.BASE_FEE // baseFee
    );

  /// @inheritdoc IAlgebraFactory
  mapping(address => mapping(address => address)) public override poolByPair;

  constructor(address _poolDeployer) {
    require(_poolDeployer != address(0));

    poolDeployer = _poolDeployer;
    communityVault = address(new AlgebraCommunityVault());
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

    IDataStorageOperator dataStorage = new DataStorageOperator(_computeAddress(token0, token1));

    dataStorage.changeFeeConfiguration(baseFeeConfiguration);

    pool = IAlgebraPoolDeployer(poolDeployer).deploy(address(dataStorage), token0, token1);

    poolByPair[token0][token1] = pool; // to avoid future addresses comparing we are populating the mapping twice
    poolByPair[token1][token0] = pool;
    emit Pool(token0, token1, pool);
  }

  /// @inheritdoc IAlgebraFactory
  function setFarmingAddress(address _farmingAddress) external override onlyOwner {
    require(farmingAddress != _farmingAddress);
    emit FarmingAddress(_farmingAddress);
    farmingAddress = _farmingAddress;
  }

  /// @inheritdoc IAlgebraFactory
  function setDefaultCommunityFee(uint8 newDefaultCommunityFee) external override onlyOwner {
    require(newDefaultCommunityFee <= Constants.MAX_COMMUNITY_FEE);
    emit DefaultCommunityFee(newDefaultCommunityFee);
    defaultCommunityFee = newDefaultCommunityFee;
  }

  /// @inheritdoc IAlgebraFactory
  function setBaseFeeConfiguration(IAlgebraFeeConfiguration.Configuration calldata _config) external override onlyOwner {
    require(uint256(_config.alpha1) + uint256(_config.alpha2) + uint256(_config.baseFee) <= type(uint16).max, 'Max fee exceeded');
    require(_config.gamma1 != 0 && _config.gamma2 != 0, 'Gammas must be > 0');

    baseFeeConfiguration = _config;
    emit FeeConfiguration(_config.alpha1, _config.alpha2, _config.beta1, _config.beta2, _config.gamma1, _config.gamma2, _config.baseFee);
  }

  /// @inheritdoc IAlgebraFactory
  function startRenounceOwnership() external override onlyOwner {
    renounceOwnershipStartTimestamp = block.timestamp;
    emit renounceOwnershipStarted(renounceOwnershipStartTimestamp, renounceOwnershipStartTimestamp + RENOUNCE_OWNERSHIP_DELAY);
  }

  /// @inheritdoc IAlgebraFactory
  function stopRenounceOwnership() external override onlyOwner {
    require(renounceOwnershipStartTimestamp != 0);
    renounceOwnershipStartTimestamp = 0;
    emit renounceOwnershipStopped(block.timestamp);
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
    emit renounceOwnershipFinished(block.timestamp);
  }

  /**
   * @dev Transfers ownership of the contract to a new account (`newOwner`).
   * Modified to fit with the role mechanism.
   */
  function _transferOwnership(address newOwner) internal override {
    _revokeRole(DEFAULT_ADMIN_ROLE, owner());
    super._transferOwnership(newOwner);
    _grantRole(DEFAULT_ADMIN_ROLE, owner());
  }

  bytes32 private constant POOL_INIT_CODE_HASH = 0xfcc737e6ca36d97a21d1742f792285635b0c7efedc3477843ed6fa0c17a98b70;

  /// @notice Deterministically computes the pool address given the factory and PoolKey
  /// @param token0 first token
  /// @param token1 second token
  /// @return pool The contract address of the Algebra pool
  function _computeAddress(address token0, address token1) private view returns (address pool) {
    pool = address(uint160(uint256(keccak256(abi.encodePacked(hex'ff', poolDeployer, keccak256(abi.encode(token0, token1)), POOL_INIT_CODE_HASH)))));
  }
}
