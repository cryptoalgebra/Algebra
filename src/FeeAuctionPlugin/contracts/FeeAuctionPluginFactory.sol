// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import './interfaces/IFeeAuctionPluginFactory.sol';
import './FeeAuctionPlugin.sol';

/// @title Algebra Fee Auction Plugin Factory
/// @notice Factory contract that creates FeeAuctionPlugin instances for Algebra pools
/// @dev Implements IAlgebraPluginFactory for automatic plugin creation on new pools
contract FeeAuctionPluginFactory is IFeeAuctionPluginFactory {
  /// @inheritdoc IFeeAuctionPluginFactory
  bytes32 public constant override ALGEBRA_FEE_AUCTION_PLUGIN_FACTORY_ADMINISTRATOR = keccak256('ALGEBRA_FEE_AUCTION_PLUGIN_FACTORY_ADMINISTRATOR');

  /// @inheritdoc IBasePluginFactory
  address public immutable override algebraFactory;

  /// @inheritdoc IBasePluginFactory
  mapping(address poolAddress => address pluginAddress) public override pluginByPool;

  /// @inheritdoc IFeeAuctionPluginFactory
  uint256 public override defaultMevTaxMultiplier;

  /// @inheritdoc IFeeAuctionPluginFactory
  uint24 public override defaultMaxMevTax;

  /// @inheritdoc IFeeAuctionPluginFactory
  uint24 public override defaultBaseFee;

  /// @inheritdoc IFeeAuctionPluginFactory
  bool public override defaultMevTaxEnabled;

  /// @notice Maximum allowed fee is 10% (100000 basis points)
  uint24 private constant MAX_FEE = 100000;

  /// @dev Restricts access to administrator role
  modifier onlyAdministrator() {
    require(IAlgebraFactory(algebraFactory).hasRoleOrOwner(ALGEBRA_FEE_AUCTION_PLUGIN_FACTORY_ADMINISTRATOR, msg.sender), 'Only administrator');
    _;
  }

  /// @notice Creates the fee auction plugin factory
  /// @param _algebraFactory Address of the Algebra factory
  /// @param _defaultBaseFee Default base fee for new plugins (500 = 0.05%)
  /// @param _defaultMevTaxMultiplier Default MEV tax multiplier (99000 recommended for L2)
  /// @param _defaultMaxMevTax Default maximum MEV tax (100000 = 10%)
  /// @param _defaultMevTaxEnabled Whether MEV tax is enabled by default
  constructor(
    address _algebraFactory,
    uint24 _defaultBaseFee,
    uint256 _defaultMevTaxMultiplier,
    uint24 _defaultMaxMevTax,
    bool _defaultMevTaxEnabled
  ) {
    require(_algebraFactory != address(0), 'Zero factory address');
    require(_defaultBaseFee <= MAX_FEE, 'Base fee too high');
    require(_defaultMaxMevTax <= MAX_FEE, 'Max MEV tax too high');

    algebraFactory = _algebraFactory;
    defaultBaseFee = _defaultBaseFee;
    defaultMevTaxMultiplier = _defaultMevTaxMultiplier;
    defaultMaxMevTax = _defaultMaxMevTax;
    defaultMevTaxEnabled = _defaultMevTaxEnabled;

    emit DefaultBaseFeeChanged(_defaultBaseFee);
    emit DefaultMevTaxParametersChanged(_defaultMevTaxMultiplier, _defaultMaxMevTax);
    emit DefaultMevTaxEnabledChanged(_defaultMevTaxEnabled);
  }

  /// @inheritdoc IAlgebraPluginFactory
  function beforeCreatePoolHook(address pool, address, address, address, address, bytes calldata) external override returns (address) {
    require(msg.sender == algebraFactory, 'Only Algebra factory');
    return _createPlugin(pool);
  }

  /// @inheritdoc IAlgebraPluginFactory
  function afterCreatePoolHook(address, address, address) external view override {
    require(msg.sender == algebraFactory, 'Only Algebra factory');
  }

  /// @inheritdoc IBasePluginFactory
  function createPluginForExistingPool(address token0, address token1) external override returns (address) {
    IAlgebraFactory factory = IAlgebraFactory(algebraFactory);
    require(factory.hasRoleOrOwner(factory.POOLS_ADMINISTRATOR_ROLE(), msg.sender), 'Only pools administrator');

    address pool = factory.poolByPair(token0, token1);
    require(pool != address(0), 'Pool does not exist');

    return _createPlugin(pool);
  }

  /// @notice Internal function to create a new plugin for a pool
  /// @param pool Address of the pool
  /// @return plugin Address of the created plugin
  function _createPlugin(address pool) internal returns (address plugin) {
    require(pluginByPool[pool] == address(0), 'Plugin already exists');

    plugin = address(
      new FeeAuctionPlugin(pool, algebraFactory, address(this), defaultBaseFee, defaultMevTaxMultiplier, defaultMaxMevTax, defaultMevTaxEnabled)
    );

    pluginByPool[pool] = plugin;
  }

  /// @inheritdoc IFeeAuctionPluginFactory
  function setDefaultBaseFee(uint24 newBaseFee) external override onlyAdministrator {
    require(newBaseFee <= MAX_FEE, 'Base fee too high');
    defaultBaseFee = newBaseFee;
    emit DefaultBaseFeeChanged(newBaseFee);
  }

  /// @inheritdoc IFeeAuctionPluginFactory
  function setDefaultMevTaxParameters(uint256 newMevTaxMultiplier, uint24 newMaxMevTax) external override onlyAdministrator {
    require(newMaxMevTax <= MAX_FEE, 'Max MEV tax too high');
    defaultMevTaxMultiplier = newMevTaxMultiplier;
    defaultMaxMevTax = newMaxMevTax;
    emit DefaultMevTaxParametersChanged(newMevTaxMultiplier, newMaxMevTax);
  }

  /// @inheritdoc IFeeAuctionPluginFactory
  function setDefaultMevTaxEnabled(bool enabled) external override onlyAdministrator {
    defaultMevTaxEnabled = enabled;
    emit DefaultMevTaxEnabledChanged(enabled);
  }
}
