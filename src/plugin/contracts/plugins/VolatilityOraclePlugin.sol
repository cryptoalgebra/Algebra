// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';

import '../interfaces/IBasePlugin.sol';
import '../interfaces/IBasePluginV1Factory.sol';
import '../interfaces/plugins/IVolatilityOracle.sol';

import '../libraries/VolatilityOracle.sol';
import '../base/BasePlugin.sol';

/// @title Algebra Integral 1.1 default plugin
/// @notice This contract stores timepoints and calculates adaptive fee and statistical averages
abstract contract VolatilityOraclePlugin is BasePlugin, IVolatilityOracle {
  using Plugins for uint8;

  uint256 internal constant UINT16_MODULO = 65536;
  using VolatilityOracle for VolatilityOracle.Timepoint[UINT16_MODULO];

  uint8 private constant defaultPluginConfig = uint8(Plugins.AFTER_INIT_FLAG | Plugins.BEFORE_SWAP_FLAG);

  bytes32 internal constant VOLATILITY_ORACLE_NAMESPACE = keccak256('namespace.volatility.oracle');

  struct VolatiltyOracleLayout {
    VolatilityOracle.Timepoint[UINT16_MODULO] timepoints;
    uint16 timepointIndex;
    uint32 lastTimepointTimestamp;
    bool isInitialized;
  }

  function timepoints(
    uint256 index
  )
    external
    view
    override
    returns (
      bool initialized,
      uint32 blockTimestamp,
      int56 tickCumulative,
      uint88 volatilityCumulative,
      int24 tick,
      int24 averageTick,
      uint16 windowStartIndex
    )
  {
    VolatiltyOracleLayout storage vol = getVolatiltyOraclePointer();

    VolatilityOracle.Timepoint memory timepoint = vol.timepoints[index];

    initialized = timepoint.initialized;
    blockTimestamp = timepoint.blockTimestamp;
    tickCumulative = timepoint.tickCumulative;
    volatilityCumulative = timepoint.volatilityCumulative;
    tick = timepoint.tick;
    averageTick = timepoint.averageTick;
    windowStartIndex = timepoint.windowStartIndex;
  }

  function timepointIndex() external view override returns (uint16) {
    VolatiltyOracleLayout storage vol = getVolatiltyOraclePointer();
    return vol.timepointIndex;
  }

  function lastTimepointTimestamp() external view override returns (uint32) {
    VolatiltyOracleLayout storage vol = getVolatiltyOraclePointer();
    return vol.lastTimepointTimestamp;
  }

  function isInitialized() external view override returns (bool) {
    VolatiltyOracleLayout storage vol = getVolatiltyOraclePointer();
    return vol.isInitialized;
  }

  /// @dev Fetch pointer of Volatility Oracle's storage
  function getVolatiltyOraclePointer() internal pure returns (VolatiltyOracleLayout storage vol) {
    bytes32 position = VOLATILITY_ORACLE_NAMESPACE;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      vol.slot := position
    }
  }

  /// @inheritdoc IVolatilityOracle
  function initialize() external override {
    require(_getPluginInPool() == address(this), 'Plugin not attached');
    (uint160 price, int24 tick, , ) = _getPoolState();
    require(price != 0, 'Pool is not initialized');
    _initialize_TWAP(tick);
  }

  function _initialize_TWAP(int24 tick) internal {
    VolatiltyOracleLayout storage vol = getVolatiltyOraclePointer();

    require(!vol.isInitialized, 'Already initialized');

    uint32 time = _blockTimestamp();
    vol.timepoints.initialize(time, tick);
    vol.lastTimepointTimestamp = time;
    vol.isInitialized = true;

    _enablePluginFlags(defaultPluginConfig);
  }
  // ###### Volatility and TWAP oracle ######

  /// @inheritdoc IVolatilityOracle
  function getSingleTimepoint(uint32 secondsAgo) external view override returns (int56 tickCumulative, uint88 volatilityCumulative) {
    VolatiltyOracleLayout storage vol = getVolatiltyOraclePointer();
    // `volatilityCumulative` values for timestamps after the last timepoint _should not_ be compared: they may differ due to interpolation errors
    (, int24 tick, , ) = _getPoolState();
    uint16 lastTimepointIndex = vol.timepointIndex;
    uint16 oldestIndex = vol.timepoints.getOldestIndex(lastTimepointIndex);
    VolatilityOracle.Timepoint memory result = vol.timepoints.getSingleTimepoint(
      _blockTimestamp(),
      secondsAgo,
      tick,
      lastTimepointIndex,
      oldestIndex
    );
    (tickCumulative, volatilityCumulative) = (result.tickCumulative, result.volatilityCumulative);
  }

  /// @inheritdoc IVolatilityOracle
  function getTimepoints(
    uint32[] memory secondsAgos
  ) external view override returns (int56[] memory tickCumulatives, uint88[] memory volatilityCumulatives) {
    VolatiltyOracleLayout storage vol = getVolatiltyOraclePointer();
    // `volatilityCumulative` values for timestamps after the last timepoint _should not_ be compared: they may differ due to interpolation errors
    (, int24 tick, , ) = _getPoolState();
    return vol.timepoints.getTimepoints(_blockTimestamp(), secondsAgos, tick, vol.timepointIndex);
  }

  /// @inheritdoc IVolatilityOracle
  function prepayTimepointsStorageSlots(uint16 startIndex, uint16 amount) external override {
    VolatiltyOracleLayout storage vol = getVolatiltyOraclePointer();
    require(!vol.timepoints[startIndex].initialized); // if not initialized, then all subsequent ones too
    require(amount > 0 && type(uint16).max - startIndex >= amount);

    unchecked {
      for (uint256 i = startIndex; i < startIndex + amount; ++i) {
        vol.timepoints[i].blockTimestamp = 1; // will be overwritten
      }
    }
  }

  function _writeTimepoint() internal {
    VolatiltyOracleLayout storage vol = getVolatiltyOraclePointer();
    // single SLOAD
    uint16 _lastIndex = vol.timepointIndex;
    uint32 _lastTimepointTimestamp = vol.lastTimepointTimestamp;

    bool _isInitialized = vol.isInitialized;
    require(_isInitialized, 'Not initialized');

    uint32 currentTimestamp = _blockTimestamp();
    if (_lastTimepointTimestamp == currentTimestamp) return;

    (, int24 tick, , ) = _getPoolState();
    (uint16 newLastIndex, ) = vol.timepoints.write(_lastIndex, currentTimestamp, tick);

    vol.timepointIndex = newLastIndex;
    vol.lastTimepointTimestamp = currentTimestamp;
  }

  function _getAverageVolatilityLast() internal view returns (uint88 volatilityAverage) {
    uint32 currentTimestamp = _blockTimestamp();
    (, int24 tick, , ) = _getPoolState();

    VolatiltyOracleLayout storage vol = getVolatiltyOraclePointer();

    uint16 lastTimepointIndex = vol.timepointIndex;
    uint16 oldestIndex = vol.timepoints.getOldestIndex(lastTimepointIndex);

    volatilityAverage = vol.timepoints.getAverageVolatility(currentTimestamp, tick, lastTimepointIndex, oldestIndex);
  }

  function _getLastTick() internal view returns (int24 lastTick) {
    VolatiltyOracleLayout memory vol = getVolatiltyOraclePointer();

    VolatilityOracle.Timepoint memory lastTimepoint = vol.timepoints[vol.timepointIndex];
    return lastTimepoint.tick;
  }
}
