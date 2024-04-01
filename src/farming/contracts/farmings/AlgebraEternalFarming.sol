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
    address virtualPoolAddress;
    uint24 minimalPositionWidth;
    bool deactivated;
    address pluginAddress;
    mapping(address => uint128) totalRewards;
  }

  /// @notice Represents the farm for nft
  struct Farm {
    uint128 liquidity;
    int24 tickLower;
    int24 tickUpper;
    mapping(address => uint256) innerRewardGrowths;
  }

  /// @inheritdoc IAlgebraEternalFarming
  bytes32 public constant override INCENTIVE_MAKER_ROLE = keccak256('INCENTIVE_MAKER_ROLE');
  /// @inheritdoc IAlgebraEternalFarming
  bytes32 public constant override FARMINGS_ADMINISTRATOR_ROLE = keccak256('FARMINGS_ADMINISTRATOR_ROLE');

  uint16 public constant FEE_WEIGHT_DENOMINATOR = 1e3;

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

  mapping(bytes32 incentiveId => address[] rewardTokensList) public rewardTokensLists;

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

    params.reward = _receiveRewards(params.rewardToken, params.reward, newIncentive);
    if (params.reward == 0) revert zeroRewardAmount();

    unchecked {
      if (int256(uint256(params.minimalPositionWidth)) > (int256(TickMath.MAX_TICK) - int256(TickMath.MIN_TICK)))
        revert minimalPositionWidthTooWide();
    }
    newIncentive.virtualPoolAddress = virtualPool;
    newIncentive.minimalPositionWidth = params.minimalPositionWidth;
    newIncentive.pluginAddress = connectedPlugin;

    emit EternalFarmingCreated(
      key.pool,
      virtualPool,
      key.nonce,
      params.rewardToken,
      params.reward,
      params.minimalPositionWidth,
      params.weight0,
      params.weight1
    );

    _addRewardToken(IAlgebraEternalVirtualPool(virtualPool), params.rewardToken, incentiveId);
    _addRewards(IAlgebraEternalVirtualPool(virtualPool), params.rewardToken, params.reward, incentiveId);
    _setRewardRates(IAlgebraEternalVirtualPool(virtualPool), params.rewardToken, params.rewardRate, incentiveId);
    _setFeesWeights(IAlgebraEternalVirtualPool(virtualPool), params.weight0, params.weight1, incentiveId);
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

    address[] memory rewardTokensList = rewardTokensLists[incentiveId];

    for (uint i; i < rewardTokensList.length; i++) {
      uint128 rewardRate = virtualPool.rewardRate(rewardTokensList[i]);
      if (rewardRate != 0) _setRewardRates(virtualPool, rewardTokensList[i], 0, incentiveId);
    }
    IFarmingCenter(farmingCenter).disconnectVirtualPoolFromPlugin(address(virtualPool), plugin);

    emit IncentiveDeactivated(incentiveId);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function decreaseRewardsAmount(IncentiveKey memory key, address rewardToken, uint128 rewardAmount) external override onlyAdministrator {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);
    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

    _distributeRewards(virtualPool);
    uint128 rewardReserve = virtualPool.rewardReserve(rewardToken);
    uint128 totalReward = incentive.totalRewards[rewardToken];
    if (rewardAmount > rewardReserve) rewardAmount = rewardReserve;
    if (rewardAmount >= totalReward) rewardAmount = totalReward - 1; // to not trigger 'non-existent incentive'
    incentive.totalRewards[rewardToken] = totalReward - rewardAmount;

    virtualPool.decreaseRewards(rewardToken, rewardAmount);

    if (rewardAmount > 0) TransferHelper.safeTransfer(address(rewardToken), msg.sender, rewardAmount);

    emit RewardAmountsDecreased(rewardToken, rewardAmount, incentiveId);
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
  function addRewards(IncentiveKey memory key, address rewardToken, uint128 rewardAmount) external override {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);

    if (_isIncentiveDeactivated(incentive)) revert incentiveStopped();

    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

    rewardAmount = _receiveRewards(rewardToken, rewardAmount, incentive);

    if (rewardAmount > 0) {
      _addRewards(virtualPool, rewardToken, rewardAmount, incentiveId);
    }
  }

  function addRewardToken(IncentiveKey memory key, address rewardToken) external override onlyIncentiveMaker {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);

    if (_isIncentiveDeactivated(incentive)) revert incentiveStopped();

    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

    _addRewardToken(virtualPool, rewardToken, incentiveId);
  }

  function removeRewardToken(IncentiveKey memory key, uint index) external override onlyIncentiveMaker {
    (, Incentive storage incentive) = _getExistingIncentiveByKey(key);

    if (_isIncentiveDeactivated(incentive)) revert incentiveStopped();

    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

    virtualPool.removeRewardToken(index);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function setRates(IncentiveKey memory key, address rewardToken, uint128 rewardRate) external override onlyIncentiveMaker {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);
    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

    if ((rewardRate != 0) && (_isIncentiveDeactivated(incentive))) revert incentiveStopped();

    _setRewardRates(virtualPool, rewardToken, rewardRate, incentiveId);
  }

  function setWeights(IncentiveKey memory key, uint16 weight0, uint16 weight1) external override onlyIncentiveMaker {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);
    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

    _setFeesWeights(virtualPool, weight0, weight1, incentiveId);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function enterFarming(IncentiveKey memory key, uint256 tokenId) external override onlyFarmingCenter {
    if (isEmergencyWithdrawActivated) revert emergencyActivated();
    (bytes32 incentiveId, int24 tickLower, int24 tickUpper, uint128 liquidity, address virtualPoolAddress) = _enterFarming(key, tokenId);

    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(virtualPoolAddress);

    Farm storage farm = farms[tokenId][incentiveId];
    farm.liquidity = liquidity;
    farm.tickLower = tickLower;
    farm.tickUpper = tickUpper;

    address[] memory rewardTokensList = rewardTokensLists[incentiveId];
    for (uint i; i < rewardTokensList.length; i++) {
      farm.innerRewardGrowths[rewardTokensList[i]] = _getInnerRewardsGrowth(virtualPool, tickLower, tickUpper, rewardTokensList[i]);
    }

    emit FarmEntered(tokenId, incentiveId, liquidity);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function exitFarming(IncentiveKey memory key, uint256 tokenId, address _owner) external override onlyFarmingCenter {
    bytes32 incentiveId = IncentiveId.compute(key);
    Farm storage farm = _getFarm(tokenId, incentiveId);

    uint256[] memory positionRewards;
    address[] memory rewardTokensList;
    if (!isEmergencyWithdrawActivated) {
      (positionRewards, rewardTokensList) = _updatePosition(farm, key, incentiveId, _owner, -int256(uint256(farm.liquidity)).toInt128());
    }

    delete farms[tokenId][incentiveId];

    emit FarmEnded(tokenId, incentiveId, rewardTokensList, _owner, positionRewards);
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
    Farm storage farm,
    IncentiveKey memory key,
    bytes32 incentiveId,
    address _owner,
    int128 liquidityDelta
  ) internal returns (uint256[] memory positionsRewards, address[] memory rewardTokensList) {
    Incentive storage incentive = incentives[incentiveId];
    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

    // pool can "detach" by itself or manually
    int24 tick = _isIncentiveDeactivated(incentive) ? virtualPool.globalTick() : _getTickInPoolAndCheckLock(key.pool);

    // update rewards, as ticks may be cleared when liquidity decreases
    _distributeRewards(virtualPool);

    (positionsRewards, , rewardTokensList) = _getNewRewardsForFarm(virtualPool, farm, incentiveId);

    // liquidityDelta will be nonzero.
    // If a desynchronization occurs and the current tick in the pool is incorrect from the point of view of the virtual pool,
    // the virtual pool will be deactivated automatically
    _updatePositionInVirtualPool(address(virtualPool), farm.tickLower, farm.tickUpper, liquidityDelta, tick);

    mapping(IERC20Minimal => uint256) storage rewardBalances = rewards[_owner];
    unchecked {
      for (uint i; i < positionsRewards.length; i++) {
        if (positionsRewards[i] != 0) rewardBalances[IERC20Minimal(rewardTokensList[i])] += positionsRewards[i]; // user must claim before overflow
      }
    }
  }

  /// @notice reward amounts can be outdated, actual amounts could be obtained via static call of `collectRewards` in FarmingCenter
  /// @inheritdoc IAlgebraEternalFarming
  function getRewardInfo(IncentiveKey memory key, uint256 tokenId) external view override returns (uint256[] memory reward) {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);

    Farm storage farm = _getFarm(tokenId, incentiveId);
    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);
    (reward, , ) = _getNewRewardsForFarm(virtualPool, farm, incentiveId);
  }

  function getIncentiveTotalRewards(IncentiveKey memory key, address rewardToken) external view override returns (uint256 rewardAmount) {
    (bytes32 incentiveId, ) = _getExistingIncentiveByKey(key);

    rewardAmount = incentives[incentiveId].totalRewards[rewardToken];
  }

  /// @notice reward amounts should be updated before calling this method
  /// @inheritdoc IAlgebraEternalFarming
  function collectRewards(
    IncentiveKey memory key,
    uint256 tokenId,
    address _owner
  ) external override onlyFarmingCenter returns (uint256[] memory reward, address[] memory rewardTokensList) {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);
    Farm storage farm = _getFarm(tokenId, incentiveId);

    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);
    _distributeRewards(virtualPool);

    uint256[] memory innerRewardGrowths;
    (reward, innerRewardGrowths, rewardTokensList) = _getNewRewardsForFarm(virtualPool, farm, incentiveId);

    Farm storage _farm = farms[tokenId][incentiveId];
    mapping(IERC20Minimal => uint256) storage rewardBalances = rewards[_owner];
    for (uint i; i < rewardTokensList.length; i++) {
      address rewardToken = rewardTokensList[i];
      _farm.innerRewardGrowths[rewardToken] = innerRewardGrowths[i];
      unchecked {
        if (reward[i] != 0) rewardBalances[IERC20Minimal(rewardToken)] += reward[i]; // user must claim before overflow
      }
    }

    emit RewardsCollected(tokenId, incentiveId, rewardTokensList, reward);
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

  function _getInnerRewardsGrowth(
    IAlgebraEternalVirtualPool virtualPool,
    int24 tickLower,
    int24 tickUpper,
    address tokenReward
  ) private view returns (uint256) {
    return virtualPool.getInnerRewardsGrowth(tickLower, tickUpper, tokenReward);
  }

  function _getNewRewardsForFarm(
    IAlgebraEternalVirtualPool virtualPool,
    Farm storage farm,
    bytes32 incentiveId
  ) private view returns (uint256[] memory positionRewards, uint256[] memory innerRewardGrowths, address[] memory rewardTokensList) {
    rewardTokensList = rewardTokensLists[incentiveId];
    positionRewards = new uint[](rewardTokensList.length);
    innerRewardGrowths = new uint[](rewardTokensList.length);
    for (uint i; i < rewardTokensList.length; i++) {
      address rewardToken = rewardTokensList[i];
      innerRewardGrowths[i] = _getInnerRewardsGrowth(virtualPool, farm.tickLower, farm.tickUpper, rewardToken);

      unchecked {
        positionRewards[i] = FullMath.mulDiv(innerRewardGrowths[i] - farm.innerRewardGrowths[rewardToken], farm.liquidity, Constants.Q128);
      }
    }
  }

  function _distributeRewards(IAlgebraEternalVirtualPool virtualPool) private {
    virtualPool.distributeRewards();
  }

  function _addRewards(IAlgebraEternalVirtualPool virtualPool, address rewardToken, uint128 amount, bytes32 incentiveId) private {
    virtualPool.addRewards(rewardToken, amount);
    emit RewardsAdded(rewardToken, amount, incentiveId);
  }

  function _addRewardToken(IAlgebraEternalVirtualPool virtualPool, address rewardToken, bytes32 incentiveId) private {
    virtualPool.addRewardToken(rewardToken);

    bool inList;
    for (uint i; i < rewardTokensLists[incentiveId].length; i++) {
      if (rewardTokensLists[incentiveId][i] == rewardToken) {
        inList = true;
      }
    }
    if (!inList) {
      rewardTokensLists[incentiveId].push(rewardToken);
    }

    emit RewardTokenAdded(rewardToken, incentiveId);
  }

  function _setRewardRates(IAlgebraEternalVirtualPool virtualPool, address rewardToken, uint128 rate, bytes32 incentiveId) private {
    virtualPool.setRates(rewardToken, rate);
    emit RewardsRatesChanged(rewardToken, rate, incentiveId);
  }

  function _setFeesWeights(IAlgebraEternalVirtualPool virtualPool, uint16 weight0, uint16 weight1, bytes32 incentiveId) private {
    if (weight0 + weight0 != FEE_WEIGHT_DENOMINATOR) revert incorrectWeight();
    virtualPool.setWeights(weight0, weight1);
    emit FeesWeightsChanged(weight0, weight1, incentiveId);
  }

  function _getFarm(uint256 tokenId, bytes32 incentiveId) private view returns (Farm storage result) {
    result = farms[tokenId][incentiveId];
    if (result.liquidity == 0) revert farmDoesNotExist();
  }

  function _receiveRewards(address rewardToken, uint128 reward, Incentive storage incentive) internal returns (uint128 receivedReward) {
    if (!unlocked) revert reentrancyLock();
    unlocked = false; // reentrancy lock
    if (reward > 0) receivedReward = _receiveToken(IERC20Minimal(rewardToken), reward);
    unlocked = true;

    incentive.totalRewards[rewardToken] += receivedReward;
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

    uint256 totalReward;
    address[] memory rewardTokenList = rewardTokensLists[incentiveId];
    for (uint i; i < rewardTokenList.length; i++) {
      totalReward += incentive.totalRewards[rewardTokenList[i]];
    }
    if (totalReward == 0) revert incentiveNotExist();
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
