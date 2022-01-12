// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../interfaces/IAlgebraFarming.sol';
import '../interfaces/IAlgebraIncentiveVirtualPool.sol';
import '../interfaces/IProxy.sol';
import '../libraries/IncentiveId.sol';
import '../libraries/RewardMath.sol';
import '../libraries/NFTPositionInfo.sol';
import '../libraries/SafeCast.sol';

import 'algebra/contracts/interfaces/IAlgebraPoolDeployer.sol';
import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra/contracts/interfaces/IERC20Minimal.sol';

import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import 'algebra-periphery/contracts/libraries/TransferHelper.sol';
import 'algebra-periphery/contracts/base/Multicall.sol';

/// @title Algebra canonical staking interface
contract AlgebraIncentiveFarming is IAlgebraFarming, Multicall {
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

    /// @notice Represents the deposit of a liquidity NFT
    struct Deposit {
        int24 tickLower;
        int24 tickUpper;
    }

    /// @inheritdoc IAlgebraFarming
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;

    /// @inheritdoc IAlgebraFarming
    IAlgebraPoolDeployer public immutable override deployer;

    /// @inheritdoc IAlgebraFarming
    IVirtualPoolDeployer public immutable override vdeployer;

    /// @inheritdoc IAlgebraFarming
    IProxy public override proxy;

    /// @inheritdoc IAlgebraFarming
    uint256 public immutable override maxIncentiveStartLeadTime;
    /// @inheritdoc IAlgebraFarming
    uint256 public immutable override maxIncentiveDuration;

    /// @dev bytes32 refers to the return value of IncentiveId.compute
    mapping(bytes32 => Incentive) public override incentives;

    /// @dev deposits[tokenId] => Deposit
    mapping(uint256 => Deposit) public override deposits;

    /// @dev farms[tokenId][incentiveHash] => Farm
    mapping(uint256 => mapping(bytes32 => uint128)) public override farms;

    address private incentiveMaker;
    address private owner;

    /// @inheritdoc IAlgebraFarming
    function setIncentiveMaker(address _incentiveMaker) external override onlyOwner {
        emit IncentiveMakerChanged(incentiveMaker, _incentiveMaker);
        incentiveMaker = _incentiveMaker;
    }

    function setProxyAddress(address _proxy) external override onlyOwner {
        proxy = IProxy(_proxy);
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

    modifier onlyProxy() {
        require(msg.sender == address(proxy));
        _;
    }

    /// @param _deployer pool deployer contract address
    /// @param _nonfungiblePositionManager the NFT position manager contract address
    /// @param _vdeployer virtual pool deployer contract address
    /// @param _maxIncentiveStartLeadTime the max duration of an incentive in seconds
    /// @param _maxIncentiveDuration the max amount of seconds into the future the incentive startTime can be set
    constructor(
        IAlgebraPoolDeployer _deployer,
        INonfungiblePositionManager _nonfungiblePositionManager,
        IVirtualPoolDeployer _vdeployer,
        uint256 _maxIncentiveStartLeadTime,
        uint256 _maxIncentiveDuration
    ) {
        owner = msg.sender;
        deployer = _deployer;
        vdeployer = _vdeployer;
        nonfungiblePositionManager = _nonfungiblePositionManager;
        maxIncentiveStartLeadTime = _maxIncentiveStartLeadTime;
        maxIncentiveDuration = _maxIncentiveDuration;
    }

    /// @inheritdoc IAlgebraFarming
    function createIncentive(
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward
    ) external override onlyIncentiveMaker returns (address virtualPool) {
        address _incentive = key.pool.activeIncentive();
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

        virtualPool = vdeployer.deploy(address(proxy), address(this), uint32(key.startTime), uint32(key.endTime));

        proxy.setProxyAddress(key.pool, virtualPool);

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
            key.refundee,
            reward,
            bonusReward
        );
    }

    /// @inheritdoc IAlgebraFarming
    function enterFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        int24 _tickLower,
        int24 _tickUpper
    ) external override onlyProxy {
        deposits[tokenId].tickUpper = _tickUpper;
        deposits[tokenId].tickLower = _tickLower;
        _enterFarming(key, tokenId);
    }

    /// @inheritdoc IAlgebraFarming
    function exitFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        address _owner
    ) external override onlyProxy {
        _exitFarming(key, tokenId, _owner);
    }

    /// @inheritdoc IAlgebraFarming
    function claimReward(
        IERC20Minimal rewardToken,
        address to,
        uint256 amountRequested
    ) external override returns (uint256 reward) {
        reward = rewards[rewardToken][msg.sender];

        if (amountRequested != 0 && amountRequested < reward) {
            reward = amountRequested;
        }

        rewards[rewardToken][msg.sender] -= reward;
        TransferHelper.safeTransfer(address(rewardToken), to, reward);

        emit RewardClaimed(to, reward, address(rewardToken), msg.sender);
    }

    /// @inheritdoc IAlgebraFarming
    function getRewardInfo(IncentiveKey memory key, uint256 tokenId)
        external
        view
        override
        returns (uint256 reward, uint256 bonusReward)
    {
        bytes32 incentiveId = IncentiveId.compute(key);

        uint128 liquidity = farms[tokenId][incentiveId];
        require(liquidity > 0, 'AlgebraFarming::getRewardInfo: farm does not exist');

        Deposit memory deposit = deposits[tokenId];
        Incentive memory incentive = incentives[incentiveId];

        (
            uint160 secondsPerLiquidityInsideX128,
            uint256 initTimestamp,
            uint256 endTimestamp
        ) = IAlgebraIncentiveVirtualPool(incentive.virtualPoolAddress).getInnerSecondsPerLiquidity(
                deposit.tickLower,
                deposit.tickUpper
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
            liquidity,
            incentive.totalLiquidity,
            secondsPerLiquidityInsideX128
        );
        bonusReward = RewardMath.computeRewardAmount(
            incentive.bonusReward,
            initTimestamp,
            endTimestamp,
            liquidity,
            incentive.totalLiquidity,
            secondsPerLiquidityInsideX128
        );
    }

    /// @dev Farms a deposited token without doing an ownership check
    function _enterFarming(IncentiveKey memory key, uint256 tokenId) private {
        require(block.timestamp < key.startTime, 'AlgebraFarming::enterFarming: incentive has already started');

        bytes32 incentiveId = IncentiveId.compute(key);

        require(incentives[incentiveId].totalReward > 0, 'AlgebraFarming::enterFarming: non-existent incentive');
        require(farms[tokenId][incentiveId] == 0, 'AlgebraFarming::enterFarming: token already farmed');

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

        farms[tokenId][incentiveId] = liquidity;

        incentives[incentiveId].totalLiquidity += liquidity;

        emit FarmStarted(tokenId, incentiveId, liquidity);
    }

    function _exitFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        address _owner
    ) private {
        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive memory incentive = incentives[incentiveId];
        // anyone can call exitFarming if the block time is after the end time of the incentive
        require(
            block.timestamp > key.endTime || block.timestamp < key.startTime,
            'AlgebraFarming::exitFarming: cannot exitFarming before end time'
        );

        uint128 liquidity = farms[tokenId][incentiveId];

        require(liquidity != 0, 'AlgebraFarming::exitFarming: farm does not exist');

        Deposit memory deposit = deposits[tokenId];

        incentives[incentiveId].numberOfFarms--;

        uint256 reward = 0;
        uint256 bonusReward = 0;

        IAlgebraIncentiveVirtualPool virtualPool = IAlgebraIncentiveVirtualPool(
            incentives[incentiveId].virtualPoolAddress
        );

        if (block.timestamp > key.endTime) {
            (uint160 secondsPerLiquidityInsideX128, uint256 initTimestamp, uint256 endTimestamp) = virtualPool
                .getInnerSecondsPerLiquidity(deposit.tickLower, deposit.tickUpper);

            if (endTimestamp == 0) {
                virtualPool.finish(uint32(block.timestamp), uint32(key.startTime));
                (secondsPerLiquidityInsideX128, initTimestamp, endTimestamp) = virtualPool.getInnerSecondsPerLiquidity(
                    deposit.tickLower,
                    deposit.tickUpper
                );
            }

            reward = RewardMath.computeRewardAmount(
                incentive.totalReward,
                initTimestamp,
                endTimestamp,
                liquidity,
                incentive.totalLiquidity,
                secondsPerLiquidityInsideX128
            );

            rewards[key.rewardToken][_owner] += reward;

            if (incentive.bonusReward != 0) {
                bonusReward = RewardMath.computeRewardAmount(
                    incentive.bonusReward,
                    initTimestamp,
                    endTimestamp,
                    liquidity,
                    incentive.totalLiquidity,
                    secondsPerLiquidityInsideX128
                );

                rewards[key.bonusRewardToken][_owner] += bonusReward;
            }
        } else {
            (IAlgebraPool pool, , , ) = NFTPositionInfo.getPositionInfo(deployer, nonfungiblePositionManager, tokenId);
            (, int24 tick, , , , , , ) = pool.globalState();

            virtualPool.applyLiquidityDeltaToPosition(
                deposit.tickLower,
                deposit.tickUpper,
                -int256(liquidity).toInt128(),
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
}
