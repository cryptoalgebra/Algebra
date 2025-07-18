// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

interface IRebalanceManager {
	event SetPriceChangeThreshold(uint16 priceChangeThreshold);
	event SetPercentages(uint16 baseLowPct, uint16 baseHighPct, uint16 limitReservePct);
	event SetTriggers(uint16 simulate, uint16 normalThreshold, uint16 underInventoryThreshold, uint16 overInventoryThreshold);
	event SetDtrDelta(uint16 dtrDelta);
	event SetHighVolatility(uint16 highVolatility);
	event SetSomeVolatility(uint16 someVolatility);
	event SetExtremeVolatility(uint16 extremeVolatility);
	event SetDepositTokenUnusedThreshold(uint16 depositTokenUnusedThreshold);
	event SetMinTimeBetweenRebalances(uint32 minTimeBetweenRebalances);
	event SetVault(address vault);
	event Paused();
	event Unpaused();

	function obtainTWAPAndRebalance(
		int24 currentTick,
        int24 slowTwapTick,
        int24 fastTwapTick,
        uint32 lastBlockTimestamp
	) external;
}