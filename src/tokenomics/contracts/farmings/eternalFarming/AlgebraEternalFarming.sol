// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IAlgebraEternalFarming.sol';
import './interfaces/IAlgebraEternalVirtualPool.sol';
import './EternalVirtualPool.sol';
import '../AlgebraFarming.sol';
import '../../libraries/IncentiveId.sol';
import '../../libraries/VirtualPoolConstants.sol';

import '@cryptoalgebra/core/contracts/libraries/SafeCast.sol';
import '@cryptoalgebra/core/contracts/libraries/FullMath.sol';

/// @title Algebra eternal (v2-like) farming
contract AlgebraEternalFarming is AlgebraFarming, IAlgebraEternalFarming {
    using SafeCast for int256;
    /// @notice Represents the farm for nft
    struct Farm {
        uint128 liquidity;
        int24 tickLower;
        int24 tickUpper;
        uint256 innerRewardGrowth0;
        uint256 innerRewardGrowth1;
    }
    /// @dev farms[tokenId][incentiveHash] => Farm
    /// @inheritdoc IAlgebraEternalFarming
    mapping(uint256 => mapping(bytes32 => Farm)) public override farms;

    /// @param _deployer pool deployer contract address
    /// @param _nonfungiblePositionManager the NFT position manager contract address
    constructor(IAlgebraPoolDeployer _deployer, INonfungiblePositionManager _nonfungiblePositionManager)
        AlgebraFarming(_deployer, _nonfungiblePositionManager)
    {
        // just initialize AlgebraFarming
    }

    /// @inheritdoc IAlgebraEternalFarming
    function createEternalFarming(
        IncentiveKey memory key,
        IncentiveParams memory params,
        Tiers calldata tiers
    ) external override onlyIncentiveMaker returns (address virtualPool) {
        (, address _incentive) = _getCurrentVirtualPools(key.pool);
        require(_incentive == address(0), 'Farming already exists');

        virtualPool = address(new EternalVirtualPool(address(farmingCenter), address(this), address(key.pool)));
        bytes32 incentiveId;
        (incentiveId, params.reward, params.bonusReward) = _createFarming(
            virtualPool,
            key,
            params.reward,
            params.bonusReward,
            params.minimalPositionWidth,
            params.multiplierToken,
            tiers
        );

        emit EternalFarmingCreated(
            key.rewardToken,
            key.bonusRewardToken,
            key.pool,
            virtualPool,
            key.startTime,
            key.endTime,
            params.reward,
            params.bonusReward,
            tiers,
            params.multiplierToken,
            params.minimalPositionWidth
        );

        IAlgebraEternalVirtualPool(virtualPool).addRewards(params.reward, params.bonusReward);
        IAlgebraEternalVirtualPool(virtualPool).setRates(params.rewardRate, params.bonusRewardRate);

        emit RewardsAdded(params.reward, params.bonusReward, incentiveId);
        emit RewardsRatesChanged(params.rewardRate, params.bonusRewardRate, incentiveId);
    }

    /// @inheritdoc IAlgebraFarming
    function detachIncentive(IncentiveKey memory key) external override onlyIncentiveMaker {
        (, address _eternalVirtualPool) = _getCurrentVirtualPools(key.pool);
        _detachIncentive(key, _eternalVirtualPool);
    }

    /// @inheritdoc IAlgebraFarming
    function attachIncentive(IncentiveKey memory key) external override onlyIncentiveMaker {
        (, address _eternalVirtualPool) = _getCurrentVirtualPools(key.pool);
        _attachIncentive(key, _eternalVirtualPool);
    }

    /// @inheritdoc IAlgebraEternalFarming
    function addRewards(
        IncentiveKey memory key,
        uint256 rewardAmount,
        uint256 bonusRewardAmount
    ) external override {
        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];
        require(incentive.totalReward > 0, 'non-existent incentive');

        (rewardAmount, bonusRewardAmount) = _receiveRewards(key, rewardAmount, bonusRewardAmount, incentive);

        if (rewardAmount | bonusRewardAmount > 0) {
            IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);
            virtualPool.addRewards(rewardAmount, bonusRewardAmount);

            emit RewardsAdded(rewardAmount, bonusRewardAmount, incentiveId);
        }
    }

    /// @inheritdoc IAlgebraEternalFarming
    function setRates(
        IncentiveKey memory key,
        uint128 rewardRate,
        uint128 bonusRewardRate
    ) external override onlyIncentiveMaker {
        bytes32 incentiveId = IncentiveId.compute(key);
        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentives[incentiveId].virtualPoolAddress);
        virtualPool.setRates(rewardRate, bonusRewardRate);

        emit RewardsRatesChanged(rewardRate, bonusRewardRate, incentiveId);
    }

    /// @inheritdoc IAlgebraFarming
    function enterFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        uint256 tokensLocked
    ) external override onlyFarmingCenter {
        (
            bytes32 incentiveId,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            address virtualPoolAddress
        ) = _enterFarming(key, tokenId, tokensLocked);

        mapping(bytes32 => Farm) storage farmsForToken = farms[tokenId];
        require(farmsForToken[incentiveId].liquidity == 0, 'token already farmed');

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = IAlgebraEternalVirtualPool(virtualPoolAddress)
            .getInnerRewardsGrowth(tickLower, tickUpper);

        farmsForToken[incentiveId] = Farm({
            liquidity: liquidity,
            tickLower: tickLower,
            tickUpper: tickUpper,
            innerRewardGrowth0: innerRewardGrowth0,
            innerRewardGrowth1: innerRewardGrowth1
        });

        emit FarmEntered(tokenId, incentiveId, liquidity, tokensLocked);
    }

    /// @inheritdoc IAlgebraFarming
    function exitFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        address _owner
    ) external override onlyFarmingCenter {
        bytes32 incentiveId = IncentiveId.compute(key);

        Farm memory farm = farms[tokenId][incentiveId];
        require(farm.liquidity != 0, 'farm does not exist');

        Incentive storage incentive = incentives[incentiveId];
        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

        uint256 reward;
        uint256 bonusReward;

        {
            (, int24 tick, , , , , ) = key.pool.globalState();

            // update rewards, as ticks may be cleared when liquidity decreases
            virtualPool.applyLiquidityDeltaToPosition(uint32(block.timestamp), farm.tickLower, farm.tickUpper, 0, tick);

            (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = virtualPool.getInnerRewardsGrowth(
                farm.tickLower,
                farm.tickUpper
            );

            virtualPool.applyLiquidityDeltaToPosition(
                uint32(block.timestamp),
                farm.tickLower,
                farm.tickUpper,
                -int256(farm.liquidity).toInt128(),
                tick
            );

            (reward, bonusReward) = (
                FullMath.mulDiv(
                    innerRewardGrowth0 - farm.innerRewardGrowth0,
                    farm.liquidity,
                    VirtualPoolConstants.Q128
                ),
                FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, VirtualPoolConstants.Q128)
            );
        }

        mapping(IERC20Minimal => uint256) storage rewardBalances = rewards[_owner];
        if (reward != 0) {
            rewardBalances[key.rewardToken] += reward; // user must claim before overflow
        }
        if (bonusReward != 0) {
            rewardBalances[key.bonusRewardToken] += bonusReward; // user must claim before overflow
        }

        delete farms[tokenId][incentiveId];

        emit FarmEnded(
            tokenId,
            incentiveId,
            address(key.rewardToken),
            address(key.bonusRewardToken),
            _owner,
            reward,
            bonusReward
        );
    }

    /// @notice reward amounts can be outdated, actual amounts could be obtained via static call of `collectRewards` in FarmingCenter
    /// @inheritdoc IAlgebraFarming
    function getRewardInfo(IncentiveKey memory key, uint256 tokenId)
        external
        view
        override
        returns (uint256 reward, uint256 bonusReward)
    {
        bytes32 incentiveId = IncentiveId.compute(key);

        Farm memory farm = farms[tokenId][incentiveId];
        require(farm.liquidity > 0, 'farm does not exist');

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentives[incentiveId].virtualPoolAddress);

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = virtualPool.getInnerRewardsGrowth(
            farm.tickLower,
            farm.tickUpper
        );

        (reward, bonusReward) = (
            FullMath.mulDiv(innerRewardGrowth0 - farm.innerRewardGrowth0, farm.liquidity, VirtualPoolConstants.Q128),
            FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, VirtualPoolConstants.Q128)
        );
    }

    /// @notice reward amounts should be updated before calling this method
    /// @inheritdoc IAlgebraEternalFarming
    function collectRewards(
        IncentiveKey memory key,
        uint256 tokenId,
        address _owner
    ) external override onlyFarmingCenter returns (uint256 reward, uint256 bonusReward) {
        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];
        require(incentive.totalReward > 0, 'non-existent incentive');

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);
        virtualPool.increaseCumulative(uint32(block.timestamp));

        Farm memory farm = farms[tokenId][incentiveId];
        require(farm.liquidity != 0, 'farm does not exist');

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = virtualPool.getInnerRewardsGrowth(
            farm.tickLower,
            farm.tickUpper
        );

        (reward, bonusReward) = (
            FullMath.mulDiv(innerRewardGrowth0 - farm.innerRewardGrowth0, farm.liquidity, VirtualPoolConstants.Q128),
            FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, VirtualPoolConstants.Q128)
        );

        farms[tokenId][incentiveId].innerRewardGrowth0 = innerRewardGrowth0;
        farms[tokenId][incentiveId].innerRewardGrowth1 = innerRewardGrowth1;

        mapping(IERC20Minimal => uint256) storage rewardBalances = rewards[_owner];
        if (reward != 0) {
            rewardBalances[key.rewardToken] += reward; // user must claim before overflow
        }
        if (bonusReward != 0) {
            rewardBalances[key.bonusRewardToken] += bonusReward; // user must claim before overflow
        }

        emit RewardsCollected(tokenId, incentiveId, reward, bonusReward);
    }
}
