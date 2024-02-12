// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.6;
pragma abicoder v2;

import '@cryptoalgebra/integral-core/contracts/interfaces/IERC20Minimal.sol';

import '@cryptoalgebra/integral-periphery/contracts/interfaces/IMulticall.sol';
import '@cryptoalgebra/integral-periphery/contracts/interfaces/INonfungiblePositionManager.sol';

import '@cryptoalgebra/integral-base-plugin/contracts/interfaces/plugins/IFarmingPlugin.sol';

import '../base/IncentiveKey.sol';
import '../interfaces/IAlgebraEternalFarming.sol';

/// @title Algebra main farming contract interface
/// @dev Manages users deposits and performs entry, exit and other actions.
interface IFarmingCenter is IMulticall {
  /// @notice Returns current virtual pool address for Algebra pool
  function virtualPoolAddresses(address poolAddress) external view returns (address virtualPoolAddresses);

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

  /// @notice Returns incentive key for specific incentiveId
  /// @param incentiveId The hash of incentive key
  function incentiveKeys(
    bytes32 incentiveId
  ) external view returns (IERC20Minimal rewardToken, IERC20Minimal bonusRewardToken, IAlgebraPool pool, uint256 nonce);

  /// @notice Used to connect incentive to compatible AlgebraPool plugin
  /// @dev only farming can do it
  /// Will revert if something is already connected to the plugin
  /// @param virtualPool The virtual pool to be connected, must not be zero address
  /// @param plugin The Algebra farming plugin
  function connectVirtualPoolToPlugin(address virtualPool, IFarmingPlugin plugin) external;

  /// @notice Used to disconnect incentive from compatible AlgebraPool plugin
  /// @dev only farming can do it.
  /// If the specified virtual pool is not connected to the plugin, nothing will happen
  /// @param virtualPool The virtual pool to be disconnected, must not be zero address
  /// @param plugin The Algebra farming plugin
  function disconnectVirtualPoolFromPlugin(address virtualPool, IFarmingPlugin plugin) external;

  /// @notice Enters in incentive (eternal farming) with NFT-position token
  /// @dev msg.sender must be the owner of NFT
  /// @param key The incentive key
  /// @param tokenId The id of position NFT
  function enterFarming(IncentiveKey memory key, uint256 tokenId) external;

  /// @notice Exits from incentive (eternal farming) with NFT-position token
  /// @dev msg.sender must be the owner of NFT
  /// @param key The incentive key
  /// @param tokenId The id of position NFT
  function exitFarming(IncentiveKey memory key, uint256 tokenId) external;

  /// @notice Used to collect reward from eternal farming. Then reward can be claimed.
  /// @param key The incentive key
  /// @param tokenId The id of position NFT
  /// @return reward The amount of collected reward
  /// @return bonusReward The amount of collected  bonus reward
  function collectRewards(IncentiveKey memory key, uint256 tokenId) external returns (uint256 reward, uint256 bonusReward);

  /// @notice Used to claim and send rewards from farming(s)
  /// @dev can be used via static call to get current rewards for user
  /// @param rewardToken The token that is a reward
  /// @param to The address to be rewarded
  /// @param amountRequested Amount to claim in eternal farming
  /// @return rewardBalanceBefore The total amount of unclaimed reward *before* claim
  function claimReward(IERC20Minimal rewardToken, address to, uint256 amountRequested) external returns (uint256 rewardBalanceBefore);
}
