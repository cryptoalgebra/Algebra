// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IAlgebraEternalFarming.sol';
import './interfaces/IAlgebraEternalVirtualPool.sol';
import '../../libraries/IncentiveId.sol';
import '../../libraries/NFTPositionInfo.sol';
import './EternalVirtualPool.sol';

import 'algebra/contracts/libraries/SafeCast.sol';

import 'algebra/contracts/libraries/FullMath.sol';
import 'algebra/contracts/libraries/Constants.sol';

import 'algebra-periphery/contracts/libraries/TransferHelper.sol';

import '../AlgebraFarming.sol';

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
    mapping(uint256 => mapping(bytes32 => Farm)) public override farms;

    /// @param _deployer pool deployer contract address
    /// @param _nonfungiblePositionManager the NFT position manager contract address
    constructor(IAlgebraPoolDeployer _deployer, INonfungiblePositionManager _nonfungiblePositionManager)
        AlgebraFarming(_deployer, _nonfungiblePositionManager)
    {
        // just initialize AlgebraFarming
    }

    /// @inheritdoc IAlgebraEternalFarming
    function createIncentive(
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward,
        uint128 rewardRate,
        uint128 bonusRewardRate,
        address multiplierToken,
        Tiers calldata tiers
    ) external override onlyIncentiveMaker returns (address virtualPool) {
        (, address _incentive) = _getCurrentVirtualPools(key.pool);
        require(_incentive == address(0), 'Farming already exists');

        virtualPool = address(new EternalVirtualPool(address(farmingCenter), address(this), address(key.pool)));
        bytes32 incentiveId = _createIncentive(virtualPool, key, reward, bonusReward, multiplierToken, tiers);

        emit IncentiveCreated(
            key.rewardToken,
            key.bonusRewardToken,
            key.pool,
            virtualPool,
            key.startTime,
            key.endTime,
            reward,
            bonusReward,
            tiers,
            multiplierToken
        );

        IAlgebraEternalVirtualPool(virtualPool).addRewards(reward, bonusReward);
        IAlgebraEternalVirtualPool(virtualPool).setRates(rewardRate, bonusRewardRate);

        emit RewardsAdded(reward, bonusReward, incentiveId);
        emit RewardsRatesChanged(rewardRate, bonusRewardRate, incentiveId);
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
        require(incentive.totalReward > 0, 'AlgebraFarming::addRewards: non-existent incentive');

        if (rewardAmount > 0) {
            uint256 balanceBefore = key.rewardToken.balanceOf(address(this));
            TransferHelper.safeTransferFrom(address(key.rewardToken), msg.sender, address(this), rewardAmount);
            uint256 balanceAfter;
            require((balanceAfter = key.rewardToken.balanceOf(address(this))) >= balanceBefore);
            rewardAmount = balanceAfter - balanceBefore;
        }

        if (bonusRewardAmount > 0) {
            uint256 balanceBefore = key.bonusRewardToken.balanceOf(address(this));
            TransferHelper.safeTransferFrom(
                address(key.bonusRewardToken),
                msg.sender,
                address(this),
                bonusRewardAmount
            );
            uint256 balanceAfter;
            require((balanceAfter = key.bonusRewardToken.balanceOf(address(this))) >= balanceBefore);
            bonusRewardAmount = balanceAfter - balanceBefore;
        }

        if (rewardAmount > 0 || bonusRewardAmount > 0) {
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
            int24 currentTickInPool,
            address virtualPoolAddress
        ) = _enterFarming(key, tokenId, tokensLocked);

        require(farms[tokenId][incentiveId].liquidity == 0, 'AlgebraFarming::enterFarming: token already farmed');

        IAlgebraEternalVirtualPool(virtualPoolAddress).applyLiquidityDeltaToPosition(
            uint32(block.timestamp),
            tickLower,
            tickUpper,
            int256(liquidity).toInt128(),
            currentTickInPool
        );

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = IAlgebraEternalVirtualPool(virtualPoolAddress)
            .getInnerRewardsGrowth(tickLower, tickUpper);

        farms[tokenId][incentiveId] = Farm({
            liquidity: liquidity,
            tickLower: tickLower,
            tickUpper: tickUpper,
            innerRewardGrowth0: innerRewardGrowth0,
            innerRewardGrowth1: innerRewardGrowth1
        });

        emit FarmStarted(tokenId, incentiveId, liquidity, tokensLocked);
    }

    /// @inheritdoc IAlgebraFarming
    function exitFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        address _owner
    ) external override onlyFarmingCenter {
        bytes32 incentiveId = IncentiveId.compute(key);

        Farm memory farm = farms[tokenId][incentiveId];
        require(farm.liquidity != 0, 'AlgebraFarming::exitFarming: farm does not exist');

        Incentive storage incentive = incentives[incentiveId];
        incentive.numberOfFarms--;
        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

        uint256 reward;
        uint256 bonusReward;

        {
            (IAlgebraPool pool, , , ) = NFTPositionInfo.getPositionInfo(deployer, nonfungiblePositionManager, tokenId);
            (, int24 tick, , , , , , ) = pool.globalState();

            virtualPool.applyLiquidityDeltaToPosition(uint32(block.timestamp), farm.tickLower, farm.tickUpper, 0, tick);

            (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = virtualPool.getInnerRewardsGrowth(
                farm.tickLower,
                farm.tickUpper
            );

            virtualPool.applyLiquidityDeltaToPosition(
                uint32(block.timestamp),
                farm.tickLower,
                farm.tickUpper,
                -int128(farm.liquidity),
                tick
            );

            (reward, bonusReward) = (
                uint128(FullMath.mulDiv(innerRewardGrowth0 - farm.innerRewardGrowth0, farm.liquidity, Constants.Q128)),
                uint128(FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, Constants.Q128))
            );
        }

        if (reward != 0) {
            rewards[key.rewardToken][_owner] += reward;
        }
        if (bonusReward != 0) {
            rewards[key.bonusRewardToken][_owner] += bonusReward;
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

    /// @inheritdoc IAlgebraFarming
    function getRewardInfo(IncentiveKey memory key, uint256 tokenId)
        external
        view
        override
        returns (uint256 reward, uint256 bonusReward)
    {
        bytes32 incentiveId = IncentiveId.compute(key);

        Farm memory farm = farms[tokenId][incentiveId];
        require(farm.liquidity > 0, 'AlgebraFarming::getRewardInfo: farm does not exist');

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentives[incentiveId].virtualPoolAddress);

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = virtualPool.getInnerRewardsGrowth(
            farm.tickLower,
            farm.tickUpper
        );

        (reward, bonusReward) = (
            FullMath.mulDiv(innerRewardGrowth0 - farm.innerRewardGrowth0, farm.liquidity, Constants.Q128),
            FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, Constants.Q128)
        );
    }

    /// @inheritdoc IAlgebraEternalFarming
    function collectRewards(
        IncentiveKey memory key,
        uint256 tokenId,
        address _owner
    ) external override onlyFarmingCenter returns (uint256, uint256) {
        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];
        require(incentive.totalReward > 0, 'AlgebraFarming::collect: non-existent incentive');

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

        Farm memory farm = farms[tokenId][incentiveId];
        require(farm.liquidity != 0, 'AlgebraFarming::collect: farm does not exist');

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = virtualPool.getInnerRewardsGrowth(
            farm.tickLower,
            farm.tickUpper
        );

        (uint128 reward, uint128 bonusReward) = (
            uint128(FullMath.mulDiv(innerRewardGrowth0 - farm.innerRewardGrowth0, farm.liquidity, Constants.Q128)),
            uint128(FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, Constants.Q128))
        );

        farms[tokenId][incentiveId].innerRewardGrowth0 = innerRewardGrowth0;
        farms[tokenId][incentiveId].innerRewardGrowth1 = innerRewardGrowth1;

        if (reward != 0) {
            rewards[key.rewardToken][_owner] += reward;
        }
        if (bonusReward != 0) {
            rewards[key.bonusRewardToken][_owner] += bonusReward;
        }

        emit RewardsCollected(tokenId, incentiveId, reward, bonusReward);
        return (reward, bonusReward);
    }
}
