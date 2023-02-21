// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;

import '../libraries/CallbackValidation.sol';

contract TestCallbackValidation {
    function verifyCallback(
        address factory,
        address tokenA,
        address tokenB
    ) external view returns (IAlgebraPool pool) {
        return CallbackValidation.verifyCallback(factory, tokenA, tokenB);
    }
}
