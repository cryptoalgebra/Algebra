// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '@cryptoalgebra/core/contracts/libraries/LiquidityMath.sol';

import '../libraries/VirtualTickManagement.sol';
import './IAlgebraVirtualPoolBase.sol';

/// @title Abstract base contract for Algebra virtual pools
abstract contract AlgebraVirtualPoolBase is IAlgebraVirtualPoolBase {
    address public immutable farmingCenterAddress;
    address public immutable farmingAddress;
    address public immutable pool;

    /// @inheritdoc IAlgebraVirtualPoolBase
    mapping(int24 => VirtualTickManagement.Tick) public override ticks;

    /// @inheritdoc IAlgebraVirtualPoolBase
    uint128 public override currentLiquidity;
    /// @inheritdoc IAlgebraVirtualPoolBase
    int24 public override globalTick;
    /// @inheritdoc IAlgebraVirtualPoolBase
    uint32 public override prevTimestamp;

    int24 internal globalPrevInitializedTick;

    /// @notice only pool (or FarmingCenter as "proxy") can call
    modifier onlyFromPool() {
        if (msg.sender != farmingCenterAddress && msg.sender != pool) revert onlyPool();
        _;
    }

    modifier onlyFromFarming() {
        if (msg.sender != farmingAddress) revert onlyFarming();
        _;
    }

    constructor(address _farmingCenterAddress, address _farmingAddress, address _pool) {
        globalPrevInitializedTick = TickMath.MIN_TICK;
        farmingCenterAddress = _farmingCenterAddress;
        farmingAddress = _farmingAddress;
        pool = _pool;
    }

    /// @dev logic of tick crossing differs in virtual pools
    function _crossTick(int24 nextTick) internal virtual returns (int128 liquidityDelta);

    /// @inheritdoc IAlgebraVirtualPool
    function crossTo(int24 targetTick, bool zeroToOne) external override onlyFromPool returns (bool) {
        if (!_increaseCumulative(uint32(block.timestamp))) return false;
        unchecked {
            int24 previousTick = globalPrevInitializedTick;
            uint128 _currentLiquidity = currentLiquidity;
            int24 _globalTick = globalTick;

            if (zeroToOne) {
                while (true) {
                    // TODO inf
                    if (targetTick < previousTick) {
                        _currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, -_crossTick(previousTick));
                        _globalTick = previousTick - 1;
                        previousTick = ticks[previousTick].prevTick;
                    } else {
                        _globalTick = targetTick;
                        break;
                    }
                }
            } else {
                while (true) {
                    int24 nextTick = ticks[previousTick].nextTick;
                    if (targetTick >= nextTick) {
                        _currentLiquidity = LiquidityMath.addDelta(_currentLiquidity, _crossTick(nextTick));
                        _globalTick = nextTick;
                        previousTick = nextTick;
                    } else {
                        _globalTick = targetTick;
                        break;
                    }
                }
            }

            globalTick = _globalTick;
            currentLiquidity = _currentLiquidity;
            globalPrevInitializedTick = previousTick;
        }
        return true;
    }

    /// @dev logic of cumulatives differs in virtual pools
    function _increaseCumulative(uint32 currentTimestamp) internal virtual returns (bool success);

    /// @inheritdoc IAlgebraVirtualPoolBase
    function increaseCumulative(uint32 currentTimestamp) external override onlyFromFarming {
        _increaseCumulative(currentTimestamp);
    }

    /// @dev logic of tick updating differs in virtual pools
    function _updateTick(
        int24 tick,
        int24 currentTick,
        int128 liquidityDelta,
        bool isTopTick
    ) internal virtual returns (bool updated);

    /// @inheritdoc IAlgebraVirtualPoolBase
    function applyLiquidityDeltaToPosition(
        uint32 currentTimestamp,
        int24 bottomTick,
        int24 topTick,
        int128 liquidityDelta,
        int24 currentTick
    ) external override onlyFromFarming {
        globalTick = currentTick;

        if (currentTimestamp > prevTimestamp) {
            _increaseCumulative(currentTimestamp);
        }

        if (liquidityDelta != 0) {
            // if we need to update the ticks, do it
            bool flippedBottom;
            bool flippedTop;

            if (_updateTick(bottomTick, currentTick, liquidityDelta, false)) {
                flippedBottom = true;
            }

            if (_updateTick(topTick, currentTick, liquidityDelta, true)) {
                flippedTop = true;
            }

            if (currentTick >= bottomTick && currentTick < topTick) {
                currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
            }

            if (flippedBottom || flippedTop) {
                int24 previousTick = globalPrevInitializedTick;
                if (flippedBottom) {
                    previousTick = _insertOrRemoveTick(bottomTick, currentTick, previousTick, liquidityDelta < 0);
                }
                if (flippedTop) {
                    previousTick = _insertOrRemoveTick(topTick, currentTick, previousTick, liquidityDelta < 0);
                }
                globalPrevInitializedTick = previousTick;
            }

            // clear any tick data that is no longer needed
            if (liquidityDelta < 0) {
                if (flippedBottom) {
                    delete ticks[bottomTick];
                }
                if (flippedTop) {
                    delete ticks[topTick];
                }
            }
        }
    }

    function _insertOrRemoveTick(
        int24 tick,
        int24 currentTick,
        int24 prevInitializedTick,
        bool remove
    ) internal virtual returns (int24 newPrevInitializedTick);
}
