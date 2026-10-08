// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/pool/IAlgebraPoolState.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';

/// @notice Minimal mock of a farming plugin for tests
contract MockFarmingPlugin is IAlgebraPlugin {
    using Plugins for uint16;

    address public pool;
    address public pluginFactory;

    address public incentive;
    address private _lastIncentiveOwner;

    modifier onlyPool() {
        require(msg.sender == pool, 'Only pool');
        _;
    }

    constructor(address _pool, address _pluginFactory) {
        pool = _pool;
        pluginFactory = _pluginFactory;
    }

    /// @dev a function, not a constant: slither fails to fold a uint16 constant built from the flags
    function defaultPluginConfig() public pure override returns (uint16) {
        return uint16(Plugins.AFTER_SWAP_FLAG);
    }

    function beforeInitialize(address, uint160) external override onlyPool returns (bytes4) {
        _updatePluginConfigInPool();
        return IAlgebraPlugin.beforeInitialize.selector;
    }

    function afterInitialize(address, uint160, int24) external view override onlyPool returns (bytes4) {
        return IAlgebraPlugin.afterInitialize.selector;
    }

    function beforeModifyPosition(address, address, int24, int24, int128, bytes calldata)
        external view override onlyPool returns (bytes4) {
        return IAlgebraPlugin.beforeModifyPosition.selector;
    }

    function afterModifyPosition(address, address, int24, int24, int128, uint256, uint256, bytes calldata)
        external view override onlyPool returns (bytes4) {
        return IAlgebraPlugin.afterModifyPosition.selector;
    }

    function beforeSwap(address, address, bool, int256, uint160, bool, bytes calldata)
        external view override onlyPool returns (uint256, bytes4, uint24) {
        return (0, IAlgebraPlugin.beforeSwap.selector, 0);
    }

    function afterSwap(address, address, bool zeroToOne, int256, uint160, int256, int256, uint256, bytes calldata)
        external override onlyPool returns (bytes4) {
        _updateVirtualPoolTick(zeroToOne);
        return IAlgebraPlugin.afterSwap.selector;
    }

    function beforeFlash(address, address, uint256, uint256, bytes calldata)
        external view override onlyPool returns (bytes4) {
        return IAlgebraPlugin.beforeFlash.selector;
    }

    function afterFlash(address, address, uint256, uint256, uint256, uint256, bytes calldata)
        external view override onlyPool returns (bytes4) {
        return IAlgebraPlugin.afterFlash.selector;
    }

    function afterSwapCalculation(address, address, bool, int256, uint160, int256, int256, bytes memory)
        external view override onlyPool returns (bytes4, uint256, uint256) {
        return (IAlgebraPlugin.afterSwapCalculation.selector, 0, 0);
    }

    function afterCross(bool, uint256, uint256, int24, int128)
        external view override onlyPool returns (bytes4) {
        return IAlgebraPlugin.afterCross.selector;
    }

    function setIncentive(address newIncentive) external {
        bool toConnect = newIncentive != address(0);
        bool accessAllowed;

        if (toConnect) {
            accessAllowed = msg.sender == IMockFarmingPluginFactory(pluginFactory).farmingAddress();
        } else {
            if (_lastIncentiveOwner != address(0)) accessAllowed = msg.sender == _lastIncentiveOwner;
            if (!accessAllowed) accessAllowed = msg.sender == IMockFarmingPluginFactory(pluginFactory).farmingAddress();
        }
        require(accessAllowed, 'Not allowed to set incentive');

        require(IAlgebraPool(pool).plugin() == address(this), 'Plugin not attached');
        require(incentive != newIncentive, 'Already active');
        if (toConnect) require(incentive == address(0), 'Has active incentive');

        incentive = newIncentive;

        if (toConnect) {
            _lastIncentiveOwner = msg.sender;
        } else {
            _lastIncentiveOwner = address(0);
        }

        _updatePluginConfigInPool();
    }

    function isIncentiveConnected(address targetIncentive) external view returns (bool) {
        if (incentive != targetIncentive) return false;
        if (IAlgebraPool(pool).plugin() != address(this)) return false;
        (, , , uint16 pluginConfig, , , ) = IAlgebraPoolState(pool).globalState();
        if (!pluginConfig.hasFlag(Plugins.AFTER_SWAP_FLAG)) return false;
        return true;
    }

    function getPool() external view returns (address) {
        return pool;
    }

    function _updatePluginConfigInPool() internal {
        (, , , uint16 currentPluginConfig, , , ) = IAlgebraPoolState(pool).globalState();
        uint16 newPluginConfig = defaultPluginConfig();
        if (currentPluginConfig != newPluginConfig) {
            IAlgebraPool(pool).setPluginConfig(newPluginConfig);
        }
    }

    function _updateVirtualPoolTick(bool zeroToOne) internal {
        address _incentive = incentive;
        if (_incentive != address(0)) {
            (, int24 tick, , , , , ) = IAlgebraPoolState(pool).globalState();
            IAlgebraVirtualPoolMock(_incentive).crossTo(tick, zeroToOne);
        }
    }
}

interface IMockFarmingPluginFactory {
    function farmingAddress() external view returns (address);
}

interface IAlgebraVirtualPoolMock {
    function crossTo(int24 targetTick, bool zeroToOne) external returns (bool);
}
