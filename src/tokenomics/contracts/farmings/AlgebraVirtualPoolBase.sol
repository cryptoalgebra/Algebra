// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import '@cryptoalgebra/core/contracts/libraries/TickManager.sol';
import '@cryptoalgebra/core/contracts/libraries/TickTable.sol';
import '@cryptoalgebra/core/contracts/libraries/LiquidityMath.sol';

import './IAlgebraVirtualPoolBase.sol';

/// @title Abstract base contract for Algebra virtual pools
abstract contract AlgebraVirtualPoolBase is IAlgebraVirtualPoolBase {
    using TickTable for mapping(int16 => uint256);

    address public immutable farmingCenterAddress;
    address public immutable farmingAddress;
    address public immutable pool;

    /// @inheritdoc IAlgebraVirtualPoolBase
    mapping(int24 => TickManager.Tick) public override ticks;

    mapping(int16 => uint256) internal tickTable;

    /// @inheritdoc IAlgebraVirtualPoolBase
    uint128 public override currentLiquidity;
    /// @inheritdoc IAlgebraVirtualPoolBase
    int24 public override globalTick;
    /// @inheritdoc IAlgebraVirtualPoolBase
    uint32 public override timeOutside;

    /// @inheritdoc IAlgebraVirtualPoolBase
    uint160 public override globalSecondsPerLiquidityCumulative;
    /// @inheritdoc IAlgebraVirtualPoolBase
    uint32 public override prevTimestamp;

    /// @notice only pool (or FarmingCenter as "proxy") can call
    modifier onlyFromPool() {
        require(msg.sender == farmingCenterAddress || msg.sender == pool, 'only pool can call this function');
        _;
    }

    modifier onlyFarming() {
        require(msg.sender == farmingAddress, 'only farming can call this function');
        _;
    }

    constructor(
        address _farmingCenterAddress,
        address _farmingAddress,
        address _pool
    ) {
        farmingCenterAddress = _farmingCenterAddress;
        farmingAddress = _farmingAddress;
        pool = _pool;
    }

    /// @notice get seconds per liquidity inside range
    function getInnerSecondsPerLiquidity(int24 bottomTick, int24 topTick)
        external
        view
        override
        returns (uint160 innerSecondsSpentPerLiquidity)
    {
        uint160 lowerSecondsPerLiquidity = ticks[bottomTick].outerSecondsPerLiquidity;
        uint160 upperSecondsPerLiquidity = ticks[topTick].outerSecondsPerLiquidity;

        if (globalTick < bottomTick) {
            return (lowerSecondsPerLiquidity - upperSecondsPerLiquidity);
        } else if (globalTick < topTick) {
            return (globalSecondsPerLiquidityCumulative - lowerSecondsPerLiquidity - upperSecondsPerLiquidity);
        } else {
            return (upperSecondsPerLiquidity - lowerSecondsPerLiquidity);
        }
    }

    /// @dev logic of tick crossing differs in virtual pools
    function _crossTick(int24 nextTick) internal virtual returns (int128 liquidityDelta);

    /// @inheritdoc IAlgebraVirtualPool
    function cross(int24 nextTick, bool zeroToOne) external override onlyFromPool {
        if (ticks[nextTick].initialized) {
            int128 liquidityDelta = _crossTick(nextTick);
            if (zeroToOne) liquidityDelta = -liquidityDelta;
            currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
        }
        globalTick = zeroToOne ? nextTick - 1 : nextTick;
    }

    /// @dev logic of cumulatives differs in virtual pools
    function _increaseCumulative(uint32 currentTimestamp) internal virtual returns (Status);

    /// @inheritdoc IAlgebraVirtualPool
    function increaseCumulative(uint32 currentTimestamp) external override onlyFromPool returns (Status) {
        return _increaseCumulative(currentTimestamp);
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
    ) external override onlyFarming {
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
                tickTable.toggleTick(bottomTick);
            }

            if (_updateTick(topTick, currentTick, liquidityDelta, true)) {
                flippedTop = true;
                tickTable.toggleTick(topTick);
            }

            if (currentTick >= bottomTick && currentTick < topTick) {
                currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
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
}
