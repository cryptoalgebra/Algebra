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

import { TestERC20, AlgebraFactory, MockTimeAlgebraPool, TestAlgebraCallee } from '../typechain';

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

const FEE_MODE_DEFAULT = 0;
const FEE_MODE_TOKEN0 = 1;
const FEE_MODE_TOKEN1 = 2;

describe('AlgebraPool fee mode', () => {
  let wallet: Wallet, other: Wallet;

  let token0: TestERC20;
  let token1: TestERC20;
  let factory: AlgebraFactory;
  let pool: MockTimeAlgebraPool;
  let swapTarget: TestAlgebraCallee;
  let vaultAddress: string;

  let swapExact0For1: SwapFunction;
  let swapExact1For0: SwapFunction;
  let swap0ForExact1: SwapFunction;
  let swap1ForExact0: SwapFunction;
  let mint: MintFunction;

  let minTick: number;
  let maxTick: number;

  beforeEach('deploy fixture', async () => {
    [wallet, other] = await (ethers as any).getSigners();
    let vault;
    let _createPool: ThenArg<ReturnType<typeof poolFixture>>['createPool'];
    ({ token0, token1, factory, vault, createPool: _createPool, swapTargetCallee: swapTarget } = await loadFixture(poolFixture));
    vaultAddress = await vault.getAddress();

    pool = await _createPool();
    ({ swapExact0For1, swapExact1For0, swap0ForExact1, swap1ForExact0, mint } = createPoolFunctions({
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
    });

    it('can be set back to the default', async () => {
      await pool.setFeeMode(FEE_MODE_TOKEN1);
      await expect(pool.setFeeMode(FEE_MODE_DEFAULT)).to.emit(pool, 'FeeMode').withArgs(FEE_MODE_DEFAULT);
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
  });

  describe('fee growth routing', () => {
    it('default mode accrues in the input token of each swap', async () => {
      await initializeWithLiquidity();

      await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);
      expect(await pool.totalFeeGrowth0Token()).to.be.gt(0);
      expect(await pool.totalFeeGrowth1Token()).to.eq(0);

      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      expect(await pool.totalFeeGrowth1Token()).to.be.gt(0);
    });

    it('token0 mode accrues in token0 in both directions', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN0);

      await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);
      const afterZeroForOne = await pool.totalFeeGrowth0Token();
      expect(afterZeroForOne).to.be.gt(0);
      expect(await pool.totalFeeGrowth1Token()).to.eq(0);

      // token0 is now the output token, the fee still has to land in token0
      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      expect(await pool.totalFeeGrowth0Token()).to.be.gt(afterZeroForOne);
      expect(await pool.totalFeeGrowth1Token()).to.eq(0);
    });

    it('token1 mode accrues in token1 in both directions', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN1);

      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      const afterOneForZero = await pool.totalFeeGrowth1Token();
      expect(afterOneForZero).to.be.gt(0);
      expect(await pool.totalFeeGrowth0Token()).to.eq(0);

      await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);
      expect(await pool.totalFeeGrowth1Token()).to.be.gt(afterOneForZero);
      expect(await pool.totalFeeGrowth0Token()).to.eq(0);
    });

    it('a swap that crosses ticks still accrues only in the fee token', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await pool.setFeeMode(FEE_MODE_TOKEN0);
      await mint(wallet.address, minTick, maxTick, expandTo18Decimals(2));
      await mint(wallet.address, -600, 600, expandTo18Decimals(2));
      await mint(wallet.address, -1200, -600, expandTo18Decimals(2));

      // large enough to cross several initialized ticks
      await swapExact1For0(expandTo18Decimals(1), wallet.address);

      expect(await pool.totalFeeGrowth0Token()).to.be.gt(0);
      expect(await pool.totalFeeGrowth1Token()).to.eq(0);
    });
  });

  describe('amounts seen by the trader', () => {
    it('exactIn puts the whole budget on the curve when the fee is on the output', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN1);
      const amount = expandTo18Decimals(1) / 10n;

      await expect(swapExact0For1(amount, wallet.address)).to.changeTokenBalance(token0, wallet, -amount);
    });

    it('exactOut delivers exactly the requested amount when the fee is on the output', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN1);
      const requested = expandTo18Decimals(1) / 100n;

      // the fee is carved out of token1, the recipient must still get the requested amount
      await expect(swap0ForExact1(requested, wallet.address)).to.changeTokenBalance(token1, wallet, requested);
    });

    it('exactOut delivers exactly the requested amount in the other direction too', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN0);
      const requested = expandTo18Decimals(1) / 100n;

      await expect(swap1ForExact0(requested, wallet.address)).to.changeTokenBalance(token0, wallet, requested);
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
      expect(receivedOnOutput).to.be.lte(receivedDefault);
    });
  });

  describe('community fee routing', () => {
    // the accrued fee is either sent to the vault straight away or held as pending, so both are summed up
    async function collectedCommunityFee() {
      const [pending0, pending1] = await pool.getCommunityFeePending();
      return [
        pending0 + (await token0.balanceOf(vaultAddress)),
        pending1 + (await token1.balanceOf(vaultAddress)),
      ];
    }

    it('lands in token0 in token0 mode, whichever way the swap goes', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN0);
      await pool.setCommunityFee(100); // set after initialize, which applies the default configuration

      // token1 in, token0 out: the fee token is the output token here
      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);

      const [fee0, fee1] = await collectedCommunityFee();
      expect(fee0).to.be.gt(0);
      expect(fee1).to.eq(0);
    });

    it('lands in token1 in token1 mode, whichever way the swap goes', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN1);
      await pool.setCommunityFee(100); // set after initialize, which applies the default configuration

      // token0 in, token1 out: the fee token is the output token here
      await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);

      const [fee0, fee1] = await collectedCommunityFee();
      expect(fee1).to.be.gt(0);
      expect(fee0).to.eq(0);
    });

    it('lands in the input token in the default mode', async () => {
      await initializeWithLiquidity(FEE_MODE_DEFAULT);
      await pool.setCommunityFee(100); // set after initialize, which applies the default configuration

      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);

      const [fee0, fee1] = await collectedCommunityFee();
      expect(fee1).to.be.gt(0);
      expect(fee0).to.eq(0);
    });
  });

  describe('positions', () => {
    it('collect the fee in the fee token regardless of the swap direction', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN0);

      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      await pool.burn(minTick, maxTick, 0, '0x');

      const { fees0, fees1 } = await pool.positions(await getPositionKey(wallet.address, minTick, maxTick, pool));
      expect(fees0).to.be.gt(0);
      expect(fees1).to.eq(0);
    });

    it('can still collect what was accrued in the other token before the mode changed', async () => {
      await initializeWithLiquidity(FEE_MODE_DEFAULT);

      // accrue in token1 under the default mode
      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);
      await pool.setFeeMode(FEE_MODE_TOKEN0);
      // and in token0 under the new mode
      await swapExact1For0(expandTo18Decimals(1) / 10n, wallet.address);

      await pool.burn(minTick, maxTick, 0, '0x');
      const { fees0, fees1 } = await pool.positions(await getPositionKey(wallet.address, minTick, maxTick, pool));

      // neither claim is lost by the switch
      expect(fees0).to.be.gt(0);
      expect(fees1).to.be.gt(0);

      await expect(pool.collect(wallet.address, minTick, maxTick, MaxUint128, MaxUint128)).to.not.be.reverted;
    });
  });

  describe('solvency', () => {
    it('the pool keeps at least what it owes after a swap with the fee on the output', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN1);

      await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);

      const poolAddress = await pool.getAddress();
      const [reserve0, reserve1] = await pool.getReserves();
      expect(await token0.balanceOf(poolAddress)).to.be.gte(reserve0);
      expect(await token1.balanceOf(poolAddress)).to.be.gte(reserve1);
    });

    it('the retained fee is backed by tokens the pool did not pay out', async () => {
      await initializeWithLiquidity(FEE_MODE_TOKEN1);
      const poolAddress = await pool.getAddress();

      const balance1Before = await token1.balanceOf(poolAddress);
      const walletBalance1Before = await token1.balanceOf(wallet.address);

      await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);

      const paidOut = walletBalance1Before === (await token1.balanceOf(wallet.address))
        ? 0n
        : (await token1.balanceOf(wallet.address)) - walletBalance1Before;

      // whatever left the pool is exactly what the trader received, the fee never leaves
      expect(balance1Before - (await token1.balanceOf(poolAddress))).to.eq(paidOut);
    });
  });
});
