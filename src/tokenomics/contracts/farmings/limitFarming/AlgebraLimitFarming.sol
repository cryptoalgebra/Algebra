// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IAlgebraLimitFarming.sol';
import './interfaces/IAlgebraLimitVirtualPool.sol';
import '../../libraries/IncentiveId.sol';
import '../../libraries/RewardMath.sol';

import './LimitVirtualPool.sol';
import '@cryptoalgebra/core/contracts/libraries/SafeCast.sol';
import '@cryptoalgebra/periphery/contracts/libraries/TransferHelper.sol';

import '../AlgebraFarming.sol';

/// @title Algebra incentive (time-limited) farming
contract AlgebraLimitFarming is AlgebraFarming, IAlgebraLimitFarming {
    using SafeCast for int256;

    /// @notice Represents the farm for nft
    struct Farm {
        uint128 liquidity;
        int24 tickLower;
        int24 tickUpper;
    }
    /// @inheritdoc IAlgebraLimitFarming
    uint256 public immutable override maxIncentiveStartLeadTime;
    /// @inheritdoc IAlgebraLimitFarming
    uint256 public immutable override maxIncentiveDuration;

    /// @dev farms[tokenId][incentiveHash] => Farm
    /// @inheritdoc IAlgebraLimitFarming
    mapping(uint256 => mapping(bytes32 => Farm)) public override farms;

    /// @param _deployer pool deployer contract address
    /// @param _nonfungiblePositionManager the NFT position manager contract address
    /// @param _maxIncentiveStartLeadTime the max duration of an incentive in seconds
    /// @param _maxIncentiveDuration the max amount of seconds into the future the incentive startTime can be set
    constructor(
        IAlgebraPoolDeployer _deployer,
        INonfungiblePositionManager _nonfungiblePositionManager,
        uint256 _maxIncentiveStartLeadTime,
        uint256 _maxIncentiveDuration
    ) AlgebraFarming(_deployer, _nonfungiblePositionManager) {
        maxIncentiveStartLeadTime = _maxIncentiveStartLeadTime;
        maxIncentiveDuration = _maxIncentiveDuration;
    }

    /// @inheritdoc IAlgebraLimitFarming
    function createLimitFarming(
        IncentiveKey memory key,
        Tiers calldata tiers,
        IncentiveParams memory params
    ) external override onlyIncentiveMaker returns (address virtualPool) {
        (address _incentive, ) = _getCurrentVirtualPools(key.pool);
        address activeIncentive = key.pool.activeIncentive();
        uint32 _activeEndTimestamp;
        if (_incentive != address(0)) {
            _activeEndTimestamp = IAlgebraLimitVirtualPool(_incentive).desiredEndTimestamp();
        }

        require(
            _activeEndTimestamp < block.timestamp && (activeIncentive != _incentive || _incentive == address(0)),
            'already has active incentive'
        );
        require(params.reward > 0, 'reward must be positive');
        require(block.timestamp <= key.startTime, 'start time too low');
        require(key.startTime - block.timestamp <= maxIncentiveStartLeadTime, 'start time too far into future');
        require(key.startTime < key.endTime, 'start must be before end time');
        require(key.endTime - key.startTime <= maxIncentiveDuration, 'incentive duration is too long');

        virtualPool = address(
            new LimitVirtualPool(
                address(farmingCenter),
                address(this),
                address(key.pool),
                uint32(key.startTime),
                uint32(key.endTime)
            )
        );
        (, params.reward, params.bonusReward) = _createFarming(
            virtualPool,
            key,
            params.reward,
            params.bonusReward,
            params.minimalPositionWidth,
            params.multiplierToken,
            tiers
        );

        emit LimitFarmingCreated(
            key.rewardToken,
            key.bonusRewardToken,
            key.pool,
            key.startTime,
            key.endTime,
            params.reward,
            params.bonusReward,
            tiers,
            params.multiplierToken,
            params.minimalPositionWidth,
            params.enterStartTime
        );
    }

    /// @inheritdoc IAlgebraFarming
    function addRewards(
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward
    ) external override onlyIncentiveMaker {
        require(block.timestamp < key.endTime, 'cannot add rewards after endTime');

        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];
        (reward, bonusReward) = _receiveRewards(key, reward, bonusReward, incentive);

        if (reward | bonusReward > 0) {
            emit RewardsAdded(reward, bonusReward, incentiveId);
        }
    }

    /// @inheritdoc IAlgebraFarming
    function decreaseRewardsAmount(
        IncentiveKey memory key,
        uint256 rewardAmount,
        uint256 bonusRewardAmount
    ) external override onlyIncentiveMaker {
        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];

        require(block.timestamp < key.endTime || incentive.totalLiquidity == 0, 'incentive finished');

        uint256 _totalReward = incentive.totalReward;
        if (rewardAmount >= _totalReward) rewardAmount = _totalReward - 1; // to not trigger 'non-existent incentive'
        incentive.totalReward = _totalReward - rewardAmount;

        uint256 _bonusReward = incentive.bonusReward;
        if (bonusRewardAmount > _bonusReward) bonusRewardAmount = _bonusReward;
        incentive.bonusReward = _bonusReward - bonusRewardAmount;

        if (rewardAmount > 0) TransferHelper.safeTransfer(address(key.rewardToken), msg.sender, rewardAmount);
        if (bonusRewardAmount > 0)
            TransferHelper.safeTransfer(address(key.bonusRewardToken), msg.sender, bonusRewardAmount);

        emit RewardAmountsDecreased(rewardAmount, bonusRewardAmount, incentiveId);
    }

    /// @inheritdoc IAlgebraFarming
    function deactivateIncentive(IncentiveKey memory key) external override onlyIncentiveMaker {
        (, Incentive storage incentive) = _getIncentiveByKey(key);
        _deactivateIncentive(key, incentive.virtualPoolAddress, incentive);
    }

    /// @inheritdoc IAlgebraFarming
    function enterFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        uint256 tokensLocked
    ) external override onlyFarmingCenter {
        require(!isEmergencyWithdrawActivated, 'emergency activated');

        require(block.timestamp < key.startTime, 'incentive has already started');

        (bytes32 incentiveId, int24 tickLower, int24 tickUpper, uint128 liquidity, ) = _enterFarming(
            key,
            tokenId,
            tokensLocked
        );

        mapping(bytes32 => Farm) storage farmsForToken = farms[tokenId];
        require(farmsForToken[incentiveId].liquidity == 0, 'token already farmed');

        Incentive storage incentive = incentives[incentiveId];
        uint224 _currentTotalLiquidity = incentive.totalLiquidity;
        require(_currentTotalLiquidity + liquidity >= _currentTotalLiquidity, 'liquidity overflow');
        incentive.totalLiquidity = _currentTotalLiquidity + liquidity;

        farmsForToken[incentiveId] = Farm({liquidity: liquidity, tickLower: tickLower, tickUpper: tickUpper});

        emit FarmEntered(tokenId, incentiveId, liquidity, tokensLocked);
    }

    /// @inheritdoc IAlgebraFarming
    function exitFarming(IncentiveKey memory key, uint256 tokenId, address _owner) external override onlyFarmingCenter {
        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];

        Farm memory farm = farms[tokenId][incentiveId];
        require(farm.liquidity != 0, 'farm does not exist');

        if (isEmergencyWithdrawActivated) {
            delete farms[tokenId][incentiveId];

            emit FarmEnded(tokenId, incentiveId, address(key.rewardToken), address(key.bonusRewardToken), _owner, 0, 0);

            return;
        }

        // anyone can call exitFarming if the block time is after the end time of the incentive
        require(block.timestamp > key.endTime || block.timestamp < key.startTime, 'cannot exitFarming before end time');

        uint256 reward;
        uint256 bonusReward;

        IAlgebraLimitVirtualPool virtualPool = IAlgebraLimitVirtualPool(incentive.virtualPoolAddress);

        if (block.timestamp > key.endTime) {
            uint256 activeTime;
            {
                bool wasFinished;
                (wasFinished, activeTime) = virtualPool.finish();
                if (!wasFinished) {
                    if (_isIncentiveActiveInPool(key.pool, address(virtualPool))) {
                        farmingCenter.connectVirtualPool(key.pool, address(0));
                    }
                }
            }

            uint160 secondsPerLiquidityInsideX128 = virtualPool.getInnerSecondsPerLiquidity(
                farm.tickLower,
                farm.tickUpper
            );

            uint224 _totalLiquidity = activeTime > 0 ? 0 : incentive.totalLiquidity; // used only if no one was active in incentive
            reward = RewardMath.computeRewardAmount(
                incentive.totalReward,
                activeTime,
                farm.liquidity,
                _totalLiquidity,
                secondsPerLiquidityInsideX128
            );

            mapping(IERC20Minimal => uint256) storage rewardBalances = rewards[_owner];
            if (reward > 0) {
                rewardBalances[key.rewardToken] += reward; // user must claim before overflow
            }

            if (incentive.bonusReward != 0) {
                bonusReward = RewardMath.computeRewardAmount(
                    incentive.bonusReward,
                    activeTime,
                    farm.liquidity,
                    _totalLiquidity,
                    secondsPerLiquidityInsideX128
                );
                if (bonusReward > 0) {
                    rewardBalances[key.bonusRewardToken] += bonusReward; // user must claim before overflow
                }
            }
        } else {
            // pool can "detach" by itself
            if (!incentive.deactivated) {
                if (!_isIncentiveActiveInPool(key.pool, address(virtualPool)))
                    _deactivateIncentive(key, address(virtualPool), incentive);
            }
            int24 tick = incentive.deactivated ? virtualPool.globalTick() : _getTickInPool(key.pool);

            virtualPool.applyLiquidityDeltaToPosition(
                uint32(block.timestamp),
                farm.tickLower,
                farm.tickUpper,
                -int256(farm.liquidity).toInt128(),
                tick
            );
            incentive.totalLiquidity -= farm.liquidity;
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
    function getRewardInfo(
        IncentiveKey memory key,
        uint256 tokenId
    ) external view override returns (uint256 reward, uint256 bonusReward) {
        bytes32 incentiveId = IncentiveId.compute(key);

        Farm memory farm = farms[tokenId][incentiveId];
        require(farm.liquidity != 0, 'farm does not exist');

        Incentive storage incentive = incentives[incentiveId];

        IAlgebraLimitVirtualPool virtualPool = IAlgebraLimitVirtualPool(incentive.virtualPoolAddress);
        uint160 secondsPerLiquidityInsideX128 = virtualPool.getInnerSecondsPerLiquidity(farm.tickLower, farm.tickUpper);

        uint256 activeTime = key.endTime - virtualPool.timeOutside() - key.startTime;

        uint224 _totalLiquidity = activeTime > 0 ? 0 : incentive.totalLiquidity; // used only if no one was active in incentive
        reward = RewardMath.computeRewardAmount(
            incentive.totalReward,
            activeTime,
            farm.liquidity,
            _totalLiquidity,
            secondsPerLiquidityInsideX128
        );
        bonusReward = RewardMath.computeRewardAmount(
            incentive.bonusReward,
            activeTime,
            farm.liquidity,
            _totalLiquidity,
            secondsPerLiquidityInsideX128
        );
    }
}
