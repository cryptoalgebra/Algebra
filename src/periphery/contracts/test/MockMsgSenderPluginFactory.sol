// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './MockMsgSenderPlugin.sol';

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPluginFactory.sol';

/// @dev Deploys a MockMsgSenderPlugin for every pool, mirroring MockPluginFactory
contract MockMsgSenderPluginFactory is IAlgebraPluginFactory {
    address public immutable algebraFactory;

    mapping(address poolAddress => address pluginAddress) public pluginByPool;

    constructor(address _algebraFactory) {
        algebraFactory = _algebraFactory;
    }

    /// @inheritdoc IAlgebraPluginFactory
    function beforeCreatePoolHook(
        address pool,
        address,
        address,
        address,
        address,
        bytes calldata
    ) external override returns (address) {
        require(msg.sender == algebraFactory);
        require(pluginByPool[pool] == address(0), 'Already created');
        MockMsgSenderPlugin plugin = new MockMsgSenderPlugin();
        pluginByPool[pool] = address(plugin);
        return address(plugin);
    }

    /// @inheritdoc IAlgebraPluginFactory
    function afterCreatePoolHook(address, address, address) external view override {
        require(msg.sender == algebraFactory);
    }
}
