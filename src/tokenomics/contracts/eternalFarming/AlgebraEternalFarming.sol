// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IAlgebraEternalFarming.sol';
import './interfaces/IAlgebraEternalVirtualPool.sol';
import '../interfaces/IFarmingCenter.sol';
import '../libraries/IncentiveId.sol';
import '../libraries/RewardMath.sol';
import '../libraries/NFTPositionInfo.sol';
import '../libraries/SafeCast.sol';

import './EternalVirtualPool.sol';

import 'algebra/contracts/interfaces/IAlgebraPoolDeployer.sol';
import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra/contracts/interfaces/IERC20Minimal.sol';
import 'algebra/contracts/libraries/FullMath.sol';
import 'algebra/contracts/libraries/Constants.sol';

import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import 'algebra-periphery/contracts/libraries/TransferHelper.sol';
import 'algebra-periphery/contracts/base/Multicall.sol';

/// @title Algebra canonical staking interface
contract AlgebraEternalFarming is IAlgebraEternalFarming, Multicall {
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

    /// @inheritdoc IAlgebraFarming
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;

    /// @inheritdoc IAlgebraFarming
    IAlgebraPoolDeployer public immutable override deployer;

    /// @inheritdoc IAlgebraFarming
    uint256 public immutable override maxIncentiveStartLeadTime;
    /// @inheritdoc IAlgebraFarming
    uint256 public immutable override maxIncentiveDuration;

    /// @inheritdoc IAlgebraFarming
    IFarmingCenter public override farmingCenter;

    /// @dev bytes32 refers to the return value of IncentiveId.compute
    mapping(bytes32 => Incentive) public override incentives;

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

    address private incentiveMaker;
    address private owner;

    // @inheritdoc IAlgebraPoolDeployer
    function setIncentiveMaker(address _incentiveMaker) external override onlyOwner {
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

    /// @inheritdoc IAlgebraEternalFarming
    function createIncentive(
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward,
        uint128 rewardRate,
        uint128 bonusRewardRate
    ) external override onlyIncentiveMaker returns (address virtualPool) {
        (, address _incentive) = farmingCenter.virtualPoolAddresses(address(key.pool));

        require(_incentive == address(0), 'Farming already exists');

        bytes32 incentiveId = IncentiveId.compute(key);

        incentives[incentiveId].totalReward += reward;

        incentives[incentiveId].bonusReward += bonusReward;

        virtualPool = address(new EternalVirtualPool(address(farmingCenter), address(this), address(key.pool)));

        farmingCenter.setFarmingCenterAddress(key.pool, virtualPool);

        incentives[incentiveId].isPoolCreated = true;
        incentives[incentiveId].virtualPoolAddress = virtualPool;

        TransferHelper.safeTransferFrom(address(key.bonusRewardToken), msg.sender, address(this), bonusReward);

        TransferHelper.safeTransferFrom(address(key.rewardToken), msg.sender, address(this), reward);

        IAlgebraEternalVirtualPool(virtualPool).addRewards(reward, bonusReward);
        IAlgebraEternalVirtualPool(virtualPool).setRates(rewardRate, bonusRewardRate);

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

        emit RewardsAdded(reward, bonusReward, incentiveId);
        emit RewardsRatesChanged(rewardRate, bonusRewardRate, incentiveId);
    }

    /// @inheritdoc IAlgebraFarming
    function detachIncentive(IncentiveKey memory key) external override onlyIncentiveMaker {
        (, address _incentive) = farmingCenter.virtualPoolAddresses(address(key.pool));
        require(_incentive != address(0), 'Farming do not exists');
        bytes32 incentiveId = IncentiveId.compute(key);

        require(incentives[incentiveId].virtualPoolAddress == _incentive, 'Another farming is active');
        farmingCenter.setFarmingCenterAddress(key.pool, address(0));

        emit IncentiveDetached(key.rewardToken, key.bonusRewardToken, key.pool, _incentive, key.startTime, key.endTime);
    }

    /// @inheritdoc IAlgebraFarming
    function attachIncentive(IncentiveKey memory key) external override onlyIncentiveMaker {
        (, address _incentive) = farmingCenter.virtualPoolAddresses(address(key.pool));
        require(_incentive == address(0), 'Farming already exists');

        bytes32 incentiveId = IncentiveId.compute(key);

        require(incentives[incentiveId].virtualPoolAddress != address(0), 'Invalid farming');

        farmingCenter.setFarmingCenterAddress(key.pool, incentives[incentiveId].virtualPoolAddress);

        emit IncentiveAttached(key.rewardToken, key.bonusRewardToken, key.pool, _incentive, key.startTime, key.endTime);
    }

    /// @inheritdoc IAlgebraEternalFarming
    function addRewards(
        IncentiveKey memory key,
        uint256 rewardAmount,
        uint256 bonusRewardAmount
    ) external override {
        bytes32 incentiveId = IncentiveId.compute(key);
        require(incentives[incentiveId].totalReward > 0, 'AlgebraFarming::addRewards: non-existent incentive');

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
            IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(
                incentives[incentiveId].virtualPoolAddress
            );
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
    function enterFarming(IncentiveKey calldata key, uint256 tokenId) external override onlyFarmingCenter {
        bytes32 incentiveId = IncentiveId.compute(key);

        require(incentives[incentiveId].totalReward > 0, 'AlgebraFarming::enterFarming: non-existent incentive'); // TOD
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

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentives[incentiveId].virtualPoolAddress);
        virtualPool.applyLiquidityDeltaToPosition(
            uint32(block.timestamp),
            tickLower,
            tickUpper,
            int256(liquidity).toInt128(),
            tick
        );

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = virtualPool.getInnerRewardsGrowth(
            tickLower,
            tickUpper
        );

        farms[tokenId][incentiveId] = Farm({
            liquidity: liquidity,
            tickLower: tickLower,
            tickUpper: tickUpper,
            innerRewardGrowth0: innerRewardGrowth0,
            innerRewardGrowth1: innerRewardGrowth1
        });

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

        Farm memory farm = farms[tokenId][incentiveId];

        require(farm.liquidity != 0, 'AlgebraFarming::exitFarming: farm does not exist');

        incentives[incentiveId].numberOfFarms--;

        uint256 reward = 0;
        uint256 bonusReward = 0;

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

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

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

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
        Incentive memory incentive = incentives[incentiveId];
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
