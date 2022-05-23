// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '../interfaces/pool/IAlgebraPoolState.sol';
import '../libraries/TickManager.sol';

abstract contract PoolState is IAlgebraPoolState {
    struct GlobalState {
        // The square root of the current price
        uint160 price;
        // The current tick
        int24 tick;
        uint16 fee;
        // The index of the last written timepoint
        uint16 timepointIndex;
        // The index of the last written (on swap) timepoint
        uint16 timepointIndexSwap;
        // The community fee represented as a percent of all collected fee
        uint8 communityFeeToken0;
        uint8 communityFeeToken1;
        // True if the contract is unlocked, otherwise - false
        bool unlocked;
    }

    /// @inheritdoc IAlgebraPoolState
    uint256 public override totalFeeGrowth0Token;
    /// @inheritdoc IAlgebraPoolState
    uint256 public override totalFeeGrowth1Token;
    /// @inheritdoc IAlgebraPoolState
    GlobalState public override globalState;

    /// @inheritdoc IAlgebraPoolState
    uint128 public override liquidity;
    uint128 internal volumePerLiquidityInBlock;

    uint160 internal blockStartPrice;
    uint32 internal startPriceUpdated;
    /// @inheritdoc IAlgebraPoolState
    uint32 public override liquidityCooldown;
    /// @inheritdoc IAlgebraPoolState
    address public override activeIncentive;

    /// @inheritdoc IAlgebraPoolState
    mapping(int24 => TickManager.Tick) public override ticks;
    /// @inheritdoc IAlgebraPoolState
    mapping(int16 => uint256) public override tickTable;

    // @dev Reentrancy protection. Implemented in every function of the contract since there are checks of balances.
    modifier lock() {
        require(globalState.unlocked, 'LOK');
        globalState.unlocked = false;
        _;
        globalState.unlocked = true;
    }

    /**
     * @dev This function is created for testing by overriding it.
     * @return A timestamp converted to uint32
     */
    function _blockTimestamp() internal view virtual returns (uint32) {
        return uint32(block.timestamp); // truncation is desired
    }
}
