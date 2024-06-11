// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import '../libraries/AdaptiveFee.sol';
import '../base/AlgebraModuleFactory.sol';
import './DynamicFeeModule.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';


contract DynamicFeeModuleFactory is AlgebraModuleFactory {
    event DefaultFeeConfiguration(AlgebraFeeConfiguration newConfig);

    AlgebraFeeConfiguration public defaultFeeConfiguration; // values of constants for sigmoids in fee calculation formula

    constructor(address _algebraFactory) AlgebraModuleFactory(_algebraFactory) {
        defaultFeeConfiguration = AdaptiveFee.initialFeeConfiguration();
    }

    /// @notice Changes initial fee configuration for new pools
    /// @dev changes coefficients for sigmoids: α / (1 + e^( (β-x) / γ))
    /// alpha1 + alpha2 + baseFee (max possible fee) must be <= type(uint16).max and gammas must be > 0
    /// @param newConfig new default fee configuration. See the #AdaptiveFee.sol library for details
    function setDefaultFeeConfiguration(AlgebraFeeConfiguration calldata newConfig) external onlyAdministrator {
        AdaptiveFee.validateFeeConfiguration(newConfig);
        defaultFeeConfiguration = newConfig;
        emit DefaultFeeConfiguration(newConfig);
    }

    function deploy(address modularHub) external onlyAdministrator override returns (address) {
        // ❗❗❗ убрать захаркоженный индекс модуля и сделать по красоте ❗❗❗
        DynamicFeeModule dynamicFeeModule = new DynamicFeeModule(algebraFactory, address(this), IAlgebraModularHub(modularHub).modules(1), modularHub);
        dynamicFeeModule.changeFeeConfiguration(defaultFeeConfiguration);

        poolToPlugin[IAlgebraModularHub(modularHub).pool()] = address(dynamicFeeModule);

        return address(dynamicFeeModule);
    }

    function getInsertModuleParams(uint256 moduleGlobalIndex) external override pure returns (InsertModuleParams[] memory) {
        InsertModuleParams[] memory insertModuleParams = new InsertModuleParams[](2);

        // dynamic fee hooks shoule be called after oracle, so indexInHookList = 1
        insertModuleParams[0] = InsertModuleParams({
            selector: IAlgebraPlugin.afterInitialize.selector,
            indexInHookList: 0,
            moduleGlobalIndex: moduleGlobalIndex,
            useDelegate: false,
            useDynamicFee: true
        });

        insertModuleParams[1] = InsertModuleParams({
            selector: IAlgebraPlugin.beforeSwap.selector,
            indexInHookList: 0,
            moduleGlobalIndex: moduleGlobalIndex,
            useDelegate: false,
            useDynamicFee: true
        });

        return insertModuleParams;
    }
}
