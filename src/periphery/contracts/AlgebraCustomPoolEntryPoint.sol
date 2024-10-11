// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import {IAlgebraCustomPoolEntryPoint, IAlgebraPluginFactory} from './interfaces/IAlgebraCustomPoolEntryPoint.sol';
import {IAlgebraPool} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import {IAlgebraFactory} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';

/// @title Algebra custom pool entry point
/// @notice Is used to create custom pools
/// @dev Version: Algebra Integral 1.2
contract AlgebraCustomPoolEntryPoint is IAlgebraCustomPoolEntryPoint {
    /// @inheritdoc IAlgebraCustomPoolEntryPoint
    address public immutable override factory;

    modifier onlyCustomDeployer(address pool) {
        _checkIfDeployer(pool);
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0));
        factory = _factory;
    }

    /// @inheritdoc IAlgebraCustomPoolEntryPoint
    function createCustomPool(
        address deployer,
        address creator,
        address tokenA,
        address tokenB,
        bytes calldata data
    ) external override returns (address customPool) {
        require(msg.sender == deployer, 'Only deployer');

        return IAlgebraFactory(factory).createCustomPool(deployer, creator, tokenA, tokenB, data);
    }

    /// @inheritdoc IAlgebraPluginFactory
    function beforeCreatePoolHook(
        address pool,
        address creator,
        address deployer,
        address token0,
        address token1,
        bytes calldata data
    ) external override returns (address) {
        require(msg.sender == factory, 'Only factory');

        // all additional custom logic should be implemented in `deployer` smart contract
        return IAlgebraPluginFactory(deployer).beforeCreatePoolHook(pool, creator, deployer, token0, token1, data);
    }

    /// @inheritdoc IAlgebraPluginFactory
    function afterCreatePoolHook(address plugin, address pool, address deployer) external override {
        require(msg.sender == factory, 'Only factory');

        IAlgebraPluginFactory(deployer).afterCreatePoolHook(plugin, pool, deployer);
    }

    // ####### Permissioned actions #######
    // AlgebraCustomPoolEntryPoint must have a "POOLS_ADMINISTRATOR" role to be able to use permissioned actions

    /// @inheritdoc IAlgebraCustomPoolEntryPoint
    function setTickSpacing(address pool, int24 newTickSpacing) external override onlyCustomDeployer(pool) {
        IAlgebraPool(pool).setTickSpacing(newTickSpacing);
    }

    /// @inheritdoc IAlgebraCustomPoolEntryPoint
    function setPlugin(address pool, address newPluginAddress) external override onlyCustomDeployer(pool) {
        IAlgebraPool(pool).setPlugin(newPluginAddress);
    }

    /// @inheritdoc IAlgebraCustomPoolEntryPoint
    function setPluginConfig(address pool, uint8 newConfig) external override onlyCustomDeployer(pool) {
        IAlgebraPool(pool).setPluginConfig(newConfig);
    }

    /// @inheritdoc IAlgebraCustomPoolEntryPoint
    function setFee(address pool, uint16 newFee) external override onlyCustomDeployer(pool) {
        IAlgebraPool(pool).setFee(newFee);
    }

    function _checkIfDeployer(address pool) internal view {
        address token0 = IAlgebraPool(pool).token0();
        address token1 = IAlgebraPool(pool).token1();
        require(pool == IAlgebraFactory(factory).customPoolByPair(msg.sender, token0, token1), 'Only deployer');
    }
}
