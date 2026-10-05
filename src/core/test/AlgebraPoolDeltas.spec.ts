import { ethers } from 'hardhat';
import { MaxUint256 } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from './shared/expect';
import { poolFixture } from './shared/fixtures';
import {
  encodePriceSqrt,
  expandTo18Decimals,
  getMaxTick,
  getMinTick,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
} from './shared/utilities';
import { MockDeltaPlugin, MockTimeAlgebraPool, TestAlgebraCallee, TestERC20 } from '../typechain';

const SHARE = 1_000_000n;
const INT256_MAX = 2n ** 255n - 1n;

const BEFORE_SWAP = 1;
const AFTER_SWAP = 1 << 1;
const DYNAMIC_FEE = 1 << 7;
const AFTER_SWAP_CALCULATION = 1 << 9;
const DELTA_CONFIG = BEFORE_SWAP | AFTER_SWAP | AFTER_SWAP_CALCULATION;

const FEE_MODES = [0, 1, 2];
const FEES = [0, 1, 3000, 500000, 999999];
const TICK_SPACING = 60;

type Kind = 'exactIn' | 'exactOut' | 'payInAdvance';

interface Delta {
  value: bigint;
  isShare: boolean;
  addend: bigint;
}
interface Deltas {
  inDecrease: Delta;
  inIncrease: Delta;
  outDecrease: Delta;
}

const NONE: Delta = { value: 0n, isShare: false, addend: 0n };
const share = (value: bigint, addend = 0n): Delta => ({ value, isShare: true, addend });
const absolute = (value: bigint): Delta => ({ value, isShare: false, addend: 0n });
const deltas = (d: Partial<Deltas> = {}): Deltas => ({ inDecrease: NONE, inIncrease: NONE, outDecrease: NONE, ...d });
const applyDelta = (d: Delta, base: bigint) => (d.isShare ? (base * d.value) / SHARE : d.value) + d.addend;
const abs = (x: bigint) => (x < 0n ? -x : x);

interface Env {
  wallet: any;
  other: any;
  token0: TestERC20;
  token1: TestERC20;
  vault: any;
  swapTarget: TestAlgebraCallee;
  pool: MockTimeAlgebraPool;
  plugin: MockDeltaPlugin;
}

async function deploy(mintRanges: [number, number, bigint][]): Promise<Env> {
  const [wallet, other] = await (ethers as any).getSigners();
  const { token0, token1, vault, swapTargetCallee: swapTarget, createPool } = await poolFixture();
  const pool = await createPool();
  const plugin = (await (await ethers.getContractFactory('MockDeltaPlugin')).deploy()) as any as MockDeltaPlugin;
  await pool.setPlugin(plugin);
  await pool.setPluginConfig(DELTA_CONFIG | DYNAMIC_FEE);
  await pool.initialize(encodePriceSqrt(1, 1));
  await token0.approve(swapTarget, MaxUint256);
  await token1.approve(swapTarget, MaxUint256);
  for (const [bottom, top, liquidity] of mintRanges)
    await swapTarget.mint(pool, wallet.address, bottom, top, liquidity);
  return { wallet, other, token0, token1, vault, swapTarget, pool, plugin };
}

// full range liquidity around the current price
async function fullRangeFixture() {
  return deploy([[getMinTick(TICK_SPACING), getMaxTick(TICK_SPACING), expandTo18Decimals(10)]]);
}

// several narrow positions, so that a swap crosses initialized ticks
async function multiTickFixture() {
  const L = expandTo18Decimals(1);
  return deploy([
    [getMinTick(TICK_SPACING), getMaxTick(TICK_SPACING), L],
    [-1200, -600, L],
    [-600, 0, L],
    [0, 600, L],
    [600, 1200, L],
  ]);
}

// liquidity only above the current price, so the range below is empty
async function emptyBelowFixture() {
  return deploy([[600, 1200, expandTo18Decimals(10)]]);
}

async function setDeltas(env: Env, d: Deltas) {
  await env.plugin.setInDecrease(d.inDecrease.value, d.inDecrease.isShare, d.inDecrease.addend);
  await env.plugin.setInIncrease(d.inIncrease.value, d.inIncrease.isShare, d.inIncrease.addend);
  await env.plugin.setOutDecrease(d.outDecrease.value, d.outDecrease.isShare, d.outDecrease.addend);
}

async function setFee(env: Env, fee: number) {
  if (fee === 0) {
    // an override of 0 means "keep the pool fee", so a zero fee needs the static fee
    await env.pool.setPluginConfig(DELTA_CONFIG);
    await env.pool.setFee(0);
  } else {
    await env.plugin.setOverrideFee(fee);
  }
}

async function setFeeMode(env: Env, feeMode: number) {
  if (feeMode !== 0) await env.pool.setFeeMode(feeMode);
}

function send(env: Env, kind: Kind, zeroToOne: boolean, amount: bigint, limit?: bigint) {
  const { swapTarget, pool, other } = env;
  const limitSqrtPrice = limit ?? (zeroToOne ? MIN_SQRT_RATIO + 1n : MAX_SQRT_RATIO - 1n);
  const to = other.address;
  if (kind === 'exactIn')
    return zeroToOne
      ? swapTarget.swapExact0For1(pool, amount, to, limitSqrtPrice)
      : swapTarget.swapExact1For0(pool, amount, to, limitSqrtPrice);
  if (kind === 'exactOut')
    return zeroToOne
      ? swapTarget.swap0ForExact1(pool, amount, to, limitSqrtPrice)
      : swapTarget.swap1ForExact0(pool, amount, to, limitSqrtPrice);
  return zeroToOne
    ? swapTarget.swapExact0For1SupportingFee(pool, amount, to, limitSqrtPrice)
    : swapTarget.swapExact1For0SupportingFee(pool, amount, to, limitSqrtPrice);
}

async function snapshot(env: Env) {
  const holders: Record<string, string> = {
    payer: env.wallet.address,
    recipient: env.other.address,
    plugin: await env.plugin.getAddress(),
    pool: await env.pool.getAddress(),
    // the community fee can be sent here during the swap
    vault: await env.pool.communityVault(),
  };
  const out: Record<string, bigint[]> = {};
  for (const [name, address] of Object.entries(holders))
    out[name] = [await env.token0.balanceOf(address), await env.token1.balanceOf(address)];
  const [r0, r1] = await env.pool.getReserves();
  out.reserves = [r0, r1];
  out.feeGrowth = [await env.pool.totalFeeGrowth0Token(), await env.pool.totalFeeGrowth1Token()];
  return out;
}

interface Result {
  before: Record<string, bigint[]>;
  after: Record<string, bigint[]>;
  event: bigint[];
  callback: bigint[];
  seen: { amountRequired: bigint; withPaymentInAdvance: boolean; calc: bigint[]; afterSwap: bigint[] };
}

async function execute(env: Env, kind: Kind, zeroToOne: boolean, amount: bigint, limit?: bigint): Promise<Result> {
  const before = await snapshot(env);
  const receipt = await (await send(env, kind, zeroToOne, amount, limit)).wait();
  const after = await snapshot(env);

  const poolAddress = (await env.pool.getAddress()).toLowerCase();
  const calleeAddress = (await env.swapTarget.getAddress()).toLowerCase();
  let event: bigint[] = [];
  let callback: bigint[] = [];
  for (const log of receipt!.logs) {
    if (log.address.toLowerCase() === poolAddress) {
      const parsed = env.pool.interface.parseLog(log as any);
      if (parsed?.name === 'Swap') event = [parsed.args.amount0, parsed.args.amount1];
    } else if (log.address.toLowerCase() === calleeAddress) {
      const parsed = env.swapTarget.interface.parseLog(log as any);
      if (parsed?.name === 'SwapCallback') callback = [parsed.args.amount0Delta, parsed.args.amount1Delta];
    }
  }

  const seen = {
    amountRequired: await env.plugin.seenAmountRequired(),
    withPaymentInAdvance: await env.plugin.seenWithPaymentInAdvance(),
    calc: [await env.plugin.seenCalc0(), await env.plugin.seenCalc1()],
    afterSwap: [await env.plugin.seenAfterSwap0(), await env.plugin.seenAfterSwap1()],
  };
  return { before, after, event, callback, seen };
}

// the amounts calculated by the swap math and the deltas the plugin took, derived from what the hooks observed
function decompose(r: Result, zeroToOne: boolean, d: Deltas) {
  const [i, o] = zeroToOne ? [0, 1] : [1, 0];
  const calcIn = r.seen.calc[i];
  const calcOut = r.seen.calc[o];
  const amountInDecrease = applyDelta(d.inDecrease, abs(r.seen.amountRequired));
  const amountInIncrease = applyDelta(d.inIncrease, calcIn > 0n ? calcIn : 0n);
  const amountOutDecrease = applyDelta(d.outDecrease, calcOut < 0n ? -calcOut : 0n);
  return { i, o, calcIn, calcOut, amountInDecrease, amountInIncrease, amountOutDecrease };
}

// invariants that hold for every successful swap, including partially executed ones
function checkAccounting(r: Result, kind: Kind, zeroToOne: boolean, amount: bigint, d: Deltas) {
  const { i, o, calcIn, calcOut, amountInDecrease, amountInIncrease, amountOutDecrease } = decompose(r, zeroToOne, d);
  const change = (holder: string, token: number) => r.after[holder][token] - r.before[holder][token];

  expect(calcIn).to.be.gte(0n, 'swap math input');
  expect(calcOut).to.be.lte(0n, 'swap math output');

  // the user pays the swapped input plus the input side deltas, in the input token only
  expect(change('payer', i)).to.eq(-(calcIn + amountInDecrease + amountInIncrease), 'payer input');
  expect(change('payer', o)).to.eq(0n, 'payer output');
  expect(change('recipient', o)).to.eq(-calcOut - amountOutDecrease, 'recipient output');
  expect(change('recipient', i)).to.eq(0n, 'recipient input');
  expect(change('plugin', i)).to.eq(amountInDecrease + amountInIncrease, 'plugin input');
  expect(change('plugin', o)).to.eq(amountOutDecrease, 'plugin output');

  // the deltas never touch the pool: together with the community fee sent to the vault it moves exactly by the swap math amounts
  expect(change('pool', i) + change('vault', i)).to.eq(calcIn, 'pool input');
  expect(change('pool', o) + change('vault', o)).to.eq(calcOut, 'pool output');
  expect(change('reserves', 0)).to.eq(change('pool', 0), 'reserve0 change');
  expect(change('reserves', 1)).to.eq(change('pool', 1), 'reserve1 change');
  expect(r.after.reserves[0]).to.eq(r.after.pool[0], 'reserve0 == balance0');
  expect(r.after.reserves[1]).to.eq(r.after.pool[1], 'reserve1 == balance1');

  // the event and afterSwap show what the user paid and received
  const paid = calcIn + amountInDecrease + amountInIncrease;
  const received = calcOut + amountOutDecrease;
  const expected = zeroToOne ? [paid, received] : [received, paid];
  expect(r.event[0]).to.eq(expected[0], 'event amount0');
  expect(r.event[1]).to.eq(expected[1], 'event amount1');
  expect(r.seen.afterSwap[0]).to.eq(expected[0], 'afterSwap amount0');
  expect(r.seen.afterSwap[1]).to.eq(expected[1], 'afterSwap amount1');

  if (kind === 'payInAdvance') {
    // the whole amount is requested upfront, the leftovers are returned
    expect(r.callback[i]).to.eq(amount, 'prepaid amount');
    expect(r.callback[o]).to.eq(0n);
    expect(r.seen.withPaymentInAdvance).to.eq(true);
    expect(r.seen.amountRequired).to.eq(amount);
  } else {
    // a single callback with what the user pays
    expect(r.callback[0]).to.eq(expected[0], 'callback amount0');
    expect(r.callback[1]).to.eq(expected[1], 'callback amount1');
    expect(r.seen.withPaymentInAdvance).to.eq(false);
    expect(r.seen.amountRequired).to.eq(kind === 'exactIn' ? amount : -amount);
  }

  // on exact input the user never pays more than requested, even with the plugin deltas
  if (kind !== 'exactOut') expect(paid).to.be.lte(amount, 'paid <= amountRequired');

  return { calcIn, calcOut, amountInDecrease, amountInIncrease, amountOutDecrease, paid, received };
}

const DIRECTIONS = [true, false];
const dirName = (zeroToOne: boolean) => (zeroToOne ? 'zeroToOne' : 'oneToZero');

// Plugin amount deltas: amountInDecrease (beforeSwap), amountInIncrease and amountOutDecrease (afterSwapCalculation).
// The plugin's part goes to the plugin, the pool itself moves only by the amounts calculated by the swap math
describe('AlgebraPool amount deltas', () => {
  describe('exact amounts for every delta, direction and swap method', () => {
    const cases: { kind: Kind; name: string; d: Deltas }[] = [
      { kind: 'exactIn', name: 'no deltas', d: deltas() },
      { kind: 'exactIn', name: 'amountInDecrease', d: deltas({ inDecrease: share(10_000n) }) },
      { kind: 'exactIn', name: 'amountOutDecrease', d: deltas({ outDecrease: share(20_000n) }) },
      {
        kind: 'exactIn',
        name: 'amountInDecrease and amountOutDecrease',
        d: deltas({ inDecrease: share(10_000n), outDecrease: share(20_000n) }),
      },
      { kind: 'exactOut', name: 'no deltas', d: deltas() },
      { kind: 'exactOut', name: 'amountInIncrease', d: deltas({ inIncrease: share(30_000n) }) },
      { kind: 'payInAdvance', name: 'no deltas', d: deltas() },
      { kind: 'payInAdvance', name: 'amountInDecrease', d: deltas({ inDecrease: share(10_000n) }) },
      { kind: 'payInAdvance', name: 'amountOutDecrease', d: deltas({ outDecrease: share(20_000n) }) },
      {
        kind: 'payInAdvance',
        name: 'amountInDecrease and amountOutDecrease',
        d: deltas({ inDecrease: share(10_000n), outDecrease: share(20_000n) }),
      },
    ];

    for (const { kind, name, d } of cases) {
      for (const zeroToOne of DIRECTIONS) {
        it(`${kind}, ${name}, ${dirName(zeroToOne)}`, async () => {
          const env = await loadFixture(fullRangeFixture);
          await setDeltas(env, d);
          const amount = expandTo18Decimals(1) / 100n;
          const r = await execute(env, kind, zeroToOne, amount);
          const { calcIn, calcOut, amountInDecrease } = checkAccounting(r, kind, zeroToOne, amount, d);

          // enough liquidity, so the swap is executed in full
          if (kind === 'exactOut') expect(-calcOut).to.eq(amount);
          else expect(calcIn).to.eq(amount - amountInDecrease);
        });
      }
    }

    for (const zeroToOne of DIRECTIONS) {
      it(`amountInDecrease is excluded from the swap math, ${dirName(zeroToOne)}`, async () => {
        const amount = expandTo18Decimals(1) / 100n;
        const amountInDecrease = amount / 100n;
        // a swap of amount - amountInDecrease without deltas moves the pool exactly as a swap of amount with amountInDecrease
        const base = await execute(
          await loadFixture(fullRangeFixture),
          'exactIn',
          zeroToOne,
          amount - amountInDecrease,
        );
        const env = await loadFixture(fullRangeFixture);
        await setDeltas(env, deltas({ inDecrease: absolute(amountInDecrease) }));
        const r = await execute(env, 'exactIn', zeroToOne, amount);
        expect(r.seen.calc).to.deep.eq(base.seen.calc);
        expect(r.after.feeGrowth).to.deep.eq(base.after.feeGrowth);
      });

      it(`amountOutDecrease does not change the swap math nor the LP fees, ${dirName(zeroToOne)}`, async () => {
        const amount = expandTo18Decimals(1) / 100n;
        const base = await execute(await loadFixture(fullRangeFixture), 'exactIn', zeroToOne, amount);
        const env = await loadFixture(fullRangeFixture);
        await setDeltas(env, deltas({ outDecrease: share(500_000n) }));
        const r = await execute(env, 'exactIn', zeroToOne, amount);
        expect(r.seen.calc).to.deep.eq(base.seen.calc);
        expect(r.after.feeGrowth).to.deep.eq(base.after.feeGrowth);
      });

      it(`amountInIncrease does not change the swap math nor the LP fees, ${dirName(zeroToOne)}`, async () => {
        const amount = expandTo18Decimals(1) / 100n;
        const base = await execute(await loadFixture(fullRangeFixture), 'exactOut', zeroToOne, amount);
        const env = await loadFixture(fullRangeFixture);
        await setDeltas(env, deltas({ inIncrease: share(500_000n) }));
        const r = await execute(env, 'exactOut', zeroToOne, amount);
        expect(r.seen.calc).to.deep.eq(base.seen.calc);
        expect(r.after.feeGrowth).to.deep.eq(base.after.feeGrowth);
      });
    }
  });

  describe('partially executed swaps', () => {
    for (const zeroToOne of DIRECTIONS) {
      // a price limit right next to the current price stops the swap early
      const nearLimit = zeroToOne ? encodePriceSqrt(999, 1000) : encodePriceSqrt(1000, 999);

      it(`amountInDecrease is charged in full when the price limit stops the swap, ${dirName(zeroToOne)}`, async () => {
        const env = await loadFixture(fullRangeFixture);
        const amount = expandTo18Decimals(1);
        const d = deltas({ inDecrease: share(10_000n) });
        await setDeltas(env, d);
        const r = await execute(env, 'exactIn', zeroToOne, amount, nearLimit);
        const { calcIn, amountInDecrease, paid } = checkAccounting(r, 'exactIn', zeroToOne, amount, d);
        expect(calcIn).to.be.lt(amount - amountInDecrease); // executed partially
        expect(amountInDecrease).to.eq(amount / 100n); // but the plugin takes its part of the requested amount
        expect(paid).to.be.lt(amount);
      });

      it(`amountOutDecrease follows the actual output, ${dirName(zeroToOne)}`, async () => {
        const env = await loadFixture(fullRangeFixture);
        const amount = expandTo18Decimals(1);
        const d = deltas({ outDecrease: share(100_000n) });
        await setDeltas(env, d);
        const r = await execute(env, 'exactIn', zeroToOne, amount, nearLimit);
        const { calcIn, calcOut, amountOutDecrease } = checkAccounting(r, 'exactIn', zeroToOne, amount, d);
        expect(calcIn).to.be.lt(amount);
        expect(amountOutDecrease).to.eq(-calcOut / 10n);
      });

      it(`amountInIncrease follows the actual input on a partial exact output, ${dirName(zeroToOne)}`, async () => {
        const env = await loadFixture(fullRangeFixture);
        const amount = expandTo18Decimals(1);
        const d = deltas({ inIncrease: share(100_000n) });
        await setDeltas(env, d);
        const r = await execute(env, 'exactOut', zeroToOne, amount, nearLimit);
        const { calcIn, calcOut, amountInIncrease } = checkAccounting(r, 'exactOut', zeroToOne, amount, d);
        expect(-calcOut).to.be.lt(amount); // received less than requested
        expect(amountInIncrease).to.eq(calcIn / 10n);
      });

      it(`payment in advance returns the leftovers and keeps amountInDecrease in full, ${dirName(zeroToOne)}`, async () => {
        const env = await loadFixture(fullRangeFixture);
        const amount = expandTo18Decimals(1);
        const d = deltas({ inDecrease: share(10_000n), outDecrease: share(100_000n) });
        await setDeltas(env, d);
        const r = await execute(env, 'payInAdvance', zeroToOne, amount, nearLimit);
        const { calcIn, amountInDecrease, paid } = checkAccounting(r, 'payInAdvance', zeroToOne, amount, d);
        const leftover = amount - calcIn - amountInDecrease;
        expect(leftover).to.be.gt(0n);
        expect(paid).to.eq(amount - leftover);
      });
    }

    it('a swap through an empty range costs exactly amountInDecrease and returns nothing', async () => {
      const env = await loadFixture(emptyBelowFixture);
      const amount = expandTo18Decimals(1) / 100n;
      const d = deltas({ inDecrease: share(10_000n), outDecrease: share(500_000n) });
      await setDeltas(env, d);
      // the liquidity is above the current price, so a swap down only travels through the empty range
      const r = await execute(env, 'exactIn', true, amount, encodePriceSqrt(1, 4));
      const { calcIn, calcOut, amountInDecrease, amountOutDecrease, paid } = checkAccounting(
        r,
        'exactIn',
        true,
        amount,
        d,
      );
      expect(calcIn).to.eq(0n);
      expect(calcOut).to.eq(0n);
      expect(amountOutDecrease).to.eq(0n);
      expect(paid).to.eq(amountInDecrease);
    });
  });

  describe('any fee, in any token', () => {
    const cases: { kind: Kind; d: Deltas }[] = [
      { kind: 'exactIn', d: deltas({ inDecrease: share(10_000n), outDecrease: share(20_000n) }) },
      { kind: 'exactOut', d: deltas({ inIncrease: share(30_000n) }) },
      { kind: 'payInAdvance', d: deltas({ inDecrease: share(10_000n), outDecrease: share(20_000n) }) },
    ];
    for (const fee of FEES) {
      for (const feeMode of FEE_MODES) {
        for (const { kind, d } of cases) {
          it(`fee ${fee}, fee mode ${feeMode}, ${kind}`, async () => {
            for (const zeroToOne of DIRECTIONS) {
              const env = await loadFixture(fullRangeFixture);
              await setFee(env, fee);
              await setFeeMode(env, feeMode);
              await setDeltas(env, d);
              // at an extreme fee the exact output is grossed up a lot, so keep it small
              const amount = kind === 'exactOut' && fee > 500000 ? 10n ** 9n : expandTo18Decimals(1) / 100n;
              const r = await execute(env, kind, zeroToOne, amount);
              checkAccounting(r, kind, zeroToOne, amount, d);
            }
          });
        }
      }
    }

    for (const zeroToOne of DIRECTIONS) {
      it(`the community fee is taken from the swapped amount only, ${dirName(zeroToOne)}`, async () => {
        const amount = expandTo18Decimals(1) / 100n;
        const amountInDecrease = amount / 100n;

        // the community fee is either pending or already sent to the vault
        const accrue = async (env: Env, swapAmount: bigint) => {
          if ((await env.pool.communityVault()) === ethers.ZeroAddress) await env.pool.setCommunityVault(env.vault);
          await env.pool.setCommunityFee(250);
          const before = await env.pool.getCommunityFeePending();
          const r = await execute(env, 'exactIn', zeroToOne, swapAmount);
          const after = await env.pool.getCommunityFeePending();
          const sent = [r.after.vault[0] - r.before.vault[0], r.after.vault[1] - r.before.vault[1]];
          return { r, accrued: [after[0] - before[0] + sent[0], after[1] - before[1] + sent[1]] };
        };

        const base = await accrue(await loadFixture(fullRangeFixture), amount - amountInDecrease);

        const env = await loadFixture(fullRangeFixture);
        const d = deltas({ inDecrease: absolute(amountInDecrease), outDecrease: share(20_000n) });
        await setDeltas(env, d);
        const { r, accrued } = await accrue(env, amount);
        checkAccounting(r, 'exactIn', zeroToOne, amount, d);
        expect(accrued).to.deep.eq(base.accrued);
        expect(accrued[zeroToOne ? 0 : 1]).to.be.gt(0n);
      });
    }
  });

  describe('bounds', () => {
    for (const zeroToOne of DIRECTIONS) {
      const dir = dirName(zeroToOne);
      const amount = expandTo18Decimals(1) / 100n;

      it(`amountInDecrease can be amountRequired - 1, ${dir}`, async () => {
        for (const kind of ['exactIn', 'payInAdvance'] as Kind[]) {
          const env = await loadFixture(fullRangeFixture);
          const d = deltas({ inDecrease: absolute(amount - 1n) });
          await setDeltas(env, d);
          const r = await execute(env, kind, zeroToOne, amount);
          checkAccounting(r, kind, zeroToOne, amount, d);
        }
      });

      it(`amountInDecrease cannot reach amountRequired, ${dir}`, async () => {
        for (const kind of ['exactIn', 'payInAdvance'] as Kind[]) {
          const env = await loadFixture(fullRangeFixture);
          await setDeltas(env, deltas({ inDecrease: absolute(amount) }));
          await expect(send(env, kind, zeroToOne, amount)).to.be.revertedWithCustomError(
            env.pool,
            'invalidAmountInDecrease',
          );
        }
      });

      it(`amountInDecrease is rejected on exact output, ${dir}`, async () => {
        const env = await loadFixture(fullRangeFixture);
        await setDeltas(env, deltas({ inDecrease: absolute(1n) }));
        await expect(send(env, 'exactOut', zeroToOne, amount)).to.be.revertedWithCustomError(
          env.pool,
          'invalidAmountInDecrease',
        );
      });

      it(`amountOutDecrease can take the whole output, ${dir}`, async () => {
        for (const kind of ['exactIn', 'payInAdvance'] as Kind[]) {
          const env = await loadFixture(fullRangeFixture);
          const d = deltas({ outDecrease: share(SHARE) });
          await setDeltas(env, d);
          const r = await execute(env, kind, zeroToOne, amount);
          const { received } = checkAccounting(r, kind, zeroToOne, amount, d);
          expect(received).to.eq(0n);
        }
      });

      it(`amountOutDecrease cannot exceed the output, ${dir}`, async () => {
        for (const kind of ['exactIn', 'payInAdvance'] as Kind[]) {
          const env = await loadFixture(fullRangeFixture);
          await setDeltas(env, deltas({ outDecrease: share(SHARE, 1n) }));
          await expect(send(env, kind, zeroToOne, amount)).to.be.revertedWithCustomError(
            env.pool,
            'invalidAmountOutDecrease',
          );
        }
      });

      it(`amountOutDecrease is rejected on exact output, ${dir}`, async () => {
        const env = await loadFixture(fullRangeFixture);
        await setDeltas(env, deltas({ outDecrease: absolute(1n) }));
        await expect(send(env, 'exactOut', zeroToOne, amount)).to.be.revertedWithCustomError(
          env.pool,
          'invalidAmountOutDecrease',
        );
      });

      it(`amountInIncrease is rejected on exact input, including payment in advance, ${dir}`, async () => {
        for (const kind of ['exactIn', 'payInAdvance'] as Kind[]) {
          const env = await loadFixture(fullRangeFixture);
          await setDeltas(env, deltas({ inIncrease: absolute(1n) }));
          await expect(send(env, kind, zeroToOne, amount)).to.be.revertedWithCustomError(
            env.pool,
            'invalidAmountInIncrease',
          );
        }
      });

      it(`amountInIncrease above int256 is rejected, ${dir}`, async () => {
        const env = await loadFixture(fullRangeFixture);
        await setDeltas(env, deltas({ inIncrease: absolute(INT256_MAX + 1n) }));
        await expect(send(env, 'exactOut', zeroToOne, amount)).to.be.revertedWithCustomError(
          env.pool,
          'invalidAmountInIncrease',
        );
      });

      it(`amountInIncrease that overflows the paid amount reverts instead of wrapping, ${dir}`, async () => {
        const env = await loadFixture(fullRangeFixture);
        await setDeltas(env, deltas({ inIncrease: absolute(INT256_MAX) }));
        await expect(send(env, 'exactOut', zeroToOne, amount)).to.be.revertedWithPanic(0x11);
      });
    }
  });

  describe('invariants across ticks', () => {
    const cases: { kind: Kind; d: Deltas }[] = [
      { kind: 'exactIn', d: deltas({ inDecrease: share(10_000n), outDecrease: share(20_000n) }) },
      { kind: 'exactOut', d: deltas({ inIncrease: share(30_000n) }) },
      { kind: 'payInAdvance', d: deltas({ inDecrease: share(10_000n), outDecrease: share(20_000n) }) },
    ];
    for (const feeMode of FEE_MODES) {
      for (const { kind, d } of cases) {
        it(`a series of swaps crossing initialized ticks, fee mode ${feeMode}, ${kind}`, async () => {
          const env = await loadFixture(multiTickFixture);
          await setFeeMode(env, feeMode);
          await setDeltas(env, d);
          // large enough to cross several positions, alternating directions
          const swaps: [boolean, bigint][] = [
            [true, expandTo18Decimals(1)],
            [false, expandTo18Decimals(2)],
            [true, expandTo18Decimals(1) / 3n],
            [false, expandTo18Decimals(1) / 7n],
          ];
          for (const [zeroToOne, amount] of swaps) {
            const r = await execute(env, kind, zeroToOne, amount);
            checkAccounting(r, kind, zeroToOne, amount, d);
          }
        });
      }
    }
  });

  describe('randomized sequences of swaps', () => {
    // deterministic, override with DELTA_FUZZ_SEED and DELTA_FUZZ_RUNS for a longer run
    const SEED = Number(process.env.DELTA_FUZZ_SEED ?? 1);
    const RUNS = Number(process.env.DELTA_FUZZ_RUNS ?? 20);
    const STEPS = 12;

    function mulberry32(seed: number) {
      return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const json = (x: unknown) => JSON.stringify(x, (_, v) => (typeof v === 'bigint' ? v.toString() : v));

    for (let run = 0; run < RUNS; run++) {
      it(`sequence ${run}, seed ${SEED}`, async () => {
        const rnd = mulberry32(SEED * 1_000_003 + run);
        const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
        const upTo = (n: number) => BigInt(Math.floor(rnd() * n));

        const env = await loadFixture(fullRangeFixture);
        const fee = pick(FEES);
        let feeMode = pick(FEE_MODES);
        await setFee(env, fee);
        await setFeeMode(env, feeMode);
        if (rnd() < 0.5) {
          if ((await env.pool.communityVault()) === ethers.ZeroAddress) await env.pool.setCommunityVault(env.vault);
          await env.pool.setCommunityFee(250);
        }

        for (let step = 0; step < STEPS; step++) {
          // switching the fee token on a live pool must not break anything either
          if (rnd() < 0.1) {
            const next = pick(FEE_MODES.filter((m) => m !== feeMode));
            await env.pool.setFeeMode(next);
            feeMode = next;
          }

          const kind = pick<Kind>(['exactIn', 'exactOut', 'payInAdvance']);
          // keep the price in a sane range, so that the price limit is never reached
          const { price } = await env.pool.globalState();
          let zeroToOne = rnd() < 0.5;
          if (price < encodePriceSqrt(1, 4)) zeroToOne = false;
          if (price > encodePriceSqrt(4, 1)) zeroToOne = true;

          let amount = (1n + upTo(9)) * 10n ** (3n + upTo(15));
          // at an extreme fee the exact output is grossed up a lot
          if (kind === 'exactOut' && fee > 500000) amount = (amount % 10n ** 10n) + 1n;

          let d: Deltas;
          let error: string | undefined;
          if (rnd() < 0.8) {
            d =
              kind === 'exactOut'
                ? deltas({ inIncrease: share(upTo(3_000_000)) })
                : deltas({ inDecrease: share(upTo(999_999)), outDecrease: share(upTo(1_000_001)) });
          } else if (kind === 'exactOut') {
            [d, error] = pick<[Deltas, string]>([
              [deltas({ inDecrease: absolute(1n) }), 'invalidAmountInDecrease'],
              [deltas({ outDecrease: absolute(1n) }), 'invalidAmountOutDecrease'],
              [deltas({ inIncrease: absolute(INT256_MAX + 1n) }), 'invalidAmountInIncrease'],
            ]);
          } else {
            [d, error] = pick<[Deltas, string]>([
              [deltas({ inDecrease: absolute(amount) }), 'invalidAmountInDecrease'],
              [deltas({ inIncrease: absolute(1n) }), 'invalidAmountInIncrease'],
              [deltas({ outDecrease: share(SHARE, 1n) }), 'invalidAmountOutDecrease'],
            ]);
          }
          await setDeltas(env, d);

          const trace = `run ${run} step ${step}: ${kind} ${dirName(zeroToOne)} amount ${amount} fee ${fee} feeMode ${feeMode} deltas ${json(d)}`;
          try {
            if (error) {
              await expect(send(env, kind, zeroToOne, amount)).to.be.revertedWithCustomError(env.pool, error);
            } else {
              const r = await execute(env, kind, zeroToOne, amount);
              checkAccounting(r, kind, zeroToOne, amount, d);
            }
          } catch (e: any) {
            throw new Error(`${trace}\n${e.message}`);
          }
        }
      });
    }
  });
});
