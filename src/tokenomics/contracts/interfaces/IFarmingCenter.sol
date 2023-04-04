// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6;
pragma abicoder v2;

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/core/contracts/interfaces/IAlgebraVirtualPool.sol';
import '@cryptoalgebra/core/contracts/interfaces/IERC20Minimal.sol';

import '@cryptoalgebra/periphery/contracts/interfaces/IMulticall.sol';
import '@cryptoalgebra/periphery/contracts/interfaces/INonfungiblePositionManager.sol';

import '../base/IncentiveKey.sol';
import '../farmings/limitFarming/interfaces/IAlgebraLimitFarming.sol';
import '../farmings/eternalFarming/interfaces/IAlgebraEternalFarming.sol';
import './IFarmingCenterVault.sol';

interface IFarmingCenter is IAlgebraVirtualPool, IMulticall {
    struct VirtualPoolAddresses {
        address eternalVirtualPool;
        address limitVirtualPool;
    }

    function virtualPoolAddresses(address) external view returns (address, address);

    /// @notice The nonfungible position manager with which this farming contract is compatible
    function nonfungiblePositionManager() external view returns (INonfungiblePositionManager);

    function limitFarming() external view returns (IAlgebraLimitFarming);

    function eternalFarming() external view returns (IAlgebraEternalFarming);

    function farmingCenterVault() external view returns (IFarmingCenterVault);

    /// @notice Returns information about a deposited NFT
    /// @param tokenId The ID of the deposit (and token) that is being transferred
    /// @return numberOfFarms The number of farms
    /// @return limitIncentiveId The id of limit incentive that is active for this NFT
    /// @return eternalIncentiveId The id of eternal incentive that is active for this NFT
    function deposits(
        uint256 tokenId
    ) external view returns (uint32 numberOfFarms, bytes32 limitIncentiveId, bytes32 eternalIncentiveId);

    /// @notice Updates activeIncentive in AlgebraPool
    /// @dev only farming can do it
    /// @param pool The AlgebraPool for which farming was created
    /// @param virtualPool The virtual pool to be connected
    function connectVirtualPool(IAlgebraPool pool, address virtualPool) external;

    /// @notice Enters in incentive (time-limited or eternal farming) with NFT-position token
    /// @dev token must be deposited in FarmingCenter
    /// @param key The incentive event key
    /// @param tokenId The id of position NFT
    /// @param tokensLocked Amount of tokens to lock for liquidity multiplier (if tiers are used)
    /// @param isLimit Is incentive time-limited or eternal
    function enterFarming(IncentiveKey memory key, uint256 tokenId, uint256 tokensLocked, bool isLimit) external;

    /// @notice Exits from incentive (time-limited or eternal farming) with NFT-position token
    /// @param key The incentive event key
    /// @param tokenId The id of position NFT
    /// @param isLimit Is incentive time-limited or eternal
    function exitFarming(IncentiveKey memory key, uint256 tokenId, bool isLimit) external;

    /// @notice Used to collect reward from eternal farming. Then reward can be claimed.
    /// @param key The incentive event key
    /// @param tokenId The id of position NFT
    /// @return reward The amount of collected reward
    /// @return bonusReward The amount of collected  bonus reward
    function collectRewards(
        IncentiveKey memory key,
        uint256 tokenId
    ) external returns (uint256 reward, uint256 bonusReward);

    /// @notice Used to claim and send rewards from farming(s)
    /// @dev can be used via static call to get current rewards for user
    /// @param rewardToken The token that is a reward
    /// @param to The address to be rewarded
    /// @param amountRequestedLimit Amount to claim in limit farming
    /// @param amountRequestedEternal Amount to claim in eternal farming
    /// @return reward The summary amount of claimed rewards
    function claimReward(
        IERC20Minimal rewardToken,
        address to,
        uint256 amountRequestedLimit,
        uint256 amountRequestedEternal
    ) external returns (uint256 reward);
}
