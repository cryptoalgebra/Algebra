// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';

import '@cryptoalgebra/integral-core/contracts/interfaces/pool/IAlgebraPoolState.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/interfaces/IAlgebraModule.sol';
import '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/base/AlgebraModule.sol';
import '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/interfaces/IAlgebraModularHub.sol';
import '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/types/HookParams.sol';

import '../libraries/VolatilityOracle.sol';
import '../interfaces/plugins/IVolatilityOracle.sol';
import '../interfaces/plugins/IDynamicFeeManager.sol';


contract OracleModule is AlgebraModule, IVolatilityOracle, Timestamp {
    using Plugins for uint8;

    uint256 internal constant UINT16_MODULO = 65536;
    using VolatilityOracle for VolatilityOracle.Timepoint[UINT16_MODULO];

    /// @inheritdoc AlgebraModule
    string public constant override MODULE_NAME = 'TWAP Oracle';

    /// @inheritdoc AlgebraModule
    uint8 public constant override DEFAULT_PLUGIN_CONFIG = uint8(Plugins.AFTER_INIT_FLAG | Plugins.BEFORE_SWAP_FLAG);

    /// @inheritdoc IVolatilityOracle
    bool public override isInitialized;
    
    /// @inheritdoc IVolatilityOracle
    uint32 public override lastTimepointTimestamp;

    /// @inheritdoc IVolatilityOracle
    uint16 public override timepointIndex;

    /// @inheritdoc IVolatilityOracle
    VolatilityOracle.Timepoint[UINT16_MODULO] public override timepoints;

    constructor(address _modularHub) AlgebraModule(_modularHub) {}

    function initialize() external {
        require(!isInitialized, 'Already initialized');
        require(IAlgebraModularHub(modularHub).moduleAddressToIndex(address(this)) != 0, 'Plugin not attached');
        (uint160 price, int24 tick, , ) = _getPoolState(pool);
        require(price != 0, 'Pool is not initialized');

        uint32 time = _blockTimestamp();
        timepoints.initialize(time, tick);

        isInitialized = true;
    }

    /// @inheritdoc IVolatilityOracle
    function getSingleTimepoint(uint32 secondsAgo) external view override returns (int56 tickCumulative, uint88 volatilityCumulative) {
        // `volatilityCumulative` values for timestamps after the last timepoint _should not_ be compared: they may differ due to interpolation errors
        (, int24 tick, , ) = _getPoolState(IAlgebraModularHub(modularHub).pool());
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
        (, int24 tick, , ) = _getPoolState(IAlgebraModularHub(modularHub).pool());
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

    function getCurrentAverageVolatility() external view override returns (uint88) {
        uint16 lastIndex = timepointIndex;

        uint16 oldestIndex = timepoints.getOldestIndex(lastIndex);
        (, int24 tick, , ) = _getPoolState(IAlgebraModularHub(modularHub).pool());

        return timepoints.getAverageVolatility(_blockTimestamp(), tick, lastIndex, oldestIndex);
    }

    function getAverageVolatilityAtLastTimepoint(
        uint32 currentTime,
        int24 tick,
        uint16 lastIndex,
        uint16 oldestIndex
    ) external view override returns (uint88) {
        return timepoints.getAverageVolatility(currentTime, tick, lastIndex, oldestIndex);
    }

    function _getPoolState(address pool) internal view returns (uint160 price, int24 tick, uint16 fee, uint8 pluginConfig) {
        (price, tick, fee, pluginConfig, , ) = IAlgebraPoolState(pool).globalState();
    }

    function _getPluginInPool(address pool) internal view returns (address plugin) {
        return IAlgebraPool(pool).plugin();
    }

    function _afterInitialize(
        bytes memory params,
        uint16 /* poolFeeCache */
    ) internal override {
        AfterInitializeParams memory decodedParams = abi.decode(params, (AfterInitializeParams));
        uint32 _timestamp = _blockTimestamp();
        timepoints.initialize(_timestamp, decodedParams.tick);

        lastTimepointTimestamp = _timestamp;
        isInitialized = true;
    }

    function _beforeSwap(
        bytes memory params,
        uint16 /* poolFeeCache */
    ) internal override {
        BeforeSwapParams memory decodedParams = abi.decode(params, (BeforeSwapParams));
        _writeTimepoint(decodedParams.pool);
    }

    function _writeTimepoint(address pool) internal {
        // single SLOAD
        uint16 _lastIndex = timepointIndex;
        uint32 _lastTimepointTimestamp = lastTimepointTimestamp;
        bool _isInitialized = isInitialized;
        require(_isInitialized, 'Not initialized');

        uint32 currentTimestamp = _blockTimestamp();

        if (_lastTimepointTimestamp == currentTimestamp) return;

        (, int24 tick, , ) = _getPoolState(pool);
        (uint16 newLastIndex, ) = timepoints.write(_lastIndex, currentTimestamp, tick);
        
        timepointIndex = newLastIndex;
        lastTimepointTimestamp = currentTimestamp;
    }
}
