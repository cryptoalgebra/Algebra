// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IAlgebraIncentiveFarming.sol';
import './interfaces/IAlgebraIncentiveVirtualPool.sol';
import '../interfaces/IFarmingCenter.sol';
import '../libraries/IncentiveId.sol';
import '../libraries/RewardMath.sol';
import '../libraries/NFTPositionInfo.sol';
import '../libraries/SafeCast.sol';

import './IncentiveVirtualPool.sol';

import 'algebra/contracts/interfaces/IAlgebraPoolDeployer.sol';
import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra/contracts/interfaces/IERC20Minimal.sol';

import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import 'algebra-periphery/contracts/libraries/TransferHelper.sol';
import 'algebra-periphery/contracts/base/Multicall.sol';

/// @title Algebra canonical staking interface
contract AlgebraIncentiveFarming is IAlgebraIncentiveFarming, Multicall {
    using SafeCast for int256;
    /// @notice Represents a staking incentive
    struct Incentive {
        uint256 totalReward;
        uint256 bonusReward;
        address virtualPoolAddress;
        uint96 numberOfFarms;
        bool isPoolCreated;
        uint224 totalLiquidity;
    }

    /// @notice Represents the farm for nft
    struct Farm {
        uint128 liquidity;
        int24 tickLower;
        int24 tickUpper;
    }

    /// @inheritdoc IAlgebraFarming
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;

    /// @inheritdoc IAlgebraFarming
    IAlgebraPoolDeployer public immutable override deployer;

    /// @inheritdoc IAlgebraFarming
    IFarmingCenter public override farmingCenter;

    /// @inheritdoc IAlgebraFarming
    uint256 public immutable override maxIncentiveStartLeadTime;
    /// @inheritdoc IAlgebraFarming
    uint256 public immutable override maxIncentiveDuration;

    /// @dev bytes32 refers to the return value of IncentiveId.compute
    mapping(bytes32 => Incentive) public override incentives;

    /// @dev farms[tokenId][incentiveHash] => Farm
    mapping(uint256 => mapping(bytes32 => Farm)) public override farms;

    address private incentiveMaker;
    address private owner;

    /// @inheritdoc IAlgebraFarming
    function setIncentiveMaker(address _incentiveMaker) external override onlyOwner {
        emit IncentiveMakerChanged(incentiveMaker, _incentiveMaker);
        incentiveMaker = _incentiveMaker;
    }

    /// @inheritdoc IAlgebraFarming
    function setFarmingCenterAddress(address _farmingCenter) external override onlyOwner {
        farmingCenter = IFarmingCenter(_farmingCenter);
    }

    /// @dev rewards[rewardToken][owner] => uint256
    /// @inheritdoc IAlgebraFarming
    mapping(IERC20Minimal => mapping(address => uint256)) public override rewards;

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
    /// @param _maxIncentiveStartLeadTime the max duration of an incentive in seconds
    /// @param _maxIncentiveDuration the max amount of seconds into the future the incentive startTime can be set
    constructor(
        IAlgebraPoolDeployer _deployer,
        INonfungiblePositionManager _nonfungiblePositionManager,
        uint256 _maxIncentiveStartLeadTime,
        uint256 _maxIncentiveDuration
    ) {
        owner = msg.sender;
        deployer = _deployer;
        nonfungiblePositionManager = _nonfungiblePositionManager;
        maxIncentiveStartLeadTime = _maxIncentiveStartLeadTime;
        maxIncentiveDuration = _maxIncentiveDuration;
    }

    /// @inheritdoc IAlgebraIncentiveFarming
    function createIncentive(
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward
    ) external override onlyIncentiveMaker returns (address virtualPool) {
        (address _incentive, ) = farmingCenter.virtualPoolAddresses(address(key.pool));
        uint32 _activeEndTimestamp;
        if (_incentive != address(0)) {
            _activeEndTimestamp = IAlgebraIncentiveVirtualPool(_incentive).desiredEndTimestamp();
        }

        require(
            _activeEndTimestamp < block.timestamp,
            'AlgebraFarming::createIncentive: there is already active incentive'
        );
        require(reward > 0, 'AlgebraFarming::createIncentive: reward must be positive');
        require(
            block.timestamp <= key.startTime,
            'AlgebraFarming::createIncentive: start time must be now or in the future'
        );
        require(
            key.startTime - block.timestamp <= maxIncentiveStartLeadTime,
            'AlgebraFarming::createIncentive: start time too far into future'
        );
        require(key.startTime < key.endTime, 'AlgebraFarming::createIncentive: start time must be before end time');
        require(
            key.endTime - key.startTime <= maxIncentiveDuration,
            'AlgebraFarming::createIncentive: incentive duration is too long'
        );

        bytes32 incentiveId = IncentiveId.compute(key);

        incentives[incentiveId].totalReward += reward;

        incentives[incentiveId].bonusReward += bonusReward;

        virtualPool = address(
            new IncentiveVirtualPool(address(farmingCenter), address(this), uint32(key.startTime), uint32(key.endTime))
        );

        farmingCenter.setFarmingCenterAddress(key.pool, virtualPool);

        incentives[incentiveId].isPoolCreated = true;
        incentives[incentiveId].virtualPoolAddress = address(virtualPool);

        TransferHelper.safeTransferFrom(address(key.bonusRewardToken), msg.sender, address(this), bonusReward);

        TransferHelper.safeTransferFrom(address(key.rewardToken), msg.sender, address(this), reward);

        emit IncentiveCreated(
            key.rewardToken,
            key.bonusRewardToken,
            key.pool,
            virtualPool,
            key.startTime,
            key.endTime,
            reward,
            bonusReward
        );
    }

    /// @inheritdoc IAlgebraFarming
    function detachIncentive(IncentiveKey memory key) external override onlyIncentiveMaker {
        (address _incentive, ) = farmingCenter.virtualPoolAddresses(address(key.pool));
        require(_incentive != address(0), 'Farming do not exists');

        farmingCenter.setFarmingCenterAddress(key.pool, address(0));

        emit IncentiveDetached(key.rewardToken, key.bonusRewardToken, key.pool, _incentive, key.startTime, key.endTime);
    }

    /// @inheritdoc IAlgebraFarming
    function enterFarming(IncentiveKey memory key, uint256 tokenId) external override onlyFarmingCenter {
        require(block.timestamp < key.startTime, 'AlgebraFarming::enterFarming: incentive has already started');

        bytes32 incentiveId = IncentiveId.compute(key);

        require(incentives[incentiveId].totalReward > 0, 'AlgebraFarming::enterFarming: non-existent incentive');
        require(farms[tokenId][incentiveId].liquidity == 0, 'AlgebraFarming::enterFarming: token already farmed');

        (IAlgebraPool pool, int24 tickLower, int24 tickUpper, uint128 liquidity) = NFTPositionInfo.getPositionInfo(
            deployer,
            nonfungiblePositionManager,
            tokenId
        );

        require(pool == key.pool, 'AlgebraFarming::enterFarming: token pool is not the incentive pool');
        require(liquidity > 0, 'AlgebraFarming::enterFarming: cannot farm token with 0 liquidity');

        incentives[incentiveId].numberOfFarms++;
        (, int24 tick, , , , , , ) = pool.globalState();

        IAlgebraIncentiveVirtualPool virtualPool = IAlgebraIncentiveVirtualPool(
            incentives[incentiveId].virtualPoolAddress
        );

        virtualPool.applyLiquidityDeltaToPosition(tickLower, tickUpper, int256(liquidity).toInt128(), tick);

        farms[tokenId][incentiveId] = Farm({liquidity: liquidity, tickLower: tickLower, tickUpper: tickUpper});

        incentives[incentiveId].totalLiquidity += liquidity;

        emit FarmStarted(tokenId, incentiveId, liquidity);
    }

    /// @inheritdoc IAlgebraFarming
    function exitFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        address _owner
    ) external override onlyFarmingCenter {
        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive memory incentive = incentives[incentiveId];
        // anyone can call exitFarming if the block time is after the end time of the incentive
        require(
            block.timestamp > key.endTime || block.timestamp < key.startTime,
            'AlgebraFarming::exitFarming: cannot exitFarming before end time'
        );

        Farm memory farm = farms[tokenId][incentiveId];

        require(farm.liquidity != 0, 'AlgebraFarming::exitFarming: farm does not exist');

        incentives[incentiveId].numberOfFarms--;

        uint256 reward = 0;
        uint256 bonusReward = 0;

        IAlgebraIncentiveVirtualPool virtualPool = IAlgebraIncentiveVirtualPool(
            incentives[incentiveId].virtualPoolAddress
        );

        if (block.timestamp > key.endTime) {
            (uint160 secondsPerLiquidityInsideX128, uint256 initTimestamp, uint256 endTimestamp) = virtualPool
                .getInnerSecondsPerLiquidity(farm.tickLower, farm.tickUpper);

            if (endTimestamp == 0) {
                virtualPool.finish(uint32(block.timestamp), uint32(key.startTime));
                (secondsPerLiquidityInsideX128, initTimestamp, endTimestamp) = virtualPool.getInnerSecondsPerLiquidity(
                    farm.tickLower,
                    farm.tickUpper
                );
            }

            reward = RewardMath.computeRewardAmount(
                incentive.totalReward,
                initTimestamp,
                endTimestamp,
                farm.liquidity,
                incentive.totalLiquidity,
                secondsPerLiquidityInsideX128
            );

            rewards[key.rewardToken][_owner] += reward;

            if (incentive.bonusReward != 0) {
                bonusReward = RewardMath.computeRewardAmount(
                    incentive.bonusReward,
                    initTimestamp,
                    endTimestamp,
                    farm.liquidity,
                    incentive.totalLiquidity,
                    secondsPerLiquidityInsideX128
                );

                rewards[key.bonusRewardToken][_owner] += bonusReward;
            }
        } else {
            (IAlgebraPool pool, , , ) = NFTPositionInfo.getPositionInfo(deployer, nonfungiblePositionManager, tokenId);
            (, int24 tick, , , , , , ) = pool.globalState();

            virtualPool.applyLiquidityDeltaToPosition(
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

    function _claimReward(
        IERC20Minimal rewardToken,
        address from,
        address to,
        uint256 amountRequested
    ) private returns (uint256 reward) {
        reward = rewards[rewardToken][from];

        if (amountRequested != 0 && amountRequested < reward) {
            reward = amountRequested;
        }

        rewards[rewardToken][from] -= reward;
        TransferHelper.safeTransfer(address(rewardToken), to, reward);

        emit RewardClaimed(to, reward, address(rewardToken), from);
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

        Incentive memory incentive = incentives[incentiveId];

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

        reward = RewardMath.computeRewardAmount(
            incentive.totalReward,
            initTimestamp,
            endTimestamp,
            farm.liquidity,
            incentive.totalLiquidity,
            secondsPerLiquidityInsideX128
        );
        bonusReward = RewardMath.computeRewardAmount(
            incentive.bonusReward,
            initTimestamp,
            endTimestamp,
            farm.liquidity,
            incentive.totalLiquidity,
            secondsPerLiquidityInsideX128
        );
    }
}
