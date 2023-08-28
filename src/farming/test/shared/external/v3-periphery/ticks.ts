export const getMinTick = (tickSpacing: number) => Math.ceil(-887272 / tickSpacing) * tickSpacing;

export const getMaxTick = (tickSpacing: number) => Math.floor(887272 / tickSpacing) * tickSpacing;

export const getMaxLiquidityPerTick = (tickSpacing: number) =>
  (2n ** 128n - 1n) / (BigInt(getMaxTick(tickSpacing) - getMinTick(tickSpacing)) / BigInt(tickSpacing) + 1n);
