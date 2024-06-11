// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/pool/IAlgebraPoolState.sol';

import '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/base/AlgebraModule.sol';

abstract contract AlgebraBaseModule is AlgebraModule {
    function _getPoolState() internal view returns (uint160 price, int24 tick, uint16 fee, uint8 pluginConfig) {
        (price, tick, fee, pluginConfig, , ) = IAlgebraPoolState(pool).globalState();
    }
}
