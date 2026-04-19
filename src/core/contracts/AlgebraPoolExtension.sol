// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;
pragma abicoder v1;

import './base/AlgebraPoolBase.sol';
import './base/ReentrancyGuard.sol';

import './libraries/Constants.sol';
import './libraries/Plugins.sol';
import './libraries/TickMath.sol';

import './interfaces/IAlgebraFactory.sol';
import './interfaces/plugin/IAlgebraPlugin.sol';

/// @title Algebra pool extension
/// @notice Contains permissioned setter logic, called via delegatecall from pool
/// @dev IMPORTANT: This extension is currently designed only for setters that do not require token0/token1 or other pool immutables.
/// If additional logic that depends on token addresses needs to be moved here (e.g. flash),
/// getDeployParameters must be updated to provide those values
/// @dev Version: Algebra Integral 1.3
contract AlgebraPoolExtension is AlgebraPoolBase, ReentrancyGuard {
  using Plugins for uint16;
  using Plugins for bytes4;

  /// @dev Extension is deployed by the factory, so msg.sender == factory.
  /// Only factory immutable needed for this extension, it is used for permission checks
  /// token0, token1, algebraPoolExtension are set to address(0) because the current setters don't need them
  function _getDeployParameters() internal virtual view override returns (address, address, address, address, address) {
    return (address(0), msg.sender, address(0), address(0), address(0));
  }

  /// @inheritdoc IAlgebraPoolActions
  function initialize(uint160 initialPrice) external override {
    int24 tick = TickMath.getTickAtSqrtRatio(initialPrice); // getTickAtSqrtRatio checks validity of initialPrice inside
    if (globalState.price != 0) revert alreadyInitialized(); // after initialization, the price can never become zero
    globalState.price = initialPrice;
    globalState.tick = tick;
    emit Initialize(initialPrice, tick);

    if (plugin != address(0)) {
      IAlgebraPlugin(plugin).beforeInitialize(msg.sender, initialPrice).shouldReturn(IAlgebraPlugin.beforeInitialize.selector);
    }

    (uint16 _communityFee, int24 _tickSpacing, uint16 _fee, uint16 _algebraFee) = _getDefaultConfiguration();

    _setFee(_fee);
    _setTickSpacing(_tickSpacing);
    if (_communityFee != 0 && communityVault == address(0)) revert invalidNewCommunityFee(); // the pool should not accumulate a community fee without a vault
    _setCommunityFee(_communityFee);
    _setAlgebraFee(_algebraFee);

    if (globalState.pluginConfig.hasFlag(Plugins.AFTER_INIT_FLAG)) {
      IAlgebraPlugin(plugin).afterInitialize(msg.sender, initialPrice, tick).shouldReturn(IAlgebraPlugin.afterInitialize.selector);
    }
  }

  // Stub implementations for interface methods that remain in AlgebraPool
  function mint(address, address, int24, int24, uint128, bytes calldata) external pure override returns (uint256, uint256, uint128) { revert notAllowed(); }
  function burn(int24, int24, uint128, bytes calldata) external pure override returns (uint256, uint256) { revert notAllowed(); }
  function collect(address, int24, int24, uint128, uint128) external pure override returns (uint128, uint128) { revert notAllowed(); }
  function swap(address, bool, int256, uint160, bytes calldata) external pure override returns (int256, int256) { revert notAllowed(); }
  function swapWithPaymentInAdvance(address, address, bool, int256, uint160, bytes calldata) external pure override returns (int256, int256) { revert notAllowed(); }
  function flash(address, uint256, uint256, bytes calldata) external pure override { revert notAllowed(); }
  function sync() external pure override { revert notAllowed(); }
  function skim() external pure override { revert notAllowed(); }
  function getReserves() external pure override returns (uint128, uint128) { revert notAllowed(); }
  function positions(bytes32) external pure override returns (uint256, uint256, uint256, uint128, uint128) { revert notAllowed(); }
  function tickTreeRoot() external pure override returns (uint32) { revert notAllowed(); }
  function tickTreeSecondLayer(int16) external pure override returns (uint256) { revert notAllowed(); }

  function _addOrRemoveTicks(int24, int24, bool, bool, int24, bool) internal pure override { revert notAllowed(); }

  /// @dev using function to save bytecode
  function _checkIfAdministrator() private view {
    if (!IAlgebraFactory(factory).hasRoleOrOwner(Constants.POOLS_ADMINISTRATOR_ROLE, msg.sender)) revert notAllowed();
  }

  /// @dev using function to save bytecode
  function _checkIfFactory() private view {
    if (msg.sender != factory) revert notAllowed();
  }

  // permissioned actions use reentrancy lock to prevent call from callback (to keep the correct order of events, etc.)
  
  function setCommunityFee(uint16 newCommunityFee) external override onlyUnlocked {
    _checkIfAdministrator();
    if (
      newCommunityFee > Constants.MAX_COMMUNITY_FEE ||
      newCommunityFee == globalState.communityFee ||
      (newCommunityFee != 0 && communityVault == address(0))
    ) revert invalidNewCommunityFee();
    _setCommunityFee(newCommunityFee);
  }

  function setTickSpacing(int24 newTickSpacing) external override onlyUnlocked {
    _checkIfAdministrator();
    if (newTickSpacing <= 0 || newTickSpacing > Constants.MAX_TICK_SPACING || tickSpacing == newTickSpacing) revert invalidNewTickSpacing();
    _setTickSpacing(newTickSpacing);
  }

  function setPlugin(address newPluginAddress) external override onlyUnlocked {
    _checkIfAdministrator();
    _setPluginConfig(0);
    _setPlugin(newPluginAddress);
  }

  function setPluginConfig(uint16 newConfig) external override onlyUnlocked {
    address _plugin = plugin;
    if (_plugin == address(0)) revert pluginIsNotConnected();
    if (msg.sender != _plugin) _checkIfAdministrator();
    _setPluginConfig(newConfig);
  }

  function setCommunityVault(address newCommunityVault) external override onlyUnlocked {
    // factory is allowed to set initial vault
    if (msg.sender != factory) _checkIfAdministrator();
    if (newCommunityVault == address(0) && globalState.communityFee != 0) _setCommunityFee(0);
    _setCommunityFeeVault(newCommunityVault);
  }

  function setFee(uint16 newFee) external override {
    _checkIfAdministrator();
    bool isDynamicFeeEnabled = globalState.pluginConfig.hasFlag(Plugins.DYNAMIC_FEE);
    if (!globalState.unlocked) revert locked();
    if (isDynamicFeeEnabled) revert dynamicFeeActive();
    _setFee(newFee);
  }

  function setAlgebraFee(uint16 newAlgebraFee) external override onlyUnlocked {
    _checkIfFactory();
    _setAlgebraFee(newAlgebraFee);
  }

  function setAlgebraFeeReceiver(address newAlgebraFeeReceiver) external override onlyUnlocked {
    _checkIfFactory();
    _setAlgebraFeeReceiver(newAlgebraFeeReceiver);
  }
}
