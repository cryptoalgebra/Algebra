// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import {IAlgebraVaultFactory} from './interfaces/IAlgebraVaultFactory.sol';
import {IAlgebraVault} from './interfaces/IAlgebraVault.sol';
import {IAlgebraFactory} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {AlgebraVaultDeployer} from './lib/AlgebraVaultDeployer.sol';
import {FarmingRewardsDistributorDeployer} from './lib/FarmingRewardsDistributorDeployer.sol';
import {IAlgebraPool} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import {IAlgebraEternalFarming} from '@cryptoalgebra/integral-farming/contracts/interfaces/IAlgebraEternalFarming.sol';

contract AlgebraVaultFactory is IAlgebraVaultFactory, ReentrancyGuard, AccessControl {
  bytes32 public constant override MANAGER_ROLE = keccak256('MANAGER_ROLE');
  bytes32 public constant override REBALANCER_ROLE = keccak256('REBALANCER_ROLE');

  address constant NULL_ADDRESS = address(0);
  uint256 constant DEFAULT_AMM_FEE = 0; // 0%
  uint256 constant DEFAULT_BASE_FEE = 2 * 10 ** 17; // 20%
  uint256 constant DEFAULT_BASE_FEE_SPLIT = 5 * 10 ** 17; // 50%
  uint256 constant PRECISION = 10 ** 18;
  uint32 constant DEFAULT_TWAP_PERIOD = 60 minutes;
  address public immutable override algebraFactory;
  address public immutable override nftManager;
  address public immutable override pluginDeployer;
  address public immutable override farmingCenter;
  address public immutable override eternalFarming;
  string public override ammName;

  address public override feeRecipient;
  uint256 public override ammFee;
  uint256 public override baseFee;
  uint256 public override baseFeeSplit;

  mapping(bytes32 => address) public getAlgebraVault;
  address[] public allVaults;

  /**
     @notice creates an instance of AlgebraVaultFactory
     @param _algebraFactory Algebra Integral factory
     @param _pluginDeployer Address of the plugin factory used for pool's plugin deployment.
     @param _nftManager Address of the Algebra NFT position manager.
     @param _ammName Name which should be reflected in the ERC20 name.
     */
  constructor(address _algebraFactory, address _pluginDeployer, address _eternalFarming, address _nftManager, string memory _ammName) {
    require(_algebraFactory != NULL_ADDRESS && _nftManager != NULL_ADDRESS && _eternalFarming != NULL_ADDRESS, 'AVF.constructor: zero address');
    algebraFactory = _algebraFactory;
    pluginDeployer = _pluginDeployer;
    eternalFarming = _eternalFarming;
    nftManager = _nftManager;

    farmingCenter = IAlgebraEternalFarming(_eternalFarming).farmingCenter();

    ammName = _ammName;
    feeRecipient = msg.sender;
    ammFee = DEFAULT_AMM_FEE;
    baseFee = DEFAULT_BASE_FEE;
    baseFeeSplit = DEFAULT_BASE_FEE_SPLIT;

    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _grantRole(MANAGER_ROLE, msg.sender);
    _grantRole(MANAGER_ROLE, address(this));
    _grantRole(REBALANCER_ROLE, msg.sender);

    emit DeployAlgebraVaultFactory(msg.sender, _algebraFactory);
  }

  /**
     @notice Creates an AlgebraVault for specified tokenA/tokenB/fee. May create an underlying Uniswap V3 pool.
     Controls liquidity provision types (one-sided or two-sided).
     @param tokenA TokenA of the Algebra V1 pool.
     @param allowTokenA Indicates if tokenA is accepted during deposit.
     @param tokenB TokenB of the Algebra V1 pool.
     @param allowTokenB Indicates if tokenB is accepted during deposit.
     @return algebraVault Address of the newly created AlgebraVault.
     */
  function createAlgebraVault(
    address tokenA,
    bool allowTokenA,
    address tokenB,
    bool allowTokenB
  ) external override onlyRole(MANAGER_ROLE) nonReentrant returns (address algebraVault) {
    require(tokenA != tokenB, 'AVF.createAlgebraVault: identical tokens');

    (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    (bool allowToken0, bool allowToken1) = tokenA < tokenB ? (allowTokenA, allowTokenB) : (allowTokenB, allowTokenA);

    require(token0 != NULL_ADDRESS, 'AVF.createAlgebraVault: zero address');
    require(allowTokenA || allowTokenB, 'AVF.createAlgebraVault: no allowed tokens');

    require(getAlgebraVault[genKey(msg.sender, token0, token1, allowToken0, allowToken1)] == NULL_ADDRESS, 'AVF.createAlgebraVault: vault exists');

    address pool;
    if (pluginDeployer != address(0)) {
      pool = IAlgebraFactory(algebraFactory).customPoolByPair(pluginDeployer, tokenA, tokenB);
    } else {
      pool = IAlgebraFactory(algebraFactory).poolByPair(tokenA, tokenB);
    }

    require(pool != NULL_ADDRESS, 'AVF.createAlgebraVault: pool must exist');

    (, , , , , bool unlocked) = IAlgebraPool(pool).globalState();

    require(unlocked, 'AVF.createAlgebraVault: pool is locked');

    algebraVault = AlgebraVaultDeployer.createAlgebraVault(pool, token0, allowToken0, token1, allowToken1, DEFAULT_TWAP_PERIOD, allVaults.length);

    // populate mapping in the reverse direction
    getAlgebraVault[genKey(msg.sender, token0, token1, allowToken0, allowToken1)] = algebraVault;
    getAlgebraVault[genKey(msg.sender, token1, token0, allowToken1, allowToken0)] = algebraVault;
    allVaults.push(algebraVault);

    emit AlgebraVaultCreated(msg.sender, algebraVault, token0, allowToken0, token1, allowToken1, allVaults.length);

    address farmingRewardsDistributor = FarmingRewardsDistributorDeployer.createFarmingRewardsDistributor(algebraVault);
    IAlgebraVault(algebraVault).setFarmingRewardsDistributor(farmingRewardsDistributor);
  }

  /**
     @notice Sets the fee recipient account address, where portion of the collected swap fees will be distributed
     @param _feeRecipient The fee recipient account address
     */
  function setFeeRecipient(address _feeRecipient) external override onlyRole(MANAGER_ROLE) {
    require(_feeRecipient != NULL_ADDRESS, 'AVF.setFeeRecipient: zero address');
    feeRecipient = _feeRecipient;
    emit FeeRecipient(msg.sender, _feeRecipient);
  }

  /**
     @notice Sets the fee percentage taken from pool's swap fees, allocated to the AMM for external incentives.
     @param _ammFee Fee percentage taken from the pool's accumulated swap fees.
     */
  function setAmmFee(uint256 _ammFee) external override onlyRole(MANAGER_ROLE) {
    require(baseFee + _ammFee <= PRECISION, 'AVF.setAmmFee: fees must be <= 10**18');
    ammFee = _ammFee;
    emit AmmFee(msg.sender, _ammFee);
  }

  /**
     @notice Sets the fee percentage taken from pool's swap fees, distributed between feeRecipient and affiliates.
     @param _baseFee Fee percentage taken from the pool's accumulated swap fees.
     */
  function setBaseFee(uint256 _baseFee) external override onlyRole(MANAGER_ROLE) {
    require(ammFee + _baseFee <= PRECISION, 'AVF.setBaseFee: fees must be <= 10**18');
    baseFee = _baseFee;
    emit BaseFee(msg.sender, _baseFee);
  }

  /**
     @notice Sets the fee split ratio between feeRecipient and affiliate accounts. Ratio format:
     (baseFeeSplit)/(100 - baseFeeSplit). E.g., for a 20/80 split, set baseFeeSplit to 20.
     @param _baseFeeSplit Fee split ratio between feeRecipient and affiliate accounts.
     */
  function setBaseFeeSplit(uint256 _baseFeeSplit) external override onlyRole(MANAGER_ROLE) {
    require(_baseFeeSplit <= PRECISION, 'AVF.setBaseFeeSplit: must be <= 10**18');
    baseFeeSplit = _baseFeeSplit;
    emit BaseFeeSplit(msg.sender, _baseFeeSplit);
  }

  /**
   * @notice generate a key for getAlgebraVault
   * @param deployer vault creator
   * @param token0 the first of two tokens in the vault
   * @param token1 the second of two tokens in the vault
   * @param allowToken0 allow deposits
   * @param allowToken1 allow deposits
   * @return key generated key
   */
  function genKey(address deployer, address token0, address token1, bool allowToken0, bool allowToken1) public pure override returns (bytes32 key) {
    key = keccak256(abi.encodePacked(deployer, token0, token1, allowToken0, allowToken1));
  }
}
