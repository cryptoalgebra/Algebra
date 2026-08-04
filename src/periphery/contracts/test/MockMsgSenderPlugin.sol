// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '../interfaces/IMsgSender.sol';

/// @dev Test-only stand-in for a permissioned-pool plugin: on `beforeSwap`/`beforeModifyPosition` it calls
/// back into the pool's immediate caller (`sender`, i.e. the router) via `IMsgSender.msgSender()` and
/// records what came back, so tests can assert what a real permissioned-pool plugin would have seen
/// mid-transaction.
contract MockMsgSenderPlugin is IAlgebraPlugin {
    address public lastSwapSender;
    address public lastModifyPositionSender;

    uint8 internal constant HOOKS_CONFIG = uint8(1) | uint8(1 << 2); // BEFORE_SWAP_FLAG | BEFORE_POSITION_MODIFY_FLAG

    function defaultPluginConfig() external pure returns (uint8) {
        return HOOKS_CONFIG;
    }

    /// @dev `beforeInitialize` is always called by the pool regardless of pluginConfig, so this is where
    /// the plugin self-enables the hooks it needs (a pool's pluginConfig otherwise defaults to 0/disabled)
    function beforeInitialize(address, uint160) external returns (bytes4) {
        IAlgebraPool(msg.sender).setPluginConfig(HOOKS_CONFIG);
        return IAlgebraPlugin.beforeInitialize.selector;
    }

    function afterInitialize(address, uint160, int24) external pure returns (bytes4) {
        return IAlgebraPlugin.afterInitialize.selector;
    }

    function beforeModifyPosition(
        address sender,
        address,
        int24,
        int24,
        int128,
        bytes calldata
    ) external returns (bytes4, uint24) {
        lastModifyPositionSender = IMsgSender(sender).msgSender();
        return (IAlgebraPlugin.beforeModifyPosition.selector, 0);
    }

    function handlePluginFee(uint256, uint256) external pure returns (bytes4) {
        return IAlgebraPlugin.handlePluginFee.selector;
    }

    function afterModifyPosition(
        address,
        address,
        int24,
        int24,
        int128,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IAlgebraPlugin.afterModifyPosition.selector;
    }

    function beforeSwap(
        address sender,
        address,
        bool,
        int256,
        uint160,
        bool,
        bytes calldata
    ) external returns (bytes4, uint24, uint24) {
        lastSwapSender = IMsgSender(sender).msgSender();
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
    ) external pure returns (bytes4) {
        return IAlgebraPlugin.afterSwap.selector;
    }

    function beforeFlash(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return IAlgebraPlugin.beforeFlash.selector;
    }

    function afterFlash(
        address,
        address,
        uint256,
        uint256,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IAlgebraPlugin.afterFlash.selector;
    }
}
