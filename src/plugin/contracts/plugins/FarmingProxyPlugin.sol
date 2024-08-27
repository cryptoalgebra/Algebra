// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';

import '../interfaces/IBasePluginV1Factory.sol';
import '../interfaces/IAlgebraVirtualPool.sol';
import '../interfaces/plugins/IFarmingPlugin.sol';

import '../base/BasePlugin.sol';

/// @title Algebra Integral 1.1 default plugin
/// @notice This contract stores timepoints and calculates adaptive fee and statistical averages
abstract contract FarmingProxyPlugin is BasePlugin, IFarmingPlugin {
  using Plugins for uint8;

  uint8 private constant defaultPluginConfig = uint8(Plugins.AFTER_SWAP_FLAG);

  bytes32 internal constant FARMING_NAMESPACE = keccak256('namespace.farming');
  struct FarmingLayout {
    address incentive;
    address _lastIncentiveOwner;
  }

  /// @dev Fetch pointer of Adaptive fee plugin's storage
  function getFarmingPointer() internal pure returns (FarmingLayout storage fl) {
    bytes32 position = FARMING_NAMESPACE;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      fl.slot := position
    }
  }

  /// @inheritdoc IFarmingPlugin
  function setIncentive(address newIncentive) external override {
    bool toConnect = newIncentive != address(0);
    bool accessAllowed;

    FarmingLayout storage fl = getFarmingPointer();
    address _incentive = fl.incentive;
    address _lastIncentiveOwner = fl._lastIncentiveOwner;
    if (toConnect) {
      accessAllowed = msg.sender == IBasePluginV1Factory(pluginFactory).farmingAddress();
    } else {
      // we allow the one who connected the incentive to disconnect it,
      // even if he no longer has the rights to connect incentives
      if (_lastIncentiveOwner != address(0)) accessAllowed = msg.sender == _lastIncentiveOwner;
      if (!accessAllowed) accessAllowed = msg.sender == IBasePluginV1Factory(pluginFactory).farmingAddress();
    }
    require(accessAllowed, 'Not allowed to set incentive');

    bool isPluginConnected = _getPluginInPool() == address(this);
    if (toConnect) require(isPluginConnected, 'Plugin not attached');

    address currentIncentive = _incentive;
    require(currentIncentive != newIncentive, 'Already active');
    if (toConnect) require(currentIncentive == address(0), 'Has active incentive');

    fl.incentive = newIncentive;
    emit Incentive(newIncentive);

    if (toConnect) {
      _lastIncentiveOwner = msg.sender; // write creator of this incentive
      fl._lastIncentiveOwner = _lastIncentiveOwner;
    } else {
      _lastIncentiveOwner = address(0);
      fl._lastIncentiveOwner = _lastIncentiveOwner;
    }

    if (isPluginConnected) {
      _enablePluginFlags(defaultPluginConfig);
    }
  }

  /// @inheritdoc IFarmingPlugin
  function isIncentiveConnected(address targetIncentive) external view override returns (bool) {
    FarmingLayout storage fl = getFarmingPointer();
    address _incentive = fl.incentive;
    if (_incentive != targetIncentive) return false;
    if (_getPluginInPool() != address(this)) return false;
    (, , , uint8 pluginConfig) = _getPoolState();
    if (!pluginConfig.hasFlag(Plugins.AFTER_SWAP_FLAG)) return false;

    return true;
  }

  function _updateVirtualPoolTick(bool zeroToOne) internal {
    FarmingLayout storage fl = getFarmingPointer();
    address _incentive = fl.incentive;
    if (_incentive != address(0)) {
      (, int24 tick, , ) = _getPoolState();
      IAlgebraVirtualPool(_incentive).crossTo(tick, zeroToOne);
    } else {
      _disablePluginFlags(defaultPluginConfig); // should not be called, reset config
    }
  }

  function incentive() external view override returns (address) {
    FarmingLayout memory fl = getFarmingPointer();
    return fl.incentive;
  }
}
