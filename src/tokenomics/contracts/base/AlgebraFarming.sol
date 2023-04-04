// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;

import '../interfaces/IAlgebraVirtualPoolBase.sol';
import '../interfaces/IAlgebraFarming.sol';
import '../interfaces/IFarmingCenter.sol';
import '../libraries/IncentiveId.sol';
import '../libraries/NFTPositionInfo.sol';
import '../libraries/LiquidityTier.sol';

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPoolDeployer.sol';
import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/core/contracts/interfaces/IERC20Minimal.sol';
import '@cryptoalgebra/core/contracts/libraries/SafeCast.sol';
import '@cryptoalgebra/core/contracts/libraries/TickMath.sol';
import '@cryptoalgebra/core/contracts/libraries/LowGasSafeMath.sol';
import '@cryptoalgebra/core/contracts/libraries/FullMath.sol';

import '@cryptoalgebra/periphery/contracts/libraries/TransferHelper.sol';

/// @title Abstract base contract for Algebra farmings
abstract contract AlgebraFarming is IAlgebraFarming {
    using SafeCast for int256;
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for uint128;

    /// @notice Represents a farming incentive
    struct Incentive {
        uint128 totalReward;
        uint128 bonusReward;
        address virtualPoolAddress;
        uint24 minimalPositionWidth;
        uint224 totalLiquidity;
        address multiplierToken;
        bool deactivated;
        Tiers tiers;
    }

    /// @inheritdoc IAlgebraFarming
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;

    IAlgebraPoolDeployer private immutable deployer;
    IAlgebraFactory private immutable factory;

    IFarmingCenter public farmingCenter;

    /// @dev bytes32 refers to the return value of IncentiveId.compute
    /// @inheritdoc IAlgebraFarming
    mapping(bytes32 => Incentive) public override incentives;

    bytes32 public constant INCENTIVE_MAKER_ROLE = keccak256('INCENTIVE_MAKER_ROLE');
    bytes32 public constant FARMINGS_ADMINISTRATOR_ROLE = keccak256('FARMINGS_ADMINISTRATOR_ROLE');

    /// @dev rewards[owner][rewardToken] => uint256
    /// @inheritdoc IAlgebraFarming
    mapping(address => mapping(IERC20Minimal => uint256)) public override rewards;

    modifier onlyIncentiveMaker() {
        _checkHasRole(INCENTIVE_MAKER_ROLE);
        _;
    }

    modifier onlyAdministrator() {
        _checkHasRole(FARMINGS_ADMINISTRATOR_ROLE);
        _;
    }

    modifier onlyFarmingCenter() {
        _checkIsFarmingCenter();
        _;
    }

    /// @param _deployer pool deployer contract address
    /// @param _nonfungiblePositionManager the NFT position manager contract address
    constructor(IAlgebraPoolDeployer _deployer, INonfungiblePositionManager _nonfungiblePositionManager) {
        deployer = _deployer;
        nonfungiblePositionManager = _nonfungiblePositionManager;
        factory = IAlgebraFactory(_nonfungiblePositionManager.factory());
    }

    function _checkIsFarmingCenter() internal view {
        require(msg.sender == address(farmingCenter));
    }

    function _checkHasRole(bytes32 role) internal view {
        require(IAlgebraFactory(factory).hasRoleOrOwner(role, msg.sender));
    }

    /// @inheritdoc IAlgebraFarming
    function setFarmingCenterAddress(address _farmingCenter) external override onlyAdministrator {
        require(_farmingCenter != address(farmingCenter));
        farmingCenter = IFarmingCenter(_farmingCenter);
        emit FarmingCenter(_farmingCenter);
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
        farmingCenter.connectVirtualPool(pool, virtualPool);
    }

    function _getCurrentVirtualPools(IAlgebraPool pool) internal view returns (address eternal) {
        return farmingCenter.virtualPoolAddresses(address(pool));
    }

    function _receiveRewards(
        IncentiveKey memory key,
        uint128 reward,
        uint128 bonusReward,
        Incentive storage incentive
    ) internal returns (uint128 receivedReward, uint128 receivedBonusReward) {
        if (reward > 0) {
            IERC20Minimal rewardToken = key.rewardToken;
            uint256 balanceBefore = _balanceOf(rewardToken);
            TransferHelper.safeTransferFrom(address(rewardToken), msg.sender, address(this), reward);
            uint256 balanceAfter = _balanceOf(rewardToken);
            require(balanceAfter > balanceBefore);
            unchecked {
                receivedReward = uint128(balanceAfter - balanceBefore); // TODO OVERFLOW CHECKS
            }
            incentive.totalReward = incentive.totalReward + receivedReward;
        }
        if (bonusReward > 0) {
            IERC20Minimal bonusRewardToken = key.bonusRewardToken;
            uint256 balanceBefore = _balanceOf(bonusRewardToken);
            TransferHelper.safeTransferFrom(address(bonusRewardToken), msg.sender, address(this), bonusReward);
            uint256 balanceAfter = _balanceOf(bonusRewardToken);
            require(balanceAfter > balanceBefore);
            unchecked {
                receivedBonusReward = uint128(balanceAfter - balanceBefore);
            }
            incentive.bonusReward = incentive.bonusReward + receivedBonusReward;
        }
    }

    function _createFarming(
        address virtualPool,
        IncentiveKey memory key,
        uint128 reward,
        uint128 bonusReward,
        uint24 minimalPositionWidth,
        address multiplierToken,
        Tiers calldata tiers
    ) internal returns (bytes32 incentiveId, uint128 receivedReward, uint128 receivedBonusReward) {
        _connectPoolToVirtualPool(key.pool, virtualPool);

        incentiveId = IncentiveId.compute(key);

        Incentive storage newIncentive = incentives[incentiveId];

        (receivedReward, receivedBonusReward) = _receiveRewards(key, reward, bonusReward, newIncentive);
        unchecked {
            if (int256(uint256(minimalPositionWidth)) > (int256(TickMath.MAX_TICK) - int256(TickMath.MIN_TICK)))
                revert minimalPositionWidthTooWide();
        }
        newIncentive.virtualPoolAddress = virtualPool;
        newIncentive.minimalPositionWidth = minimalPositionWidth;

        if (
            tiers.tier1Multiplier > LiquidityTier.MAX_MULTIPLIER ||
            tiers.tier2Multiplier > LiquidityTier.MAX_MULTIPLIER ||
            tiers.tier3Multiplier > LiquidityTier.MAX_MULTIPLIER
        ) revert multiplierIsTooHigh();

        if (
            tiers.tier1Multiplier < LiquidityTier.DENOMINATOR ||
            tiers.tier2Multiplier < LiquidityTier.DENOMINATOR ||
            tiers.tier3Multiplier < LiquidityTier.DENOMINATOR
        ) revert multiplierIsTooLow();

        newIncentive.tiers = tiers;
        newIncentive.multiplierToken = multiplierToken;
    }

    function _deactivateIncentive(IncentiveKey memory key, address currentVirtualPool) internal {
        if (currentVirtualPool == address(0)) revert incentiveNotExist();

        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];
        if (incentive.virtualPoolAddress != currentVirtualPool) revert anotherFarmingIsActive();
        if (incentive.deactivated) revert incentiveStopped();
        incentive.deactivated = true;

        _connectPoolToVirtualPool(key.pool, address(0));

        emit IncentiveDeactivated(incentiveId);
    }

    function _enterFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        uint256 tokensLocked
    ) internal returns (bytes32 incentiveId, int24 tickLower, int24 tickUpper, uint128 liquidity, address virtualPool) {
        incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];
        _checkIsIncentiveExist(incentive);
        if (incentive.deactivated) revert incentiveStopped();

        IAlgebraPool pool;
        (pool, tickLower, tickUpper, liquidity) = NFTPositionInfo.getPositionInfo(
            deployer,
            nonfungiblePositionManager,
            tokenId
        );

        if (pool != key.pool) revert invalidPool();
        if (liquidity == 0) revert zeroLiquidity();

        int24 tick = _getTickInPool(pool);

        uint32 multiplier = LiquidityTier.getLiquidityMultiplier(tokensLocked, incentive.tiers);
        uint256 liquidityAmountWithMultiplier = FullMath.mulDiv(liquidity, multiplier, LiquidityTier.DENOMINATOR);
        require(liquidityAmountWithMultiplier <= type(uint128).max);
        liquidity = uint128(liquidityAmountWithMultiplier);

        virtualPool = incentive.virtualPoolAddress;
        uint24 minimalAllowedTickWidth = incentive.minimalPositionWidth;
        unchecked {
            if (int256(tickUpper) - int256(tickLower) < int256(uint256(minimalAllowedTickWidth)))
                revert positionIsTooNarrow();
        }

        _updatePositionInVirtualPool(
            virtualPool,
            uint32(block.timestamp),
            tickLower,
            tickUpper,
            int256(uint256(liquidity)).toInt128(),
            tick
        );
    }

    function _claimReward(
        IERC20Minimal rewardToken,
        address from,
        address to,
        uint256 amountRequested
    ) internal returns (uint256 reward) {
        reward = rewards[from][rewardToken];

        if (amountRequested == 0 || amountRequested > reward) {
            amountRequested = reward;
        }
        unchecked {
            rewards[from][rewardToken] = reward - amountRequested;
        }
        TransferHelper.safeTransfer(address(rewardToken), to, amountRequested);

        emit RewardClaimed(to, amountRequested, address(rewardToken), from);
    }

    function _checkIsIncentiveExist(Incentive storage incentive) internal view {
        if (incentive.totalReward == 0) revert incentiveNotExist();
    }

    function _balanceOf(IERC20Minimal token) internal view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function _getTickInPool(IAlgebraPool pool) internal view returns (int24 tick) {
        (, tick, , , , , ) = pool.globalState();
    }

    function _updatePositionInVirtualPool(
        address virtualPool,
        uint32 timestamp,
        int24 tickLower,
        int24 tickUpper,
        int128 liquidityDelta,
        int24 currentTick
    ) internal {
        IAlgebraVirtualPoolBase(virtualPool).applyLiquidityDeltaToPosition(
            timestamp,
            tickLower,
            tickUpper,
            liquidityDelta,
            currentTick
        );
    }
}
