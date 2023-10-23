import { ethers } from 'hardhat';
import { expect } from './shared/expect';
import snapshotGasCost from './shared/snapshotGasCost';
import { encodePriceSqrt, expandTo18Decimals } from './shared/utilities';
import { PriceMovementMathTest, TokenDeltaMathTest } from '../typechain';

describe('PriceMovementMath', () => {
  let PriceMovementMath: PriceMovementMathTest;
  let sqrtPriceMath: TokenDeltaMathTest;
  before(async () => {
    const PriceMovementMathTestFactory = await ethers.getContractFactory('PriceMovementMathTest');
    const sqrtPriceMathTestFactory = await ethers.getContractFactory('TokenDeltaMathTest');
    PriceMovementMath = (await PriceMovementMathTestFactory.deploy()) as any as PriceMovementMathTest;
    sqrtPriceMath = (await sqrtPriceMathTestFactory.deploy()) as any as TokenDeltaMathTest;
  });

  describe('#movePriceTowardsTarget', () => {
    it('revert cases', async () => {
      const price = encodePriceSqrt(1, 1);
      const priceTarget = encodePriceSqrt(101, 100);
      const liquidity = 2n ** 128n - 1n;
      const amount = expandTo18Decimals(1);
      const fee = 600;

      expect(PriceMovementMath.movePriceTowardsTarget(0, priceTarget, liquidity, amount, fee)).to.be
        .revertedWithoutReason;

      expect(PriceMovementMath.movePriceTowardsTarget(price, priceTarget, 0, amount, fee)).to.be.revertedWithoutReason;
    });

    it('handles amountAvailable underflow', async () => {
      const price = encodePriceSqrt(1, 1);
      const priceTarget = encodePriceSqrt(101, 100);
      const liquidity = expandTo18Decimals(2);
      const amount = '-57896044618658097711785492504343953926634992332820282019728792003956564819968';
      const fee = 600;

      await expect(
        PriceMovementMath.movePriceTowardsTarget(price, priceTarget, liquidity, amount, fee)
      ).to.be.revertedWithCustomError(PriceMovementMath, 'invalidAmountRequired');
    });

    it('handles max liquidity', async () => {
      const price = encodePriceSqrt(1, 1);
      const priceTarget = encodePriceSqrt(101, 100);
      const liquidity = 2n ** 128n - 1n;
      const amount = expandTo18Decimals(1);
      const fee = 600;

      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        price,
        priceTarget,
        liquidity,
        amount,
        fee
      );

      expect(amountIn).to.eq('999399998850334720');
      expect(feeAmount).to.eq('600001149665280');
      expect(amountOut).to.eq('999399998850334719');
      expect(amountIn + feeAmount, 'entire amount is used').to.be.eq(amount);
      expect(sqrtQ).to.not.eq(priceTarget);
    });

    it('handles max liquidity and huge amount', async () => {
      const price = encodePriceSqrt(1, 1);
      const priceTarget = 1;
      const liquidity = 2n ** 128n - 1n;
      const amount = 2n ** 128n - 1n;
      const fee = 0;

      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        price,
        priceTarget,
        liquidity,
        amount,
        fee
      );

      expect(amountIn).to.eq('340282366920938463463374607431768211455');
      expect(feeAmount).to.eq('0');
      expect(amountOut).to.eq('170141183460469231731687303715884105727');
      expect(amountIn + feeAmount, 'entire amount is used').to.be.eq(amount);
      expect(sqrtQ).to.not.eq(priceTarget);
    });

    it('handles shifted liquidity internal overflow', async () => {
      const price = '1461446703485210103287273052203988822378723970342';
      const priceTarget = '4295128739';
      const liquidity = 2n ** 128n - 1n;
      const amount = '79231140595944432132633395119';
      const fee = 0;

      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        price,
        priceTarget,
        liquidity,
        amount,
        fee
      );

      expect(amountIn).to.eq('79231140595944432132633395118');
      expect(feeAmount).to.eq('1');
      expect(amountOut).to.eq('6276865794854539910162679325510021897617750978755115584760');
      expect(amountIn + feeAmount, 'entire amount is used').to.be.eq(amount);
      expect(sqrtQ).to.not.eq(priceTarget);
    });

    it('handles max liquidity and huge amount at max price', async () => {
      const price = '1461446703485210103287273052203988822378723970342';
      const priceTarget = '4295128739';
      const liquidity = 2n ** 128n - 1n;
      const amount = 2n ** 128n - 1n;
      const fee = 0;

      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        price,
        priceTarget,
        liquidity,
        amount,
        fee
      );

      expect(amountIn).to.eq('340282366920938463463374607431203982080');
      expect(amountOut).to.eq('6276865796315986612967337485317294249402799158149117772694');
      expect(feeAmount).to.eq('564229375'); // TODO lost precision
      expect(amountIn + feeAmount, 'entire amount is used').to.be.eq(amount);
      expect(sqrtQ).to.not.eq(priceTarget);
    });

    it('exact amount in that gets capped at price target in one for zero', async () => {
      const price = encodePriceSqrt(1, 1);
      const priceTarget = encodePriceSqrt(101, 100);
      const liquidity = expandTo18Decimals(2);
      const amount = expandTo18Decimals(1);
      const fee = 600;
      const zeroToOne = false;

      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        price,
        priceTarget,
        liquidity,
        amount,
        fee
      );

      expect(amountIn).to.eq('9975124224178055');
      expect(feeAmount).to.eq('5988667735148');
      expect(amountOut).to.eq('9925619580021728');
      expect(amountIn + feeAmount, 'entire amount is not used').to.lt(amount);

      const priceAfterWholeInputAmount = await sqrtPriceMath.getNewPriceAfterInput(price, liquidity, amount, zeroToOne);

      expect(sqrtQ, 'price is capped at price target').to.eq(priceTarget);
      expect(sqrtQ, 'price is less than price after whole input amount').to.lt(priceAfterWholeInputAmount);
    });

    it('exact amount out that gets capped at price target in one for zero', async () => {
      const price = encodePriceSqrt(1, 1);
      const priceTarget = encodePriceSqrt(101, 100);
      const liquidity = expandTo18Decimals(2);
      const amount = expandTo18Decimals(1) * (-1n);
      const fee = 600;
      const zeroToOne = false;

      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        price,
        priceTarget,
        liquidity,
        amount,
        fee
      );

      expect(amountIn).to.eq('9975124224178055');
      expect(feeAmount).to.eq('5988667735148');
      expect(amountOut).to.eq('9925619580021728');
      expect(amountOut, 'entire amount out is not returned').to.lt(amount* (-1n));

      const priceAfterWholeOutputAmount = await sqrtPriceMath.getNewPriceAfterOutput(
        price,
        liquidity,
        amount * (-1n),
        zeroToOne
      );

      expect(sqrtQ, 'price is capped at price target').to.eq(priceTarget);
      expect(sqrtQ, 'price is less than price after whole output amount').to.lt(priceAfterWholeOutputAmount);
    });

    it('exact amount in that is fully spent in one for zero', async () => {
      const price = encodePriceSqrt(1, 1);
      const priceTarget = encodePriceSqrt(1000, 100);
      const liquidity = expandTo18Decimals(2);
      const amount = expandTo18Decimals(1);
      const fee = 600;
      const zeroToOne = false;

      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        price,
        priceTarget,
        liquidity,
        amount,
        fee
      );

      expect(amountIn).to.eq('999400000000000000');
      expect(feeAmount).to.eq('600000000000000');
      expect(amountOut).to.eq('666399946655997866');
      expect(amountIn + feeAmount, 'entire amount is used').to.eq(amount);

      const priceAfterWholeInputAmountLessFee = await sqrtPriceMath.getNewPriceAfterInput(
        price,
        liquidity,
        amount - feeAmount,
        zeroToOne
      );

      expect(sqrtQ, 'price does not reach price target').to.be.lt(priceTarget);
      expect(sqrtQ, 'price is equal to price after whole input amount').to.eq(priceAfterWholeInputAmountLessFee);
    });

    it('exact amount out that is fully received in one for zero', async () => {
      const price = encodePriceSqrt(1, 1);
      const priceTarget = encodePriceSqrt(10000, 100);
      const liquidity = expandTo18Decimals(2);
      const amount = expandTo18Decimals(1) *(-1n);
      const fee = 600;
      const zeroToOne = false;

      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        price,
        priceTarget,
        liquidity,
        amount,
        fee
      );

      expect(amountIn).to.eq('2000000000000000000');
      expect(feeAmount).to.eq('1200720432259356');
      expect(amountOut).to.eq(amount* (-1n));

      const priceAfterWholeOutputAmount = await sqrtPriceMath.getNewPriceAfterOutput(
        price,
        liquidity,
        amount* (-1n),
        zeroToOne
      );

      expect(sqrtQ, 'price does not reach price target').to.be.lt(priceTarget);
      expect(sqrtQ, 'price is less than price after whole output amount').to.eq(priceAfterWholeOutputAmount);
    });

    it('check price collision in exactOut', async () => {
      // this scenario isn't possible in pool
      const price = '1524785991';
      const priceTarget = '1524785992';
      const liquidity = '4369999';
      const amount = -2;
      const fee = 39875;

      const { amountIn, amountOut, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        price,
        priceTarget,
        liquidity,
        amount,
        fee
      );

      expect(amountIn).to.eq('1');
      expect(feeAmount).to.eq('1');
      expect(amountOut).to.eq('2');
    });

    it('amount out is capped at the desired amount out', async () => {
      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        BigInt('417332158212080721273783715441582'),
        BigInt('1452870262520218020823638996'),
        '159344665391607089467575320103',
        '-1',
        1
      );
      expect(amountIn).to.eq('1');
      expect(feeAmount).to.eq('1');
      expect(amountOut).to.eq('1'); // would be 2 if not capped
      expect(sqrtQ).to.eq('417332158212080721273783715441581');
    });

    it('target price of 1 uses partial input amount', async () => {
      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        BigInt('2'),
        BigInt('1'),
        '1',
        '3915081100057732413702495386755767',
        1
      );
      expect(amountIn).to.eq('39614081257132168796771975168');
      expect(feeAmount).to.eq('39614120871253040049813');
      expect(amountIn + feeAmount).to.be.lte('3915081100057732413702495386755767');
      expect(amountOut).to.eq('0');
      expect(sqrtQ).to.eq('1');
    });

    it('entire input amount taken as fee', async () => {
      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        '2413',
        '79887613182836312',
        '1985041575832132834610021537970',
        '10',
        1872
      );
      expect(amountIn).to.eq('0');
      expect(feeAmount).to.eq('10');
      expect(amountOut).to.eq('0');
      expect(sqrtQ).to.eq('2413');
    });

    it('handles intermediate insufficient liquidity in zero for one exact output case', async () => {
      const sqrtP = BigInt('20282409603651670423947251286016');
      const sqrtPTarget = sqrtP * 11n / 10n;
      const liquidity = 1024;
      // virtual reserves of one are only 4
      // https://www.wolframalpha.com/input/?i=1024+%2F+%2820282409603651670423947251286016+%2F+2**96%29
      const amountRemaining = -4;
      const feePips = 3000;
      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        sqrtP,
        sqrtPTarget,
        liquidity,
        amountRemaining,
        feePips
      );
      expect(amountOut).to.eq(0);
      expect(sqrtQ).to.eq(sqrtPTarget);
      expect(amountIn).to.eq(26215);
      expect(feeAmount).to.eq(79);
    });

    it('handles intermediate insufficient liquidity in one for zero exact output case', async () => {
      const sqrtP = BigInt('20282409603651670423947251286016');
      const sqrtPTarget = sqrtP * 9n / 10n;
      const liquidity = 1024;
      // virtual reserves of zero are only 262144
      // https://www.wolframalpha.com/input/?i=1024+*+%2820282409603651670423947251286016+%2F+2**96%29
      const amountRemaining = -263000;
      const feePips = 3000;
      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        sqrtP,
        sqrtPTarget,
        liquidity,
        amountRemaining,
        feePips
      );
      expect(amountOut).to.eq(26214);
      expect(sqrtQ).to.eq(sqrtPTarget);
      expect(amountIn).to.eq(1);
      expect(feeAmount).to.eq(1);
    });

    describe('gas  [ @skip-on-coverage ]', () => {
      it('swap one for zero exact in capped', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(101, 100),
            expandTo18Decimals(2),
            expandTo18Decimals(1),
            600
          )
        );
      });
      it('swap zero for one exact in capped', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(99, 100),
            expandTo18Decimals(2),
            expandTo18Decimals(1),
            600
          )
        );
      });
      it('swap one for zero exact out capped', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(101, 100),
            expandTo18Decimals(2),
            expandTo18Decimals(1)* (-1n),
            600
          )
        );
      });
      it('swap zero for one exact out capped', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(99, 100),
            expandTo18Decimals(2),
            expandTo18Decimals(1)* (-1n),
            600
          )
        );
      });
      it('swap one for zero exact in partial', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(1010, 100),
            expandTo18Decimals(2),
            1000,
            600
          )
        );
      });
      it('swap zero for one exact in partial', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(99, 1000),
            expandTo18Decimals(2),
            1000,
            600
          )
        );
      });
      it('swap one for zero exact out partial', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(1010, 100),
            expandTo18Decimals(2),
            1000,
            600
          )
        );
      });
      it('swap zero for one exact out partial', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(99, 1000),
            expandTo18Decimals(2),
            1000,
            600
          )
        );
      });
    });
  });
});
