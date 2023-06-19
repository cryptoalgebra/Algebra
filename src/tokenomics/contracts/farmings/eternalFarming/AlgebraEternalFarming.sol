// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IAlgebraEternalFarming.sol';
import './interfaces/IAlgebraEternalVirtualPool.sol';
import '../../libraries/IncentiveId.sol';
import './EternalVirtualPool.sol';

import '@cryptoalgebra/core/contracts/libraries/SafeCast.sol';

import '@cryptoalgebra/core/contracts/libraries/FullMath.sol';
import '@cryptoalgebra/core/contracts/libraries/Constants.sol';

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
    /// @inheritdoc IAlgebraEternalFarming
    mapping(uint256 => mapping(bytes32 => Farm)) public override farms;

    /// @param _deployer pool deployer contract address
    /// @param _nonfungiblePositionManager the NFT position manager contract address
    constructor(
        IAlgebraPoolDeployer _deployer,
        INonfungiblePositionManager _nonfungiblePositionManager
    ) AlgebraFarming(_deployer, _nonfungiblePositionManager) {
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

        _addRewards(IAlgebraEternalVirtualPool(virtualPool), params.reward, params.bonusReward, incentiveId);
        _setRewardRates(
            IAlgebraEternalVirtualPool(virtualPool),
            params.rewardRate,
            params.bonusRewardRate,
            incentiveId
        );
    }

    /// @inheritdoc IAlgebraFarming
    function deactivateIncentive(IncentiveKey memory key) external override onlyIncentiveMaker {
        (bytes32 incentiveId, Incentive storage incentive) = _getIncentiveByKey(key);
        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

        _deactivateIncentive(key, address(virtualPool), incentive);

        if (virtualPool.rewardRate0() != 0 || virtualPool.rewardRate1() != 0) {
            _setRewardRates(virtualPool, 0, 0, incentiveId);
        }
    }

    /// @inheritdoc IAlgebraFarming
    function decreaseRewardsAmount(
        IncentiveKey memory key,
        uint256 rewardAmount,
        uint256 bonusRewardAmount
    ) external override onlyOwner {
        (bytes32 incentiveId, Incentive storage incentive) = _getIncentiveByKey(key);
        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

        virtualPool.distributeRewards();
        uint256 rewardReserve0 = virtualPool.rewardReserve0();
        if (rewardAmount > rewardReserve0) rewardAmount = rewardReserve0;
        if (rewardAmount >= incentive.totalReward) rewardAmount = incentive.totalReward - 1; // to not trigger 'non-existent incentive'
        incentive.totalReward = incentive.totalReward - rewardAmount;

        uint256 rewardReserve1 = virtualPool.rewardReserve1();
        if (bonusRewardAmount > rewardReserve1) bonusRewardAmount = rewardReserve1;
        incentive.bonusReward = incentive.bonusReward - bonusRewardAmount;

        virtualPool.decreaseRewards(rewardAmount, bonusRewardAmount);

        if (rewardAmount > 0) TransferHelper.safeTransfer(address(key.rewardToken), msg.sender, rewardAmount);
        if (bonusRewardAmount > 0)
            TransferHelper.safeTransfer(address(key.bonusRewardToken), msg.sender, bonusRewardAmount);

        emit RewardAmountsDecreased(rewardAmount, bonusRewardAmount, incentiveId);
    }

    /// @inheritdoc IAlgebraFarming
    function addRewards(IncentiveKey memory key, uint256 rewardAmount, uint256 bonusRewardAmount) external override {
        (bytes32 incentiveId, Incentive storage incentive) = _getIncentiveByKey(key);
        require(!incentive.deactivated, 'incentive stopped');

        (rewardAmount, bonusRewardAmount) = _receiveRewards(key, rewardAmount, bonusRewardAmount, incentive);

        if (rewardAmount | bonusRewardAmount > 0) {
            IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);
            _addRewards(virtualPool, rewardAmount, bonusRewardAmount, incentiveId);
        }
    }

    /// @inheritdoc IAlgebraEternalFarming
    function setRates(
        IncentiveKey memory key,
        uint128 rewardRate,
        uint128 bonusRewardRate
    ) external override onlyIncentiveMaker {
        (bytes32 incentiveId, Incentive storage incentive) = _getIncentiveByKey(key);

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

        if ((incentive.deactivated || _activeIncentiveInPool(key.pool) != address(virtualPool)))
            require(rewardRate | bonusRewardRate == 0, 'incentive stopped');

        _setRewardRates(virtualPool, rewardRate, bonusRewardRate, incentiveId);
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
    function exitFarming(IncentiveKey memory key, uint256 tokenId, address _owner) external override onlyFarmingCenter {
        bytes32 incentiveId = IncentiveId.compute(key);

        Farm memory farm = farms[tokenId][incentiveId];
        require(farm.liquidity != 0, 'farm does not exist');

        Incentive storage incentive = incentives[incentiveId];
        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

        uint256 reward;
        uint256 bonusReward;

        {
            if (_activeIncentiveInPool(key.pool) != address(virtualPool)) incentive.deactivated = true; // pool can "detach" by itself
            int24 tick = incentive.deactivated ? virtualPool.globalTick() : _getTickInPool(key.pool);

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
                FullMath.mulDiv(innerRewardGrowth0 - farm.innerRewardGrowth0, farm.liquidity, Constants.Q128),
                FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, Constants.Q128)
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
    function getRewardInfo(
        IncentiveKey memory key,
        uint256 tokenId
    ) external view override returns (uint256 reward, uint256 bonusReward) {
        bytes32 incentiveId = IncentiveId.compute(key);

        Farm memory farm = farms[tokenId][incentiveId];
        require(farm.liquidity > 0, 'farm does not exist');

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

    /// @notice reward amounts should be updated before calling this method
    /// @inheritdoc IAlgebraEternalFarming
    function collectRewards(
        IncentiveKey memory key,
        uint256 tokenId,
        address _owner
    ) external override onlyFarmingCenter returns (uint256 reward, uint256 bonusReward) {
        (bytes32 incentiveId, Incentive storage incentive) = _getIncentiveByKey(key);

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

        Farm memory farm = farms[tokenId][incentiveId];
        require(farm.liquidity != 0, 'farm does not exist');

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = virtualPool.getInnerRewardsGrowth(
            farm.tickLower,
            farm.tickUpper
        );

        (reward, bonusReward) = (
            FullMath.mulDiv(innerRewardGrowth0 - farm.innerRewardGrowth0, farm.liquidity, Constants.Q128),
            FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, Constants.Q128)
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

    function _addRewards(
        IAlgebraEternalVirtualPool virtualPool,
        uint256 amount0,
        uint256 amount1,
        bytes32 incentiveId
    ) private {
        virtualPool.addRewards(amount0, amount1);
        emit RewardsAdded(amount0, amount1, incentiveId);
    }

    function _setRewardRates(
        IAlgebraEternalVirtualPool virtualPool,
        uint128 rate0,
        uint128 rate1,
        bytes32 incentiveId
    ) private {
        virtualPool.setRates(rate0, rate1);
        emit RewardsRatesChanged(rate0, rate1, incentiveId);
    }
}
