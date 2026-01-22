// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IERC20Minimal.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/FullMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Constants.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';

import '@cryptoalgebra/integral-periphery/contracts/libraries/TransferHelper.sol';

import '../interfaces/IFeeBasedFarming.sol';

/// @title Fee-Based Farming for Algebra Integral
/// @notice Distributes rewards proportionally to the fees earned by positions
/// @dev All positions automatically participate in farming. Entry data is stored in the pool.
contract FeeBasedFarming is IFeeBasedFarming {
    /// @notice The Algebra factory
    IAlgebraFactory public immutable factory;

    /// @notice Role for setting up farmings
    bytes32 public constant FARMING_ADMIN_ROLE = keccak256('FARMING_ADMIN_ROLE');

    /// @dev Pool address => FarmingConfig
    mapping(address => FarmingConfig) internal _farmingConfigs;

    /// @dev Track claimed rewards to prevent double-claiming
    /// pool => positionKey => claimedReward
    mapping(address => mapping(bytes32 => uint256)) public claimedRewards;

    /// @dev Track last claim timestamp for positions
    /// pool => positionKey => lastClaimTimestamp
    mapping(address => mapping(bytes32 => uint256)) public lastClaimTimestamp;

    // Reentrancy lock
    bool private locked;

    modifier nonReentrant() {
        require(!locked, 'Locked');
        locked = true;
        _;
        locked = false;
    }

    modifier onlyFarmingAdmin() {
        require(factory.hasRoleOrOwner(FARMING_ADMIN_ROLE, msg.sender), 'Not authorized');
        _;
    }

    constructor(address _factory) {
        factory = IAlgebraFactory(_factory);
    }

    /// @inheritdoc IFeeBasedFarming
    function farmingPositions(
        address pool,
        address owner,
        int24 bottomTick,
        int24 topTick
    ) external view override returns (FarmingPosition memory position) {
        // Get farming entry from pool
        (uint256 feeGrowthInside0AtEntry, uint256 accumulatedFees0AtEntry, uint256 entryTimestamp) = 
            IAlgebraPool(pool).getFarmingEntry(owner, bottomTick, topTick);
        
        // Get current position liquidity from pool
        bytes32 positionKey = _getPoolPositionKey(owner, bottomTick, topTick);
        (uint256 liquidity, , , , ) = IAlgebraPool(pool).positions(positionKey);
        
        position = FarmingPosition({
            liquidity: uint128(liquidity),
            feeGrowthInside0AtEntry: feeGrowthInside0AtEntry,
            accumulatedFees0AtEntry: accumulatedFees0AtEntry,
            entryTimestamp: entryTimestamp
        });
    }

    /// @inheritdoc IFeeBasedFarming
    function farmingConfigs(address pool) external view override returns (FarmingConfig memory) {
        return _farmingConfigs[pool];
    }

    /// @inheritdoc IFeeBasedFarming
    function pendingReward(
        address pool,
        address owner,
        int24 bottomTick,
        int24 topTick
    ) external view override returns (uint256 reward, uint256 feesEarned) {
        return _calculateReward(pool, owner, bottomTick, topTick);
    }

    /// @inheritdoc IFeeBasedFarming
    function enterFarming(
        address,
        address,
        int24,
        int24
    ) external pure override {
        // Positions automatically enter farming when created in the pool
        // This function is kept for interface compatibility but does nothing
        revert('Auto-farming: positions enter automatically');
    }

    /// @inheritdoc IFeeBasedFarming
    function exitFarming(
        address pool,
        address owner,
        int24 bottomTick,
        int24 topTick
    ) external override nonReentrant returns (uint256 reward) {
        require(msg.sender == owner, 'Not owner');
        
        // Get and transfer pending reward
        reward = _claimReward(pool, owner, bottomTick, topTick);
        
        // Note: Position exit from farming happens automatically when liquidity is removed in pool
    }

    /// @inheritdoc IFeeBasedFarming
    function claimReward(
        address pool,
        address owner,
        int24 bottomTick,
        int24 topTick
    ) external override nonReentrant returns (uint256 reward) {
        require(msg.sender == owner, 'Not owner');
        reward = _claimReward(pool, owner, bottomTick, topTick);
    }

    /// @inheritdoc IFeeBasedFarming
    function setupFarming(
        address pool,
        address rewardToken,
        uint256 rewardAmount,
        uint256 duration
    ) external override onlyFarmingAdmin {
        require(duration > 0, 'Duration must be > 0');
        require(rewardAmount > 0, 'Reward must be > 0');
        require(_farmingConfigs[pool].rewardEndTime < block.timestamp, 'Farming still active');

        // Transfer reward tokens
        TransferHelper.safeTransferFrom(rewardToken, msg.sender, address(this), rewardAmount);

        uint256 rewardRate = rewardAmount / duration;
        uint256 accumulatedFees0 = IAlgebraPool(pool).accumulatedFees0();

        _farmingConfigs[pool] = FarmingConfig({
            rewardToken: rewardToken,
            rewardRate: rewardRate,
            rewardEndTime: block.timestamp + duration,
            totalRewardsDistributed: 0,
            lastUpdateTime: block.timestamp,
            accumulatedFees0AtLastUpdate: accumulatedFees0
        });

        emit RewardsAdded(pool, rewardToken, rewardRate, duration);
    }

    /// @inheritdoc IFeeBasedFarming
    function addRewards(
        address pool,
        uint256 rewardAmount,
        uint256 additionalDuration
    ) external override onlyFarmingAdmin {
        FarmingConfig storage config = _farmingConfigs[pool];
        require(config.rewardToken != address(0), 'Farming not setup');
        require(config.rewardEndTime >= block.timestamp, 'Farming ended');

        // Transfer reward tokens
        TransferHelper.safeTransferFrom(config.rewardToken, msg.sender, address(this), rewardAmount);

        // Calculate remaining rewards and add new ones
        uint256 remainingTime = config.rewardEndTime - block.timestamp;
        uint256 remainingRewards = remainingTime * config.rewardRate;
        uint256 totalRewards = remainingRewards + rewardAmount;
        uint256 totalDuration = remainingTime + additionalDuration;

        config.rewardRate = totalRewards / totalDuration;
        config.rewardEndTime = block.timestamp + totalDuration;

        emit RewardsAdded(pool, config.rewardToken, config.rewardRate, totalDuration);
    }

    function _claimReward(
        address pool,
        address owner,
        int24 bottomTick,
        int24 topTick
    ) internal returns (uint256 reward) {
        uint256 feesEarned;
        (reward, feesEarned) = _calculateReward(pool, owner, bottomTick, topTick);

        if (reward > 0) {
            FarmingConfig storage config = _farmingConfigs[pool];
            bytes32 positionKey = _getPoolPositionKey(owner, bottomTick, topTick);
            
            // Update claimed rewards
            claimedRewards[pool][positionKey] += reward;
            lastClaimTimestamp[pool][positionKey] = block.timestamp;
            config.totalRewardsDistributed += reward;

            // Transfer rewards
            TransferHelper.safeTransfer(config.rewardToken, owner, reward);

            emit PositionExited(pool, owner, bottomTick, topTick, feesEarned, reward);
        }
    }

    /// @dev Helper struct to avoid stack too deep in _calculateReward
    struct RewardCalculationCache {
        uint256 feeGrowthInside0AtEntry;
        uint256 accumulatedFees0AtEntry;
        uint256 entryTimestamp;
        uint256 liquidity;
        uint256 currentFeeGrowthInside0;
        uint256 currentAccumulatedFees;
        uint256 startTime;
        uint256 endTime;
    }

    function _calculateReward(
        address pool,
        address owner,
        int24 bottomTick,
        int24 topTick
    ) internal view returns (uint256 reward, uint256 feesEarned) {
        RewardCalculationCache memory cache;
        
        // Get farming entry from pool
        (cache.feeGrowthInside0AtEntry, cache.accumulatedFees0AtEntry, cache.entryTimestamp) = 
            IAlgebraPool(pool).getFarmingEntry(owner, bottomTick, topTick);
        
        if (cache.entryTimestamp == 0) {
            return (0, 0); // Position not in farming
        }

        // Get current position liquidity from pool
        bytes32 positionKey = _getPoolPositionKey(owner, bottomTick, topTick);
        (cache.liquidity, , , , ) = IAlgebraPool(pool).positions(positionKey);
        
        if (cache.liquidity == 0) {
            return (0, 0);
        }

        // Calculate current feeGrowthInside0 dynamically from ticks
        cache.currentFeeGrowthInside0 = _getFeeGrowthInside0(IAlgebraPool(pool), bottomTick, topTick);

        FarmingConfig memory config = _farmingConfigs[pool];
        if (config.rewardToken == address(0)) {
            return (0, 0); // Farming not set up
        }

        // Calculate fees earned by this position since entry
        unchecked {
            uint256 feeGrowthDelta = cache.currentFeeGrowthInside0 - cache.feeGrowthInside0AtEntry;
            feesEarned = FullMath.mulDiv(feeGrowthDelta, cache.liquidity, Constants.Q128);
        }
        
        // Get total fees accumulated since position entry
        cache.currentAccumulatedFees = IAlgebraPool(pool).accumulatedFees0();
        uint256 totalFeesInPeriod = cache.currentAccumulatedFees - cache.accumulatedFees0AtEntry;
        
        if (totalFeesInPeriod == 0 || feesEarned == 0) {
            return (0, feesEarned);
        }

        // Calculate time-based rewards available for this period
        cache.startTime = _max(cache.entryTimestamp, lastClaimTimestamp[pool][positionKey]);
        if (cache.startTime < config.lastUpdateTime) {
            cache.startTime = config.lastUpdateTime;
        }
        cache.endTime = _min(block.timestamp, config.rewardEndTime);
        
        if (cache.endTime <= cache.startTime) {
            return (0, feesEarned);
        }

        uint256 potentialRewards = (cache.endTime - cache.startTime) * config.rewardRate;
        
        // Position's share of rewards based on fees earned / total fees in period
        reward = FullMath.mulDiv(potentialRewards, feesEarned, totalFeesInPeriod);
    }

    /// @dev Calculate current feeGrowthInside0 for a position by reading tick data
    /// This gives the real-time value, not the snapshot stored in positions()
    function _getFeeGrowthInside0(
        IAlgebraPool pool,
        int24 bottomTick,
        int24 topTick
    ) internal view returns (uint256 feeGrowthInside0X128) {
        (, int24 currentTick, , , , ) = pool.globalState();
        
        // Get outer fee growth for both ticks
        (, , , , uint256 lowerOuterFeeGrowth0Token, ) = pool.ticks(bottomTick);
        (, , , , uint256 upperOuterFeeGrowth0Token, ) = pool.ticks(topTick);

        unchecked {
            if (currentTick < topTick) {
                if (currentTick >= bottomTick) {
                    // Current tick is inside the range
                    uint256 feeGrowthGlobal0X128 = pool.totalFeeGrowth0Token();
                    feeGrowthInside0X128 = feeGrowthGlobal0X128 - lowerOuterFeeGrowth0Token;
                } else {
                    // Current tick is below the range
                    feeGrowthInside0X128 = lowerOuterFeeGrowth0Token;
                }
                feeGrowthInside0X128 -= upperOuterFeeGrowth0Token;
            } else {
                // Current tick is above the range
                feeGrowthInside0X128 = upperOuterFeeGrowth0Token - lowerOuterFeeGrowth0Token;
            }
        }
    }

    /// @dev Generate position key as used by the pool
    function _getPoolPositionKey(
        address owner,
        int24 bottomTick,
        int24 topTick
    ) internal pure returns (bytes32 key) {
        assembly {
            key := or(shl(24, or(shl(24, owner), and(bottomTick, 0xFFFFFF))), and(topTick, 0xFFFFFF))
        }
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }
}
