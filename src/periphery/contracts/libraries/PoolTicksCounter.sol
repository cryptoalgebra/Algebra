// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.6.0;

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import 'hardhat/console.sol';

/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-periphery
library PoolTicksCounter {
    /// @dev This function counts the number of initialized ticks that would incur a gas cost between tickBefore and tickAfter.
    /// When tickBefore and/or tickAfter themselves are initialized, the logic over whether we should count them depends on the
    /// direction of the swap. If we are swapping upwards (tickAfter > tickBefore) we don't want to count tickBefore but we do
    /// want to count tickAfter. The opposite is true if we are swapping downwards.
    function countInitializedTicksCrossed(
        IAlgebraPool self,
        int24 tickBefore,
        int24 tickAfter
    ) internal view returns (uint32 initializedTicksCrossed) {
        int24 startTick;

        (, , int24 prevTick, , , , ) = self.globalState();

        if (tickAfter <= tickBefore) {
            startTick = prevTick;
            while (startTick > tickAfter) {
                initializedTicksCrossed++;
                (, , , , startTick, , , , ) = self.ticks(startTick);
            }
        } else {
            (, , , , , startTick, , , ) = self.ticks(prevTick);
            while (startTick <= tickAfter) {
                initializedTicksCrossed++;
                (, , , , , startTick, , , ) = self.ticks(startTick);
            }
        }

        if ((startTick == tickBefore) && (tickBefore < tickAfter)) {
            initializedTicksCrossed -= 1;
        }

        return initializedTicksCrossed;
    }
}
