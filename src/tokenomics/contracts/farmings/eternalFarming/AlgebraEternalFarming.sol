// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;

import './interfaces/IAlgebraEternalFarming.sol';
import './interfaces/IAlgebraEternalVirtualPool.sol';
import './EternalVirtualPool.sol';
import '../../libraries/IncentiveId.sol';

import '../../libraries/VirtualPoolConstants.sol';

import '@cryptoalgebra/core/contracts/libraries/SafeCast.sol';
import '@cryptoalgebra/core/contracts/libraries/FullMath.sol';

import '../../base/AlgebraFarming.sol';

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
        if (_incentive != address(0)) revert farmingAlreadyExists();

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
        (, address _eternalVirtualPool) = _getCurrentVirtualPools(key.pool);

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(_eternalVirtualPool);

        (uint128 rewardRate0, uint128 rewardRate1) = virtualPool.rewardRates();
        if (rewardRate0 | rewardRate1 != 0) {
            _setRewardRates(virtualPool, 0, 0, IncentiveId.compute(key));
        }

        _deactivateIncentive(key, _eternalVirtualPool);
    }

    /// @inheritdoc IAlgebraFarming
    function decreaseRewardsAmount(
        IncentiveKey memory key,
        uint128 rewardAmount,
        uint128 bonusRewardAmount
    ) external override onlyOwner {
        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];

        _checkIsIncentiveExist(incentive);

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

        unchecked {
            (uint128 rewardReserve0, uint128 rewardReserve1) = virtualPool.rewardReserves();
            if (rewardAmount > rewardReserve0) rewardAmount = rewardReserve0;
            if (rewardAmount >= incentive.totalReward) rewardAmount = incentive.totalReward - 1; // to not trigger 'non-existent incentive'
            incentive.totalReward = incentive.totalReward - rewardAmount;

            if (bonusRewardAmount > rewardReserve1) bonusRewardAmount = rewardReserve1;
            incentive.bonusReward = incentive.bonusReward - bonusRewardAmount;
        }

        virtualPool.decreaseRewards(rewardAmount, bonusRewardAmount);

        if (rewardAmount > 0) TransferHelper.safeTransfer(address(key.rewardToken), msg.sender, rewardAmount);
        if (bonusRewardAmount > 0)
            TransferHelper.safeTransfer(address(key.bonusRewardToken), msg.sender, bonusRewardAmount);

        emit RewardAmountsDecreased(rewardAmount, bonusRewardAmount, incentiveId);
    }

    /// @inheritdoc IAlgebraFarming
    function addRewards(IncentiveKey memory key, uint128 rewardAmount, uint128 bonusRewardAmount) external override {
        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];
        _checkIsIncentiveExist(incentive);
        if (incentive.deactivated) revert incentiveStopped();

        (rewardAmount, bonusRewardAmount) = _receiveRewards(key, rewardAmount, bonusRewardAmount, incentive);

        if (rewardAmount | bonusRewardAmount > 0) {
            _addRewards(
                IAlgebraEternalVirtualPool(incentive.virtualPoolAddress),
                rewardAmount,
                bonusRewardAmount,
                incentiveId
            );
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
        if (farmsForToken[incentiveId].liquidity != 0) revert tokenAlreadyFarmed();

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = _getInnerRewardsGrowth(
            IAlgebraEternalVirtualPool(virtualPoolAddress),
            tickLower,
            tickUpper
        );

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
        if (farm.liquidity == 0) revert farmDoesNotExist();

        (uint256 reward, uint256 bonusReward) = _updatePosition(
            farm,
            key,
            incentiveId,
            _owner,
            -int256(uint256(farm.liquidity)).toInt128()
        );

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

    function _updatePosition(
        Farm memory farm,
        IncentiveKey memory key,
        bytes32 incentiveId,
        address _owner,
        int128 liquidityDelta
    ) internal returns (uint256 reward, uint256 bonusReward) {
        Incentive storage incentive = incentives[incentiveId];
        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

        {
            int24 tick;
            if (incentive.deactivated) {
                tick = virtualPool.globalTick();
            } else {
                tick = _getTickInPool(key.pool);
            }

            // update rewards, as ticks may be cleared when liquidity decreases
            _updatePositionInVirtualPool(
                address(virtualPool),
                uint32(block.timestamp),
                farm.tickLower,
                farm.tickUpper,
                0,
                tick
            );

            (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = _getInnerRewardsGrowth(
                virtualPool,
                farm.tickLower,
                farm.tickUpper
            );

            unchecked {
                if (liquidityDelta != 0) {
                    _updatePositionInVirtualPool(
                        address(virtualPool),
                        uint32(block.timestamp),
                        farm.tickLower,
                        farm.tickUpper,
                        liquidityDelta,
                        tick
                    );
                }

                (reward, bonusReward) = (
                    FullMath.mulDiv(
                        innerRewardGrowth0 - farm.innerRewardGrowth0,
                        farm.liquidity,
                        VirtualPoolConstants.Q128
                    ),
                    FullMath.mulDiv(
                        innerRewardGrowth1 - farm.innerRewardGrowth1,
                        farm.liquidity,
                        VirtualPoolConstants.Q128
                    )
                );
            }
        }

        mapping(IERC20Minimal => uint256) storage rewardBalances = rewards[_owner];
        unchecked {
            if (reward != 0) {
                rewardBalances[key.rewardToken] += reward; // user must claim before overflow
            }
            if (bonusReward != 0) {
                rewardBalances[key.bonusRewardToken] += bonusReward; // user must claim before overflow
            }
        }
    }

    /// @notice reward amounts can be outdated, actual amounts could be obtained via static call of `collectRewards` in FarmingCenter
    /// @inheritdoc IAlgebraFarming
    function getRewardInfo(
        IncentiveKey memory key,
        uint256 tokenId
    ) external view override returns (uint256 reward, uint256 bonusReward) {
        bytes32 incentiveId = IncentiveId.compute(key);

        Farm memory farm = farms[tokenId][incentiveId];
        if (farm.liquidity == 0) revert farmDoesNotExist();

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentives[incentiveId].virtualPoolAddress);

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = _getInnerRewardsGrowth(
            virtualPool,
            farm.tickLower,
            farm.tickUpper
        );

        unchecked {
            (reward, bonusReward) = (
                FullMath.mulDiv(
                    innerRewardGrowth0 - farm.innerRewardGrowth0,
                    farm.liquidity,
                    VirtualPoolConstants.Q128
                ),
                FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, VirtualPoolConstants.Q128)
            );
        }
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
        _checkIsIncentiveExist(incentive);

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);
        virtualPool.increaseCumulative(uint32(block.timestamp));

        Farm memory farm = farms[tokenId][incentiveId];
        if (farm.liquidity == 0) revert farmDoesNotExist();

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = _getInnerRewardsGrowth(
            virtualPool,
            farm.tickLower,
            farm.tickUpper
        );

        unchecked {
            (reward, bonusReward) = (
                FullMath.mulDiv(
                    innerRewardGrowth0 - farm.innerRewardGrowth0,
                    farm.liquidity,
                    VirtualPoolConstants.Q128
                ),
                FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, VirtualPoolConstants.Q128)
            );
        }

        farms[tokenId][incentiveId].innerRewardGrowth0 = innerRewardGrowth0;
        farms[tokenId][incentiveId].innerRewardGrowth1 = innerRewardGrowth1;

        mapping(IERC20Minimal => uint256) storage rewardBalances = rewards[_owner];
        unchecked {
            if (reward != 0) {
                rewardBalances[key.rewardToken] += reward; // user must claim before overflow
            }
            if (bonusReward != 0) {
                rewardBalances[key.bonusRewardToken] += bonusReward; // user must claim before overflow
            }
        }

        emit RewardsCollected(tokenId, incentiveId, reward, bonusReward);
    }

    function _getInnerRewardsGrowth(
        IAlgebraEternalVirtualPool virtualPool,
        int24 tickLower,
        int24 tickUpper
    ) private view returns (uint256, uint256) {
        return virtualPool.getInnerRewardsGrowth(tickLower, tickUpper);
    }

    function _addRewards(
        IAlgebraEternalVirtualPool virtualPool,
        uint128 amount0,
        uint128 amount1,
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
