// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './MockPlugin.sol';

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPluginFactory.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';

contract MockPluginFactory is IAlgebraPluginFactory {
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
        return _createPlugin(pool);
    }

    /// @inheritdoc IAlgebraPluginFactory
    function afterCreatePoolHook(address, address, address) external view override {
        require(msg.sender == algebraFactory);
    }

    //   function createPluginForExistingPool(address token0, address token1) external override returns (address) {
    //     IAlgebraFactory factory = IAlgebraFactory(algebraFactory);
    //     require(factory.hasRoleOrOwner(factory.POOLS_ADMINISTRATOR_ROLE(), msg.sender));

    //     address pool = factory.poolByPair(token0, token1);
    //     require(pool != address(0), 'Pool not exist');

    //     return _createPlugin(pool);
    //   }

    function _createPlugin(address pool) internal returns (address) {
        require(pluginByPool[pool] == address(0), 'Already created');
        MockPlugin mockPlugin = new MockPlugin();
        pluginByPool[pool] = address(mockPlugin);
        return address(mockPlugin);
    }
}
