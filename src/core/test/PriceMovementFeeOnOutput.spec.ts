import { ethers } from 'hardhat';
import { expect } from './shared/expect';
import { encodePriceSqrt, expandTo18Decimals, MIN_SQRT_RATIO, MAX_SQRT_RATIO } from './shared/utilities';
import { PriceMovementMathTest } from '../typechain';

const DENOMINATOR = 1_000_000n;

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;
// the fee taken from a known gross amount, and the one added on top of a known net amount
const feeOfGross = (gross: bigint, fee: bigint) => ceilDiv(gross * fee, DENOMINATOR);
const feeOfNet = (net: bigint, fee: bigint) => ceilDiv(net * fee, DENOMINATOR - fee);

describe('PriceMovementMath with fee on output', () => {
  let math: PriceMovementMathTest;

  before(async () => {
    const factory = await ethers.getContractFactory('PriceMovementMathTest');
    math = (await factory.deploy()) as any as PriceMovementMathTest;
  });

  const run = (feeOnInput: boolean, price: bigint, target: bigint, liquidity: bigint, amount: bigint, fee: bigint | number) =>
    math.movePriceTowardsTargetWithFeeMode(feeOnInput, price, target, liquidity, amount, fee);

  // both directions, so that a mixed up delta helper cannot hide behind a symmetric case
  const directions = [
    { name: 'zero for one', price: encodePriceSqrt(1, 1), near: encodePriceSqrt(100, 101), far: encodePriceSqrt(1, 100) },
    { name: 'one for zero', price: encodePriceSqrt(1, 1), near: encodePriceSqrt(101, 100), far: encodePriceSqrt(100, 1) },
  ];

  for (const { name, price, near, far } of directions) {
    describe(name, () => {
      const liquidity = expandTo18Decimals(2);

      describe('exactIn', () => {
        it('does not deduct anything from the available input', async () => {
          const amount = expandTo18Decimals(1);
          const fee = 600n;

          const onInput = await run(true, price, far, liquidity, amount, fee);
          const onOutput = await run(false, price, far, liquidity, amount, fee);

          expect(onInput.amountIn).to.be.lt(amount); // only a part of the budget reaches the curve
          expect(onOutput.amountIn).to.eq(amount); // the whole budget does
        });

        it('consumes the entire budget when the target is not reached', async () => {
          const { amountIn, sqrtQ } = await run(false, price, far, liquidity, expandTo18Decimals(1), 600);
          expect(sqrtQ).to.not.eq(far);
          expect(amountIn).to.eq(expandTo18Decimals(1));
        });

        it('stops at the target when the budget is more than enough', async () => {
          const { amountIn, sqrtQ } = await run(false, price, near, liquidity, expandTo18Decimals(1), 600);
          expect(sqrtQ).to.eq(near);
          expect(amountIn).to.be.lt(expandTo18Decimals(1));
        });

        it('takes the fee as a share of the gross output', async () => {
          for (const fee of [1n, 100n, 600n, 3000n, 100_000n, 999_999n]) {
            const { amountOut, feeAmount } = await run(false, price, far, liquidity, expandTo18Decimals(1), fee);
            expect(feeAmount, `fee ${fee}`).to.eq(feeOfGross(amountOut + feeAmount, fee));
          }
        });

        it('moves the price further than the same budget with the fee on the input', async () => {
          const onInput = await run(true, price, far, liquidity, expandTo18Decimals(1), 600);
          const onOutput = await run(false, price, far, liquidity, expandTo18Decimals(1), 600);

          if (price > far) expect(onOutput.sqrtQ).to.be.lt(onInput.sqrtQ);
          else expect(onOutput.sqrtQ).to.be.gt(onInput.sqrtQ);
        });

        it('never hands the trader more than the fee on the input would', async () => {
          // forced by the concavity of the curve
          for (const fee of [1n, 600n, 3000n, 100_000n]) {
            const onInput = await run(true, price, far, liquidity, expandTo18Decimals(1), fee);
            const onOutput = await run(false, price, far, liquidity, expandTo18Decimals(1), fee);
            expect(onOutput.amountOut, `fee ${fee}`).to.be.lte(onInput.amountOut);
          }
        });
      });

      describe('exactOut', () => {
        it('delivers exactly the requested amount', async () => {
          for (const fee of [1n, 100n, 600n, 3000n, 100_000n]) {
            const requested = expandTo18Decimals(1);
            const { amountOut, sqrtQ } = await run(false, price, far, liquidity, -requested, fee);
            expect(sqrtQ, `fee ${fee}`).to.not.eq(far);
            expect(amountOut, `fee ${fee}`).to.eq(requested);
          }
        });

        it('grosses the released amount up by the fee', async () => {
          for (const fee of [1n, 600n, 3000n, 100_000n]) {
            const requested = expandTo18Decimals(1);
            const { feeAmount } = await run(false, price, far, liquidity, -requested, fee);
            expect(feeAmount, `fee ${fee}`).to.eq(feeOfNet(requested, fee));
          }
        });

        it('does not mark the input up', async () => {
          const requested = expandTo18Decimals(1);
          const onInput = await run(true, price, far, liquidity, -requested, 600);
          const onOutput = await run(false, price, far, liquidity, -requested, 600);

          // the markup rides on top of the raw input, while on the output side there is none
          expect(onInput.feeAmount).to.eq(feeOfNet(onInput.amountIn, 600n));
          expect(onOutput.amountIn + onOutput.feeAmount).to.not.eq(onOutput.amountIn + feeOfNet(onOutput.amountIn, 600n));
        });

        it('costs the trader at least as much as the fee on the input would', async () => {
          for (const fee of [1n, 600n, 3000n, 100_000n]) {
            const requested = expandTo18Decimals(1);
            const onInput = await run(true, price, far, liquidity, -requested, fee);
            const onOutput = await run(false, price, far, liquidity, -requested, fee);

            expect(onInput.amountOut, `fee ${fee}`).to.eq(onOutput.amountOut);
            expect(onOutput.amountIn, `fee ${fee}`).to.be.gte(onInput.amountIn + onInput.feeAmount - 1n);
          }
        });

        it('caps at the target without overshooting it', async () => {
          const requested = expandTo18Decimals(1);
          const { amountOut, sqrtQ } = await run(false, price, near, liquidity, -requested, 600);
          expect(sqrtQ).to.eq(near);
          expect(amountOut).to.be.lt(requested);
        });

        it('compares the step capacity against the grossed up amount', async () => {
          // a net amount just under the gross capacity: comparing by net would overshoot the target
          const fee = 600n;
          const capped = await run(false, price, near, liquidity, -expandTo18Decimals(100), fee);
          const grossCapacity = capped.amountOut + capped.feeAmount;

          const { sqrtQ } = await run(false, price, near, liquidity, -(grossCapacity - 1n), fee);

          if (price > near) expect(sqrtQ).to.be.gte(near);
          else expect(sqrtQ).to.be.lte(near);
        });

        it('caps the fee when the step runs out of room', async () => {
          const { amountOut, feeAmount } = await run(false, price, near, liquidity, -expandTo18Decimals(100), 600);
          // gross is what the step could give, so the fee is a plain share of it
          expect(feeAmount).to.eq(feeOfGross(amountOut + feeAmount, 600n));
        });
      });
    });
  }

  describe('parity with the fee on the input', () => {
    it('is a no-op when the fee is zero', async () => {
      const liquidity = expandTo18Decimals(2);
      const cases: Array<[bigint, bigint, bigint]> = [
        [encodePriceSqrt(1, 1), encodePriceSqrt(100, 1), expandTo18Decimals(1)],
        [encodePriceSqrt(1, 1), encodePriceSqrt(1, 100), expandTo18Decimals(1)],
        [encodePriceSqrt(1, 1), encodePriceSqrt(101, 100), expandTo18Decimals(1)],
        [encodePriceSqrt(1, 1), encodePriceSqrt(100, 101), expandTo18Decimals(1)],
      ];

      for (const [price, target, amount] of cases) {
        for (const signed of [amount, -amount]) {
          const onInput = await run(true, price, target, liquidity, signed, 0);
          const onOutput = await run(false, price, target, liquidity, signed, 0);

          expect(onOutput.sqrtQ).to.eq(onInput.sqrtQ);
          expect(onOutput.amountIn).to.eq(onInput.amountIn);
          expect(onOutput.amountOut).to.eq(onInput.amountOut);
          expect(onOutput.feeAmount).to.eq(0n);
          expect(onInput.feeAmount).to.eq(0n);
        }
      }
    });

    it('does nothing when the price is already at the target', async () => {
      const price = encodePriceSqrt(1, 1);
      const { amountIn, amountOut, feeAmount, sqrtQ } = await run(false, price, price, expandTo18Decimals(2), expandTo18Decimals(1), 600);

      expect(amountIn).to.eq(0n);
      expect(amountOut).to.eq(0n);
      expect(feeAmount).to.eq(0n);
      expect(sqrtQ).to.eq(price);
    });
  });

  describe('boundaries', () => {
    it('handles the smallest possible amounts', async () => {
      const liquidity = expandTo18Decimals(2);
      for (const fee of [1n, 600n, 999_999n]) {
        const exactIn = await run(false, encodePriceSqrt(1, 1), encodePriceSqrt(1, 100), liquidity, 1n, fee);
        expect(exactIn.feeAmount, `exactIn fee ${fee}`).to.be.lte(exactIn.amountOut + exactIn.feeAmount);

        const exactOut = await run(false, encodePriceSqrt(1, 1), encodePriceSqrt(1, 100), liquidity, -1n, fee);
        expect(exactOut.amountOut, `exactOut fee ${fee}`).to.be.lte(1n);
      }
    });

    it('handles a fee of almost 100%', async () => {
      const liquidity = expandTo18Decimals(2);
      const fee = 999_999n;

      const { amountOut, feeAmount } = await run(false, encodePriceSqrt(1, 1), encodePriceSqrt(1, 100), liquidity, expandTo18Decimals(1), fee);
      expect(amountOut).to.be.gte(0n); // the recipient is never left owing anything
      expect(feeAmount).to.eq(feeOfGross(amountOut + feeAmount, fee));
    });

    it('handles max liquidity', async () => {
      const liquidity = 2n ** 128n - 1n;
      const { amountIn, amountOut, feeAmount } = await run(false, encodePriceSqrt(1, 1), encodePriceSqrt(101, 100), liquidity, expandTo18Decimals(1), 600);

      expect(amountIn).to.be.gt(0n);
      expect(feeAmount).to.eq(feeOfGross(amountOut + feeAmount, 600n));
    });

    it('handles minimum liquidity', async () => {
      const { amountIn, amountOut } = await run(false, encodePriceSqrt(1, 1), encodePriceSqrt(1, 100), 1n, expandTo18Decimals(1), 600);
      expect(amountIn).to.be.gt(0n);
      expect(amountOut).to.be.gte(0n);
    });

    it('handles the extremes of the price range', async () => {
      const liquidity = expandTo18Decimals(2);
      const down = await run(false, encodePriceSqrt(1, 1), MIN_SQRT_RATIO + 1n, liquidity, expandTo18Decimals(1), 600);
      expect(down.sqrtQ).to.be.gte(MIN_SQRT_RATIO + 1n);

      const up = await run(false, encodePriceSqrt(1, 1), MAX_SQRT_RATIO - 1n, liquidity, expandTo18Decimals(1), 600);
      expect(up.sqrtQ).to.be.lte(MAX_SQRT_RATIO - 1n);
    });

    it('reverts on the amount that cannot be negated', async () => {
      const min = '-57896044618658097711785492504343953926634992332820282019728792003956564819968';
      await expect(
        run(false, encodePriceSqrt(1, 1), encodePriceSqrt(101, 100), expandTo18Decimals(2), BigInt(min), 600)
      ).to.be.revertedWithCustomError(math, 'invalidAmountRequired');
    });
  });

  describe('overflow of the grossed up request', () => {
    // at a fee of 50% or more, net + fee(net) can exceed uint256. This amount makes the sum land exactly on
    // 2**256, so an unguarded addition wraps to zero and the step degenerates into an empty swap
    const fee = 500001n;
    const amount = 57895928826568860395590068933358945238727139062835616379164752546372556906838n;

    for (const { name, price, far } of directions) {
      it('saturates instead of wrapping (' + name + ')', async () => {
        const liquidity = expandTo18Decimals(2);

        const onInput = await run(true, price, far, liquidity, -amount, fee);
        const onOutput = await run(false, price, far, liquidity, -amount, fee);

        // the request dwarfs the step, so both modes have to run all the way to the target
        expect(onInput.sqrtQ).to.eq(far);
        expect(onOutput.sqrtQ).to.eq(far);
        expect(onOutput.amountOut).to.not.eq(0n);
        expect(onOutput.amountIn).to.not.eq(0n);
      });
    }
  });

  describe('counterexamples found by echidna', () => {
    it('at a zero fee the two modes agree on the price and on what the trader pays, but not on the split', async () => {
      // the default mode books the rounding remainder as a fee even at a zero rate
      const price = 1n;
      const target = 18116071946803138900321398584371426747400n;
      const liquidity = 305486149345101430878192618159n;
      const amount = 25n;

      const onInput = await run(true, price, target, liquidity, amount, 0);
      const onOutput = await run(false, price, target, liquidity, amount, 0);

      expect(onInput.sqrtQ).to.eq(onOutput.sqrtQ);
      expect(onInput.amountOut).to.eq(onOutput.amountOut);
      expect(onInput.amountIn + onInput.feeAmount).to.eq(onOutput.amountIn); // the trader gives up the same

      // but the split is not: one wei of dust is booked as a fee on the input side
      expect(onInput.amountIn).to.eq(24n);
      expect(onInput.feeAmount).to.eq(1n);
      expect(onOutput.amountIn).to.eq(25n);
      expect(onOutput.feeAmount).to.eq(0n);
    });

    it('on a one wei exactOut the fee on the output can cost the trader less than the fee on the input', async () => {
      // the input needed for an output is convex, so the modes are asymptotically equal and the rounding
      // decides. This is why there is no exactOut cross mode inequality
      const price = 323914862793378532315977460615323229826116682n;
      const target = 47696920040871320287433665831111259403605n;
      const liquidity = 506833410090404368292222230750843416n;
      const fee = 1n;

      const onInput = await run(true, price, target, liquidity, -1n, fee);
      const onOutput = await run(false, price, target, liquidity, -1n, fee);

      expect(onInput.amountOut).to.eq(1n);
      expect(onOutput.amountOut).to.eq(1n);
      expect(onInput.sqrtQ).to.eq(onOutput.sqrtQ);

      // charged on top on the input side, carved out of what was released on the output side
      expect(onInput.amountIn + onInput.feeAmount).to.eq(2n);
      expect(onOutput.amountIn).to.eq(1n);
    });
  });
});
