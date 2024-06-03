// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import '../base/AlgebraModuleFactory.sol';
import './MockTimeOracleModule.sol';

contract MockTimeOracleModuleFactory is AlgebraModuleFactory {
    constructor(address _algebraFactory) AlgebraModuleFactory(_algebraFactory) {}

    function deploy(address modularHub) external override returns (address) {
        MockTimeOracleModule oracleModule = new MockTimeOracleModule(modularHub);

        return address(oracleModule);
    }

    function getInsertModuleParams(uint256 moduleGlobalIndex) external override pure returns (InsertModuleParams[] memory) {
        InsertModuleParams[] memory insertModuleParams = new InsertModuleParams[](2);

        insertModuleParams[0] = InsertModuleParams({
            selector: IAlgebraPlugin.afterInitialize.selector,
            indexInHookList: 0,
            moduleGlobalIndex: moduleGlobalIndex,
            useDelegate: false,
            useDynamicFee: false
        });

        insertModuleParams[1] = InsertModuleParams({
            selector: IAlgebraPlugin.beforeSwap.selector,
            indexInHookList: 0,
            moduleGlobalIndex: moduleGlobalIndex,
            useDelegate: false,
            useDynamicFee: false
        });

        return insertModuleParams;
    }
}
