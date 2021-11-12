// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';

import 'algebra/contracts/interfaces/IAlgebraPoolDeployer.sol';
import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra/contracts/interfaces/IERC20Minimal.sol';

import './IVirtualPoolDeployer.sol';
import './IAlgebraVirtualPool.sol';

import 'algebra-periphery/contracts/interfaces/IERC721Permit.sol';
import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import 'algebra-periphery/contracts/interfaces/IMulticall.sol';

/// @title Algebra Farming Interface
/// @notice Allows staking nonfungible liquidity tokens in exchange for reward tokens
interface IAlgebraFarming is IERC721Receiver, IERC721Permit, IMulticall {
    /// @param rewardToken The token being distributed as a reward
    /// @param pool The Algebra pool
    /// @param startTime The time when the incentive program begins
    /// @param endTime The time when rewards stop accruing
    /// @param refundee The address which receives any remaining reward tokens when the incentive is ended
    struct IncentiveKey {
        IERC20Minimal rewardToken;
        IERC20Minimal bonusRewardToken;
        IAlgebraPool pool;
        uint256 startTime;
        uint256 endTime;
        address refundee;
    }

    function deployer() external view returns (IAlgebraPoolDeployer);

    /// @notice The nonfungible position manager with which this staking contract is compatible
    function nonfungiblePositionManager() external view returns (INonfungiblePositionManager);

    function vdeployer() external view returns (IVirtualPoolDeployer);

    /// @notice The max duration of an incentive in seconds
    function maxIncentiveDuration() external view returns (uint256);

    /// @notice The max amount of seconds into the future the incentive startTime can be set
    function maxIncentiveStartLeadTime() external view returns (uint256);

    /// @notice Represents a staking incentive
    /// @param incentiveId The ID of the incentive computed from its parameters
    /// @return totalReward The amount of reward token not yet claimed by users
    function incentives(bytes32 incentiveId)
        external
        view
        returns (
            uint256 totalReward,
            uint256 bonusReward,
            address virtualPoolAddress,
            uint96 numberOfFarms,
            bool isPoolCreated,
            uint224 totalLiquidity
        );

    /// @notice Returns information about a deposited NFT
    /// @return _tokenId
    /// @return owner The owner of the deposited NFT
    /// @return tickLower The lower tick of the range
    /// @return tickUpper The upper tick of the range
    function deposits(uint256 tokenId)
        external
        view
        returns (
            uint256 _tokenId,
            address owner,
            int24 tickLower,
            int24 tickUpper
        );

    /// @notice Returns information about a farmd liquidity NFT
    /// @param tokenId The ID of the farmd token
    /// @param incentiveId The ID of the incentive for which the token is farmd
    /// @return liquidity The amount of liquidity in the NFT as of the last time the rewards were computed
    function farms(uint256 tokenId, bytes32 incentiveId) external view returns (uint128 liquidity);

    function setIncentiveMaker(address _incentiveMaker) external;

    /// @notice Returns amounts of reward tokens owed to a given address according to the last time all farms were updated
    /// @param rewardToken The token for which to check rewards
    /// @param owner The owner for which the rewards owed are checked
    /// @return rewardsOwed The amount of the reward token claimable by the owner
    function rewards(IERC20Minimal rewardToken, address owner) external view returns (uint256 rewardsOwed);

    /// @notice Creates a new liquidity mining incentive program
    /// @param key Details of the incentive to create
    /// @param reward The amount of reward tokens to be distributed
    function createIncentive(
        IncentiveKey memory key,
        uint256 reward,
        uint256 algReward
    ) external returns (address virtualPool);

    /// @notice Ends an incentive after the incentive end time has passed and all farms have been withdrawn
    /// @param key Details of the incentive to end
    /// @return refund The remaining reward tokens when the incentive is ended
    //function endIncentive(IncentiveKey memory key) external returns (uint256 refund);

    /// @notice Transfers ownership of a deposit from the sender to the given recipient
    /// @param tokenId The ID of the token (and the deposit) to transfer
    /// @param to The new owner of the deposit
    //function transferDeposit(uint256 tokenId, address to) external;

    /// @notice Withdraws a Algebra LP token `tokenId` from this contract to the recipient `to`
    /// @param tokenId The unique identifier of an Algebra LP token
    /// @param to The address where the LP token will be sent
    /// @param data An optional data array that will be passed along to the `to` address via the NFT safeTransferFrom
    function withdrawToken(
        uint256 tokenId,
        address to,
        bytes memory data
    ) external;

    /// @notice Farms a Algebra LP token
    /// @param key The key of the incentive for which to farm the NFT
    /// @param tokenId The ID of the token to farm
    function enterFarming(IncentiveKey memory key, uint256 tokenId) external;

    /// @notice exitFarmings a Algebra LP token
    /// @param key The key of the incentive for which to exitFarming the NFT
    /// @param tokenId The ID of the token to exitFarming
    function exitFarming(IncentiveKey memory key, uint256 tokenId) external;

    /// @notice Transfers `amountRequested` of accrued `rewardToken` rewards from the contract to the recipient `to`
    /// @param rewardToken The token being distributed as a reward
    /// @param to The address where claimed rewards will be sent to
    /// @param amountRequested The amount of reward tokens to claim. Claims entire reward amount if set to 0.
    /// @return reward The amount of reward tokens claimed
    function claimReward(
        IERC20Minimal rewardToken,
        address to,
        uint256 amountRequested
    ) external returns (uint256 reward);

    /// @notice Calculates the reward amount that will be received for the given farm
    /// @param key The key of the incentive
    /// @param tokenId The ID of the token
    /// @return reward The reward accrued to the NFT for the given incentive thus far
    function getRewardInfo(IncentiveKey memory key, uint256 tokenId)
        external
        returns (uint256 reward, uint256 algReward);

    /// @notice Event emitted when a liquidity mining incentive has been created
    /// @param rewardToken The token being distributed as a reward
    /// @param pool The Algebra pool
    /// @param startTime The time when the incentive program begins
    /// @param endTime The time when rewards stop accruing
    /// @param refundee The address which receives any remaining reward tokens after the end time
    /// @param reward The amount of reward tokens to be distributed
    event IncentiveCreated(
        IERC20Minimal indexed rewardToken,
        IERC20Minimal indexed bonusRewardToken,
        IAlgebraPool indexed pool,
        address virtualPool,
        uint256 startTime,
        uint256 endTime,
        address refundee,
        uint256 reward,
        uint256 bonusReward
    );

    /// @notice Event that can be emitted when a liquidity mining incentive has ended
    /// @param incentiveId The incentive which is ending
    /// @param refund The amount of reward tokens refunded
    //event IncentiveEnded(bytes32 indexed incentiveId, uint256 refund);

    /// @notice Emitted when ownership of a deposit changes
    /// @param tokenId The ID of the deposit (and token) that is being transferred
    /// @param oldOwner The owner before the deposit was transferred
    /// @param newOwner The owner after the deposit was transferred
    event DepositTransferred(uint256 indexed tokenId, address indexed oldOwner, address indexed newOwner);

    /// @notice Event emitted when a Algebra LP token has been farmd
    /// @param tokenId The unique identifier of an Algebra LP token
    /// @param liquidity The amount of liquidity farmd
    /// @param incentiveId The incentive in which the token is staking
    event FarmStarted(
        uint256 indexed tokenId,
        uint256 indexed L2tokenId,
        bytes32 indexed incentiveId,
        uint128 liquidity
    );

    /// @notice Event emitted when a Algebra LP token has been exitFarmingd
    /// @param tokenId The unique identifier of an Algebra LP token
    /// @param incentiveId The incentive in which the token is staking
    event FarmEnded(
        uint256 indexed tokenId,
        bytes32 indexed incentiveId,
        address indexed rewardAddress,
        address bonusRewardToken,
        address owner,
        uint256 reward,
        uint256 bonusReward
    );

    /// @notice Event emitted when a reward token has been claimed
    /// @param to The address where claimed rewards were sent to
    /// @param reward The amount of reward tokens claimed
    event RewardClaimed(address indexed to, uint256 reward, address indexed rewardAddress, address indexed owner);
}
