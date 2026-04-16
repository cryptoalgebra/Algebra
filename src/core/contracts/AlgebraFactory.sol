// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './libraries/Constants.sol';

import './interfaces/IAlgebraFactory.sol';
import './interfaces/IAlgebraPool.sol';
import './interfaces/IAlgebraPoolDeployer.sol';
import './interfaces/vault/IAlgebraVaultFactory.sol';
import './interfaces/plugin/IAlgebraPluginFactory.sol';

import './AlgebraCommunityVault.sol';
import './AlgebraPoolExtension.sol';

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import {ReentrancyGuard as OZReentrancyGuard} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';

/// @title Algebra factory
/// @notice Is used to deploy pools and its plugins
/// @dev Version: Algebra Integral 1.3
contract AlgebraFactory is IAlgebraFactory, Ownable2Step, AccessControlEnumerable, OZReentrancyGuard {
  /// @inheritdoc IAlgebraFactory
  bytes32 public constant override POOLS_ADMINISTRATOR_ROLE = keccak256('POOLS_ADMINISTRATOR'); // it`s here for the public visibility of the value

  /// @inheritdoc IAlgebraFactory
  bytes32 public constant override CUSTOM_POOL_DEPLOYER = keccak256('CUSTOM_POOL_DEPLOYER');

  /// @inheritdoc IAlgebraFactory
  address public immutable override poolDeployer;

  /// @inheritdoc IAlgebraFactory
  address public immutable poolExtension;

  /// @inheritdoc IAlgebraFactory
  uint16 public override defaultCommunityFee;

  /// @inheritdoc IAlgebraFactory
  uint16 public override defaultFee;

  /// @inheritdoc IAlgebraFactory
  int24 public override defaultTickspacing;

  /// @inheritdoc IAlgebraFactory
  uint256 public override renounceOwnershipStartTimestamp;

  /// @dev time delay before ownership renouncement can be finished
  uint256 private constant RENOUNCE_OWNERSHIP_DELAY = 1 days;

  /// @inheritdoc IAlgebraFactory
  IAlgebraPluginFactory public defaultPluginFactory;

  /// @inheritdoc IAlgebraFactory
  IAlgebraVaultFactory public vaultFactory;

  /// @inheritdoc IAlgebraFactory
  address public override defaultAlgebraFeeReceiver;

  /// @inheritdoc IAlgebraFactory
  address public override algebraFeeManager;

  /// @inheritdoc IAlgebraFactory
  uint16 public override defaultAlgebraFee;

  /// @inheritdoc IAlgebraFactory
  mapping(address => uint16) public override proposedAlgebraFee;

  /// @inheritdoc IAlgebraFactory
  mapping(address => mapping(address => address)) public override poolByPair;

  /// @inheritdoc IAlgebraFactory
  mapping(address => mapping(address => mapping(address => address))) public override customPoolByPair;

  /// @inheritdoc IAlgebraFactory
  /// @dev keccak256 of AlgebraPool init bytecode. Used to compute pool address deterministically
  bytes32 public constant POOL_INIT_CODE_HASH = 0x2f10586b808bd53ba2ef453a3094f21c0b3f95b0734830ddc3d393bd9d2fcdbf;

  modifier onlyAlgebraFeeManager() {
    require(msg.sender == algebraFeeManager, 'only algebra fee manager');
    _;
  }

  constructor(address _poolDeployer) {
    require(_poolDeployer != address(0));
    poolDeployer = _poolDeployer;
    poolExtension = address(new AlgebraPoolExtension());
    defaultTickspacing = Constants.INIT_DEFAULT_TICK_SPACING;
    defaultFee = Constants.INIT_DEFAULT_FEE;

    emit DefaultTickspacing(Constants.INIT_DEFAULT_TICK_SPACING);
    emit DefaultFee(Constants.INIT_DEFAULT_FEE);
  }

  /// @inheritdoc IAlgebraFactory
  function owner() public view override(IAlgebraFactory, Ownable) returns (address) {
    return super.owner();
  }

  /// @inheritdoc IAlgebraFactory
  function hasRoleOrOwner(bytes32 role, address account) public view override returns (bool) {
    return (owner() == account || super.hasRole(role, account));
  }

  /// @inheritdoc IAlgebraFactory
  function defaultConfigurationForPool() external view override returns (uint16 communityFee, int24 tickSpacing, uint16 fee, uint16 algebraFee) {
    return (defaultCommunityFee, defaultTickspacing, defaultFee, defaultAlgebraFee);
  }

  /// @inheritdoc IAlgebraFactory
  function computePoolAddress(address token0, address token1) public view override returns (address pool) {
    pool = address(uint160(uint256(keccak256(abi.encodePacked(hex'ff', poolDeployer, keccak256(abi.encode(token0, token1)), POOL_INIT_CODE_HASH)))));
  }

  /// @inheritdoc IAlgebraFactory
  function computeCustomPoolAddress(address deployer, address token0, address token1) public view override returns (address customPool) {
    customPool = address(
      uint160(uint256(keccak256(abi.encodePacked(hex'ff', poolDeployer, keccak256(abi.encode(deployer, token0, token1)), POOL_INIT_CODE_HASH))))
    );
  }

  /// @inheritdoc IAlgebraFactory
  function createPool(address tokenA, address tokenB, bytes calldata data) external override nonReentrant returns (address pool) {
    return _createPool(address(0), msg.sender, tokenA, tokenB, data);
  }

  /// @inheritdoc IAlgebraFactory
  function createCustomPool(
    address deployer,
    address creator,
    address tokenA,
    address tokenB,
    bytes calldata data
  ) external override nonReentrant returns (address customPool) {
    require(hasRole(CUSTOM_POOL_DEPLOYER, msg.sender), 'Can`t create custom pools');
    return _createPool(deployer, creator, tokenA, tokenB, data);
  }

  function _createPool(address deployer, address creator, address tokenA, address tokenB, bytes memory data) private returns (address pool) {
    require(tokenA != tokenB);
    (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    require(token0 != address(0));

    mapping(address => mapping(address => address)) storage _poolByPair = deployer == address(0) ? poolByPair : customPoolByPair[deployer];
    require(_poolByPair[token0][token1] == address(0));

    address plugin;
    if (deployer == address(0)) {
      if (address(defaultPluginFactory) != address(0)) {
        plugin = defaultPluginFactory.beforeCreatePoolHook(computePoolAddress(token0, token1), creator, address(0), token0, token1, data);
      }
    } else {
      plugin = IAlgebraPluginFactory(msg.sender).beforeCreatePoolHook(
        computeCustomPoolAddress(deployer, token0, token1),
        creator,
        deployer,
        token0,
        token1,
        data
      );
    }

    pool = IAlgebraPoolDeployer(poolDeployer).deploy(plugin, token0, token1, deployer);

    if (deployer == address(0)) {
      if (address(defaultPluginFactory) != address(0)) {
        defaultPluginFactory.afterCreatePoolHook(plugin, pool, deployer);
      }
    } else {
      IAlgebraPluginFactory(msg.sender).afterCreatePoolHook(plugin, pool, deployer);
    }

    _poolByPair[token0][token1] = pool;
    _poolByPair[token1][token0] = pool;

    if (deployer == address(0)) {
      emit Pool(token0, token1, pool);
    } else {
      emit CustomPool(deployer, token0, token1, pool);
    }

    if (address(vaultFactory) != address(0)) {
      address vault = vaultFactory.createVaultForPool(pool, creator, deployer, token0, token1);
      IAlgebraPool(pool).setCommunityVault(vault);
    }

    address _defaultAlgebraFeeReceiver = defaultAlgebraFeeReceiver;
    if (_defaultAlgebraFeeReceiver != address(0)) {
      IAlgebraPool(pool).setAlgebraFeeReceiver(_defaultAlgebraFeeReceiver);
    }
  }

  /// @inheritdoc IAlgebraFactory
  function setDefaultCommunityFee(uint16 newDefaultCommunityFee) external override onlyOwner {
    require(newDefaultCommunityFee <= Constants.MAX_COMMUNITY_FEE);
    require(defaultCommunityFee != newDefaultCommunityFee);
    if (newDefaultCommunityFee != 0) require(address(vaultFactory) != address(0));
    defaultCommunityFee = newDefaultCommunityFee;
    emit DefaultCommunityFee(newDefaultCommunityFee);
  }

  /// @inheritdoc IAlgebraFactory
  function setDefaultFee(uint16 newDefaultFee) external override onlyOwner {
    require(newDefaultFee <= Constants.MAX_DEFAULT_FEE);
    require(defaultFee != newDefaultFee);
    defaultFee = newDefaultFee;
    emit DefaultFee(newDefaultFee);
  }

  /// @inheritdoc IAlgebraFactory
  function setDefaultTickspacing(int24 newDefaultTickspacing) external override onlyOwner {
    require(newDefaultTickspacing >= Constants.MIN_TICK_SPACING);
    require(newDefaultTickspacing <= Constants.MAX_TICK_SPACING);
    require(newDefaultTickspacing != defaultTickspacing);
    defaultTickspacing = newDefaultTickspacing;
    emit DefaultTickspacing(newDefaultTickspacing);
  }

  /// @inheritdoc IAlgebraFactory
  function setDefaultPluginFactory(address newDefaultPluginFactory) external override onlyOwner {
    require(newDefaultPluginFactory != address(defaultPluginFactory));
    defaultPluginFactory = IAlgebraPluginFactory(newDefaultPluginFactory);
    emit DefaultPluginFactory(newDefaultPluginFactory);
  }

  /// @inheritdoc IAlgebraFactory
  function setVaultFactory(address newVaultFactory) external override onlyOwner {
    require(newVaultFactory != address(vaultFactory));
    if (newVaultFactory == address(0)) require(defaultCommunityFee == 0);
    vaultFactory = IAlgebraVaultFactory(newVaultFactory);
    emit VaultFactory(newVaultFactory);
  }

  /// @inheritdoc IAlgebraFactory
  function startRenounceOwnership() external override onlyOwner {
    require(renounceOwnershipStartTimestamp == 0);
    renounceOwnershipStartTimestamp = block.timestamp;
    emit RenounceOwnershipStart(renounceOwnershipStartTimestamp, renounceOwnershipStartTimestamp + RENOUNCE_OWNERSHIP_DELAY);
  }

  /// @inheritdoc IAlgebraFactory
  function stopRenounceOwnership() external override onlyOwner {
    require(renounceOwnershipStartTimestamp != 0);
    renounceOwnershipStartTimestamp = 0;
    emit RenounceOwnershipStop(block.timestamp);
  }

  /// @dev Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore.
  /// Can only be called by the current owner if RENOUNCE_OWNERSHIP_DELAY seconds
  /// have passed since the call to the startRenounceOwnership() function.
  function renounceOwnership() public override onlyOwner {
    require(renounceOwnershipStartTimestamp != 0);
    require(block.timestamp - renounceOwnershipStartTimestamp >= RENOUNCE_OWNERSHIP_DELAY);
    renounceOwnershipStartTimestamp = 0;

    super.renounceOwnership();
    emit RenounceOwnershipFinish(block.timestamp);
  }

  /// @inheritdoc IAlgebraFactory
  function setDefaultAlgebraFee(uint16 newDefaultAlgebraFee) external override onlyAlgebraFeeManager {
    require(newDefaultAlgebraFee <= Constants.MAX_COMMUNITY_FEE);
    require(newDefaultAlgebraFee != defaultAlgebraFee);
    defaultAlgebraFee = newDefaultAlgebraFee;
    emit DefaultAlgebraFee(newDefaultAlgebraFee);
  }

  /// @inheritdoc IAlgebraFactory
  function setAlgebraFeeReceiver(address pool, address newAlgebraFeeReceiver) external override onlyAlgebraFeeManager {
    IAlgebraPool(pool).setAlgebraFeeReceiver(newAlgebraFeeReceiver);
  }

  /// @inheritdoc IAlgebraFactory
  function setDefaultAlgebraFeeReceiver(address newDefaultAlgebraFeeReceiver) external override onlyAlgebraFeeManager {
    require(newDefaultAlgebraFeeReceiver != defaultAlgebraFeeReceiver);
    defaultAlgebraFeeReceiver = newDefaultAlgebraFeeReceiver;
    emit DefaultAlgebraFeeReceiver(newDefaultAlgebraFeeReceiver);
  }

  /// @inheritdoc IAlgebraFactory
  function proposeAlgebraFee(address pool, uint16 newAlgebraFee) external override onlyAlgebraFeeManager {
    require(newAlgebraFee <= Constants.MAX_COMMUNITY_FEE);
    proposedAlgebraFee[pool] = newAlgebraFee;
    emit AlgebraFeeProposal(pool, newAlgebraFee);
  }

  /// @inheritdoc IAlgebraFactory
  function cancelAlgebraFeeProposal(address pool) external override onlyAlgebraFeeManager {
    delete proposedAlgebraFee[pool];
    emit CancelAlgebraFeeProposal(pool);
  }

  /// @inheritdoc IAlgebraFactory
  function acceptAlgebraFee(address pool) external override {
    require(hasRoleOrOwner(POOLS_ADMINISTRATOR_ROLE, msg.sender), 'only administrator');
    uint16 newAlgebraFee = proposedAlgebraFee[pool];
    delete proposedAlgebraFee[pool];
    IAlgebraPool(pool).setAlgebraFee(newAlgebraFee);
  }

  /// @inheritdoc IAlgebraFactory
  function transferAlgebraFeeManagerRole(address _newAlgebraFeeManager) external override {
    require(msg.sender == algebraFeeManager || (algebraFeeManager == address(0) && msg.sender == owner()), 'not allowed');
    algebraFeeManager = _newAlgebraFeeManager;
    emit AlgebraFeeManager(_newAlgebraFeeManager);
  }

  /// @dev Transfers ownership of the contract to a new account (`newOwner`).
  /// Modified to fit with the role mechanism.
  function _transferOwnership(address newOwner) internal override {
    _revokeRole(DEFAULT_ADMIN_ROLE, owner());
    super._transferOwnership(newOwner);
    if (owner() != address(0)) {
      _grantRole(DEFAULT_ADMIN_ROLE, owner());
    }
  }
  
}
