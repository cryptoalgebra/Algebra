// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../interfaces/IAlgebraFarming.sol';
import '../interfaces/IFarmingCenter.sol';
import '../libraries/IncentiveId.sol';
import '../libraries/NFTPositionInfo.sol';
import '../libraries/Multiplier.sol';

import 'algebra/contracts/libraries/SafeCast.sol';
import 'algebra/contracts/interfaces/IAlgebraPoolDeployer.sol';
import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra/contracts/interfaces/IERC20Minimal.sol';

import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import 'algebra-periphery/contracts/libraries/TransferHelper.sol';

abstract contract AlgebraFarming is IAlgebraFarming {
    using SafeCast for int256;
    /// @notice Represents a staking incentive
    struct Incentive {
        uint256 totalReward;
        uint256 bonusReward;
        address virtualPoolAddress;
        uint96 numberOfFarms;
        bool isPoolCreated;
        uint224 totalLiquidity;
        address multiplierToken;
        Levels levels;
    }

    /// @inheritdoc IAlgebraFarming
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;

    /// @inheritdoc IAlgebraFarming
    IAlgebraPoolDeployer public immutable override deployer;

    /// @inheritdoc IAlgebraFarming
    IFarmingCenter public override farmingCenter;

    /// @dev bytes32 refers to the return value of IncentiveId.compute
    mapping(bytes32 => Incentive) public override incentives;

    address internal incentiveMaker;
    address internal immutable owner;

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
    constructor(IAlgebraPoolDeployer _deployer, INonfungiblePositionManager _nonfungiblePositionManager) {
        owner = msg.sender;
        deployer = _deployer;
        nonfungiblePositionManager = _nonfungiblePositionManager;
    }

    // @inheritdoc IAlgebraPoolDeployer
    function setIncentiveMaker(address _incentiveMaker) external override onlyOwner {
        incentiveMaker = _incentiveMaker;
    }

    /// @inheritdoc IAlgebraFarming
    function setFarmingCenterAddress(address _farmingCenter) external override onlyOwner {
        farmingCenter = IFarmingCenter(_farmingCenter);
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
        farmingCenter.setFarmingCenterAddress(pool, virtualPool);
    }

    function _getCurrentVirtualPools(IAlgebraPool pool) internal view returns (address incentive, address eternal) {
        return farmingCenter.virtualPoolAddresses(address(pool));
    }

    function _createIncentive(
        address virtualPool,
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward,
        address multiplierToken,
        Levels calldata levels
    ) internal returns (bytes32 incentiveId) {
        _connectPoolToVirtualPool(key.pool, virtualPool);

        incentiveId = IncentiveId.compute(key);

        Incentive storage newIncentive = incentives[incentiveId];
        newIncentive.totalReward += reward;
        newIncentive.bonusReward += bonusReward;

        newIncentive.isPoolCreated = true;
        newIncentive.virtualPoolAddress = virtualPool;
        newIncentive.levels = levels;
        newIncentive.multiplierToken = multiplierToken;

        TransferHelper.safeTransferFrom(address(key.bonusRewardToken), msg.sender, address(this), bonusReward);
        TransferHelper.safeTransferFrom(address(key.rewardToken), msg.sender, address(this), reward);
    }

    function _detachIncentive(IncentiveKey memory key, address _incentive) internal {
        require(_incentive != address(0), 'Farming do not exist');

        require(incentives[IncentiveId.compute(key)].virtualPoolAddress == _incentive, 'Another farming is active');
        _connectPoolToVirtualPool(key.pool, address(0));

        emit IncentiveDetached(key.rewardToken, key.bonusRewardToken, key.pool, _incentive, key.startTime, key.endTime);
    }

    function _attachIncentive(IncentiveKey memory key, address _incentive) internal {
        require(_incentive == address(0), 'Farming already exists');

        address virtualPoolAddress = incentives[IncentiveId.compute(key)].virtualPoolAddress;
        require(virtualPoolAddress != address(0), 'Invalid farming');

        _connectPoolToVirtualPool(key.pool, virtualPoolAddress);

        emit IncentiveAttached(key.rewardToken, key.bonusRewardToken, key.pool, _incentive, key.startTime, key.endTime);
    }

    function _enterFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        uint256 tokensLocked
    )
        internal
        returns (
            bytes32 incentiveId,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            int24 tick,
            address virtualPool
        )
    {
        incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];

        require(incentive.totalReward > 0, 'AlgebraFarming::enterFarming: non-existent incentive');

        IAlgebraPool pool;
        (pool, tickLower, tickUpper, liquidity) = NFTPositionInfo.getPositionInfo(
            deployer,
            nonfungiblePositionManager,
            tokenId
        );

        require(pool == key.pool, 'AlgebraFarming::enterFarming: invalid pool for token');
        require(liquidity > 0, 'AlgebraFarming::enterFarming: cannot farm token with 0 liquidity');
        (, tick, , , , , , ) = pool.globalState();

        uint32 multiplier = Multiplier.getMultiplier(tokensLocked, incentive.levels);
        liquidity += (liquidity * multiplier) / Multiplier.DENOMINATOR;

        incentive.numberOfFarms++;
        virtualPool = incentive.virtualPoolAddress;

        incentive.totalLiquidity += liquidity;
    }

    function _claimReward(
        IERC20Minimal rewardToken,
        address from,
        address to,
        uint256 amountRequested
    ) internal returns (uint256 reward) {
        reward = rewards[rewardToken][from];

        if (amountRequested == 0 || amountRequested > reward) {
            amountRequested = reward;
        }

        rewards[rewardToken][from] = reward - amountRequested;
        TransferHelper.safeTransfer(address(rewardToken), to, amountRequested);

        emit RewardClaimed(to, amountRequested, address(rewardToken), from);
    }
}
