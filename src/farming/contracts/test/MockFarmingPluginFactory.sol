// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPluginFactory.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import './MockFarmingPlugin.sol';

/// @notice Minimal mock of a plugin factory for farming tests
contract MockFarmingPluginFactory is IAlgebraPluginFactory {
    address public algebraFactory;
    address public farmingAddress;

    mapping(address => address) public pluginByPool;

    modifier onlyAdministrator() {
        require(
            IAlgebraFactory(algebraFactory).hasRoleOrOwner(keccak256('ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR'), msg.sender),
            'Only administrator'
        );
        _;
    }

    constructor(address _algebraFactory) {
        algebraFactory = _algebraFactory;
    }

    function beforeCreatePoolHook(
        address pool,
        address,
        address,
        address,
        address,
        bytes calldata
    ) external override returns (address) {
        require(msg.sender == algebraFactory, 'Only factory');
        return _createPlugin(pool);
    }

    function afterCreatePoolHook(address, address, address) external view override {
        require(msg.sender == algebraFactory, 'Only factory');
    }

    function createPluginForExistingPool(address token0, address token1) external returns (address) {
        IAlgebraFactory factory = IAlgebraFactory(algebraFactory);
        require(factory.hasRoleOrOwner(factory.POOLS_ADMINISTRATOR_ROLE(), msg.sender), 'Not admin');
        address pool = factory.poolByPair(token0, token1);
        require(pool != address(0), 'Pool not exist');
        return _createPlugin(pool);
    }

    function setFarmingAddress(address newFarmingAddress) external onlyAdministrator {
        require(farmingAddress != newFarmingAddress, 'Already set');
        farmingAddress = newFarmingAddress;
    }

    function _createPlugin(address pool) internal returns (address) {
        require(pluginByPool[pool] == address(0), 'Already created');
        MockFarmingPlugin plugin = new MockFarmingPlugin(pool, address(this));
        pluginByPool[pool] = address(plugin);
        return address(plugin);
    }
}
