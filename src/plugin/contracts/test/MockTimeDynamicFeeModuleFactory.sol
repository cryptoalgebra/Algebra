// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import '../libraries/AdaptiveFee.sol';
import '../base/AlgebraModuleFactory.sol';
import './MockTimeDynamicFeeModule.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';


contract MockTimeDynamicFeeModuleFactory is AlgebraModuleFactory {
    event DefaultFeeConfiguration(AlgebraFeeConfiguration newConfig);

    AlgebraFeeConfiguration public defaultFeeConfiguration; // values of constants for sigmoids in fee calculation formula

    constructor(address _algebraFactory) AlgebraModuleFactory(_algebraFactory) {
        defaultFeeConfiguration = AdaptiveFee.initialFeeConfiguration();
    }

    function setDefaultFeeConfiguration(AlgebraFeeConfiguration calldata newConfig) external onlyAdministrator {
        AdaptiveFee.validateFeeConfiguration(newConfig);
        defaultFeeConfiguration = newConfig;
        emit DefaultFeeConfiguration(newConfig);
    }

    function deploy(address modularHub) external override returns (address) {
        DynamicFeeModule dynamicFeeModule = new MockTimeDynamicFeeModule(algebraFactory, address(this), IAlgebraModularHub(modularHub).modules(1), modularHub); // oracle module is stored at index 1 in modular hub
        dynamicFeeModule.changeFeeConfiguration(defaultFeeConfiguration);

        return address(dynamicFeeModule);
    }

    function getInsertModuleParams(uint256 moduleGlobalIndex) external override pure returns (InsertModuleParams[] memory) {
        InsertModuleParams[] memory insertModuleParams = new InsertModuleParams[](2);

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
