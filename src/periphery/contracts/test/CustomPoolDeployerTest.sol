// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.26;

import {IAlgebraCustomPoolEntryPoint} from '../interfaces/IAlgebraCustomPoolEntryPoint.sol';

contract CustomPoolDeployerTest {
    address public immutable entryPoint;
    address public immutable plugin;

    mapping(address => address) public poolToPlugin;

    constructor(address _entryPoint, address _plugin) {
        entryPoint = _entryPoint;
        plugin = _plugin;
    }

    function createCustomPool(
        address deployer,
        address creator,
        address tokenA,
        address tokenB,
        bytes calldata data
    ) external returns (address customPool) {
        return IAlgebraCustomPoolEntryPoint(entryPoint).createCustomPool(deployer, creator, tokenA, tokenB, data);
    }

    event BeforeCreatePoolHook(
        address pool,
        address creator,
        address deployer,
        address token0,
        address token1,
        bytes data
    );
    event AfterCreatePoolHook(address plugin, address pool, address deployer);

    function beforeCreatePoolHook(
        address pool,
        address creator,
        address deployer,
        address token0,
        address token1,
        bytes calldata data
    ) external returns (address) {
        require(msg.sender == entryPoint, 'Only entryPoint');
        emit BeforeCreatePoolHook(pool, creator, deployer, token0, token1, data);
        return plugin;
    }

    function afterCreatePoolHook(address _plugin, address pool, address deployer) external {
        emit AfterCreatePoolHook(_plugin, pool, deployer);
    }

    function setPluginForPool(address pool, address _plugin) external {
        poolToPlugin[pool] = _plugin;
    }

    function setTickSpacing(address pool, int24 newTickSpacing) external {
        IAlgebraCustomPoolEntryPoint(entryPoint).setTickSpacing(pool, newTickSpacing);
    }

    function setPlugin(address pool, address newPluginAddress) external {
        IAlgebraCustomPoolEntryPoint(entryPoint).setPlugin(pool, newPluginAddress);
    }

    function setPluginConfig(address pool, uint16 newConfig) external {
        IAlgebraCustomPoolEntryPoint(entryPoint).setPluginConfig(pool, newConfig);
    }

    function setFee(address pool, uint16 newFee) external {
        IAlgebraCustomPoolEntryPoint(entryPoint).setFee(pool, newFee);
    }
}
