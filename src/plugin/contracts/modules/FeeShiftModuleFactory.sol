// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import {AlgebraModuleFactory} from '../base/AlgebraModuleFactory.sol';
import {FeeShiftModule} from './FeeShiftModule.sol';

import {IAlgebraModularHub} from '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/interfaces/IAlgebraModularHub.sol';
import {InsertModuleParams} from '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/types/InsertModuleParams.sol';
import {IAlgebraPlugin} from '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';


contract FeeShiftModuleFactory is AlgebraModuleFactory {
    constructor(address _algebraFactory) AlgebraModuleFactory(_algebraFactory) {}

    function deploy(address modularHub) external onlyAdministrator override returns (address) {
        FeeShiftModule feeShiftModule = new FeeShiftModule(modularHub);

        poolToPlugin[IAlgebraModularHub(modularHub).pool()] = address(feeShiftModule);

        return address(feeShiftModule);
    }

    function getInsertModuleParams(uint256 moduleGlobalIndex) external override pure returns (InsertModuleParams[] memory) {
        InsertModuleParams[] memory insertModuleParams = new InsertModuleParams[](1);

        insertModuleParams[0] = InsertModuleParams({
            selector: IAlgebraPlugin.beforeSwap.selector,
            indexInHookList: 0,
            moduleGlobalIndex: moduleGlobalIndex,
            useDelegate: false,
            useDynamicFee: true
        });

        return insertModuleParams;
    }
}
