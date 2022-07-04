// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IAlgebraIncentiveFarming.sol';
import './interfaces/IAlgebraIncentiveVirtualPool.sol';
import '../../libraries/IncentiveId.sol';
import '../../libraries/RewardMath.sol';

import './IncentiveVirtualPool.sol';
import 'algebra/contracts/libraries/SafeCast.sol';
import 'algebra-periphery/contracts/libraries/TransferHelper.sol';

import '../AlgebraFarming.sol';

/// @title Algebra incentive (time-limited) farming
contract AlgebraIncentiveFarming is AlgebraFarming, IAlgebraIncentiveFarming {
    using SafeCast for int256;

    /// @notice Represents the farm for nft
    struct Farm {
        uint128 liquidity;
        int24 tickLower;
        int24 tickUpper;
    }
    /// @inheritdoc IAlgebraIncentiveFarming
    uint256 public immutable override maxIncentiveStartLeadTime;
    /// @inheritdoc IAlgebraIncentiveFarming
    uint256 public immutable override maxIncentiveDuration;

    /// @dev farms[tokenId][incentiveHash] => Farm
    /// @inheritdoc IAlgebraIncentiveFarming
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

    /// @inheritdoc IAlgebraIncentiveFarming
    function createIncentive(
        IncentiveKey memory key,
        Tiers calldata tiers,
        IncentiveParams memory params
    ) external override onlyIncentiveMaker returns (address virtualPool) {
        (address _incentive, ) = _getCurrentVirtualPools(key.pool);
        address activeIncentive = key.pool.activeIncentive();
        uint32 _activeEndTimestamp;
        if (_incentive != address(0)) {
            _activeEndTimestamp = IAlgebraIncentiveVirtualPool(_incentive).desiredEndTimestamp();
        }

        require(
            _activeEndTimestamp < block.timestamp && (activeIncentive != _incentive || _incentive == address(0)),
            'AlgebraFarming::createIncentive: already has active incentive'
        );
        require(params.reward > 0, 'AlgebraFarming::createIncentive: reward must be positive');
        require(block.timestamp <= key.startTime, 'AlgebraFarming::createIncentive: start time too low');
        require(
            key.startTime - block.timestamp <= maxIncentiveStartLeadTime,
            'AlgebraFarming::createIncentive: start time too far into future'
        );
        require(key.startTime < key.endTime, 'AlgebraFarming::createIncentive: start must be before end time');
        require(
            key.endTime - key.startTime <= maxIncentiveDuration,
            'AlgebraFarming::createIncentive: incentive duration is too long'
        );

        virtualPool = address(
            new IncentiveVirtualPool(
                address(farmingCenter),
                address(this),
                address(key.pool),
                uint32(key.startTime),
                uint32(key.endTime)
            )
        );
        (, params.reward, params.bonusReward) = _createIncentive(
            virtualPool,
            key,
            params.reward,
            params.bonusReward,
            params.multiplierToken,
            tiers
        );

        emit IncentiveCreated(
            key.rewardToken,
            key.bonusRewardToken,
            key.pool,
            key.startTime,
            key.endTime,
            params.reward,
            params.bonusReward,
            tiers,
            params.multiplierToken,
            params.enterStartTime
        );
    }

    function addRewards(
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward
    ) external onlyIncentiveMaker {
        require(block.timestamp < key.endTime, 'AlgebraFarming::addRewards: cannot add rewards after endTime');

        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];
        (reward, bonusReward) = _receiveRewards(key, reward, bonusReward, incentive);

        if (reward | bonusReward > 0) {
            emit RewardsAdded(reward, bonusReward, incentiveId);
        }
    }

    function decreaseRewardsAmount(
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward
    ) external override onlyIncentiveMaker {
        require(block.timestamp < key.endTime, 'AlgebraFarming::decreaseRewardAmount: incentive finished');

        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];

        incentive.totalReward -= reward;
        incentive.bonusReward -= bonusReward;

        TransferHelper.safeTransfer(address(key.bonusRewardToken), msg.sender, bonusReward);
        TransferHelper.safeTransfer(address(key.rewardToken), msg.sender, reward);

        emit RewardAmountsDecreased(reward, bonusReward, incentiveId);
    }

    /// @inheritdoc IAlgebraFarming
    function detachIncentive(IncentiveKey memory key) external override onlyIncentiveMaker {
        (address _incentiveVirtualPool, ) = _getCurrentVirtualPools(key.pool);
        _detachIncentive(key, _incentiveVirtualPool);
    }

    /// @inheritdoc IAlgebraFarming
    function attachIncentive(IncentiveKey memory key) external override onlyIncentiveMaker {
        (address _incentiveVirtualPool, ) = _getCurrentVirtualPools(key.pool);
        _attachIncentive(key, _incentiveVirtualPool);
    }

    /// @inheritdoc IAlgebraFarming
    function enterFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        uint256 tokensLocked
    ) external override onlyFarmingCenter {
        require(block.timestamp < key.startTime, 'AlgebraFarming::enterFarming: incentive has already started');

        (
            bytes32 incentiveId,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            int24 currentTickInPool,
            address virtualPoolAddress
        ) = _enterFarming(key, tokenId, tokensLocked);

        require(farms[tokenId][incentiveId].liquidity == 0, 'AlgebraFarming::enterFarming: token already farmed');

        IAlgebraIncentiveVirtualPool(virtualPoolAddress).applyLiquidityDeltaToPosition(
            uint32(block.timestamp),
            tickLower,
            tickUpper,
            int256(liquidity).toInt128(),
            currentTickInPool
        );

        farms[tokenId][incentiveId] = Farm({liquidity: liquidity, tickLower: tickLower, tickUpper: tickUpper});

        emit FarmStarted(tokenId, incentiveId, liquidity, tokensLocked);
    }

    /// @inheritdoc IAlgebraFarming
    function exitFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        address _owner
    ) external override onlyFarmingCenter {
        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];
        // anyone can call exitFarming if the block time is after the end time of the incentive
        require(
            block.timestamp > key.endTime || block.timestamp < key.startTime,
            'AlgebraFarming::exitFarming: cannot exitFarming before end time'
        );

        Farm memory farm = farms[tokenId][incentiveId];

        require(farm.liquidity != 0, 'AlgebraFarming::exitFarming: farm does not exist');

        uint256 reward;
        uint256 bonusReward;

        IAlgebraIncentiveVirtualPool virtualPool = IAlgebraIncentiveVirtualPool(incentive.virtualPoolAddress);

        if (block.timestamp > key.endTime) {
            (uint160 secondsPerLiquidityInsideX128, uint256 initTimestamp, uint256 endTimestamp) = virtualPool
                .getInnerSecondsPerLiquidity(farm.tickLower, farm.tickUpper);

            if (endTimestamp == 0) {
                virtualPool.finish();
                (secondsPerLiquidityInsideX128, initTimestamp, endTimestamp) = virtualPool.getInnerSecondsPerLiquidity(
                    farm.tickLower,
                    farm.tickUpper
                );
                (address _incentive, ) = _getCurrentVirtualPools(key.pool);
                if (address(virtualPool) == _incentive) {
                    farmingCenter.connectVirtualPool(key.pool, address(0));
                }
            }

            uint224 _totalLiquidity = incentive.totalLiquidity;
            reward = RewardMath.computeRewardAmount(
                incentive.totalReward,
                initTimestamp,
                endTimestamp,
                farm.liquidity,
                _totalLiquidity,
                secondsPerLiquidityInsideX128
            );

            rewards[key.rewardToken][_owner] += reward;

            if (incentive.bonusReward != 0) {
                bonusReward = RewardMath.computeRewardAmount(
                    incentive.bonusReward,
                    initTimestamp,
                    endTimestamp,
                    farm.liquidity,
                    _totalLiquidity,
                    secondsPerLiquidityInsideX128
                );

                rewards[key.bonusRewardToken][_owner] += bonusReward;
            }
        } else {
            (, int24 tick, , , , , , ) = key.pool.globalState();

            virtualPool.applyLiquidityDeltaToPosition(
                uint32(block.timestamp),
                farm.tickLower,
                farm.tickUpper,
                -int256(farm.liquidity).toInt128(),
                tick
            );
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

        Incentive storage incentive = incentives[incentiveId];

        (
            uint160 secondsPerLiquidityInsideX128,
            uint256 initTimestamp,
            uint256 endTimestamp
        ) = IAlgebraIncentiveVirtualPool(incentive.virtualPoolAddress).getInnerSecondsPerLiquidity(
                farm.tickLower,
                farm.tickUpper
            );

        if (initTimestamp == 0) {
            initTimestamp = key.startTime;
            endTimestamp = key.endTime;
        }
        if (endTimestamp == 0) {
            endTimestamp = key.endTime;
        }

        uint224 _totalLiquidity = incentive.totalLiquidity;
        reward = RewardMath.computeRewardAmount(
            incentive.totalReward,
            initTimestamp,
            endTimestamp,
            farm.liquidity,
            _totalLiquidity,
            secondsPerLiquidityInsideX128
        );
        bonusReward = RewardMath.computeRewardAmount(
            incentive.bonusReward,
            initTimestamp,
            endTimestamp,
            farm.liquidity,
            _totalLiquidity,
            secondsPerLiquidityInsideX128
        );
    }
}
