import { ethers } from 'hardhat';
import { LiquidityAmountsTest } from '../typechain';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { expect } from './shared/expect';

import snapshotGasCost from './shared/snapshotGasCost';

describe('LiquidityAmounts', async () => {
  let liquidityFromAmounts: LiquidityAmountsTest;

  before('deploy test library', async () => {
    const liquidityFromAmountsTestFactory = await ethers.getContractFactory('LiquidityAmountsTest');
    liquidityFromAmounts = (await liquidityFromAmountsTestFactory.deploy()) as any as LiquidityAmountsTest;
  });

  describe('#getLiquidityForAmount0', () => {
    it('gas [ @skip-on-coverage ]', async () => {
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      await snapshotGasCost(liquidityFromAmounts.getGasCostOfGetLiquidityForAmount0(sqrtPriceAX96, sqrtPriceBX96, 100));
    });
  });

  describe('#getLiquidityForAmount1', () => {
    it('gas [ @skip-on-coverage ]', async () => {
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      await snapshotGasCost(liquidityFromAmounts.getGasCostOfGetLiquidityForAmount1(sqrtPriceAX96, sqrtPriceBX96, 100));
    });
  });

  describe('#getLiquidityForAmounts', () => {
    it('amounts for price inside', async () => {
      const sqrtPriceX96 = encodePriceSqrt(1, 1);
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      const liquidity = await liquidityFromAmounts.getLiquidityForAmounts(
        sqrtPriceX96,
        sqrtPriceAX96,
        sqrtPriceBX96,
        100,
        200
      );
      expect(liquidity).to.eq(2148);
    });

    it('amounts for price below', async () => {
      const sqrtPriceX96 = encodePriceSqrt(99, 110);
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      const liquidity = await liquidityFromAmounts.getLiquidityForAmounts(
        sqrtPriceX96,
        sqrtPriceAX96,
        sqrtPriceBX96,
        100,
        200
      );
      expect(liquidity).to.eq(1048);
    });

    it('amounts for price above', async () => {
      const sqrtPriceX96 = encodePriceSqrt(111, 100);
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      const liquidity = await liquidityFromAmounts.getLiquidityForAmounts(
        sqrtPriceX96,
        sqrtPriceAX96,
        sqrtPriceBX96,
        100,
        200
      );
      expect(liquidity).to.eq(2097);
    });

    it('amounts for price equal to lower boundary', async () => {
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceX96 = sqrtPriceAX96;
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      const liquidity = await liquidityFromAmounts.getLiquidityForAmounts(
        sqrtPriceX96,
        sqrtPriceAX96,
        sqrtPriceBX96,
        100,
        200
      );
      expect(liquidity).to.eq(1048);
    });

    it('amounts for price equal to upper boundary', async () => {
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      const sqrtPriceX96 = sqrtPriceBX96;
      const liquidity = await liquidityFromAmounts.getLiquidityForAmounts(
        sqrtPriceX96,
        sqrtPriceAX96,
        sqrtPriceBX96,
        100,
        200
      );
      expect(liquidity).to.eq(2097);
    });

    it('gas for price below [ @skip-on-coverage ]', async () => {
      const sqrtPriceX96 = encodePriceSqrt(99, 110);
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      await snapshotGasCost(
        liquidityFromAmounts.getGasCostOfGetLiquidityForAmounts(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, 100, 200)
      );
    });
    it('gas for price above [ @skip-on-coverage ]', async () => {
      const sqrtPriceX96 = encodePriceSqrt(111, 100);
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      await snapshotGasCost(
        liquidityFromAmounts.getGasCostOfGetLiquidityForAmounts(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, 100, 200)
      );
    });
    it('gas for price inside [ @skip-on-coverage ]', async () => {
      const sqrtPriceX96 = encodePriceSqrt(1, 1);
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      await snapshotGasCost(
        liquidityFromAmounts.getGasCostOfGetLiquidityForAmounts(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, 100, 200)
      );
    });
  });

  describe('#getAmount0ForLiquidity', () => {
    it('gas [ @skip-on-coverage ]', async () => {
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      await snapshotGasCost(liquidityFromAmounts.getGasCostOfGetAmount0ForLiquidity(sqrtPriceAX96, sqrtPriceBX96, 100));
    });
  });

  describe('#getAmount1ForLiquidity', () => {
    it('gas [ @skip-on-coverage ]', async () => {
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      await snapshotGasCost(liquidityFromAmounts.getGasCostOfGetAmount1ForLiquidity(sqrtPriceAX96, sqrtPriceBX96, 100));
    });
  });

  describe('boundary order and overflow', () => {
    const lower = encodePriceSqrt(100, 110);
    const upper = encodePriceSqrt(110, 100);
    const price = encodePriceSqrt(1, 1);

    it('gives the same result when the two boundaries are passed in reverse', async () => {
      const lib = liquidityFromAmounts;
      // the values are pinned as well: a change applied to both orders would keep symmetry alone green
      expect(await lib.getLiquidityForAmount0(lower, upper, 100)).to.eq(1048);
      expect(await lib.getLiquidityForAmount0(upper, lower, 100)).to.eq(1048);
      expect(await lib.getLiquidityForAmount1(lower, upper, 100)).to.eq(1048);
      expect(await lib.getLiquidityForAmount1(upper, lower, 100)).to.eq(1048);
      expect(await lib.getLiquidityForAmounts(price, lower, upper, 100, 200)).to.eq(2148);
      expect(await lib.getLiquidityForAmounts(price, upper, lower, 100, 200)).to.eq(2148);
      expect(await lib.getAmount0ForLiquidity(lower, upper, 2148)).to.eq(204);
      expect(await lib.getAmount0ForLiquidity(upper, lower, 2148)).to.eq(204);
      expect(await lib.getAmount1ForLiquidity(lower, upper, 2148)).to.eq(204);
      expect(await lib.getAmount1ForLiquidity(upper, lower, 2148)).to.eq(204);
      expect(await lib.getAmountsForLiquidity(price, lower, upper, 2148)).to.deep.eq([99n, 99n]);
      expect(await lib.getAmountsForLiquidity(price, upper, lower, 2148)).to.deep.eq([99n, 99n]);
    });

    it('reverts when liquidity does not fit into uint128', async () => {
      await expect(
        liquidityFromAmounts.getLiquidityForAmount0(price, encodePriceSqrt(10001, 10000), 2n ** 200n)
      ).to.be.revertedWithoutReason();
    });
  });

  describe('#getAmountsForLiquidity', () => {
    it('amounts for price inside', async () => {
      const sqrtPriceX96 = encodePriceSqrt(1, 1);
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      const { amount0, amount1 } = await liquidityFromAmounts.getAmountsForLiquidity(
        sqrtPriceX96,
        sqrtPriceAX96,
        sqrtPriceBX96,
        2148
      );
      expect(amount0).to.eq(99);
      expect(amount1).to.eq(99);
    });

    it('amounts for price below', async () => {
      const sqrtPriceX96 = encodePriceSqrt(99, 110);
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      const { amount0, amount1 } = await liquidityFromAmounts.getAmountsForLiquidity(
        sqrtPriceX96,
        sqrtPriceAX96,
        sqrtPriceBX96,
        1048
      );
      expect(amount0).to.eq(99);
      expect(amount1).to.eq(0);
    });

    it('amounts for price above', async () => {
      const sqrtPriceX96 = encodePriceSqrt(111, 100);
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      const { amount0, amount1 } = await liquidityFromAmounts.getAmountsForLiquidity(
        sqrtPriceX96,
        sqrtPriceAX96,
        sqrtPriceBX96,
        2097
      );
      expect(amount0).to.eq(0);
      expect(amount1).to.eq(199);
    });

    it('amounts for price on lower boundary', async () => {
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceX96 = sqrtPriceAX96;
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      const { amount0, amount1 } = await liquidityFromAmounts.getAmountsForLiquidity(
        sqrtPriceX96,
        sqrtPriceAX96,
        sqrtPriceBX96,
        1048
      );
      expect(amount0).to.eq(99);
      expect(amount1).to.eq(0);
    });

    it('amounts for price on upper boundary', async () => {
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      const sqrtPriceX96 = sqrtPriceBX96;
      const { amount0, amount1 } = await liquidityFromAmounts.getAmountsForLiquidity(
        sqrtPriceX96,
        sqrtPriceAX96,
        sqrtPriceBX96,
        2097
      );
      expect(amount0).to.eq(0);
      expect(amount1).to.eq(199);
    });

    it('gas for price below [ @skip-on-coverage ]', async () => {
      const sqrtPriceX96 = encodePriceSqrt(99, 110);
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      await snapshotGasCost(
        liquidityFromAmounts.getGasCostOfGetAmountsForLiquidity(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, 2148)
      );
    });
    it('gas for price above [ @skip-on-coverage ]', async () => {
      const sqrtPriceX96 = encodePriceSqrt(111, 100);
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      await snapshotGasCost(
        liquidityFromAmounts.getGasCostOfGetAmountsForLiquidity(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, 1048)
      );
    });
    it('gas for price inside [ @skip-on-coverage ]', async () => {
      const sqrtPriceX96 = encodePriceSqrt(1, 1);
      const sqrtPriceAX96 = encodePriceSqrt(100, 110);
      const sqrtPriceBX96 = encodePriceSqrt(110, 100);
      await snapshotGasCost(
        liquidityFromAmounts.getGasCostOfGetAmountsForLiquidity(sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, 2097)
      );
    });
  });
});
