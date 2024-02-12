// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPoolDeployer.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IERC20Minimal.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/SafeCast.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/FullMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Constants.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/LowGasSafeMath.sol';

import '@cryptoalgebra/integral-periphery/contracts/libraries/TransferHelper.sol';

import '@cryptoalgebra/integral-base-plugin/contracts/interfaces/plugins/IFarmingPlugin.sol';

import '../interfaces/IAlgebraEternalFarming.sol';
import '../interfaces/IAlgebraEternalVirtualPool.sol';
import '../interfaces/IFarmingCenter.sol';
import '../libraries/IncentiveId.sol';
import '../libraries/NFTPositionInfo.sol';

import './EternalVirtualPool.sol';

/// @title Algebra Integral 1.0  eternal (v2-like) farming
/// @notice Manages rewards and virtual pools
contract AlgebraEternalFarming is IAlgebraEternalFarming {
  using SafeCast for int256;
  using LowGasSafeMath for uint256;
  using LowGasSafeMath for uint128;

  /// @notice Represents a farming incentive
  struct Incentive {
    uint128 totalReward;
    uint128 bonusReward;
    address virtualPoolAddress;
    uint24 minimalPositionWidth;
    bool deactivated;
    address pluginAddress;
  }

  /// @notice Represents the farm for nft
  struct Farm {
    uint128 liquidity;
    int24 tickLower;
    int24 tickUpper;
    uint256 innerRewardGrowth0;
    uint256 innerRewardGrowth1;
  }

  /// @inheritdoc IAlgebraEternalFarming
  bytes32 public constant override INCENTIVE_MAKER_ROLE = keccak256('INCENTIVE_MAKER_ROLE');
  /// @inheritdoc IAlgebraEternalFarming
  bytes32 public constant override FARMINGS_ADMINISTRATOR_ROLE = keccak256('FARMINGS_ADMINISTRATOR_ROLE');

  /// @inheritdoc IAlgebraEternalFarming
  INonfungiblePositionManager public immutable override nonfungiblePositionManager;

  IAlgebraPoolDeployer private immutable deployer;
  IAlgebraFactory private immutable factory;

  /// @inheritdoc IAlgebraEternalFarming
  address public override farmingCenter;
  /// @inheritdoc IAlgebraEternalFarming
  bool public override isEmergencyWithdrawActivated;
  // reentrancy lock
  bool private unlocked = true;

  /// @dev bytes32 incentiveId refers to the return value of IncentiveId.compute
  /// @inheritdoc IAlgebraEternalFarming
  mapping(bytes32 incentiveId => Incentive incentive) public override incentives;

  /// @dev farms[tokenId][incentiveHash] => Farm
  /// @inheritdoc IAlgebraEternalFarming
  mapping(uint256 tokenId => mapping(bytes32 incentiveId => Farm farm)) public override farms;

  /// @inheritdoc IAlgebraEternalFarming
  uint256 public numOfIncentives;

  /// @dev rewards[owner][rewardToken] => uint256
  /// @inheritdoc IAlgebraEternalFarming
  mapping(address owner => mapping(IERC20Minimal rewardToken => uint256 rewardAmount)) public override rewards;

  modifier onlyIncentiveMaker() {
    _checkHasRole(INCENTIVE_MAKER_ROLE);
    _;
  }

  modifier onlyAdministrator() {
    _checkHasRole(FARMINGS_ADMINISTRATOR_ROLE);
    _;
  }

  modifier onlyFarmingCenter() {
    _checkIsFarmingCenter();
    _;
  }

  /// @param _deployer pool deployer contract address
  /// @param _nonfungiblePositionManager the NFT position manager contract address
  constructor(IAlgebraPoolDeployer _deployer, INonfungiblePositionManager _nonfungiblePositionManager) {
    (deployer, nonfungiblePositionManager) = (_deployer, _nonfungiblePositionManager);
    factory = IAlgebraFactory(_nonfungiblePositionManager.factory());
  }

  /// @inheritdoc IAlgebraEternalFarming
  function isIncentiveDeactivated(bytes32 incentiveId) external view override returns (bool res) {
    return _isIncentiveDeactivated(incentives[incentiveId]);
  }

  function _checkIsFarmingCenter() internal view {
    require(msg.sender == farmingCenter);
  }

  function _checkHasRole(bytes32 role) internal view {
    require(factory.hasRoleOrOwner(role, msg.sender));
  }

  /// @inheritdoc IAlgebraEternalFarming
  function createEternalFarming(
    IncentiveKey memory key,
    IncentiveParams memory params,
    address plugin
  ) external override onlyIncentiveMaker returns (address virtualPool) {
    address connectedPlugin = key.pool.plugin();
    if (connectedPlugin != plugin || connectedPlugin == address(0)) revert pluginNotConnected();
    if (IFarmingPlugin(connectedPlugin).incentive() != address(0)) revert anotherFarmingIsActive();

    virtualPool = address(new EternalVirtualPool(address(this), connectedPlugin));
    IFarmingCenter(farmingCenter).connectVirtualPoolToPlugin(virtualPool, IFarmingPlugin(connectedPlugin));

    key.nonce = numOfIncentives++;
    bytes32 incentiveId = IncentiveId.compute(key);
    Incentive storage newIncentive = incentives[incentiveId];

    (params.reward, params.bonusReward) = _receiveRewards(key, params.reward, params.bonusReward, newIncentive);
    if (params.reward == 0) revert zeroRewardAmount();

    unchecked {
      if (int256(uint256(params.minimalPositionWidth)) > (int256(TickMath.MAX_TICK) - int256(TickMath.MIN_TICK)))
        revert minimalPositionWidthTooWide();
    }
    newIncentive.virtualPoolAddress = virtualPool;
    newIncentive.minimalPositionWidth = params.minimalPositionWidth;
    newIncentive.pluginAddress = connectedPlugin;

    emit EternalFarmingCreated(
      key.rewardToken,
      key.bonusRewardToken,
      key.pool,
      virtualPool,
      key.nonce,
      params.reward,
      params.bonusReward,
      params.minimalPositionWidth
    );

    _addRewards(IAlgebraEternalVirtualPool(virtualPool), params.reward, params.bonusReward, incentiveId);
    _setRewardRates(IAlgebraEternalVirtualPool(virtualPool), params.rewardRate, params.bonusRewardRate, incentiveId);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function deactivateIncentive(IncentiveKey memory key) external override onlyIncentiveMaker {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);
    // if the virtual pool is deactivated automatically, it is still possible to correctly deactivate it manually
    if (incentive.deactivated) revert incentiveStopped();

    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);
    IFarmingPlugin plugin = IFarmingPlugin(incentive.pluginAddress);

    incentive.deactivated = true;
    virtualPool.deactivate();

    (uint128 rewardRate0, uint128 rewardRate1) = virtualPool.rewardRates();
    if (rewardRate0 | rewardRate1 != 0) _setRewardRates(virtualPool, 0, 0, incentiveId);

    IFarmingCenter(farmingCenter).disconnectVirtualPoolFromPlugin(address(virtualPool), plugin);

    emit IncentiveDeactivated(incentiveId);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function decreaseRewardsAmount(IncentiveKey memory key, uint128 rewardAmount, uint128 bonusRewardAmount) external override onlyAdministrator {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);
    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

    _distributeRewards(virtualPool);
    (uint128 rewardReserve0, uint128 rewardReserve1) = virtualPool.rewardReserves();
    if (rewardAmount > rewardReserve0) rewardAmount = rewardReserve0;
    if (rewardAmount >= incentive.totalReward) rewardAmount = incentive.totalReward - 1; // to not trigger 'non-existent incentive'
    incentive.totalReward = incentive.totalReward - rewardAmount;

    if (bonusRewardAmount > rewardReserve1) bonusRewardAmount = rewardReserve1;
    incentive.bonusReward = incentive.bonusReward - bonusRewardAmount;

    virtualPool.decreaseRewards(rewardAmount, bonusRewardAmount);

    if (rewardAmount > 0) TransferHelper.safeTransfer(address(key.rewardToken), msg.sender, rewardAmount);
    if (bonusRewardAmount > 0) TransferHelper.safeTransfer(address(key.bonusRewardToken), msg.sender, bonusRewardAmount);

    emit RewardAmountsDecreased(rewardAmount, bonusRewardAmount, incentiveId);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function setFarmingCenterAddress(address _farmingCenter) external override onlyAdministrator {
    require(_farmingCenter != farmingCenter);
    farmingCenter = _farmingCenter;
    emit FarmingCenter(_farmingCenter);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function setEmergencyWithdrawStatus(bool newStatus) external override onlyAdministrator {
    require(isEmergencyWithdrawActivated != newStatus);
    isEmergencyWithdrawActivated = newStatus;
    emit EmergencyWithdraw(newStatus);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function addRewards(IncentiveKey memory key, uint128 rewardAmount, uint128 bonusRewardAmount) external override {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);

    if (_isIncentiveDeactivated(incentive)) revert incentiveStopped();

    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

    (rewardAmount, bonusRewardAmount) = _receiveRewards(key, rewardAmount, bonusRewardAmount, incentive);

    if (rewardAmount | bonusRewardAmount > 0) {
      _addRewards(virtualPool, rewardAmount, bonusRewardAmount, incentiveId);
    }
  }

  /// @inheritdoc IAlgebraEternalFarming
  function setRates(IncentiveKey memory key, uint128 rewardRate, uint128 bonusRewardRate) external override onlyIncentiveMaker {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);
    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

    if ((rewardRate | bonusRewardRate != 0) && (_isIncentiveDeactivated(incentive))) revert incentiveStopped();

    _setRewardRates(virtualPool, rewardRate, bonusRewardRate, incentiveId);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function enterFarming(IncentiveKey memory key, uint256 tokenId) external override onlyFarmingCenter {
    if (isEmergencyWithdrawActivated) revert emergencyActivated();
    (bytes32 incentiveId, int24 tickLower, int24 tickUpper, uint128 liquidity, address virtualPoolAddress) = _enterFarming(key, tokenId);

    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(virtualPoolAddress);
    (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = _getInnerRewardsGrowth(virtualPool, tickLower, tickUpper);

    farms[tokenId][incentiveId] = Farm(liquidity, tickLower, tickUpper, innerRewardGrowth0, innerRewardGrowth1);

    emit FarmEntered(tokenId, incentiveId, liquidity);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function exitFarming(IncentiveKey memory key, uint256 tokenId, address _owner) external override onlyFarmingCenter {
    bytes32 incentiveId = IncentiveId.compute(key);
    Farm memory farm = _getFarm(tokenId, incentiveId);

    uint256 reward;
    uint256 bonusReward;
    if (!isEmergencyWithdrawActivated) {
      (reward, bonusReward) = _updatePosition(farm, key, incentiveId, _owner, -int256(uint256(farm.liquidity)).toInt128());
    }

    delete farms[tokenId][incentiveId];

    emit FarmEnded(tokenId, incentiveId, address(key.rewardToken), address(key.bonusRewardToken), _owner, reward, bonusReward);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function claimReward(IERC20Minimal rewardToken, address to, uint256 amountRequested) external override returns (uint256 reward) {
    return _claimReward(rewardToken, msg.sender, to, amountRequested);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function claimRewardFrom(
    IERC20Minimal rewardToken,
    address from,
    address to,
    uint256 amountRequested
  ) external override onlyFarmingCenter returns (uint256 reward) {
    return _claimReward(rewardToken, from, to, amountRequested);
  }

  function _updatePosition(
    Farm memory farm,
    IncentiveKey memory key,
    bytes32 incentiveId,
    address _owner,
    int128 liquidityDelta
  ) internal returns (uint256 reward, uint256 bonusReward) {
    Incentive storage incentive = incentives[incentiveId];
    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

    // pool can "detach" by itself or manually
    int24 tick = _isIncentiveDeactivated(incentive) ? virtualPool.globalTick() : _getTickInPoolAndCheckLock(key.pool);

    // update rewards, as ticks may be cleared when liquidity decreases
    _distributeRewards(virtualPool);

    (reward, bonusReward, , ) = _getNewRewardsForFarm(virtualPool, farm);

    // liquidityDelta will be nonzero.
    // If a desynchronization occurs and the current tick in the pool is incorrect from the point of view of the virtual pool,
    // the virtual pool will be deactivated automatically
    _updatePositionInVirtualPool(address(virtualPool), farm.tickLower, farm.tickUpper, liquidityDelta, tick);

    mapping(IERC20Minimal => uint256) storage rewardBalances = rewards[_owner];
    unchecked {
      if (reward != 0) rewardBalances[key.rewardToken] += reward; // user must claim before overflow
      if (bonusReward != 0) rewardBalances[key.bonusRewardToken] += bonusReward; // user must claim before overflow
    }
  }

  /// @notice reward amounts can be outdated, actual amounts could be obtained via static call of `collectRewards` in FarmingCenter
  /// @inheritdoc IAlgebraEternalFarming
  function getRewardInfo(IncentiveKey memory key, uint256 tokenId) external view override returns (uint256 reward, uint256 bonusReward) {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);

    Farm memory farm = _getFarm(tokenId, incentiveId);
    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);
    (reward, bonusReward, , ) = _getNewRewardsForFarm(virtualPool, farm);
  }

  /// @notice reward amounts should be updated before calling this method
  /// @inheritdoc IAlgebraEternalFarming
  function collectRewards(
    IncentiveKey memory key,
    uint256 tokenId,
    address _owner
  ) external override onlyFarmingCenter returns (uint256 reward, uint256 bonusReward) {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);
    Farm memory farm = _getFarm(tokenId, incentiveId);

    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);
    _distributeRewards(virtualPool);

    uint256 innerRewardGrowth0;
    uint256 innerRewardGrowth1;
    (reward, bonusReward, innerRewardGrowth0, innerRewardGrowth1) = _getNewRewardsForFarm(virtualPool, farm);

    Farm storage _farm = farms[tokenId][incentiveId];
    _farm.innerRewardGrowth0 = innerRewardGrowth0;
    _farm.innerRewardGrowth1 = innerRewardGrowth1;

    mapping(IERC20Minimal => uint256) storage rewardBalances = rewards[_owner];
    unchecked {
      if (reward != 0) rewardBalances[key.rewardToken] += reward; // user must claim before overflow
      if (bonusReward != 0) rewardBalances[key.bonusRewardToken] += bonusReward; // user must claim before overflow
    }

    emit RewardsCollected(tokenId, incentiveId, reward, bonusReward);
  }

  /// @dev Does not check if the incentive is indeed currently connected to the Algebra pool or not
  function _isIncentiveDeactivated(Incentive storage incentive) private view returns (bool) {
    address virtualPoolAddress = incentive.virtualPoolAddress;
    bool _deactivated = incentive.deactivated; // if incentive was deactivated directly
    if (!_deactivated) {
      _deactivated = IAlgebraEternalVirtualPool(virtualPoolAddress).deactivated(); // if incentive was deactivated automatically
    }
    return _deactivated;
  }

  function _getInnerRewardsGrowth(IAlgebraEternalVirtualPool virtualPool, int24 tickLower, int24 tickUpper) private view returns (uint256, uint256) {
    return virtualPool.getInnerRewardsGrowth(tickLower, tickUpper);
  }

  function _getNewRewardsForFarm(
    IAlgebraEternalVirtualPool virtualPool,
    Farm memory farm
  ) private view returns (uint256 reward, uint256 bonusReward, uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) {
    (innerRewardGrowth0, innerRewardGrowth1) = _getInnerRewardsGrowth(virtualPool, farm.tickLower, farm.tickUpper);

    unchecked {
      (reward, bonusReward) = (
        FullMath.mulDiv(innerRewardGrowth0 - farm.innerRewardGrowth0, farm.liquidity, Constants.Q128),
        FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, Constants.Q128)
      );
    }
  }

  function _distributeRewards(IAlgebraEternalVirtualPool virtualPool) private {
    virtualPool.distributeRewards();
  }

  function _addRewards(IAlgebraEternalVirtualPool virtualPool, uint128 amount0, uint128 amount1, bytes32 incentiveId) private {
    virtualPool.addRewards(amount0, amount1);
    emit RewardsAdded(amount0, amount1, incentiveId);
  }

  function _setRewardRates(IAlgebraEternalVirtualPool virtualPool, uint128 rate0, uint128 rate1, bytes32 incentiveId) private {
    virtualPool.setRates(rate0, rate1);
    emit RewardsRatesChanged(rate0, rate1, incentiveId);
  }

  function _getFarm(uint256 tokenId, bytes32 incentiveId) private view returns (Farm memory result) {
    result = farms[tokenId][incentiveId];
    if (result.liquidity == 0) revert farmDoesNotExist();
  }

  function _receiveRewards(
    IncentiveKey memory key,
    uint128 reward,
    uint128 bonusReward,
    Incentive storage incentive
  ) internal returns (uint128 receivedReward, uint128 receivedBonusReward) {
    if (!unlocked) revert reentrancyLock();
    unlocked = false; // reentrancy lock
    if (reward > 0) receivedReward = _receiveToken(key.rewardToken, reward);
    if (bonusReward > 0) receivedBonusReward = _receiveToken(key.bonusRewardToken, bonusReward);
    unlocked = true;

    (uint128 _totalRewardBefore, uint128 _bonusRewardBefore) = (incentive.totalReward, incentive.bonusReward);
    incentive.totalReward = _totalRewardBefore + receivedReward;
    incentive.bonusReward = _bonusRewardBefore + receivedBonusReward;
  }

  function _receiveToken(IERC20Minimal token, uint128 amount) private returns (uint128) {
    uint256 balanceBefore = _getBalanceOf(token);
    TransferHelper.safeTransferFrom(address(token), msg.sender, address(this), amount);
    uint256 balanceAfter = _getBalanceOf(token);
    require(balanceAfter > balanceBefore);
    unchecked {
      uint256 received = balanceAfter - balanceBefore;
      if (received > type(uint128).max) revert invalidTokenAmount();
      return (uint128(received));
    }
  }

  function _enterFarming(
    IncentiveKey memory key,
    uint256 tokenId
  ) internal returns (bytes32 incentiveId, int24 tickLower, int24 tickUpper, uint128 liquidity, address virtualPool) {
    Incentive storage incentive;
    (incentiveId, incentive) = _getExistingIncentiveByKey(key);

    if (farms[tokenId][incentiveId].liquidity != 0) revert tokenAlreadyFarmed();

    virtualPool = incentive.virtualPoolAddress;
    uint24 minimalAllowedTickWidth = incentive.minimalPositionWidth;

    if (_isIncentiveDeactivated(incentive)) revert incentiveStopped();

    IAlgebraPool pool;
    (pool, tickLower, tickUpper, liquidity) = NFTPositionInfo.getPositionInfo(deployer, nonfungiblePositionManager, tokenId);

    if (pool != key.pool) revert invalidPool();
    if (liquidity == 0) revert zeroLiquidity();

    unchecked {
      if (int256(tickUpper) - int256(tickLower) < int256(uint256(minimalAllowedTickWidth))) revert positionIsTooNarrow();
    }

    int24 tick = _getTickInPoolAndCheckLock(pool);
    _updatePositionInVirtualPool(virtualPool, tickLower, tickUpper, int256(uint256(liquidity)).toInt128(), tick);
  }

  function _claimReward(IERC20Minimal rewardToken, address from, address to, uint256 amountRequested) internal returns (uint256 reward) {
    if (to == address(0)) revert claimToZeroAddress();
    mapping(IERC20Minimal => uint256) storage userRewards = rewards[from];
    reward = userRewards[rewardToken];

    if (amountRequested == 0 || amountRequested > reward) amountRequested = reward;

    if (amountRequested > 0) {
      unchecked {
        userRewards[rewardToken] = reward - amountRequested;
      }
      TransferHelper.safeTransfer(address(rewardToken), to, amountRequested);
      emit RewardClaimed(to, amountRequested, address(rewardToken), from);
    }
  }

  function _getExistingIncentiveByKey(IncentiveKey memory key) internal view returns (bytes32 incentiveId, Incentive storage incentive) {
    incentiveId = IncentiveId.compute(key);
    incentive = incentives[incentiveId];
    if (incentive.totalReward == 0) revert incentiveNotExist();
  }

  function _getTickInPoolAndCheckLock(IAlgebraPool pool) internal view returns (int24 tick) {
    bool poolUnlocked;
    (, tick, , , , poolUnlocked) = pool.globalState();
    if (!poolUnlocked) revert poolReentrancyLock();
  }

  function _getBalanceOf(IERC20Minimal token) internal view returns (uint256) {
    return token.balanceOf(address(this));
  }

  function _updatePositionInVirtualPool(address virtualPool, int24 tickLower, int24 tickUpper, int128 liquidityDelta, int24 currentTick) internal {
    IAlgebraEternalVirtualPool(virtualPool).applyLiquidityDeltaToPosition(tickLower, tickUpper, liquidityDelta, currentTick);
  }
}
