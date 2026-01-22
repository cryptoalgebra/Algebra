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

import '@cryptoalgebra/farming-proxy-plugin/contracts/interfaces/IFarmingPlugin.sol';

import '../interfaces/IAlgebraEternalFarming.sol';
import '../interfaces/IAlgebraEternalVirtualPool.sol';
import '../interfaces/IFarmingCenter.sol';
import '../libraries/IncentiveId.sol';
import '../libraries/NFTPositionInfo.sol';

import './EternalVirtualPool.sol';

/// @title Algebra Integral 1.2.2  eternal (v2-like) farming
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
    uint128 rewardRate;      // Rate of reward distribution per second
    uint128 bonusRewardRate; // Rate of bonus reward distribution per second
  }

  /// @notice Represents the farm for nft
  struct Farm {
    uint128 liquidity;
    int24 tickLower;
    int24 tickUpper;
    uint32 timestamp;
    uint256 totalFees0;
    uint256 totalFees1;
    uint256 innerFeesGrowth0;
    uint256 innerFeesGrowth1;
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

  /// @dev pool => IncentiveKey
  /// @inheritdoc IAlgebraEternalFarming
  mapping(address pool => IncentiveKey key) public override incentiveKeys;

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

    virtualPool = address(new EternalVirtualPool(address(this), connectedPlugin, address(key.pool)));
    IFarmingCenter(farmingCenter).connectVirtualPoolToPlugin(virtualPool, IFarmingPlugin(connectedPlugin));

    key.nonce = numOfIncentives++;
    incentiveKeys[address(key.pool)] = key;
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
    newIncentive.rewardRate = params.rewardRate;
    newIncentive.bonusRewardRate = params.bonusRewardRate;

    emit EternalFarmingCreated(
      key.rewardToken,
      key.bonusRewardToken,
      key.pool,
      virtualPool,
      key.nonce,
      params.reward,
      params.bonusReward,
      params.minimalPositionWidth,
      params.rewardRate,
      params.bonusRewardRate
    );
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
    delete incentiveKeys[address(key.pool)];

    IFarmingCenter(farmingCenter).disconnectVirtualPoolFromPlugin(address(virtualPool), plugin);

    emit IncentiveDeactivated(incentiveId);
  }

  /// @inheritdoc IAlgebraEternalFarming
  function setRates(IncentiveKey memory key, uint128 rewardRate, uint128 bonusRewardRate) external override onlyIncentiveMaker {
    (bytes32 incentiveId, Incentive storage incentive) = _getExistingIncentiveByKey(key);
    
    // Cannot set non-zero rates for deactivated incentive
    if ((rewardRate | bonusRewardRate != 0) && _isIncentiveDeactivated(incentive)) revert incentiveStopped();

    incentive.rewardRate = rewardRate;
    incentive.bonusRewardRate = bonusRewardRate;
    
    emit RewardsRatesChanged(rewardRate, bonusRewardRate, incentiveId);
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
  function enterFarming(IncentiveKey memory key, uint256 tokenId) external override onlyFarmingCenter {
    if (isEmergencyWithdrawActivated) revert emergencyActivated();
    (bytes32 incentiveId, int24 tickLower, int24 tickUpper, uint128 liquidity, address virtualPoolAddress) = _enterFarming(key, tokenId);

    IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(virtualPoolAddress);
    
    // Update total fees before reading
    virtualPool.updateTotalFees();
    
    (uint256 innerFeeGrowth0, uint256 innerFeeGrowth1) = _getInnerFeeGrowthForRange(address(key.pool), tickLower, tickUpper);
    (uint256 totalFees0, uint256 totalFees1) = virtualPool.getTotalFees();
    
    farms[tokenId][incentiveId] = Farm({
      liquidity: liquidity,
      tickLower: tickLower,
      tickUpper: tickUpper,
      timestamp: uint32(block.timestamp),
      totalFees0: totalFees0,
      totalFees1: totalFees1,
      innerFeesGrowth0: innerFeeGrowth0,
      innerFeesGrowth1: innerFeeGrowth1
    });

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

    // Update total fees before calculating rewards
    virtualPool.updateTotalFees();

    (uint256 currentFeeGrowthInside0, uint256 currentFeeGrowthInside1) = _getInnerFeeGrowthForRange(address(key.pool), farm.tickLower, farm.tickUpper);
    
    uint256 fees0Earned;
    uint256 fees1Earned;
    // Calculate fees earned by this position since entry
    unchecked {
        uint256 feeGrowth0Delta = currentFeeGrowthInside0 - farm.innerFeesGrowth0;
        fees0Earned = FullMath.mulDiv(feeGrowth0Delta, farm.liquidity, Constants.Q128);

        uint256 feeGrowth1Delta = currentFeeGrowthInside1 - farm.innerFeesGrowth1;
        fees1Earned = FullMath.mulDiv(feeGrowth1Delta, farm.liquidity, Constants.Q128);
    }
    
    (uint256 totalFees0, uint256 totalFees1) = virtualPool.getTotalFees();
    
    uint256 totalFees0Delta = totalFees0 - farm.totalFees0;
    uint256 totalFees1Delta = totalFees1 - farm.totalFees1;

    // Calculate rewards based on time in farming and incentive's reward rate
    uint256 potentialRewards = (block.timestamp - farm.timestamp) * incentive.rewardRate;
    uint256 potentialBonusRewards = (block.timestamp - farm.timestamp) * incentive.bonusRewardRate;
    
    // Position's share of rewards based on fees earned / total fees in period
    if (totalFees0Delta > 0) {
      reward = FullMath.mulDiv(potentialRewards, fees0Earned, totalFees0Delta);
    }
    if (totalFees1Delta > 0 && fees1Earned > 0) {
      bonusReward = FullMath.mulDiv(potentialBonusRewards, fees1Earned, totalFees1Delta);
    }

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
    
    // Get current total fees (note: may be slightly outdated without updateTotalFees call)
    (uint256 totalFees0, uint256 totalFees1) = virtualPool.getTotalFees();
    
    // Get current inner fee growth for position
    (uint256 currentFeeGrowthInside0, uint256 currentFeeGrowthInside1) = _getInnerFeeGrowthForRangeView(address(key.pool), farm.tickLower, farm.tickUpper);
    
    uint256 fees0Earned;
    unchecked {
      uint256 feeGrowth0Delta = currentFeeGrowthInside0 - farm.innerFeesGrowth0;
      fees0Earned = FullMath.mulDiv(feeGrowth0Delta, farm.liquidity, Constants.Q128);
    }
    
    uint256 totalFees0Delta = totalFees0 - farm.totalFees0;
    uint256 totalFees1Delta = totalFees1 - farm.totalFees1;
    uint256 potentialRewards = (block.timestamp - farm.timestamp) * incentive.rewardRate;
    uint256 potentialBonusRewards = (block.timestamp - farm.timestamp) * incentive.bonusRewardRate;
    
    if (totalFees0Delta > 0) {
      reward = FullMath.mulDiv(potentialRewards, fees0Earned, totalFees0Delta);
    }
    
    // Calculate bonus reward based on token1 fees
    uint256 fees1Earned;
    unchecked {
      uint256 feeGrowth1Delta = currentFeeGrowthInside1 - farm.innerFeesGrowth1;
      fees1Earned = FullMath.mulDiv(feeGrowth1Delta, farm.liquidity, Constants.Q128);
    }
    if (totalFees1Delta > 0 && fees1Earned > 0) {
      bonusReward = FullMath.mulDiv(potentialBonusRewards, fees1Earned, totalFees1Delta);
    }
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
    
    // Update total fees
    virtualPool.updateTotalFees();
    

    // Get current fee growth for position
    (uint256 currentFeeGrowthInside0, uint256 currentFeeGrowthInside1) = _getInnerFeeGrowthForRange(address(key.pool), farm.tickLower, farm.tickUpper);
    
    uint256 fees0Earned;
    unchecked {
      uint256 feeGrowth0Delta = currentFeeGrowthInside0 - farm.innerFeesGrowth0;
      fees0Earned = FullMath.mulDiv(feeGrowth0Delta, farm.liquidity, Constants.Q128);
    }
    
    (uint256 totalFees0, uint256 totalFees1) = virtualPool.getTotalFees();
    
    {
      uint256 totalFees0Delta = totalFees0 - farm.totalFees0;
      uint256 totalFees1Delta = totalFees1 - farm.totalFees1;
      
      if (totalFees0Delta > 0) {
        uint256 potentialRewards = (block.timestamp - farm.timestamp) * incentive.rewardRate;
        reward = FullMath.mulDiv(potentialRewards, fees0Earned, totalFees0Delta);
      }

      // Calculate bonus reward
      uint256 fees1Earned;
      unchecked {
        uint256 feeGrowth1Delta = currentFeeGrowthInside1 - farm.innerFeesGrowth1;
        fees1Earned = FullMath.mulDiv(feeGrowth1Delta, farm.liquidity, Constants.Q128);
      }
      if (totalFees1Delta > 0 && fees1Earned > 0) {
        uint256 potentialBonusRewards = (block.timestamp - farm.timestamp) * incentive.bonusRewardRate;
        bonusReward = FullMath.mulDiv(potentialBonusRewards, fees1Earned, totalFees1Delta);
      }
    }

    // Update farm state
    Farm storage _farm = farms[tokenId][incentiveId];
    _farm.innerFeesGrowth0 = currentFeeGrowthInside0;
    _farm.innerFeesGrowth1 = currentFeeGrowthInside1;
    _farm.totalFees0 = totalFees0;
    _farm.totalFees1 = totalFees1;
    _farm.timestamp = uint32(block.timestamp);

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

  function _getInnerFeeGrowthForRange(address pool, int24 tickLower, int24 tickUpper) private view returns (uint256 innerFeeGrowth0Token, uint256 innerFeeGrowth1Token) {
    ( , int24 currentTick , , , ,) = IAlgebraPool(pool).globalState();
    uint256 totalFeeGrowth0Token = IAlgebraPool(pool).totalFeeGrowth0Token();
    uint256 totalFeeGrowth1Token = IAlgebraPool(pool).totalFeeGrowth1Token();
    (, , , , uint256 lowerOuterFeeGrowth0Token, uint256 lowerOuterFeeGrowth1Token) = IAlgebraPool(pool).ticks(tickLower);
    (, , , , uint256 upperOuterFeeGrowth0Token, uint256 upperOuterFeeGrowth1Token) = IAlgebraPool(pool).ticks(tickUpper); 

    unchecked {
      if (currentTick < tickUpper) {
        if (currentTick >= tickLower) {
          innerFeeGrowth0Token = totalFeeGrowth0Token - lowerOuterFeeGrowth0Token;
          innerFeeGrowth1Token = totalFeeGrowth1Token - lowerOuterFeeGrowth1Token;
        } else {
          innerFeeGrowth0Token = lowerOuterFeeGrowth0Token;
          innerFeeGrowth1Token = lowerOuterFeeGrowth1Token;
        }
        innerFeeGrowth0Token -= upperOuterFeeGrowth0Token;
        innerFeeGrowth1Token -= upperOuterFeeGrowth1Token;
      } else {
        innerFeeGrowth0Token = upperOuterFeeGrowth0Token - lowerOuterFeeGrowth0Token;
        innerFeeGrowth1Token = upperOuterFeeGrowth1Token - lowerOuterFeeGrowth1Token;
      }
    }
  }

  function _getInnerFeeGrowthForRangeView(address pool, int24 tickLower, int24 tickUpper) private view returns (uint256 innerFeeGrowth0Token, uint256 innerFeeGrowth1Token) {
    return _getInnerFeeGrowthForRange(pool, tickLower, tickUpper);
  }
}
