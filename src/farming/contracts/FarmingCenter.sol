// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/core/contracts/interfaces/IERC20Minimal.sol';
import '@cryptoalgebra/periphery/contracts/interfaces/IPositionFollower.sol';
import '@cryptoalgebra/periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@cryptoalgebra/periphery/contracts/base/Multicall.sol';
import '@cryptoalgebra/periphery/contracts/libraries/PoolAddress.sol';
import '@cryptoalgebra/plugins/contracts/interfaces/plugins/IFarmingPlugin.sol';

import './interfaces/IFarmingCenter.sol';
import './libraries/IncentiveId.sol';

/// @title Algebra main farming contract
/// @dev Manages farmings and performs entry, exit and other actions.
contract FarmingCenter is IFarmingCenter, IPositionFollower, Multicall {
  /// @inheritdoc IFarmingCenter
  IAlgebraEternalFarming public immutable override eternalFarming;
  /// @inheritdoc IFarmingCenter
  INonfungiblePositionManager public immutable override nonfungiblePositionManager;
  /// @inheritdoc IFarmingCenter
  address public immutable override algebraPoolDeployer;

  /// @inheritdoc IFarmingCenter
  mapping(address poolAddress => address virtualPoolAddress) public override virtualPoolAddresses;

  /// @inheritdoc IFarmingCenter
  mapping(uint256 tokenId => bytes32 incentiveId) public override deposits;

  /// @inheritdoc IFarmingCenter
  mapping(bytes32 incentiveId => IncentiveKey incentiveKey) public override incentiveKeys;

  constructor(IAlgebraEternalFarming _eternalFarming, INonfungiblePositionManager _nonfungiblePositionManager) {
    eternalFarming = _eternalFarming;
    nonfungiblePositionManager = _nonfungiblePositionManager;
    algebraPoolDeployer = _nonfungiblePositionManager.poolDeployer();
  }

  modifier isApprovedOrOwner(uint256 tokenId) {
    require(nonfungiblePositionManager.isApprovedOrOwner(msg.sender, tokenId), 'not approved for token');
    _;
  }

  /// @inheritdoc IFarmingCenter
  function enterFarming(IncentiveKey memory key, uint256 tokenId) external override isApprovedOrOwner(tokenId) {
    bytes32 incentiveId = IncentiveId.compute(key);
    if (address(incentiveKeys[incentiveId].pool) == address(0)) incentiveKeys[incentiveId] = key;

    require(deposits[tokenId] == bytes32(0), 'token already farmed');
    deposits[tokenId] = incentiveId;
    nonfungiblePositionManager.switchFarmingStatus(tokenId, true);

    IAlgebraEternalFarming(eternalFarming).enterFarming(key, tokenId);
  }

  /// @inheritdoc IFarmingCenter
  function exitFarming(IncentiveKey memory key, uint256 tokenId) external override isApprovedOrOwner(tokenId) {
    _exitFarming(key, tokenId, nonfungiblePositionManager.ownerOf(tokenId));
  }

  function _exitFarming(IncentiveKey memory key, uint256 tokenId, address tokenOwner) private {
    require(deposits[tokenId] == IncentiveId.compute(key), 'invalid incentiveId');
    deposits[tokenId] = bytes32(0);
    nonfungiblePositionManager.switchFarmingStatus(tokenId, false);

    IAlgebraEternalFarming(eternalFarming).exitFarming(key, tokenId, tokenOwner);
  }

  /// @inheritdoc IPositionFollower
  function applyLiquidityDelta(uint256 tokenId, int256) external override {
    _updatePosition(tokenId);
  }

  function _updatePosition(uint256 tokenId) private {
    require(msg.sender == address(nonfungiblePositionManager), 'only nonfungiblePosManager');

    bytes32 _eternalIncentiveId = deposits[tokenId];
    if (_eternalIncentiveId != bytes32(0)) {
      address tokenOwner = nonfungiblePositionManager.ownerOf(tokenId);
      (, , , , , , uint128 liquidity, , , , ) = nonfungiblePositionManager.positions(tokenId);

      IncentiveKey memory key = incentiveKeys[_eternalIncentiveId];

      if (liquidity == 0 || virtualPoolAddresses[address(key.pool)] == address(0)) {
        _exitFarming(key, tokenId, tokenOwner);
      } else {
        IAlgebraEternalFarming(eternalFarming).exitFarming(key, tokenId, tokenOwner);

        if (IAlgebraEternalFarming(eternalFarming).isIncentiveDeactivated(IncentiveId.compute(key))) {
          // exit completely if the incentive has stopped (manually or automatically)
          deposits[tokenId] = bytes32(0);
          nonfungiblePositionManager.switchFarmingStatus(tokenId, false);
        } else {
          // reenter with new liquidity value
          IAlgebraEternalFarming(eternalFarming).enterFarming(key, tokenId);
        }
      }
    }
  }

  /// @inheritdoc IFarmingCenter
  function collectRewards(
    IncentiveKey memory key,
    uint256 tokenId
  ) external override isApprovedOrOwner(tokenId) returns (uint256 reward, uint256 bonusReward) {
    (reward, bonusReward) = eternalFarming.collectRewards(key, tokenId, nonfungiblePositionManager.ownerOf(tokenId));
  }

  /// @inheritdoc IFarmingCenter
  function claimReward(IERC20Minimal rewardToken, address to, uint256 amountRequested) external override returns (uint256 reward) {
    unchecked {
      if (amountRequested != 0) reward += eternalFarming.claimRewardFrom(rewardToken, msg.sender, to, amountRequested);
    }
  }

  /// @inheritdoc IFarmingCenter
  function connectVirtualPoolToPlugin(address newVirtualPool, IFarmingPlugin plugin) external override {
    require(msg.sender == address(eternalFarming), 'only farming can call this');
    IAlgebraPool pool = IAlgebraPool(plugin.pool());
    PoolAddress.PoolKey memory poolKey = PoolAddress.PoolKey(pool.token0(), pool.token1());
    require(address(pool) == PoolAddress.computeAddress(algebraPoolDeployer, poolKey), 'invalid pool');
    plugin.setIncentive(newVirtualPool); // TODO
    virtualPoolAddresses[address(pool)] = newVirtualPool;
  }
}
