// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/pool/IAlgebraPoolState.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';

contract CustomPlugin is Timestamp, IAlgebraPlugin {
    using Plugins for uint8;

    address public pool;
    bytes32 public constant ALGEBRA_BASE_PLUGIN_MANAGER = keccak256('ALGEBRA_BASE_PLUGIN_MANAGER');

    function _getPoolState() internal view returns (uint160 price, int24 tick, uint16 fee, uint8 pluginConfig) {
        (price, tick, fee, pluginConfig, , ) = IAlgebraPoolState(pool).globalState();
    }

    /// @inheritdoc IAlgebraPlugin
    uint8 public constant override defaultPluginConfig =
        uint8(Plugins.BEFORE_SWAP_FLAG | Plugins.AFTER_SWAP_FLAG | Plugins.DYNAMIC_FEE);

    function beforeInitialize(address, uint160) external override returns (bytes4) {
        pool = msg.sender;
        _updatePluginConfigInPool();
        return IAlgebraPlugin.beforeInitialize.selector;
    }

    function afterInitialize(address, uint160, int24) external override returns (bytes4) {
        _updatePluginConfigInPool();
        return IAlgebraPlugin.afterInitialize.selector;
    }

    /// @dev unused
    function beforeModifyPosition(
        address,
        address,
        int24,
        int24,
        int128,
        bytes calldata
    ) external override returns (bytes4, uint24) {
        _updatePluginConfigInPool(); // should not be called, reset config
        return (IAlgebraPlugin.beforeModifyPosition.selector, 0);
    }

    /// @dev unused
    function afterModifyPosition(
        address,
        address,
        int24,
        int24,
        int128,
        uint256,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        _updatePluginConfigInPool(); // should not be called, reset config
        return IAlgebraPlugin.afterModifyPosition.selector;
    }

    function beforeSwap(
        address,
        address,
        bool,
        int256,
        uint160,
        bool,
        bytes calldata
    ) external override returns (bytes4, uint24, uint24) {
        IAlgebraPool(pool).setFee(10000);
        return (IAlgebraPlugin.beforeSwap.selector, 0, 0);
    }

    function afterSwap(
        address,
        address,
        bool,
        int256,
        uint160,
        int256,
        int256,
        bytes calldata
    ) external override returns (bytes4) {
        IAlgebraPool(pool).setFee(100);
        return IAlgebraPlugin.afterSwap.selector;
    }

    function handlePluginFee(uint256, uint256) external pure returns (bytes4) {
        return IAlgebraPlugin.handlePluginFee.selector;
    }

    /// @dev unused
    function beforeFlash(address, address, uint256, uint256, bytes calldata) external override returns (bytes4) {
        _updatePluginConfigInPool(); // should not be called, reset config
        return IAlgebraPlugin.beforeFlash.selector;
    }

    /// @dev unused
    function afterFlash(
        address,
        address,
        uint256,
        uint256,
        uint256,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        _updatePluginConfigInPool(); // should not be called, reset config
        return IAlgebraPlugin.afterFlash.selector;
    }

    function _updatePluginConfigInPool() internal {
        uint8 newPluginConfig = defaultPluginConfig;

        (, , , uint8 currentPluginConfig) = _getPoolState();
        if (currentPluginConfig != newPluginConfig) {
            IAlgebraPool(pool).setPluginConfig(newPluginConfig);
        }
    }
}
