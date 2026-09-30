// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';

contract MockPlugin is IAlgebraPlugin {
    function defaultPluginConfig() external pure returns (uint16) {
        return 0;
    }

    function beforeInitialize(address, uint160) external pure returns (bytes4) {
        return IAlgebraPlugin.beforeInitialize.selector;
    }

    function afterInitialize(address, uint160, int24) external pure returns (bytes4) {
        return IAlgebraPlugin.afterInitialize.selector;
    }

    function beforeModifyPosition(
        address,
        address,
        int24,
        int24,
        int128,
        bytes calldata
    ) external pure returns (bytes4) {
        return IAlgebraPlugin.beforeModifyPosition.selector;
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

    function beforeSwap(address, address, bool, int256, uint160, bool, bytes calldata) external pure returns (uint256, bytes4, uint24) {
        return (0, IAlgebraPlugin.beforeSwap.selector, 0);
    }

    function afterSwap(
        address,
        address,
        bool,
        int256,
        uint160,
        int256,
        int256,
        uint256,
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

    function afterSwapCalculation(
        address,
        address,
        bool,
        int256,
        uint160,
        int256,
        int256,
        bytes memory
    ) external pure returns (bytes4, uint256, uint256) {
        return (IAlgebraPlugin.afterSwapCalculation.selector, 0, 0);
    }

    function afterCross(
        bool,
        uint256,
        uint256,
        int24,
        int128
    ) external pure returns (bytes4) {
        return IAlgebraPlugin.afterCross.selector;
    }
}
