// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/core/contracts/base/common/Timestamp.sol';
import '@cryptoalgebra/core/contracts/libraries/Plugins.sol';
import '@cryptoalgebra/core/contracts/libraries/FullMath.sol';

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/core/contracts/interfaces/plugin/IAlgebraPlugin.sol';
import '@cryptoalgebra/core/contracts/interfaces/pool/IAlgebraPoolState.sol';
import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';

import './interfaces/IAlgebraBasePluginV1.sol';
import './interfaces/IBasePluginV1Factory.sol';
import './interfaces/IAlgebraVirtualPool.sol';

import './libraries/VolatilityOracle.sol';
import './libraries/TransferHelper.sol';
import './libraries/AdaptiveFee.sol';
import './types/AlgebraFeeConfigurationU144.sol';

/// @title Algebra default plugin
/// @notice This contract stores timepoints and calculates adaptive fee and statistical averages
contract AlgebraBasePluginV1 is IAlgebraBasePluginV1, Timestamp, IAlgebraPlugin {
  using Plugins for uint8;
  using AlgebraFeeConfigurationU144Lib for AlgebraFeeConfiguration;

  uint256 internal constant UINT16_MODULO = 65536;
  using VolatilityOracle for VolatilityOracle.Timepoint[UINT16_MODULO];

  /// @dev The role can be granted in AlgebraFactory
  bytes32 public constant ALGEBRA_BASE_PLUGIN_MANAGER = keccak256('ALGEBRA_BASE_PLUGIN_MANAGER');

  /// @inheritdoc IAlgebraPlugin
  uint8 public constant override defaultPluginConfig = uint8(Plugins.AFTER_INIT_FLAG | Plugins.BEFORE_SWAP_FLAG | Plugins.DYNAMIC_FEE);

  /// @inheritdoc IFarmingPlugin
  address public immutable override pool;
  address private immutable factory;
  address private immutable pluginFactory;

  /// @inheritdoc IVolatilityOracle
  VolatilityOracle.Timepoint[UINT16_MODULO] public override timepoints;

  /// @inheritdoc IVolatilityOracle
  uint16 public override timepointIndex;

  /// @inheritdoc IVolatilityOracle
  uint32 public override lastTimepointTimestamp;

  /// @inheritdoc IVolatilityOracle
  bool public override isInitialized;

  /// @dev AlgebraFeeConfiguration struct packed in uint144
  AlgebraFeeConfigurationU144 private _feeConfig;

  /// @inheritdoc IFarmingPlugin
  address public override incentive;

  /// @dev the address which connected the last incentive. Needed so that he can disconnect it
  address private _lastIncentiveOwner;

  modifier onlyPool() {
    _checkIfFromPool();
    _;
  }

  constructor(address _pool, address _factory, address _pluginFactory) {
    (factory, pool, pluginFactory) = (_factory, _pool, _pluginFactory);
  }

  /// @inheritdoc IDynamicFeeManager
  function feeConfig()
    external
    view
    override
    returns (uint16 alpha1, uint16 alpha2, uint32 beta1, uint32 beta2, uint16 gamma1, uint16 gamma2, uint16 baseFee)
  {
    (alpha1, alpha2) = (_feeConfig.alpha1(), _feeConfig.alpha2());
    (beta1, beta2) = (_feeConfig.beta1(), _feeConfig.beta2());
    (gamma1, gamma2) = (_feeConfig.gamma1(), _feeConfig.gamma2());
    baseFee = _feeConfig.baseFee();
  }

  function _checkIfFromPool() internal view {
    require(msg.sender == pool, 'Only pool can call this');
  }

  function _getPoolState() internal view returns (uint160 price, int24 tick, uint16 fee, uint8 pluginConfig) {
    (price, tick, fee, pluginConfig, , ) = IAlgebraPoolState(pool).globalState();
  }

  function _getPluginInPool() internal view returns (address plugin) {
    return IAlgebraPool(pool).plugin();
  }

  /// @inheritdoc IAlgebraBasePluginV1
  function initialize() external override {
    require(!isInitialized, 'Already initialized');
    require(_getPluginInPool() == address(this), 'Plugin not attached');
    (uint160 price, int24 tick, , ) = _getPoolState();
    require(price != 0, 'Pool is not initialized');

    uint32 time = _blockTimestamp();
    timepoints.initialize(time, tick);
    lastTimepointTimestamp = time;
    isInitialized = true;

    _updatePluginConfigInPool();
  }

  // ###### Volatility and TWAP oracle ######

  /// @inheritdoc IVolatilityOracle
  function getSingleTimepoint(uint32 secondsAgo) external view override returns (int56 tickCumulative, uint88 volatilityCumulative) {
    // `volatilityCumulative` values for timestamps after the last timepoint _should not_ be compared: they may differ due to interpolation errors
    (, int24 tick, , ) = _getPoolState();
    uint16 lastTimepointIndex = timepointIndex;
    uint16 oldestIndex = timepoints.getOldestIndex(lastTimepointIndex);
    VolatilityOracle.Timepoint memory result = timepoints.getSingleTimepoint(_blockTimestamp(), secondsAgo, tick, lastTimepointIndex, oldestIndex);
    (tickCumulative, volatilityCumulative) = (result.tickCumulative, result.volatilityCumulative);
  }

  /// @inheritdoc IVolatilityOracle
  function getTimepoints(
    uint32[] memory secondsAgos
  ) external view override returns (int56[] memory tickCumulatives, uint88[] memory volatilityCumulatives) {
    // `volatilityCumulative` values for timestamps after the last timepoint _should not_ be compared: they may differ due to interpolation errors
    (, int24 tick, , ) = _getPoolState();
    return timepoints.getTimepoints(_blockTimestamp(), secondsAgos, tick, timepointIndex);
  }

  /// @inheritdoc IVolatilityOracle
  function prepayTimepointsStorageSlots(uint16 startIndex, uint16 amount) external override {
    require(!timepoints[startIndex].initialized); // if not initialized, then all subsequent ones too
    require(amount > 0 && type(uint16).max - startIndex >= amount);

    unchecked {
      for (uint256 i = startIndex; i < startIndex + amount; ++i) {
        timepoints[i].blockTimestamp = 1; // will be overwritten
      }
    }
  }

  // ###### Fee manager ######

  /// @inheritdoc IDynamicFeeManager
  function changeFeeConfiguration(AlgebraFeeConfiguration calldata _config) external override {
    require(msg.sender == pluginFactory || IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));
    AdaptiveFee.validateFeeConfiguration(_config);

    _feeConfig = _config.pack(); // pack struct to uint144 and write in storage
    emit FeeConfiguration(_config);
  }

  /// @inheritdoc IAlgebraDynamicFeePlugin
  function getCurrentFee() external view override returns (uint16 fee) {
    uint16 lastIndex = timepointIndex;
    AlgebraFeeConfigurationU144 feeConfig_ = _feeConfig;
    if (feeConfig_.alpha1() | feeConfig_.alpha2() == 0) return feeConfig_.baseFee();

    uint16 oldestIndex = timepoints.getOldestIndex(lastIndex);
    (, int24 tick, , ) = _getPoolState();

    uint88 volatilityAverage = timepoints.getAverageVolatility(_blockTimestamp(), tick, lastIndex, oldestIndex);
    return AdaptiveFee.getFee(volatilityAverage, feeConfig_);
  }

  function _getFeeAtLastTimepoint(
    uint16 lastTimepointIndex,
    uint16 oldestTimepointIndex,
    int24 currentTick,
    AlgebraFeeConfigurationU144 feeConfig_
  ) internal view returns (uint16 fee) {
    if (feeConfig_.alpha1() | feeConfig_.alpha2() == 0) return feeConfig_.baseFee();

    uint88 volatilityAverage = timepoints.getAverageVolatility(_blockTimestamp(), currentTick, lastTimepointIndex, oldestTimepointIndex);
    return AdaptiveFee.getFee(volatilityAverage, feeConfig_);
  }

  // ###### Farming plugin ######

  /// @inheritdoc IFarmingPlugin
  function setIncentive(address newIncentive) external override {
    bool toConnect = newIncentive != address(0);
    bool accessAllowed;
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

    address currentIncentive = incentive;
    require(currentIncentive != newIncentive, 'Already active');
    if (toConnect) require(currentIncentive == address(0), 'Has active incentive');

    incentive = newIncentive;
    emit Incentive(newIncentive);

    if (toConnect) {
      _lastIncentiveOwner = msg.sender; // write creator of this incentive
    } else {
      _lastIncentiveOwner = address(0);
    }

    if (isPluginConnected) {
      _updatePluginConfigInPool();
    }
  }

  /// @inheritdoc IFarmingPlugin
  function isIncentiveConnected(address targetIncentive) external view override returns (bool) {
    if (incentive != targetIncentive) return false;
    if (_getPluginInPool() != address(this)) return false;
    (, , , uint8 pluginConfig) = _getPoolState();
    if (!pluginConfig.hasFlag(Plugins.AFTER_SWAP_FLAG)) return false;

    return true;
  }

  // ###### LIMIT ORDERS ######

  using EpochLibrary for Epoch;

  bytes internal constant ZERO_BYTES = bytes('');

  Epoch private constant EPOCH_DEFAULT = Epoch.wrap(0);

  int24 public tickLowerLasts;

  Epoch public epochNext = Epoch.wrap(1);

  struct EpochInfo {
    bool filled;
    address token0;
    address token1;
    uint256 token0Total;
    uint256 token1Total;
    uint128 liquidityTotal;
    mapping(address => uint128) liquidity;
  }

  mapping(bytes32 => Epoch) public epochs;
  mapping(Epoch => EpochInfo) public epochInfos;

  function getEpoch(int24 tickLower, bool zeroForOne) public view returns (Epoch) {
    return epochs[keccak256(abi.encode(tickLower, zeroForOne))];
  }

  function setEpoch(int24 tickLower, bool zeroForOne, Epoch epoch) private {
    epochs[keccak256(abi.encode(tickLower, zeroForOne))] = epoch;
  }

  function getEpochLiquidity(Epoch epoch, address owner) external view returns (uint256) {
    return epochInfos[epoch].liquidity[owner];
  }

  function getTickSpacing() private view returns (int24) {
    return IAlgebraPool(pool).tickSpacing();
  }

  function getTickLower(int24 tick, int24 tickSpacing) private pure returns (int24) {
    int24 compressed = tick / tickSpacing;
    if (tick < 0 && tick % tickSpacing != 0) compressed--; // round towards negative infinity
    return compressed * tickSpacing;
  }

  function _getCrossedTicks(int24 tick, int24 tickSpacing) internal view returns (int24 tickLower, int24 lower, int24 upper) {
    tickLower = tick;
    int24 _tickLowerLast = tickLowerLasts;

    if (tickLower < _tickLowerLast) {
      lower = tickLower + tickSpacing;
      upper = _tickLowerLast;
    } else {
      lower = _tickLowerLast;
      upper = tickLower - tickSpacing;
    }
  }

  function _fillEpoch(int24 lower, bool zeroForOne) internal {
    Epoch epoch = getEpoch(lower, zeroForOne);
    if (!epoch.equals(EPOCH_DEFAULT)) {
      EpochInfo storage epochInfo = epochInfos[epoch];

      epochInfo.filled = true;

      (uint256 amount0, uint256 amount1) = IAlgebraPool(pool).burn(lower, lower + getTickSpacing(), epochInfo.liquidityTotal, '');

      unchecked {
        epochInfo.token0Total += amount0;
        epochInfo.token1Total += amount1;
      }

      setEpoch(lower, zeroForOne, EPOCH_DEFAULT);

      emit Fill(epoch, lower, zeroForOne);
    }
  }

  function algebraMintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata data) external override onlyPool {
    address payer = abi.decode(data, (address));
    //TODO add native support
    if (amount0Owed > 0) TransferHelper.safeTransferFrom(IAlgebraPool(pool).token0(), payer, msg.sender, amount0Owed);
    if (amount1Owed > 0) TransferHelper.safeTransferFrom(IAlgebraPool(pool).token1(), payer, msg.sender, amount1Owed);
  }

  function place(int24 tickLower, bool zeroForOne, uint128 liquidity) external override {
    if (liquidity == 0) revert ZeroLiquidity();

    (uint256 amount0, uint256 amount1, uint128 liquidityActual) = IAlgebraPool(pool).mint(
      msg.sender,
      address(this),
      tickLower,
      tickLower + getTickSpacing(),
      liquidity,
      abi.encode(msg.sender)
    );

    // TODO Is an additional check on the amount of liquidity added necessary?
    if (amount0 > 0) {
      if (amount1 != 0) revert InRange();
      if (!zeroForOne) revert CrossedRange();
    } else {
      if (amount0 != 0) revert InRange();
      if (zeroForOne) revert CrossedRange();
    }

    EpochInfo storage epochInfo;
    Epoch epoch = getEpoch(tickLower, zeroForOne);
    if (epoch.equals(EPOCH_DEFAULT)) {
      unchecked {
        setEpoch(tickLower, zeroForOne, epoch = epochNext);
        // since epoch was just assigned the current value of epochNext,
        // this is equivalent to epochNext++, which is what's intended,
        // and it saves an SLOAD
        epochNext = epoch.unsafeIncrement();
      }
      epochInfo = epochInfos[epoch];
      epochInfo.token0 = IAlgebraPool(pool).token0();
      epochInfo.token1 = IAlgebraPool(pool).token1();
    } else {
      epochInfo = epochInfos[epoch];
    }

    unchecked {
      epochInfo.liquidityTotal += liquidityActual;
      epochInfo.liquidity[msg.sender] += liquidityActual;
    }

    emit Place(msg.sender, epoch, tickLower, zeroForOne, liquidityActual);
  }

  function kill(int24 tickLower, bool zeroForOne, address to) external override returns (uint256 amount0, uint256 amount1) {
    Epoch epoch = getEpoch(tickLower, zeroForOne);
    EpochInfo storage epochInfo = epochInfos[epoch];

    if (epochInfo.filled) revert Filled();

    uint128 liquidity = epochInfo.liquidity[msg.sender];
    if (liquidity == 0) revert ZeroLiquidity();
    delete epochInfo.liquidity[msg.sender];
    uint128 liquidityTotal = epochInfo.liquidityTotal;
    epochInfo.liquidityTotal = liquidityTotal - liquidity;

    int24 tickUpper = tickLower + getTickSpacing();
    // TODO fee distribution
    (amount0, amount1) = IAlgebraPool(pool).burn(tickLower, tickUpper, liquidity, '');

    IAlgebraPool(pool).collect(to, tickLower, tickUpper, uint128(amount0), uint128(amount1));

    emit Kill(msg.sender, epoch, tickLower, zeroForOne, liquidity);
  }

  function withdraw(int24 tickLower, bool zeroForOne, address to) external returns (uint256 amount0, uint256 amount1) {
    Epoch epoch = getEpoch(tickLower, zeroForOne);
    EpochInfo storage epochInfo = epochInfos[epoch];

    if (!epochInfo.filled) revert NotFilled();

    uint128 liquidity = epochInfo.liquidity[msg.sender];
    if (liquidity == 0) revert ZeroLiquidity();
    delete epochInfo.liquidity[msg.sender];

    uint256 token0Total = epochInfo.token0Total;
    uint256 token1Total = epochInfo.token1Total;
    uint128 liquidityTotal = epochInfo.liquidityTotal;

    amount0 = FullMath.mulDiv(token0Total, liquidity, liquidityTotal);
    amount1 = FullMath.mulDiv(token1Total, liquidity, liquidityTotal);

    epochInfo.token0Total = token0Total - amount0;
    epochInfo.token1Total = token1Total - amount1;
    epochInfo.liquidityTotal = liquidityTotal - liquidity;

    IAlgebraPool(pool).collect(to, tickLower, tickLower + getTickSpacing(), uint128(amount0), uint128(amount1));

    emit Withdraw(msg.sender, epoch, liquidity);
  }

  // ###### HOOKS ######

  function beforeInitialize(address, uint160) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool();
    return IAlgebraPlugin.beforeInitialize.selector;
  }

  function afterInitialize(address, uint160, int24 tick) external override onlyPool returns (bytes4) {
    uint32 _timestamp = _blockTimestamp();
    timepoints.initialize(_timestamp, tick);

    lastTimepointTimestamp = _timestamp;
    tickLowerLasts = getTickLower(tick, getTickSpacing());
    isInitialized = true;

    IAlgebraPool(pool).setFee(_feeConfig.baseFee());
    return IAlgebraPlugin.afterInitialize.selector;
  }

  /// @dev unused
  function beforeModifyPosition(address, address, int24, int24, int128, bytes calldata) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(); // should not be called, reset config
    return IAlgebraPlugin.beforeModifyPosition.selector;
  }

  /// @dev unused
  function afterModifyPosition(address, address, int24, int24, int128, uint256, uint256, bytes calldata) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(); // should not be called, reset config
    return IAlgebraPlugin.afterModifyPosition.selector;
  }

  function beforeSwap(address, address, bool, int256, uint160, bool, bytes calldata) external override onlyPool returns (bytes4) {
    _writeTimepointAndUpdateFee();
    return IAlgebraPlugin.beforeSwap.selector;
  }

  function afterSwap(address, address, bool zeroToOne, int256, uint160, int256, int256, bytes calldata) external override onlyPool returns (bytes4) {
    address _incentive = incentive;
    (, int24 tick, , ) = _getPoolState();

    if (_incentive != address(0)) {
      IAlgebraVirtualPool(_incentive).crossTo(tick, zeroToOne);
    }
    int24 tickSpacing = getTickSpacing();
    (int24 tickLower, int24 lower, int24 upper) = _getCrossedTicks(tick, tickSpacing);
    if (lower > upper) return IAlgebraPlugin.afterSwap.selector;

    // note that a zeroForOne swap means that the pool is actually gaining token0, so limit
    // order fills are the opposite of swap fills, hence the inversion below
    for (; lower <= upper; lower += tickSpacing) {
      _fillEpoch(lower, !zeroToOne);
    }

    tickLowerLasts = getTickLower(tickLower, tickSpacing);

    return IAlgebraPlugin.afterSwap.selector;
  }

  /// @dev unused
  function beforeFlash(address, address, uint256, uint256, bytes calldata) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(); // should not be called, reset config
    return IAlgebraPlugin.beforeFlash.selector;
  }

  /// @dev unused
  function afterFlash(address, address, uint256, uint256, uint256, uint256, bytes calldata) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(); // should not be called, reset config
    return IAlgebraPlugin.afterFlash.selector;
  }

  function _updatePluginConfigInPool() internal {
    uint8 newPluginConfig = defaultPluginConfig;
    if (incentive != address(0)) {
      newPluginConfig |= uint8(Plugins.AFTER_SWAP_FLAG);
    }

    (, , , uint8 currentPluginConfig) = _getPoolState();
    if (currentPluginConfig != newPluginConfig) {
      IAlgebraPool(pool).setPluginConfig(newPluginConfig);
    }
  }

  function _writeTimepointAndUpdateFee() internal {
    // single SLOAD
    uint16 _lastIndex = timepointIndex;
    uint32 _lastTimepointTimestamp = lastTimepointTimestamp;
    AlgebraFeeConfigurationU144 feeConfig_ = _feeConfig; // struct packed in uint144
    bool _isInitialized = isInitialized;
    require(_isInitialized, 'Not initialized');

    uint32 currentTimestamp = _blockTimestamp();

    if (_lastTimepointTimestamp == currentTimestamp) return;

    (, int24 tick, uint16 fee, ) = _getPoolState();
    (uint16 newLastIndex, uint16 newOldestIndex) = timepoints.write(_lastIndex, currentTimestamp, tick);

    timepointIndex = newLastIndex;
    lastTimepointTimestamp = currentTimestamp;

    uint16 newFee = _getFeeAtLastTimepoint(newLastIndex, newOldestIndex, tick, feeConfig_);
    if (newFee != fee) {
      IAlgebraPool(pool).setFee(newFee);
    }
  }
}
