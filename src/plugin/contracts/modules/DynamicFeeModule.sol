// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/pool/IAlgebraPoolState.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';

import '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/base/AlgebraModule.sol';
import '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/interfaces/IAlgebraModularHub.sol';
import '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/types/HookParams.sol';
import '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/libraries/ModuleUtils.sol';

import '../types/AlgebraFeeConfigurationU144.sol';
import '../interfaces/plugins/IDynamicFeeManager.sol';
import '../interfaces/plugins/IVolatilityOracle.sol';
import '../libraries/AdaptiveFee.sol';
import '../libraries/VolatilityOracle.sol';

contract DynamicFeeModule is AlgebraModule, IDynamicFeeManager, Timestamp {
    using Plugins for uint8;
    using AlgebraFeeConfigurationU144Lib for AlgebraFeeConfiguration;

    uint256 internal constant UINT16_MODULO = 65536;
    using VolatilityOracle for VolatilityOracle.Timepoint[UINT16_MODULO];

    /// @inheritdoc AlgebraModule
    string public override constant MODULE_NAME = 'Dynamic Fee';

    /// @inheritdoc AlgebraModule
    uint8 public override constant DEFAULT_PLUGIN_CONFIG = uint8(Plugins.AFTER_INIT_FLAG | Plugins.BEFORE_SWAP_FLAG | Plugins.DYNAMIC_FEE);

    /// @dev The role can be granted in AlgebraFactory
    bytes32 public constant ALGEBRA_BASE_PLUGIN_MANAGER = keccak256('ALGEBRA_BASE_PLUGIN_MANAGER');

    /// @inheritdoc	IDynamicFeeManager
    address public immutable override oracleModule;

    /// @inheritdoc	IDynamicFeeManager
    address public immutable override factory;

    /// @inheritdoc	IDynamicFeeManager
    address public immutable override pluginFactory;

    /// @dev AlgebraFeeConfiguration struct packed in uint144
    AlgebraFeeConfigurationU144 private _feeConfig;

    constructor(address _factory, address _pluginFactory, address _oracleModule, address _modularHub) AlgebraModule(_modularHub) {
        (factory, pluginFactory, oracleModule) = (_factory, _pluginFactory, _oracleModule);
    }

    function changeFeeConfiguration(AlgebraFeeConfiguration calldata _config) external override {
        require(msg.sender == pluginFactory || IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));
        AdaptiveFee.validateFeeConfiguration(_config);

        _feeConfig = _config.pack(); // pack struct to uint144 and write in storage
        emit IDynamicFeeManager.FeeConfiguration(_config);
    }

    /// @inheritdoc IAlgebraDynamicFeePlugin
    function getCurrentFee() external view override returns (uint16 fee) {
        uint88 volatilityAverage = IVolatilityOracle(oracleModule).getCurrentAverageVolatility();
        return AdaptiveFee.getFee(volatilityAverage, _feeConfig);
    }

    function _getFeeAtLastTimepoint(
        uint16 lastTimepointIndex,
        uint16 oldestTimepointIndex,
        int24 currentTick,
        AlgebraFeeConfigurationU144 feeConfig_
    ) internal view returns (uint16 fee) {
        if (feeConfig_.alpha1() | feeConfig_.alpha2() == 0) return feeConfig_.baseFee();

        uint88 volatilityAverage = IVolatilityOracle(oracleModule).getAverageVolatilityAtLastTimepoint(_blockTimestamp(), currentTick, lastTimepointIndex, oldestTimepointIndex);
        return AdaptiveFee.getFee(volatilityAverage, feeConfig_);
    }

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

    function _getPoolState() internal view returns (uint160 price, int24 tick, uint16 fee, uint8 pluginConfig) {
        (price, tick, fee, pluginConfig, , ) = IAlgebraPoolState(pool).globalState();
    }

    function _afterInitialize(
        bytes memory /* params */,
        uint16 /* poolFeeCache */
    ) internal view override {
        ModuleUtils.returnDynamicFeeResult(_feeConfig.baseFee(), false);
    }

    function _beforeSwap(
        bytes memory /* params */,
        uint16 /* poolFeeCache */
    ) internal view override {
        uint16 newFee = _getNewFee();
        ModuleUtils.returnDynamicFeeResult(newFee, false);
    }

    function _getNewFee() internal view returns (uint16 newFee) {
        uint16 lastTimepointIndex = IVolatilityOracle(oracleModule).timepointIndex();

        uint16 oldestTimepointIndex; /* ❗❗❗ вот тут еще подумать, точно ли правильно логика написана ❗❗❗ */
        unchecked {
            // overflow is desired
            oldestTimepointIndex = lastTimepointIndex + 1;
        }

        (bool initialized, , , , , , ) = IVolatilityOracle(oracleModule).timepoints(oldestTimepointIndex);

        oldestTimepointIndex = initialized ? oldestTimepointIndex : 0;

        (, int24 tick, , ) = _getPoolState();

        newFee = _getFeeAtLastTimepoint(lastTimepointIndex, oldestTimepointIndex, tick, _feeConfig);
    }
}
