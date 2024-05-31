// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import '../base/AlgebraModuleFactory.sol';
import './OracleModule.sol';

import 'hardhat/console.sol';

contract OracleModuleFactory is AlgebraModuleFactory {
    constructor(address _algebraFactory) AlgebraModuleFactory(_algebraFactory) {}

    function deploy(address modularHub) external onlyAdministrator override returns (address) {
        OracleModule oracleModule = new OracleModule(modularHub);
        console.log('oracleModule', address(oracleModule));

        poolToPlugin[IAlgebraModularHub(modularHub).pool()] = address(oracleModule);

        return address(oracleModule);
    }

    function getInsertModuleParams(uint256 moduleGlobalIndex) external override pure returns (InsertModuleParams[] memory) {
        InsertModuleParams[] memory insertModuleParams = new InsertModuleParams[](2);

        // oracle module must be first, so indexInHookList = 0
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
