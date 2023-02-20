// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IAlgebraFactory.sol';
import './interfaces/IAlgebraPoolDeployer.sol';
import './interfaces/IDataStorageOperator.sol';
import './interfaces/IAlgebraFeeConfiguration.sol';
import './libraries/Constants.sol';
import './DataStorageOperator.sol';
import './AlgebraCommunityVault.sol';

/**
 * @title Algebra factory
 * @notice Is used to deploy pools and its dataStorages
 */
contract AlgebraFactory is IAlgebraFactory {
  address private _pendingOwner;
  /// @inheritdoc IAlgebraFactory
  address public override owner;

  /// @inheritdoc IAlgebraFactory
  address public immutable override poolDeployer;

  /// @inheritdoc IAlgebraFactory
  address public immutable override communityVault;

  /// @inheritdoc IAlgebraFactory
  address public override farmingAddress;

  /// @inheritdoc IAlgebraFactory
  uint8 public override defaultCommunityFee;

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

  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  constructor(address _poolDeployer) {
    require(_poolDeployer != address(0));
    owner = msg.sender;
    emit Owner(msg.sender);

    poolDeployer = _poolDeployer;
    communityVault = address(new AlgebraCommunityVault());
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
  function setOwner(address _owner) external override onlyOwner {
    require(msg.sender != _owner);
    require(_owner != address(0), 'Cannot set 0 address as owner');
    _pendingOwner = _owner;
  }

  /// @inheritdoc IAlgebraFactory
  function acceptOwnership() external override {
    require(_pendingOwner == msg.sender, 'Caller is not the new owner');
    owner = _pendingOwner;
    delete _pendingOwner;
    emit Owner(owner);
  }

  /// @inheritdoc IAlgebraFactory
  function renounceOwnership() external override onlyOwner {
    // TODO MB ADD TIMELOCK
    delete owner;
    delete _pendingOwner;
    emit Owner(address(0));
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

  bytes32 private constant POOL_INIT_CODE_HASH = 0x6c4f5f9499cf10cb53b5cb77d4c9862a71912b9f690a0aae9f07a88579aaa301;

  /// @notice Deterministically computes the pool address given the factory and PoolKey
  /// @param token0 first token
  /// @param token1 second token
  /// @return pool The contract address of the Algebra pool
  function _computeAddress(address token0, address token1) private view returns (address pool) {
    pool = address(uint256(keccak256(abi.encodePacked(hex'ff', poolDeployer, keccak256(abi.encode(token0, token1)), POOL_INIT_CODE_HASH))));
  }
}
