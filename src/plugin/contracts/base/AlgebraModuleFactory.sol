// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import '../libraries/AdaptiveFee.sol';
import '../interfaces/IAlgebraModuleFactory.sol';

abstract contract AlgebraModuleFactory is IAlgebraModuleFactory {
    bytes32 public constant ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR = keccak256('ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR');

    address public immutable algebraFactory;

    mapping(address pool => address pluginAddress) public override poolToPlugin;

    modifier onlyAdministrator() {
        require(IAlgebraFactory(algebraFactory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR, msg.sender), 'Only administrator');
        _;
    }

    constructor(address _algebraFactory) {
        algebraFactory = _algebraFactory;
    }
}
