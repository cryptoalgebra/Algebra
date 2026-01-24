// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';
import '@cryptoalgebra/abstract-plugin/contracts/BaseAbstractPlugin.sol';

import './interfaces/IFeeAuctionPlugin.sol';

/// @title Algebra MEV Auction Plugin
/// @notice Plugin that implements MEV tax - a fee that depends on transaction priority fee
/// @dev swapFee = baseFee + mevTaxMultiplier * priorityFeePerGas / 1e9
/// where priorityFeePerGas = tx.gasprice - block.basefee
contract FeeAuctionPlugin is BaseAbstractPlugin, IFeeAuctionPlugin {
  using Plugins for uint8;

  /// @inheritdoc IFeeAuctionPlugin
  uint24 public override baseFee;

  /// @inheritdoc IFeeAuctionPlugin
  uint256 public override mevTaxMultiplier;

  /// @inheritdoc IFeeAuctionPlugin
  uint24 public override maxMevTax;

  /// @inheritdoc IFeeAuctionPlugin
  bool public override mevTaxEnabled;

  /// @notice Maximum allowed fee is 10% (100000 basis points)
  uint24 private constant MAX_FEE = 100000;

  /// @notice Plugin configuration flags: BEFORE_SWAP_FLAG | DYNAMIC_FEE
  uint8 private constant PLUGIN_CONFIG = uint8(Plugins.BEFORE_SWAP_FLAG) | uint8(Plugins.DYNAMIC_FEE);

  constructor(
    address _pool,
    address _factory,
    address _pluginFactory,
    uint24 _baseFee,
    uint256 _mevTaxMultiplier,
    uint24 _maxMevTax,
    bool _mevTaxEnabled
  ) BaseAbstractPlugin(_pool, _factory, _pluginFactory) {
    require(_baseFee <= MAX_FEE, 'Base fee too high');
    require(_maxMevTax <= MAX_FEE, 'Max MEV tax too high');

    baseFee = _baseFee;
    mevTaxMultiplier = _mevTaxMultiplier;
    maxMevTax = _maxMevTax;
    mevTaxEnabled = _mevTaxEnabled;

    defaultPluginConfig = PLUGIN_CONFIG;
    activeModules.push('FeeAuction');
  }

  /// @inheritdoc IFeeAuctionPlugin
  function setBaseFee(uint24 newBaseFee) external override {
    _authorize();
    require(newBaseFee <= MAX_FEE, 'Base fee too high');
    baseFee = newBaseFee;
    emit BaseFeeChanged(newBaseFee);
  }

  /// @inheritdoc IFeeAuctionPlugin
  function setMevTaxParameters(uint256 newMevTaxMultiplier, uint24 newMaxMevTax) external override {
    _authorize();
    require(newMaxMevTax <= MAX_FEE, 'Max MEV tax too high');
    mevTaxMultiplier = newMevTaxMultiplier;
    maxMevTax = newMaxMevTax;
    emit MevTaxParametersChanged(newMevTaxMultiplier, newMaxMevTax);
  }

  /// @inheritdoc IFeeAuctionPlugin
  function setMevTaxEnabled(bool enabled) external override {
    _authorize();
    mevTaxEnabled = enabled;
    emit MevTaxEnabledChanged(enabled);
  }

  /// @notice Calculates the priority fee of the current transaction
  /// @dev priorityFee = tx.gasprice - block.basefee
  /// @return priorityFee The priority fee in wei
  function _getPriorityFee() internal view returns (uint256 priorityFee) {
    // On L2s without EIP-1559, block.basefee may be 0 or minimal
    // In such cases, tx.gasprice effectively becomes the priority fee
    if (tx.gasprice > block.basefee) {
      priorityFee = tx.gasprice - block.basefee;
    } else {
      priorityFee = 0;
    }
  }

  /// @notice Calculates the MEV tax based on priority fee
  /// @dev mevTax = min((priorityFee * mevTaxMultiplier) / 1e9, maxMevTax)
  /// @return mevTax The calculated MEV tax in basis points
  function _calculateMevTax() internal view returns (uint24 mevTax) {
    if (!mevTaxEnabled) {
      return 0;
    }

    uint256 priorityFee = _getPriorityFee();
    if (priorityFee == 0) {
      return 0;
    }

    uint256 calculatedTax = (priorityFee * mevTaxMultiplier) / 1e9;

    // Cap at maxMevTax
    if (calculatedTax > maxMevTax) {
      return maxMevTax;
    }

    return uint24(calculatedTax);
  }

  // ======== HOOKS ========

  /// @inheritdoc IAlgebraPlugin
  function beforeInitialize(address, uint160) external override(AbstractPlugin, IAlgebraPlugin) onlyPool returns (bytes4) {
    _updatePluginConfigInPool(defaultPluginConfig);
    return IAlgebraPlugin.beforeInitialize.selector;
  }

  /// @inheritdoc IAlgebraPlugin
  function beforeSwap(
    address,
    address,
    bool,
    int256,
    uint160,
    bool,
    bytes calldata
  ) external override(AbstractPlugin, IAlgebraPlugin) onlyPool returns (bytes4, uint24, uint24) {
    uint24 feeOverride = baseFee;
    uint24 pluginFee = _calculateMevTax();

    return (IAlgebraPlugin.beforeSwap.selector, feeOverride, pluginFee);
  }

  /// @inheritdoc IAlgebraPlugin
  /// @dev This function is view in the base contract, but we emit an event for tracking
  /// The actual fee tokens are transferred to this contract by the pool
  function handlePluginFee(uint256, uint256) external view override(AbstractPlugin, IAlgebraPlugin) onlyPool returns (bytes4) {
    // Note: We cannot modify state here as the base function is view
    // Fees are automatically sent to the plugin contract by the pool
    // Use collectPluginFee to withdraw accumulated fees
    // Emit is not allowed in view, but we keep this comment for documentation
    return IAlgebraPlugin.handlePluginFee.selector;
  }
}
