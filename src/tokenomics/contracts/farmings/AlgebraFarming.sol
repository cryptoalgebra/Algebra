// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../interfaces/IAlgebraFarming.sol';
import '../interfaces/IFarmingCenter.sol';
import '../interfaces/INonfungiblePositionManager.sol';
import './IAlgebraVirtualPoolBase.sol';
import '../libraries/IncentiveId.sol';
import '../libraries/NFTPositionInfo.sol';
import '../libraries/LiquidityTier.sol';
import '../libraries/VirtualPoolConstants.sol';
import '../libraries/TickMath.sol';
import '../libraries/LowGasSafeMath.sol';
import '../libraries/FullMath.sol';

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPoolDeployer.sol';
import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/core/contracts/interfaces/IERC20Minimal.sol';
import '@cryptoalgebra/core/contracts/libraries/SafeCast.sol';

import '@cryptoalgebra/periphery/contracts/libraries/TransferHelper.sol';

/// @title Abstract base contract for Algebra farmings
abstract contract AlgebraFarming is IAlgebraFarming {
    using SafeCast for int256;
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for uint128;

    /// @notice Represents a farming incentive
    struct Incentive {
        uint128 totalReward;
        uint128 bonusReward;
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

    address internal incentiveMaker;
    address internal immutable owner;

    /// @dev rewards[owner][rewardToken] => uint256
    /// @inheritdoc IAlgebraFarming
    mapping(address => mapping(IERC20Minimal => uint256)) public override rewards;

    modifier onlyIncentiveMaker() {
        require(msg.sender == incentiveMaker);
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    modifier onlyFarmingCenter() {
        require(msg.sender == address(farmingCenter));
        _;
    }

    /// @param _deployer pool deployer contract address
    /// @param _nonfungiblePositionManager the NFT position manager contract address
    constructor(IAlgebraPoolDeployer _deployer, INonfungiblePositionManager _nonfungiblePositionManager) {
        owner = msg.sender;
        deployer = _deployer;
        nonfungiblePositionManager = _nonfungiblePositionManager;
    }

    /// @inheritdoc IAlgebraFarming
    function setIncentiveMaker(address _incentiveMaker) external override onlyOwner {
        require(incentiveMaker != _incentiveMaker);
        incentiveMaker = _incentiveMaker;
        emit IncentiveMaker(_incentiveMaker);
    }

    /// @inheritdoc IAlgebraFarming
    function setFarmingCenterAddress(address _farmingCenter) external override onlyOwner {
        require(_farmingCenter != address(farmingCenter));
        farmingCenter = IFarmingCenter(_farmingCenter);
        emit FarmingCenter(_farmingCenter);
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
        uint128 reward,
        uint128 bonusReward,
        Incentive storage incentive
    ) internal returns (uint128 receivedReward, uint128 receivedBonusReward) {
        if (reward > 0) {
            IERC20Minimal rewardToken = key.rewardToken;
            uint256 balanceBefore = rewardToken.balanceOf(address(this));
            TransferHelper.safeTransferFrom(address(rewardToken), msg.sender, address(this), reward);
            uint256 balanceAfter = rewardToken.balanceOf(address(this));
            require(balanceAfter > balanceBefore);
            receivedReward = uint128(balanceAfter - balanceBefore); // TODO OVERFLOW CHECKS
            incentive.totalReward = incentive.totalReward.add128(receivedReward);
        }
        if (bonusReward > 0) {
            IERC20Minimal bonusRewardToken = key.bonusRewardToken;
            uint256 balanceBefore = bonusRewardToken.balanceOf(address(this));
            TransferHelper.safeTransferFrom(address(bonusRewardToken), msg.sender, address(this), bonusReward);
            uint256 balanceAfter = bonusRewardToken.balanceOf(address(this));
            require(balanceAfter > balanceBefore);
            receivedBonusReward = uint128(balanceAfter - balanceBefore);
            incentive.bonusReward = incentive.bonusReward.add128(receivedBonusReward);
        }
    }

    function _createFarming(
        address virtualPool,
        IncentiveKey memory key,
        uint128 reward,
        uint128 bonusReward,
        uint24 minimalPositionWidth,
        address multiplierToken,
        Tiers calldata tiers
    ) internal returns (bytes32 incentiveId, uint128 receivedReward, uint128 receivedBonusReward) {
        _connectPoolToVirtualPool(key.pool, virtualPool);

        incentiveId = IncentiveId.compute(key);

        Incentive storage newIncentive = incentives[incentiveId];

        (receivedReward, receivedBonusReward) = _receiveRewards(key, reward, bonusReward, newIncentive);

        require(
            minimalPositionWidth <=
                ((int256(TickMath.MAX_TICK) / VirtualPoolConstants.TICK_SPACING) *
                    VirtualPoolConstants.TICK_SPACING -
                    (int256(TickMath.MIN_TICK) / VirtualPoolConstants.TICK_SPACING) *
                    VirtualPoolConstants.TICK_SPACING),
            'minimalPositionWidth too wide'
        );
        newIncentive.virtualPoolAddress = virtualPool;
        newIncentive.minimalPositionWidth = minimalPositionWidth;

        require(
            tiers.tier1Multiplier <= LiquidityTier.MAX_MULTIPLIER &&
                tiers.tier2Multiplier <= LiquidityTier.MAX_MULTIPLIER &&
                tiers.tier3Multiplier <= LiquidityTier.MAX_MULTIPLIER,
            'Multiplier is too high'
        );

        require(
            tiers.tier1Multiplier >= LiquidityTier.DENOMINATOR &&
                tiers.tier2Multiplier >= LiquidityTier.DENOMINATOR &&
                tiers.tier3Multiplier >= LiquidityTier.DENOMINATOR,
            'Multiplier is too low'
        );

        newIncentive.tiers = tiers;
        newIncentive.multiplierToken = multiplierToken;
    }

    function _deactivateIncentive(IncentiveKey memory key, address currentVirtualPool) internal {
        require(currentVirtualPool != address(0), 'Farming do not exist');

        Incentive storage incentive = incentives[IncentiveId.compute(key)];
        require(incentive.virtualPoolAddress == currentVirtualPool, 'Another farming is active');
        require(!incentive.deactivated, 'Already deactivated');
        incentive.deactivated = true;

        _connectPoolToVirtualPool(key.pool, address(0));

        emit IncentiveDeactivated(
            key.rewardToken,
            key.bonusRewardToken,
            key.pool,
            currentVirtualPool,
            key.startTime,
            key.endTime
        );
    }

    function _enterFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        uint256 tokensLocked
    ) internal returns (bytes32 incentiveId, int24 tickLower, int24 tickUpper, uint128 liquidity, address virtualPool) {
        incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];

        _checkIsIncentiveExist(incentive);
        require(!incentive.deactivated, 'incentive stopped');

        IAlgebraPool pool;
        (pool, tickLower, tickUpper, liquidity) = NFTPositionInfo.getPositionInfo(
            deployer,
            nonfungiblePositionManager,
            tokenId
        );

        require(pool == key.pool, 'invalid pool for token');
        require(liquidity > 0, 'cannot farm token with 0 liquidity');
        (, int24 tick, , , , , ) = pool.globalState();

        uint32 multiplier = LiquidityTier.getLiquidityMultiplier(tokensLocked, incentive.tiers);
        uint256 liquidityAmountWithMultiplier = FullMath.mulDiv(liquidity, multiplier, LiquidityTier.DENOMINATOR);
        require(liquidityAmountWithMultiplier <= type(uint128).max);
        liquidity = uint128(liquidityAmountWithMultiplier);

        virtualPool = incentive.virtualPoolAddress;
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
        reward = rewards[from][rewardToken];

        if (amountRequested == 0 || amountRequested > reward) {
            amountRequested = reward;
        }

        rewards[from][rewardToken] = reward - amountRequested;
        TransferHelper.safeTransfer(address(rewardToken), to, amountRequested);

        emit RewardClaimed(to, amountRequested, address(rewardToken), from);
    }

    function _checkIsIncentiveExist(Incentive storage incentive) internal view {
        require(incentive.totalReward > 0, 'non-existent incentive');
    }
}
