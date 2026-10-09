import { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from './shared/expect';

import { poolFixture } from './shared/fixtures';

import {
  expandTo18Decimals,
  getMaxTick,
  getMinTick,
  encodePriceSqrt,
  createPoolFunctions,
  getPositionKey,
  SwapFunction,
  MintFunction,
  MaxUint128,
} from './shared/utilities';

import {
  TestERC20,
  MockTimeAlgebraPool,
  TestAlgebraCallee,
  MockPoolPlugin,
  TickMathTest,
} from '../typechain';

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

const FEE_MODE_DEFAULT = 0;
const FEE_MODE_TOKEN0 = 1;
const FEE_MODE_TOKEN1 = 2;

describe('AlgebraPool fee mode', () => {
  let wallet: Wallet, other: Wallet;

  let token0: TestERC20;
  let token1: TestERC20;
  let pool: MockTimeAlgebraPool;
  let swapTarget: TestAlgebraCallee;
  let vaultAddress: string;

  let swapExact0For1: SwapFunction;
  let swapExact1For0: SwapFunction;
  let swap0ForExact1: SwapFunction;
  let swap1ForExact0: SwapFunction;
  let swapExact0For1SupportingFee: SwapFunction;
  let swapExact1For0SupportingFee: SwapFunction;
  let mint: MintFunction;

  let minTick: number;
  let maxTick: number;

  beforeEach('deploy fixture', async () => {
    [wallet, other] = await (ethers as any).getSigners();
    let vault;
    let _createPool: ThenArg<ReturnType<typeof poolFixture>>['createPool'];
    ({ token0, token1, vault, createPool: _createPool, swapTargetCallee: swapTarget } = await loadFixture(poolFixture));
    vaultAddress = await vault.getAddress();

    pool = await _createPool();
    ({
      swapExact0For1,
      swapExact1For0,
      swap0ForExact1,
      swap1ForExact0,
      swapExact0For1SupportingFee,
      swapExact1For0SupportingFee,
      mint,
    } = createPoolFunctions({
      token0,
      token1,
      swapTarget,
      pool,
    }));
    minTick = getMinTick(60);
    maxTick = getMaxTick(60);
  });

  async function initializeWithLiquidity(feeMode: number = FEE_MODE_DEFAULT) {
    await pool.initialize(encodePriceSqrt(1, 1));
    if (feeMode !== FEE_MODE_DEFAULT) await pool.setFeeMode(feeMode);
    await mint(wallet.address, minTick, maxTick, expandTo18Decimals(2));
  }

  describe('#setFeeMode', () => {
    it('is off by default', async () => {
      expect((await pool.globalState()).feeMode).to.eq(FEE_MODE_DEFAULT);
    });

    it('sets the mode and emits an event', async () => {
      await expect(pool.setFeeMode(FEE_MODE_TOKEN0)).to.emit(pool, 'FeeMode').withArgs(FEE_MODE_TOKEN0);
      expect((await pool.globalState()).feeMode).to.eq(FEE_MODE_TOKEN0);

      await expect(pool.setFeeMode(FEE_MODE_TOKEN1)).to.emit(pool, 'FeeMode').withArgs(FEE_MODE_TOKEN1);
      expect((await pool.globalState()).feeMode).to.eq(FEE_MODE_TOKEN1);

      await expect(pool.setFeeMode(FEE_MODE_DEFAULT)).to.emit(pool, 'FeeMode').withArgs(FEE_MODE_DEFAULT);
      expect((await pool.globalState()).feeMode).to.eq(FEE_MODE_DEFAULT);
    });

    it('rejects an unknown mode', async () => {
      await expect(pool.setFeeMode(3)).to.be.revertedWithCustomError(pool, 'invalidNewFeeMode');
      await expect(pool.setFeeMode(255)).to.be.revertedWithCustomError(pool, 'invalidNewFeeMode');
    });

    it('rejects setting the same mode twice', async () => {
      await expect(pool.setFeeMode(FEE_MODE_DEFAULT)).to.be.revertedWithCustomError(pool, 'invalidNewFeeMode');
      await pool.setFeeMode(FEE_MODE_TOKEN0);
      await expect(pool.setFeeMode(FEE_MODE_TOKEN0)).to.be.revertedWithCustomError(pool, 'invalidNewFeeMode');
    });

    it('can only be called by an administrator', async () => {
      await expect(pool.connect(other).setFeeMode(FEE_MODE_TOKEN0)).to.be.revertedWithCustomError(pool, 'notAllowed');
    });

    it('does not change any other part of the global state', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      const before = await pool.globalState();
      await pool.setFeeMode(FEE_MODE_TOKEN1);
      const after = await pool.globalState();

      expect(after.price).to.eq(before.price);
      expect(after.tick).to.eq(before.tick);
      expect(after.lastFee).to.eq(before.lastFee);
      expect(after.pluginConfig).to.eq(before.pluginConfig);
      expect(after.communityFee).to.eq(before.communityFee);
      expect(after.unlocked).to.eq(before.unlocked);
    });

    it('a mode set before initialize survives it and applies to the first swap', async () => {
      await pool.setFeeMode(FEE_MODE_TOKEN1);
      await pool.initialize(encodePriceSqrt(1, 1));
      expect((await pool.globalState()).feeMode).to.eq(FEE_MODE_TOKEN1);

      // under the default mode this 0 -> 1 swap would accrue in token0
      await mint(wallet.address, minTick, maxTick, expandTo18Decimals(2));
      await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);
      expect(await pool.totalFeeGrowth0Token()).to.eq(0);
      expect(await pool.totalFeeGrowth1Token()).to.eq(8101961117165266326721666069987521n);
    });
  });

  describe('fee growth routing', () => {
    it('default mode accrues in the input token of each swap', async () => {
      await initializeWithLiquidity();

      await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);
      expect(await pool.totalFeeGrowth0Token()).to.eq(8507059173023461586584365185794205n);
      expect(await pool.totalFeeGrowth1Token()).to.eq(0);

      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      expect(await pool.totalFeeGrowth1Token()).to.eq(8507059173023461586584365185794205n);
      expect(await pool.totalFeeGrowth0Token()).to.eq(8507059173023461586584365185794205n);
    });

    it('token0 mode accrues in token0 in both directions', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN0);

      await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);
      expect(await pool.totalFeeGrowth0Token()).to.eq(8507059173023461586584365185794205n);
      expect(await pool.totalFeeGrowth1Token()).to.eq(0);

      // token0 is now the output token, the fee still has to land in token0
      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      expect(await pool.totalFeeGrowth0Token()).to.eq(17417840419052228883635560643094198n);
      expect(await pool.totalFeeGrowth1Token()).to.eq(0);
    });

    it('token1 mode accrues in token1 in both directions', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN1);

      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      expect(await pool.totalFeeGrowth1Token()).to.eq(8507059173023461586584365185794205n);
      expect(await pool.totalFeeGrowth0Token()).to.eq(0);

      await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);
      expect(await pool.totalFeeGrowth1Token()).to.eq(17417840419052228883635560643094198n);
      expect(await pool.totalFeeGrowth0Token()).to.eq(0);
    });

    it('a tick crossed up and back down under different modes flips both sides of its snapshot', async () => {
      const liquidity = expandTo18Decimals(2);
      await pool.initialize(encodePriceSqrt(1, 1));
      await mint(wallet.address, minTick, maxTick, liquidity);
      await mint(wallet.address, -600, 600, liquidity); // in range at the end
      await mint(wallet.address, 600, 1200, liquidity); // above the price at the end

      // up through tick 600 with the fee in token0
      await pool.setFeeMode(FEE_MODE_TOKEN0);
      await swapExact1For0(expandTo18Decimals(2) / 10n, wallet.address);
      expect((await pool.globalState()).tick).to.eq(975);
      const growth0 = await pool.totalFeeGrowth0Token();
      expect(growth0).to.eq(8101961117165266326721666069987521n);
      const growth0BelowTick = (await pool.ticks(600)).outerFeeGrowth0Token;

      // back down with the fee in token1, stopping right on the tick, so all of the token1 fee accrues above it
      await pool.setFeeMode(FEE_MODE_TOKEN1);
      const tickMath = (await (await ethers.getContractFactory('TickMathTest')).deploy()) as any as TickMathTest;
      await swapExact0For1(expandTo18Decimals(1), wallet.address, await tickMath.getSqrtRatioAtTick(600));
      expect((await pool.globalState()).tick).to.eq(599);
      const growth1 = await pool.totalFeeGrowth1Token();
      expect(growth1).to.eq(3325751690837795970706432432644127n);

      // token0 is frozen on the way down and flips from its earlier snapshot, token1 flips from zero
      expect(await pool.totalFeeGrowth0Token()).to.eq(growth0);
      const crossed = await pool.ticks(600);
      expect(crossed.outerFeeGrowth0Token).to.eq(growth0 - growth0BelowTick);
      expect(crossed.outerFeeGrowth1Token).to.eq(growth1);

      // the position in range earned token0 below the tick only, the one above earned the rest of both
      await pool.burn(-600, 600, 0, '0x');
      await pool.burn(600, 1200, 0, '0x');
      const inRange = await pool.positions(await getPositionKey(wallet.address, -600, 600, pool));
      const above = await pool.positions(await getPositionKey(wallet.address, 600, 1200, pool));
      expect([inRange.fees0, inRange.fees1]).to.deep.eq([(growth0BelowTick * liquidity) / 2n ** 128n, 0n]);
      expect([above.fees0, above.fees1]).to.deep.eq([
        ((growth0 - growth0BelowTick) * liquidity) / 2n ** 128n,
        (growth1 * liquidity) / 2n ** 128n,
      ]);
    });
  });

  describe('amounts seen by the trader', () => {
    it('a zero fee moves no accumulator and hands over the whole curve amount', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN1);
      await pool.setFee(0);

      await expect(swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address)).to.changeTokenBalance(
        token1,
        wallet,
        95238095238095238n
      );

      expect(await pool.totalFeeGrowth0Token()).to.eq(0);
      expect(await pool.totalFeeGrowth1Token()).to.eq(0);
      const [pending0, pending1] = await pool.getCommunityFeePending();
      expect(pending0).to.eq(0);
      expect(pending1).to.eq(0);
    });

    it('exactOut delivers the full amount across several initialized ticks', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await mint(wallet.address, minTick, maxTick, expandTo18Decimals(2));
      await mint(wallet.address, -600, 600, expandTo18Decimals(2));
      await mint(wallet.address, 600, 1200, expandTo18Decimals(2));
      await pool.setFeeMode(FEE_MODE_TOKEN0);

      const requested = expandTo18Decimals(1) / 2n;
      const balance1Before = await token1.balanceOf(wallet.address);
      await expect(swap1ForExact0(requested, wallet.address)).to.changeTokenBalance(token0, wallet, requested);

      expect(balance1Before - (await token1.balanceOf(wallet.address))).to.eq(598584731605189978n);
      expect(await pool.totalFeeGrowth0Token()).to.eq(32648803644318831998769253068493049n);
      expect(await pool.totalFeeGrowth1Token()).to.eq(0);
      expect((await pool.globalState()).tick).to.eq(4261);
      // the fee carved out of the output stays in the pool and is accounted for in the reserves
      expect(await pool.getReserves()).to.deep.eq([await token0.balanceOf(pool), await token1.balanceOf(pool)]);
    });

    it('the trader never gets more from the fee on the output than from the fee on the input', async () => {
      const amount = expandTo18Decimals(1) / 10n;

      await initializeWithLiquidity(FEE_MODE_DEFAULT);
      const balanceBeforeDefault = await token1.balanceOf(wallet.address);
      await swapExact0For1(amount, wallet.address);
      const receivedDefault = (await token1.balanceOf(wallet.address)) - balanceBeforeDefault;

      // a fresh pool in the other mode, same starting state
      pool = await (await loadFixture(poolFixture)).createPool();
      ({ swapExact0For1, swapExact1For0, swap0ForExact1, swap1ForExact0, mint } = createPoolFunctions({
        token0,
        token1,
        swapTarget,
        pool,
      }));
      await initializeWithLiquidity(FEE_MODE_TOKEN1);
      const balanceBeforeOnOutput = await token1.balanceOf(wallet.address);
      await swapExact0For1(amount, wallet.address);
      const receivedOnOutput = (await token1.balanceOf(wallet.address)) - balanceBeforeOnOutput;

      // forced by the concavity of the curve
      expect(receivedDefault).to.eq(95192742684349627n);
      expect(receivedOnOutput).to.eq(95190476190476190n);
      expect(receivedOnOutput).to.be.lt(receivedDefault);
    });
  });

  describe('#swapWithPaymentInAdvance', () => {
    it('routes the fee to token1 in token1 mode on a 0 -> 1 swap', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN1);
      await pool.setCommunityFee(100);

      await swapExact0For1SupportingFee(expandTo18Decimals(1) / 10n, wallet.address);

      expect(await pool.totalFeeGrowth1Token()).to.eq(7291765005448875806996267838374155n);
      expect(await pool.totalFeeGrowth0Token()).to.eq(0);
      const [fee0, fee1] = await pool.getCommunityFeePending();
      expect(fee1).to.eq(4761904761904n);
      expect(fee0).to.eq(0);
    });

    it('routes the fee to token0 in token0 mode on a 1 -> 0 swap', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN0);
      await pool.setCommunityFee(100);

      await swapExact1For0SupportingFee(expandTo18Decimals(1) / 10n, wallet.address);

      expect(await pool.totalFeeGrowth0Token()).to.eq(7291765005448875806996267838374155n);
      expect(await pool.totalFeeGrowth1Token()).to.eq(0);
      const [fee0, fee1] = await pool.getCommunityFeePending();
      expect(fee0).to.eq(4761904761904n);
      expect(fee1).to.eq(0);
    });

    it('refunds the leftovers and still charges the fee in the fee token', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN1);
      await pool.setCommunityFee(100);

      const paid0Before = await token0.balanceOf(wallet.address);
      // the limit price stops the swap long before the budget is used up
      await expect(
        swapExact0For1SupportingFee(expandTo18Decimals(1), wallet.address, encodePriceSqrt(999, 1000))
      ).to.changeTokenBalance(token1, wallet, 999750000015639n);

      expect(paid0Before - (await token0.balanceOf(wallet.address))).to.eq(1000750625547368n);
      expect((await pool.globalState()).price).to.eq(encodePriceSqrt(999, 1000));
      expect(await pool.getReserves()).to.deep.eq([2001000750625547368n, 1999000249999984361n]);

      expect(await pool.totalFeeGrowth1Token()).to.eq(76582683016917109323800278743567n);
      expect(await pool.totalFeeGrowth0Token()).to.eq(0);
      const [fee0, fee1] = await pool.getCommunityFeePending();
      expect(fee1).to.eq(50012506254n);
      expect(fee0).to.eq(0);
    });
  });

  describe('community fee routing', () => {
    it('lands in token0 in token0 mode, whichever way the swap goes', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN0);
      await pool.setCommunityFee(100); // set after initialize, which applies the default configuration

      // token1 in, token0 out: the fee token is the output token here
      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      let [fee0, fee1] = await pool.getCommunityFeePending();
      expect(fee0).to.eq(4761904761904n);
      expect(fee1).to.eq(0);

      // and back with token0 in, where it is the input token
      await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);
      [fee0, fee1] = await pool.getCommunityFeePending();
      expect(fee0).to.eq(4761904761904n + 5000000000000n); // the fee on the input is the larger one
      expect(fee1).to.eq(0);
    });

    it('lands in token1 in token1 mode, whichever way the swap goes', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN1);
      await pool.setCommunityFee(100); // set after initialize, which applies the default configuration

      // token0 in, token1 out: the fee token is the output token here
      await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);
      let [fee0, fee1] = await pool.getCommunityFeePending();
      expect(fee1).to.eq(4761904761904n);
      expect(fee0).to.eq(0);

      // and back with token1 in, where it is the input token
      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      [fee0, fee1] = await pool.getCommunityFeePending();
      expect(fee1).to.eq(4761904761904n + 5000000000000n); // the fee on the input is the larger one
      expect(fee0).to.eq(0);
    });

    it('the vault claims both slots when the mode changed in between', async () => {
      await initializeWithLiquidity(FEE_MODE_DEFAULT);
      await pool.setCommunityFee(100);

      // the fee is in the input token, then in token0 after the mode change
      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      await pool.setFeeMode(FEE_MODE_TOKEN0);
      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      expect(await pool.getCommunityFeePending()).to.deep.eq([4329205794030n, 5000000000000n]);

      const vault = await ethers.getContractAt('AlgebraCommunityVault', vaultAddress);
      await vault.claimCommunityFees([pool]);

      expect(await pool.getCommunityFeePending()).to.deep.eq([0n, 0n]);
      expect(await token0.balanceOf(vaultAddress)).to.eq(4329205794030n);
      expect(await token1.balanceOf(vaultAddress)).to.eq(5000000000000n);
    });
  });

  describe('positions', () => {
    it('a position converted into the other token is still owed the fee in the fee token', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN0);
      await mint(wallet.address, 0, 120, expandTo18Decimals(1));

      // the swap takes the whole single sided position, so it ends up entirely in token1
      await swapExact1For0(expandTo18Decimals(2), other.address);
      await expect(pool.burn(0, 120, expandTo18Decimals(1), '0x'))
        .to.emit(pool, 'Burn')
        .withArgs(wallet.address, 0, 120, expandTo18Decimals(1), 0, 6017734268818165n);

      const { fees0, fees1 } = await pool.positions(await getPositionKey(wallet.address, 0, 120, pool));
      expect(fees0).to.eq(2990868880254n);
      expect(fees1).to.eq(6017734268818165n);

      // the default mode would have paid this out in token1 alone, here the fee leaves in token0
      const before = [await token0.balanceOf(wallet.address), await token1.balanceOf(wallet.address)];
      await pool.collect(wallet.address, 0, 120, MaxUint128, MaxUint128);
      expect((await token0.balanceOf(wallet.address)) - before[0]).to.eq(fees0);
      expect((await token1.balanceOf(wallet.address)) - before[1]).to.eq(fees1);
    });

    it('can still collect what was accrued in the other token before the mode changed', async () => {
      await initializeWithLiquidity(FEE_MODE_DEFAULT);

      // accrue in token1 under the default mode
      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      await pool.setFeeMode(FEE_MODE_TOKEN0);
      // and in token0 under the new mode, which leaves the token1 accumulator where the switch left it
      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      expect(await pool.totalFeeGrowth0Token()).to.eq(7365761972403377305404778279035523n);
      expect(await pool.totalFeeGrowth1Token()).to.eq(8507059173023461586584365185794205n);

      // neither claim is lost by the switch: the only position earns both accumulators in full, rounded down
      await pool.burn(minTick, maxTick, 0, '0x');
      const { fees0, fees1 } = await pool.positions(await getPositionKey(wallet.address, minTick, maxTick, pool));
      expect(fees0).to.eq(43292057940308n);
      expect(fees1).to.eq(49999999999999n);

      const tx = pool.collect(wallet.address, minTick, maxTick, MaxUint128, MaxUint128);
      await expect(tx).to.changeTokenBalances(token0, [wallet, pool], [fees0, -fees0]);
      await expect(tx).to.changeTokenBalances(token1, [wallet, pool], [fees1, -fees1]);
    });
  });

  describe('with the dynamic fee', () => {
    let poolPlugin: MockPoolPlugin;

    beforeEach('connect a plugin', async () => {
      poolPlugin = (await (await ethers.getContractFactory('MockPoolPlugin')).deploy(pool)) as any as MockPoolPlugin;
      await pool.setPlugin(poolPlugin);
      await pool.setPluginConfig(1 | 128); // BEFORE_SWAP | DYNAMIC_FEE
    });

    it('the largest dynamic fee leaves a millionth of the output, exactIn and exactOut alike', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN1);
      await poolPlugin.setDynamicFee(999999);

      // the curve gives out 95238095238095238, the trader keeps a millionth of it
      await expect(swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address)).to.changeTokenBalance(
        token1,
        wallet,
        95238095238n
      );

      // the requested amount still arrives in full, so the curve has to give out a million times more
      const growthBefore = await pool.totalFeeGrowth1Token();
      await expect(swap0ForExact1(1000, wallet.address)).to.changeTokenBalance(token1, wallet, 1000);
      expect((await pool.totalFeeGrowth1Token()) - growthBefore).to.eq(
        ((10n ** 9n - 1000n) * 2n ** 128n) / expandTo18Decimals(2)
      );
      expect(await pool.totalFeeGrowth0Token()).to.eq(0);
    });
  });

  describe('with plugin deltas', () => {
    let poolPlugin: MockPoolPlugin;

    beforeEach('connect a plugin', async () => {
      poolPlugin = (await (await ethers.getContractFactory('MockPoolPlugin')).deploy(pool)) as any as MockPoolPlugin;
      await pool.setPlugin(poolPlugin);
      await pool.setPluginConfig(512); // AFTER_SWAP_CALCULATION
    });

    it('amountOutDecrease is capped by the output left after the fee', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN1);
      await pool.setCommunityFee(100);
      const amount = expandTo18Decimals(1) / 10n;
      // what this swap hands over once the fee is taken from token1
      const outputAfterFee = 95190476190476190n;

      // still below the output before the fee, but more than the trader is owed
      await poolPlugin.setAmountOutDecrease(outputAfterFee + 1n);
      await expect(swapExact0For1(amount, wallet.address)).to.be.revertedWithCustomError(
        pool,
        'invalidAmountOutDecrease'
      );

      await poolPlugin.setAmountOutDecrease(outputAfterFee);
      const tx = await swapExact0For1(amount, wallet.address);
      await expect(tx).to.changeTokenBalances(token1, [wallet, poolPlugin], [0, outputAfterFee]);
      await expect(tx).to.changeTokenBalances(token0, [wallet, poolPlugin], [-amount, 0]);
      expect(await pool.getCommunityFeePending()).to.deep.eq([0n, 4761904761904n]);
    });
  });
});
