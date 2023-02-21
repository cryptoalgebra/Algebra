// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;

import '../interfaces/IPeripheryImmutableState.sol';

/// @title Immutable state
/// @notice Immutable state used by periphery contracts
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-periphery
abstract contract PeripheryImmutableState is IPeripheryImmutableState {
    /// @inheritdoc IPeripheryImmutableState
    address public immutable override factory;
    /// @inheritdoc IPeripheryImmutableState
    address public immutable override poolDeployer;
    /// @inheritdoc IPeripheryImmutableState
    address public immutable override WNativeToken;

    constructor(
        address _factory,
        address _WNativeToken,
        address _poolDeployer
    ) {
        factory = _factory;
        poolDeployer = _poolDeployer;
        WNativeToken = _WNativeToken;
    }
}
