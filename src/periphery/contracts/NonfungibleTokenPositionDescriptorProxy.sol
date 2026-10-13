// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.37;

import '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';

/// @title Proxy for NonfungibleTokenPositionDescriptor
/// @notice A transparent upgradeable proxy that can be deployed without initialization data
/// @dev The descriptor has no initializer: its configuration is set in the implementation constructor, so there is
/// nothing to initialize in the proxy storage. The proxy deploys its own ProxyAdmin owned by `initialOwner`
contract NonfungibleTokenPositionDescriptorProxy is TransparentUpgradeableProxy {
    constructor(address logic, address initialOwner) TransparentUpgradeableProxy(logic, initialOwner, '') {}

    /// @dev Nothing to initialize, see the contract description
    function _unsafeAllowUninitialized() internal pure override returns (bool) {
        return true;
    }
}
