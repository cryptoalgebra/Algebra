// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '../interfaces/callback/IAlgebraSwapCallback.sol';
import '../interfaces/callback/IAlgebraMintCallback.sol';
import '../interfaces/callback/IAlgebraFlashCallback.sol';
import '../interfaces/plugin/IAlgebraPlugin.sol';
import '../interfaces/plugin/IAlgebraDynamicFeePlugin.sol';
import '../interfaces/IAlgebraPool.sol';
import '../interfaces/IAlgebraFactory.sol';
import '../interfaces/IAlgebraPoolDeployer.sol';
import '../interfaces/IERC20Minimal.sol';

import '../libraries/TickManagement.sol';
import '../libraries/SafeTransfer.sol';
import '../libraries/Constants.sol';
import '../libraries/Plugins.sol';

import './common/Timestamp.sol';

/// @title Algebra pool base abstract contract
/// @notice Contains state variables, immutables and common internal functions
/// @dev Decoupling into a separate abstract contract simplifies testing
abstract contract AlgebraPoolBase is IAlgebraPool, Timestamp {
  using TickManagement for mapping(int24 => TickManagement.Tick);

  struct GlobalState {
    uint160 price; // The square root of the current price in Q64.96 format
    int24 tick; // The current tick
    uint16 fee; // The current fee in hundredths of a bip, i.e. 1e-6
    uint8 pluginConfig; // The current plugin config as a bitmap
    uint16 communityFee; // The community fee represented as a percent of all collected fee in thousandths (1e-3)
    bool unlocked; // True if the contract is unlocked, otherwise - false
  }

  /// @inheritdoc IAlgebraPoolImmutables
  address public immutable override factory;
  /// @inheritdoc IAlgebraPoolImmutables
  address public immutable override token0;
  /// @inheritdoc IAlgebraPoolImmutables
  address public immutable override token1;
  /// @inheritdoc IAlgebraPoolImmutables
  address public immutable override communityVault;

  /// @inheritdoc IAlgebraPoolState
  uint256 public override totalFeeGrowth0Token;
  /// @inheritdoc IAlgebraPoolState
  uint256 public override totalFeeGrowth1Token;
  /// @inheritdoc IAlgebraPoolState
  GlobalState public override globalState;

  /// @inheritdoc IAlgebraPoolState
  mapping(int24 => TickManagement.Tick) public override ticks;

  /// @inheritdoc IAlgebraPoolState
  uint32 public override communityFeeLastTimestamp;

  /// @dev The amounts of token0 and token1 that will be sent to the vault
  uint104 internal communityFeePending0;
  uint104 internal communityFeePending1;

  /// @inheritdoc IAlgebraPoolState
  address public override plugin;

  /// @inheritdoc IAlgebraPoolState
  mapping(int16 => uint256) public override tickTable;

  /// @inheritdoc IAlgebraPoolState
  int24 public override nextTickGlobal;
  /// @inheritdoc IAlgebraPoolState
  int24 public override prevTickGlobal;

  /// @inheritdoc IAlgebraPoolState
  uint128 public override liquidity;
  /// @inheritdoc IAlgebraPoolState
  int24 public override tickSpacing;

  /// @inheritdoc IAlgebraPoolImmutables
  function maxLiquidityPerTick() external pure override returns (uint128) {
    return Constants.MAX_LIQUIDITY_PER_TICK;
  }

  /// @inheritdoc IAlgebraPoolState
  function getCommunityFeePending() external view returns (uint128, uint128) {
    return (communityFeePending0, communityFeePending1);
  }

  /// @inheritdoc IAlgebraPoolState
  function fee() external view returns (uint16 currentFee) {
    currentFee = globalState.fee;
    uint8 pluginConfig = globalState.pluginConfig;

    if (Plugins.hasFlag(pluginConfig, Plugins.DYNAMIC_FEE)) return IAlgebraDynamicFeePlugin(plugin).getCurrentFee();
  }

  /// @notice Check that the lower and upper ticks do not violate the boundaries of allowed ticks and are specified in the correct order
  modifier onlyValidTicks(int24 bottomTick, int24 topTick) {
    TickManagement.checkTickRangeValidity(bottomTick, topTick);
    _;
  }

  constructor() {
    (plugin, factory, communityVault, token0, token1) = _getDeployParameters();
    (prevTickGlobal, nextTickGlobal) = (TickMath.MIN_TICK, TickMath.MAX_TICK);
    globalState.unlocked = true;
  }

  /// @dev Gets the parameter values ​​for creating the pool. They are not passed in the constructor to make it easier to use create2 opcode
  /// Can be overridden in tests
  function _getDeployParameters() internal virtual returns (address, address, address, address, address) {
    return IAlgebraPoolDeployer(msg.sender).getDeployParameters();
  }

  /// @dev Gets the default settings for pool initialization. Can be overridden in tests
  function _getDefaultConfiguration() internal virtual returns (uint16, int24, uint16) {
    return IAlgebraFactory(factory).defaultConfigurationForPool();
  }

  // The main external calls that are used by the pool. Can be overridden in tests

  function _balanceToken0() internal view virtual returns (uint256) {
    return IERC20Minimal(token0).balanceOf(address(this));
  }

  function _balanceToken1() internal view virtual returns (uint256) {
    return IERC20Minimal(token1).balanceOf(address(this));
  }

  function _transfer(address token, address to, uint256 amount) internal virtual {
    SafeTransfer.safeTransfer(token, to, amount);
  }

  // These 'callback' functions are wrappers over the callbacks that the pool calls on the msg.sender
  // These methods can be overridden in tests

  /// @dev Using function to save bytecode
  function _swapCallback(int256 amount0, int256 amount1, bytes calldata data) internal virtual {
    IAlgebraSwapCallback(msg.sender).algebraSwapCallback(amount0, amount1, data);
  }

  function _mintCallback(uint256 amount0, uint256 amount1, bytes calldata data) internal virtual {
    IAlgebraMintCallback(msg.sender).algebraMintCallback(amount0, amount1, data);
  }

  function _flashCallback(uint256 fee0, uint256 fee1, bytes calldata data) internal virtual {
    IAlgebraFlashCallback(msg.sender).algebraFlashCallback(fee0, fee1, data);
  }

  // This virtual function is implemented in TickStructure and used in Positions
  /// @dev Add or remove a pair of ticks to the corresponding data structure
  function _addOrRemoveTicks(int24 bottomTick, int24 topTick, bool toggleBottom, bool toggleTop, int24 currentTick, bool remove) internal virtual;
}
