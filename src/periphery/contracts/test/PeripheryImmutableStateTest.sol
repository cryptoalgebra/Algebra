// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;

import '../base/PeripheryImmutableState.sol';

contract PeripheryImmutableStateTest is PeripheryImmutableState {
    constructor(
        address _factory,
        address _WNativeToken,
        address _poolDeployer
    ) PeripheryImmutableState(_factory, _WNativeToken, _poolDeployer) {}
}
