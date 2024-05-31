// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import '../interfaces/IAlgebraFarmingModuleFactory.sol';
import '../base/AlgebraModuleFactory.sol';
import './FarmingModule.sol';

import 'hardhat/console.sol';

contract FarmingModuleFactory is AlgebraModuleFactory, IAlgebraFarmingModuleFactory {
    address public override farmingAddress;

    constructor(address _algebraFactory) AlgebraModuleFactory(_algebraFactory) {}

    function setFarmingAddress(address newFarmingAddress) external override onlyAdministrator {
        require(farmingAddress != newFarmingAddress);
        farmingAddress = newFarmingAddress;
        emit FarmingAddress(newFarmingAddress);
    }

    function deploy(address modularHub) external onlyAdministrator override returns (address) {
        FarmingModule farmingModule = new FarmingModule(modularHub, address(this));
        console.log('farmingModule', address(farmingModule));

        poolToPlugin[IAlgebraModularHub(modularHub).pool()] = address(farmingModule);

        return address(farmingModule);
    }

    function getInsertModuleParams(uint256 moduleGlobalIndex) external override pure returns (InsertModuleParams[] memory) {
        InsertModuleParams[] memory insertModuleParams = new InsertModuleParams[](1);

        insertModuleParams[0] = InsertModuleParams({
            selector: IAlgebraPlugin.afterSwap.selector,
            indexInHookList: 0,
            moduleGlobalIndex: moduleGlobalIndex,
            useDelegate: false,
            useDynamicFee: false
        });

        return insertModuleParams;
    }
}
