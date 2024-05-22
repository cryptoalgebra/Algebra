// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import {IAlgebraCustomPoolEntryPoint} from '../interfaces/IAlgebraCustomPoolEntryPoint.sol';

contract CustomPoolDeployerTest {
    address public immutable entryPoint;

    mapping(address => address) public poolToPlugin;

    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
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

    function beforeCreatePoolHook(
        address pool,
        address,
        address,
        address,
        address,
        bytes calldata
    ) external view returns (address) {
        require(msg.sender == entryPoint, 'Only entryPoint');

        return poolToPlugin[pool];
    }

    function setPluginForPool(address pool, address plugin) external {
        poolToPlugin[pool] = plugin;
    }

    function setTickSpacing(address pool, int24 newTickSpacing) external {
        IAlgebraCustomPoolEntryPoint(entryPoint).setTickSpacing(pool, newTickSpacing);
    }

    function setPlugin(address pool, address newPluginAddress) external {
        IAlgebraCustomPoolEntryPoint(entryPoint).setPlugin(pool, newPluginAddress);
    }

    function setPluginConfig(address pool, uint8 newConfig) external {
        IAlgebraCustomPoolEntryPoint(entryPoint).setPluginConfig(pool, newConfig);
    }

    function setFee(address pool, uint16 newFee) external {
        IAlgebraCustomPoolEntryPoint(entryPoint).setFee(pool, newFee);
    }
}
