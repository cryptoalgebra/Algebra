// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../interfaces/IAlgebraFarming.sol';
import '../interfaces/IFarmingCenter.sol';
import './IAlgebraVirtualPoolBase.sol';
import '../libraries/IncentiveId.sol';
import '../libraries/NFTPositionInfo.sol';
import '../libraries/LiquidityTier.sol';

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPoolDeployer.sol';
import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/core/contracts/interfaces/IERC20Minimal.sol';
import '@cryptoalgebra/core/contracts/libraries/SafeCast.sol';
import '@cryptoalgebra/core/contracts/libraries/TickMath.sol';
import '@cryptoalgebra/core/contracts/libraries/Constants.sol';
import '@cryptoalgebra/core/contracts/libraries/LowGasSafeMath.sol';
import '@cryptoalgebra/core/contracts/libraries/FullMath.sol';

import '@cryptoalgebra/periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@cryptoalgebra/periphery/contracts/libraries/TransferHelper.sol';

/// @title Abstract base contract for Algebra farmings
abstract contract AlgebraFarming is IAlgebraFarming {
    using SafeCast for int256;
    using LowGasSafeMath for uint256;

    /// @notice Represents a farming incentive
    struct Incentive {
        uint256 totalReward;
        uint256 bonusReward;
        address virtualPoolAddress;
        uint24 minimalPositionWidth;
        uint224 totalLiquidity;
        address multiplierToken;
        bool deactivated;
        Tiers tiers;
    }

    /// @inheritdoc IAlgebraFarming
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;

    /// @inheritdoc IAlgebraFarming
    IAlgebraPoolDeployer public immutable override deployer;

    IFarmingCenter public farmingCenter;

    /// @dev bytes32 refers to the return value of IncentiveId.compute
    /// @inheritdoc IAlgebraFarming
    mapping(bytes32 => Incentive) public override incentives;

    address public incentiveMaker;
    address public owner;

    /// @inheritdoc IAlgebraFarming
    bool public override isEmergencyWithdrawActivated;
    // reentrancy lock
    bool private unlocked = true;

    /// @dev rewards[owner][rewardToken] => uint256
    /// @inheritdoc IAlgebraFarming
    mapping(address => mapping(IERC20Minimal => uint256)) public override rewards;

    modifier onlyIncentiveMaker() {
        _checkIsIncentiveMaker();
        _;
    }

    modifier onlyOwner() {
        _checkIsOwner();
        _;
    }

    modifier onlyFarmingCenter() {
        _checkIsFarmingCenter();
        _;
    }

    modifier nonReentrant() {
        require(unlocked);
        unlocked = false;
        _;
        unlocked = true;
    }

    /// @param _deployer pool deployer contract address
    /// @param _nonfungiblePositionManager the NFT position manager contract address
    constructor(IAlgebraPoolDeployer _deployer, INonfungiblePositionManager _nonfungiblePositionManager) {
        owner = msg.sender;
        deployer = _deployer;
        nonfungiblePositionManager = _nonfungiblePositionManager;
    }

    function _checkIsFarmingCenter() private view {
        require(msg.sender == address(farmingCenter));
    }

    function _checkIsIncentiveMaker() private view {
        require(msg.sender == incentiveMaker);
    }

    function _checkIsOwner() private view {
        require(msg.sender == owner);
    }

    /// @inheritdoc IAlgebraFarming
    function setIncentiveMaker(address _incentiveMaker) external override onlyOwner {
        require(incentiveMaker != _incentiveMaker);
        incentiveMaker = _incentiveMaker;
        emit IncentiveMaker(_incentiveMaker);
    }

    /// @inheritdoc IAlgebraFarming
    function setOwner(address _owner) external override onlyOwner {
        require(_owner != owner);
        owner = _owner;
        emit Owner(_owner);
    }

    /// @inheritdoc IAlgebraFarming
    function setFarmingCenterAddress(address _farmingCenter) external override onlyOwner {
        require(_farmingCenter != address(farmingCenter));
        farmingCenter = IFarmingCenter(_farmingCenter);
        emit FarmingCenter(_farmingCenter);
    }

    /// @inheritdoc IAlgebraFarming
    function setEmergencyWithdrawStatus(bool newStatus) external override onlyOwner {
        require(isEmergencyWithdrawActivated != newStatus);
        isEmergencyWithdrawActivated = newStatus;
        emit EmergencyWithdraw(newStatus);
    }

    /// @inheritdoc IAlgebraFarming
    function claimReward(
        IERC20Minimal rewardToken,
        address to,
        uint256 amountRequested
    ) external override returns (uint256 reward) {
        return _claimReward(rewardToken, msg.sender, to, amountRequested);
    }

    /// @inheritdoc IAlgebraFarming
    function claimRewardFrom(
        IERC20Minimal rewardToken,
        address from,
        address to,
        uint256 amountRequested
    ) external override onlyFarmingCenter returns (uint256 reward) {
        return _claimReward(rewardToken, from, to, amountRequested);
    }

    function _connectPoolToVirtualPool(IAlgebraPool pool, address virtualPool) private {
        farmingCenter.connectVirtualPool(pool, virtualPool);
    }

    function _getCurrentVirtualPools(IAlgebraPool pool) internal view returns (address incentive, address eternal) {
        return farmingCenter.virtualPoolAddresses(address(pool));
    }

    function _receiveRewards(
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward,
        Incentive storage incentive
    ) internal nonReentrant returns (uint256 receivedReward, uint256 receivedBonusReward) {
        if (reward > 0) {
            receivedReward = _receiveToken(key.rewardToken, reward);
            incentive.totalReward = incentive.totalReward.add(receivedReward);
        }
        if (bonusReward > 0) {
            receivedBonusReward = _receiveToken(key.bonusRewardToken, bonusReward);
            incentive.bonusReward = incentive.bonusReward.add(receivedBonusReward);
        }
    }

    function _receiveToken(IERC20Minimal token, uint256 amount) private returns (uint256) {
        uint256 balanceBefore = _balanceOfToken(token);
        TransferHelper.safeTransferFrom(address(token), msg.sender, address(this), amount);
        uint256 balanceAfter = _balanceOfToken(token);
        require(balanceAfter > balanceBefore);
        return balanceAfter - balanceBefore;
    }

    function _balanceOfToken(IERC20Minimal token) private view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function _createFarming(
        address virtualPool,
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward,
        uint24 minimalPositionWidth,
        address multiplierToken,
        Tiers calldata tiers
    ) internal returns (bytes32 incentiveId, uint256 receivedReward, uint256 receivedBonusReward) {
        _connectPoolToVirtualPool(key.pool, virtualPool);

        incentiveId = IncentiveId.compute(key);

        Incentive storage newIncentive = incentives[incentiveId];
        require(newIncentive.totalReward == 0, 'key already used');

        (receivedReward, receivedBonusReward) = _receiveRewards(key, reward, bonusReward, newIncentive);
        require(receivedReward != 0, 'zero reward amount');

        require(
            minimalPositionWidth <= (int256(TickMath.MAX_TICK) - int256(TickMath.MIN_TICK)),
            'minimalPositionWidth too wide'
        );
        newIncentive.virtualPoolAddress = virtualPool;
        newIncentive.minimalPositionWidth = minimalPositionWidth;

        require(
            tiers.tier1Multiplier <= LiquidityTier.MAX_MULTIPLIER &&
                tiers.tier2Multiplier <= LiquidityTier.MAX_MULTIPLIER &&
                tiers.tier3Multiplier <= LiquidityTier.MAX_MULTIPLIER,
            'Multiplier cant be greater than MAX_MULTIPLIER'
        );

        require(
            tiers.tier1Multiplier >= LiquidityTier.DENOMINATOR &&
                tiers.tier2Multiplier >= LiquidityTier.DENOMINATOR &&
                tiers.tier3Multiplier >= LiquidityTier.DENOMINATOR,
            'Multiplier cant be less than DENOMINATOR'
        );

        newIncentive.tiers = tiers;
        newIncentive.multiplierToken = multiplierToken;
    }

    function _deactivateIncentive(IncentiveKey memory key, address virtualPool, Incentive storage incentive) internal {
        require(virtualPool != address(0), 'Farming do not exist');
        require(!incentive.deactivated, 'Already deactivated');

        incentive.deactivated = true;

        IAlgebraVirtualPoolBase(virtualPool).deactivate();

        if (_isIncentiveActiveInPool(key.pool, virtualPool)) {
            _connectPoolToVirtualPool(key.pool, address(0));
        }

        emit IncentiveDeactivated(
            key.rewardToken,
            key.bonusRewardToken,
            key.pool,
            virtualPool,
            key.startTime,
            key.endTime
        );
    }

    function _enterFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        uint256 tokensLocked
    ) internal returns (bytes32 incentiveId, int24 tickLower, int24 tickUpper, uint128 liquidity, address virtualPool) {
        Incentive storage incentive;
        (incentiveId, incentive) = _getIncentiveByKey(key);

        virtualPool = incentive.virtualPoolAddress;
        require(!incentive.deactivated && _isIncentiveActiveInPool(key.pool, virtualPool), 'incentive stopped');

        IAlgebraPool pool;
        (pool, tickLower, tickUpper, liquidity) = NFTPositionInfo.getPositionInfo(
            deployer,
            nonfungiblePositionManager,
            tokenId
        );

        require(pool == key.pool, 'invalid pool for token');
        require(liquidity > 0, 'cannot farm token with 0 liquidity');
        int24 tick = _getTickInPool(pool);

        uint32 multiplier = LiquidityTier.getLiquidityMultiplier(tokensLocked, incentive.tiers);
        uint256 liquidityAmountWithMultiplier = FullMath.mulDiv(liquidity, multiplier, LiquidityTier.DENOMINATOR);
        require(liquidityAmountWithMultiplier <= type(uint128).max);
        liquidity = uint128(liquidityAmountWithMultiplier);

        uint24 minimalAllowedTickWidth = incentive.minimalPositionWidth;
        require(int256(tickUpper) - int256(tickLower) >= int256(minimalAllowedTickWidth), 'position too narrow');

        IAlgebraVirtualPoolBase(virtualPool).applyLiquidityDeltaToPosition(
            uint32(block.timestamp),
            tickLower,
            tickUpper,
            int256(liquidity).toInt128(),
            tick
        );
    }

    function _claimReward(
        IERC20Minimal rewardToken,
        address from,
        address to,
        uint256 amountRequested
    ) internal returns (uint256 reward) {
        require(to != address(0), 'to zero address');
        reward = rewards[from][rewardToken];

        if (amountRequested == 0 || amountRequested > reward) {
            amountRequested = reward;
        }

        if (amountRequested > 0) {
            rewards[from][rewardToken] = reward - amountRequested;
            TransferHelper.safeTransfer(address(rewardToken), to, amountRequested);

            emit RewardClaimed(to, amountRequested, address(rewardToken), from);
        }
    }

    function _isIncentiveActiveInPool(IAlgebraPool pool, address virtualPool) internal view returns (bool) {
        return farmingCenter.isIncentiveActiveInPool(pool, virtualPool);
    }

    function _getIncentiveByKey(
        IncentiveKey memory key
    ) internal view returns (bytes32 incentiveId, Incentive storage incentive) {
        incentiveId = IncentiveId.compute(key);
        incentive = incentives[incentiveId];
        require(incentive.totalReward != 0, 'non-existent incentive');
    }

    function _getTickInPool(IAlgebraPool pool) internal view returns (int24 tick) {
        (, tick, , , , , ) = pool.globalState();
    }
}
