// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/types/InsertModuleParams.sol';

interface IAlgebraModuleFactory {
    function algebraFactory() external returns (address);

    function deploy(address modularHub) external returns (address);

    function getInsertModuleParams(uint256 moduleGlobalIndex) external pure returns (InsertModuleParams[] memory);
}
