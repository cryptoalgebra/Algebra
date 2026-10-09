import { ethers } from 'hardhat';
import { expect } from './shared/expect';
import { encodePriceSqrt, expandTo18Decimals, MIN_SQRT_RATIO } from './shared/utilities';
import {
  AssertDeltasEchidnaTest,
  AssertFeeModeSwapEchidnaTest,
  PropFeeTokenIsolationEchidnaTest,
  PropReservesEchidnaTest,
} from '../typechain';

// The fuzzing suites run under echidna in CI, so nothing else checks the assumptions they are written under.
// These cases drive the harness contracts directly and pin the ones that were silently false.
describe('echidna pool harnesses', () => {
  const liquidity = expandTo18Decimals(1);
  const payment = expandTo18Decimals(10);

  describe('PoolMockEchidna', () => {
    const deployReservesSuite = async () =>
      (await (await ethers.getContractFactory('PropReservesEchidnaTest')).deploy()) as any as PropReservesEchidnaTest;

    it('initializes through its own extension, at a price folded into the valid range', async () => {
      const suite = await deployReservesSuite();
      await suite.initializeWrapped(0);

      const { price, lastFee } = await suite.globalState();
      expect(price).to.eq(MIN_SQRT_RATIO);
      expect(lastFee).to.eq(100);
      expect(await suite.tickSpacing()).to.eq(1);
    });

    it('turns the community fee on with a vault of its own, at a fee folded into the valid range', async () => {
      const suite = await deployReservesSuite();
      await suite.setCommunityFeeWrapped(1001 + 250);
      expect(await suite.communityVault()).to.eq('0x000000000000000000000000000000000000dEaD');
      expect((await suite.globalState()).communityFee).to.eq(250);

      // the same fee again is skipped instead of reverting, and a vault set before is kept
      await suite.setCommunityFeeWrapped(250);
      await suite.setCommunityVault('0x0000000000000000000000000000000000000001');
      await suite.setCommunityFeeWrapped(0);
      expect(await suite.communityVault()).to.eq('0x0000000000000000000000000000000000000001');
      expect((await suite.globalState()).communityFee).to.eq(0);
    });

    it('claims the community fee as its own vault and puts the vault back', async () => {
      const suite = await deployReservesSuite();
      await suite.initializeWrapped(2n ** 96n);
      await suite.mintWrapped(-600, 600, liquidity, payment, payment);
      // there is no vault to claim for yet
      await expect(suite.claimCommunityFeeWrapped()).to.be.revertedWithoutReason();

      const vault = '0x000000000000000000000000000000000000dEaD';
      await suite.setCommunityFeeWrapped(100);
      await suite.swap(suite, true, expandTo18Decimals(1) / 100n, encodePriceSqrt(99, 100), '0x');
      const [pending0, pending1] = await suite.getCommunityFeePending();
      expect(pending0).to.be.gt(0);
      const [reserve0, reserve1] = await suite.getReserves();

      await expect(suite.claimCommunityFeeWrapped())
        .to.emit(suite, 'CommunityFeeTransfer')
        .withArgs(await suite.getAddress(), pending0, pending1);
      expect(await suite.communityVault()).to.eq(vault);
      expect(await suite.getCommunityFeePending()).to.deep.eq([0n, 0n]);
      expect(await suite.getReserves()).to.deep.eq([reserve0 - pending0, reserve1 - pending1]);
      expect(await suite.echidna_check_balance0_reserve0()).to.eq(true);
      expect(await suite.echidna_check_balance1_reserve1()).to.eq(true);
    });
  });

  describe('PropFeeTokenIsolationEchidnaTest', () => {
    let suite: PropFeeTokenIsolationEchidnaTest;

    beforeEach('deploy and seed the harness', async () => {
      const factory = await ethers.getContractFactory('PropFeeTokenIsolationEchidnaTest');
      suite = (await factory.deploy()) as any as PropFeeTokenIsolationEchidnaTest;
      await suite.initialize(encodePriceSqrt(1, 1));
      await suite.mintAroundCurrentTickWrapped(6000, liquidity, payment, payment);
    });

    it('starts with the fee token pinned to token0', async () => {
      expect((await suite.globalState()).feeMode).to.eq(1);
      expect(await suite.echidna_check_other_token_never_accrues_fees()).to.be.true;
      expect(await suite.echidna_check_pending_fees_are_in_fee_token_only()).to.be.true;
    });

    it('holds while swaps run in both directions', async () => {
      await suite.swap(suite, true, expandTo18Decimals(1) / 100n, encodePriceSqrt(99, 100), '0x');
      await suite.swap(suite, false, expandTo18Decimals(1) / 100n, encodePriceSqrt(101, 100), '0x');

      expect(await suite.totalFeeGrowth0Token()).to.be.gt(0);
      expect(await suite.echidna_check_other_token_never_accrues_fees()).to.be.true;
      expect(await suite.echidna_check_pending_fees_are_in_fee_token_only()).to.be.true;
    });

    it('holds when a flash is taken, because the harness keeps it on the token0 side', async () => {
      // the argument is dropped by the override, so the token1 accumulator cannot move
      await suite.flashWrapped(suite, expandTo18Decimals(1) / 100n, expandTo18Decimals(1) / 100n);
      // a flash only leaves the fee as an excess balance: the next operation is what sweeps it into fee growth
      await suite.swap(suite, true, expandTo18Decimals(1) / 100n, encodePriceSqrt(99, 100), '0x');

      expect(await suite.totalFeeGrowth1Token()).to.eq(0);
      expect(await suite.echidna_check_other_token_never_accrues_fees()).to.be.true;
    });

    it('holds when a range that takes only token0 is also paid token1, because the harness credits what was owed', async () => {
      // the pool refunds overpayment only in tokens the range needs, so the token1 here would stay as an excess
      await suite.mintWrapped(6000, 6060, liquidity, payment, payment);
      await suite.swap(suite, true, expandTo18Decimals(1) / 100n, encodePriceSqrt(99, 100), '0x');

      expect(await suite.totalFeeGrowth1Token()).to.eq(0);
      expect(await suite.echidna_check_other_token_never_accrues_fees()).to.be.true;
    });

    it('holds when a payment in advance for token0 also sends token1, because the harness credits what was owed', async () => {
      const amount = expandTo18Decimals(1) / 100n;
      await suite.swapWithPaymentInAdvanceWrapped(true, amount, encodePriceSqrt(99, 100), amount, payment);
      await suite.swap(suite, true, amount, encodePriceSqrt(98, 100), '0x');

      expect(await suite.totalFeeGrowth1Token()).to.eq(0);
      expect(await suite.echidna_check_other_token_never_accrues_fees()).to.be.true;
    });

    it('would not hold after a raw flash that pays token1, which is why the config blacklists the pool flash', async () => {
      // the callback credits whatever the data names, and a flash keeps what it was paid as its fee
      const data = ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256'], [0, 1000]);
      await suite.flash(suite, 0, 0, data);
      await suite.swap(suite, true, expandTo18Decimals(1) / 100n, encodePriceSqrt(99, 100), '0x');

      expect(await suite.echidna_check_other_token_never_accrues_fees()).to.be.false;
    });

    it('would not hold if a sequence could move the fee mode, which is why the config blacklists the setters', async () => {
      // both entry points are reachable: the harness inherits the whole pool and accepts every caller as an administrator
      await suite.setFeeMode(2);
      await suite.swap(suite, false, expandTo18Decimals(1) / 100n, encodePriceSqrt(101, 100), '0x');

      expect(await suite.totalFeeGrowth1Token()).to.be.gt(0);
      expect(await suite.echidna_check_other_token_never_accrues_fees()).to.be.false;
    });
  });

  describe('AssertFeeModeSwapEchidnaTest', () => {
    let suite: AssertFeeModeSwapEchidnaTest;

    beforeEach('deploy and seed the harness', async () => {
      const factory = await ethers.getContractFactory('AssertFeeModeSwapEchidnaTest');
      suite = (await factory.deploy()) as any as AssertFeeModeSwapEchidnaTest;
      await suite.initialize(encodePriceSqrt(1, 1));
      await suite.mintAroundCurrentTickWrapped(6000, liquidity, payment, payment);
    });

    it('runs the zero fee check at the default rate and puts the rate back', async () => {
      // the default rate is 100, so requiring a zero rate instead of setting one left this unreached
      expect((await suite.globalState()).lastFee).to.eq(100);

      await suite.swapWithoutFeeWrapped(true, expandTo18Decimals(1) / 100n, encodePriceSqrt(99, 100));

      expect((await suite.globalState()).lastFee).to.eq(100);
      expect(await suite.totalFeeGrowth0Token()).to.eq(0);
      expect(await suite.totalFeeGrowth1Token()).to.eq(0);
    });

    it('checks the fee token of a whole swap in both directions', async () => {
      await suite.swapAndCheckFeeTokenWrapped(true, expandTo18Decimals(1) / 100n, encodePriceSqrt(99, 100));
      await suite.swapAndCheckFeeTokenWrapped(false, expandTo18Decimals(1) / 100n, encodePriceSqrt(101, 100));

      // the default mode takes the fee from the input, so both accumulators moved
      expect(await suite.totalFeeGrowth0Token()).to.be.gt(0);
      expect(await suite.totalFeeGrowth1Token()).to.be.gt(0);
    });

    it('lets the input of an exactIn swap that cannot move the price become the fee, in the fee token only', async () => {
      // the counterexample echidna found: at this price 1 wei of token1 cannot move the sqrt price by one unit
      const fresh = (await (
        await ethers.getContractFactory('AssertFeeModeSwapEchidnaTest')
      ).deploy()) as any as AssertFeeModeSwapEchidnaTest;
      await fresh.initializeWrapped(5774619113608n);
      await fresh.mintAroundCurrentTickWrapped(
        1,
        81834140674865963342729282033n,
        23047810124949406296762716242700818808504636n,
        777359109n
      );

      await fresh.swapWithoutFeeWrapped(false, 1, 0);
      expect(await fresh.totalFeeGrowth1Token()).to.eq(2n ** 128n / 81834140674865963342729282033n);
      expect(await fresh.totalFeeGrowth0Token()).to.eq(0);
    });

    it('can always drain every position and still pay the pending community fee, without changing the pool', async () => {
      await suite.mintAroundCurrentTickWrapped(600, liquidity, payment, payment);
      await suite.setCommunityVault('0x000000000000000000000000000000000000dEaD');
      await suite.setCommunityFee(100);
      const amount = expandTo18Decimals(1) / 10n;
      for (const mode of [0, 1, 2]) {
        await suite.setFeeModeWrapped(mode);
        await suite.swapExactInWrapped(true, amount, 0);
        await suite.swapExactOutWrapped(false, amount, 2n ** 160n - 1n);
      }

      const before = [await suite.liquidity(), await suite.getReserves(), await suite.getCommunityFeePending()];
      await suite.checkSolvencyWrapped();
      expect([await suite.liquidity(), await suite.getReserves(), await suite.getCommunityFeePending()]).to.deep.eq(before);
    });

    it('keeps at most 16 positions, which is why only this suite tracks them', async () => {
      // the range from beforeEach is the first one
      for (let tick = 1; tick < 16; tick++) await suite.mintWrapped(-tick, tick, 1000, payment, payment);
      await expect(suite.mintWrapped(-16, 16, 1000, payment, payment)).to.be.revertedWithoutReason();

      // a suite that does not track them mints as many ranges as it likes
      const other = (await (
        await ethers.getContractFactory('PropReservesEchidnaTest')
      ).deploy()) as any as PropReservesEchidnaTest;
      await other.initializeWrapped(2n ** 96n);
      for (let tick = 1; tick <= 17; tick++) await other.mintWrapped(-tick, tick, 1000, payment, payment);
    });

    for (const check of ['swapAndCheckFeeTokenWrapped', 'swapWithoutFeeWrapped'] as const) {
      it(`skips ${check} while an excess waits to be swept, and runs it once a swap has settled it`, async () => {
        // a token1 swap would sweep this token0 donation into the token0 accumulator, which is not its own fee
        await suite.donate(1, 0);
        await expect(suite[check](false, expandTo18Decimals(1) / 100n, encodePriceSqrt(101, 100))).to.be.revertedWithoutReason();

        await suite.swap(suite, true, expandTo18Decimals(1) / 100n, encodePriceSqrt(99, 100), '0x');
        await suite[check](false, expandTo18Decimals(1) / 100n, encodePriceSqrt(101, 100));
      });
    }
  });

  describe('AssertDeltasEchidnaTest', () => {
    let suite: AssertDeltasEchidnaTest;
    const amount = expandTo18Decimals(1) / 100n;

    beforeEach('deploy and seed the harness', async () => {
      const factory = await ethers.getContractFactory('AssertDeltasEchidnaTest');
      suite = (await factory.deploy()) as any as AssertDeltasEchidnaTest;
      await suite.mintAroundCurrentTickWrapped(6000, liquidity, payment, payment);
    });

    it('starts initialized, with the delta plugin connected and the dynamic fee on', async () => {
      const { price, tick, lastFee, pluginConfig } = await suite.globalState();
      expect([price, tick, lastFee, pluginConfig]).to.deep.eq([2n ** 96n, 0n, 100n, BigInt(1 | 2 | 128 | 512)]);
      expect(await suite.tickSpacing()).to.eq(1);
    });

    it('runs the deltas check in every fee mode, in both directions, exactIn, exactOut and with the payment in advance', async () => {
      // a community fee as well, so that the vault and the fee token checks have something to see
      await suite.setCommunityVault('0x000000000000000000000000000000000000dEaD');
      await suite.setCommunityFee(100);
      await suite.setDeltasWrapped(10000, 30000, 20000, 0, 0);

      for (const mode of [0, 1, 2]) {
        await suite.setFeeModeWrapped(mode);
        for (const dynamicFee of [0, 3000]) {
          await suite.setDynamicFeeWrapped(dynamicFee);
          await suite.swapWithDeltasWrapped(true, amount, 0);
          await suite.swapWithDeltasWrapped(false, amount, 2n ** 160n - 1n);
          await suite.swapWithDeltasWrapped(true, -amount, 0);
          await suite.swapWithDeltasWrapped(false, -amount, 2n ** 160n - 1n);
          await suite.swapWithPaymentInAdvanceDeltasWrapped(true, amount, 0);
          await suite.swapWithPaymentInAdvanceDeltasWrapped(false, amount, 2n ** 160n - 1n);
        }
      }
    });

    it('applies the dynamic fee to the checked swaps', async () => {
      await suite.setDynamicFeeWrapped(3000);
      await expect(suite.swapWithDeltasWrapped(true, amount, 0))
        .to.emit(suite, 'SwapFee')
        .withArgs(await suite.getAddress(), 3000);
      await expect(suite.swapWithPaymentInAdvanceDeltasWrapped(false, amount, 2n ** 160n - 1n))
        .to.emit(suite, 'SwapFee')
        .withArgs(await suite.getAddress(), 3000);
    });

    it('returns the leftovers of a payment in advance stopped by the price limit', async () => {
      await suite.setDeltasWrapped(10000, 0, 500000, 0, 0);
      const reservesBefore = await suite.getReserves();
      await suite.swapWithPaymentInAdvanceDeltasWrapped(true, expandTo18Decimals(1), encodePriceSqrt(99, 100));

      // about half a percent of the amount paid upfront reached the pool, the wrapper checks the rest came back
      expect((await suite.globalState()).price).to.eq(encodePriceSqrt(99, 100));
      const reservesAfter = await suite.getReserves();
      expect([reservesAfter[0] - reservesBefore[0], reservesAfter[1] - reservesBefore[1]]).to.deep.eq([
        5037815259212076n,
        -5012562893380045n,
      ]);
    });

    // one delta the addend steps over its bound: [inDecreaseShare, outDecreaseShare, addend, target, exactIn, error]
    for (const [inShare, outShare, addend, target, exactIn, error] of [
      [999999, 0, 255, 0, true, 'invalidAmountInDecrease'], // reaches the whole amount
      [0, 0, 1, 0, false, 'invalidAmountInDecrease'], // exactOut may not have it at all
      [0, 0, 1, 1, true, 'invalidAmountInIncrease'], // exactIn may not have it at all
      [0, 1000000, 1, 2, true, 'invalidAmountOutDecrease'], // more than the whole output
      [0, 0, 1, 2, false, 'invalidAmountOutDecrease'], // exactOut may not have it at all
    ] as const) {
      it(`reverts a swap with a delta over its bound (target ${target}, ${exactIn ? 'exactIn' : 'exactOut'})`, async () => {
        await suite.setDeltasWrapped(inShare, 0, outShare, addend, target);
        await expect(suite.swapWithDeltasWrapped(true, exactIn ? 1000 : -1000, 0)).to.be.revertedWithCustomError(
          suite,
          error
        );
      });
    }
  });
});
