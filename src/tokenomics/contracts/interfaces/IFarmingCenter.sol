// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6;
pragma abicoder v2;

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/core/contracts/interfaces/IERC20Minimal.sol';

import '@cryptoalgebra/periphery/contracts/interfaces/IMulticall.sol';
import '@cryptoalgebra/periphery/contracts/interfaces/INonfungiblePositionManager.sol';

import '../base/IncentiveKey.sol';
import '../interfaces/IAlgebraEternalFarming.sol';

interface IFarmingCenter is IMulticall {
  function virtualPoolAddresses(address) external view returns (address);

  /// @notice The nonfungible position manager with which this farming contract is compatible
  function nonfungiblePositionManager() external view returns (INonfungiblePositionManager);

  /// @notice The eternal farming contract
  function eternalFarming() external view returns (IAlgebraEternalFarming);

  /// @notice The Algebra poolDeployer contract
  function algebraPoolDeployer() external view returns (address);

  /// @notice Returns information about a deposited NFT
  /// @param tokenId The ID of the deposit (and token) that is being transferred
  /// @return eternalIncentiveId The id of eternal incentive that is active for this NFT
  function deposits(uint256 tokenId) external view returns (bytes32 eternalIncentiveId);

  /// @notice Updates activeIncentive in AlgebraPool
  /// @dev only farming can do it
  /// @param pool The AlgebraPool for which farming was created
  /// @param virtualPool The virtual pool to be connected
  function connectVirtualPool(IAlgebraPool pool, address virtualPool) external;

  /// @notice Enters in incentive (time-limited or eternal farming) with NFT-position token
  /// @dev token must be deposited in FarmingCenter
  /// @param key The incentive event key
  /// @param tokenId The id of position NFT
  function enterFarming(IncentiveKey memory key, uint256 tokenId) external;

  /// @notice Exits from incentive (time-limited or eternal farming) with NFT-position token
  /// @param key The incentive event key
  /// @param tokenId The id of position NFT
  function exitFarming(IncentiveKey memory key, uint256 tokenId) external;

  /// @notice Used to collect reward from eternal farming. Then reward can be claimed.
  /// @param key The incentive event key
  /// @param tokenId The id of position NFT
  /// @return reward The amount of collected reward
  /// @return bonusReward The amount of collected  bonus reward
  function collectRewards(IncentiveKey memory key, uint256 tokenId) external returns (uint256 reward, uint256 bonusReward);

  /// @notice Used to claim and send rewards from farming(s)
  /// @dev can be used via static call to get current rewards for user
  /// @param rewardToken The token that is a reward
  /// @param to The address to be rewarded
  /// @param amountRequested Amount to claim in eternal farming
  /// @return reward The summary amount of claimed rewards
  function claimReward(IERC20Minimal rewardToken, address to, uint256 amountRequested) external returns (uint256 reward);
}
