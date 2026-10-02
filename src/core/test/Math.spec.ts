import { ethers } from 'hardhat';
import { MaxUint256 } from 'ethers';
import { SafeMathTest, FullMathTest } from '../typechain';
import { expect } from './shared/expect';
import { Decimal } from 'decimal.js';

const Q128 = 2n ** 128n;

Decimal.config({ toExpNeg: -500, toExpPos: 500 });

describe('SafeMath', () => {
  let safeMath: SafeMathTest;

  before('deploy FullMathTest', async () => {
    const factory = await ethers.getContractFactory('SafeMathTest');
    safeMath = (await factory.deploy()) as any as SafeMathTest;
  });

  it('#add', async () => {
    await expect(safeMath.add(MaxUint256, 1)).to.be.revertedWithoutReason();
  });

  it('#sub', async () => {
    await expect(safeMath.sub(Q128 - 1n, Q128)).to.be.revertedWithoutReason();
    expect(await safeMath.sub(Q128, Q128 - 1n)).to.be.eq(1);
  });

  it('#mul', async () => {
    await expect(safeMath.mul(Q128, Q128)).to.be.revertedWithoutReason();
  });

  it('#addInt', async () => {
    await expect(safeMath.addInt(2n ** 255n - 1n, 1)).to.be.revertedWithoutReason();
  });

  it('#subInt', async () => {
    await expect(safeMath.subInt(100, (2n ** 255n - 1n) * -1n)).to.be.revertedWithoutReason();
    await expect(safeMath.subInt(2n ** 255n - 1n, -100)).to.be.revertedWithoutReason();
  });

  it('#add128', async () => {
    await expect(safeMath.add128(Q128 - 10n, 15)).to.be.revertedWithoutReason();
    expect(await safeMath.add128(10, 10)).to.be.eq(20);
  });

  it('#toUint160', async () => {
    await expect(safeMath.toUint160(2n ** 255n - 1n)).to.be.revertedWithoutReason();
  });

  it('#toUint128', async () => {
    await expect(safeMath.toUint128(2n ** 255n - 1n)).to.be.revertedWithoutReason();
  });

  it('#toInt128', async () => {
    await expect(safeMath.toInt128(2n ** 255n - 1n)).to.be.revertedWithoutReason();
    expect(await safeMath.toInt128(2n ** 127n - 1n)).to.be.eq(2n ** 127n - 1n);
    await expect(safeMath.toInt128U(2n ** 128n - 1n)).to.be.revertedWithoutReason();
  });

  it('#toInt256', async () => {
    await expect(safeMath.toInt256(MaxUint256)).to.be.revertedWithoutReason();
  });
});

describe('FullMath', () => {
  let fullMath: FullMathTest;
  before('deploy FullMathTest', async () => {
    const factory = await ethers.getContractFactory('FullMathTest');
    fullMath = (await factory.deploy()) as any as FullMathTest;
  });

  describe('#mulDiv', () => {
    it('reverts on a zero denominator and on overflow', async () => {
      await expect(fullMath.mulDiv(Q128, 5, 0)).to.be.revertedWithoutReason();
      await expect(fullMath.mulDiv(Q128, Q128, 0)).to.be.revertedWithoutReason();
      await expect(fullMath.mulDiv(Q128, Q128, 1)).to.be.revertedWithoutReason();
      await expect(fullMath.mulDiv(MaxUint256, MaxUint256, MaxUint256 - 1n)).to.be.revertedWithoutReason();
    });

    it('accurate for max inputs and with phantom overflow', async () => {
      expect(await fullMath.mulDiv(MaxUint256, MaxUint256, MaxUint256), 'all max inputs').to.eq(MaxUint256);
      expect(
        await fullMath.mulDiv(Q128, /**0.5=*/ (50n * Q128) / 100n, /**1.5=*/ (150n * Q128) / 100n),
        'without phantom overflow'
      ).to.eq(Q128 / 3n);
      expect(await fullMath.mulDiv(Q128, 35n * Q128, 8n * Q128), 'with phantom overflow').to.eq((4375n * Q128) / 1000n);
      expect(await fullMath.mulDiv(Q128, 1000n * Q128, 3000n * Q128), 'repeating decimal').to.eq(Q128 / 3n);
    });
  });

  describe('#mulDivRoundingUp', () => {
    it('reverts on a zero denominator and on overflow', async () => {
      await expect(fullMath.mulDivRoundingUp(Q128, 5, 0)).to.be.revertedWithoutReason();
      await expect(fullMath.mulDivRoundingUp(Q128, Q128, 0)).to.be.revertedWithoutReason();
      await expect(fullMath.mulDivRoundingUp(Q128, Q128, 1)).to.be.revertedWithoutReason();
      await expect(fullMath.mulDivRoundingUp(MaxUint256, MaxUint256, MaxUint256 - 1n)).to.be.revertedWithoutReason();
    });

    it('reverts if mulDiv overflows 256 bits after rounding up', async () => {
      await expect(
        fullMath.mulDivRoundingUp(
          '535006138814359',
          '432862656469423142931042426214547535783388063929571229938474969',
          '2'
        )
      ).to.be.revertedWithoutReason();
      await expect(
        fullMath.mulDivRoundingUp(
          '115792089237316195423570985008687907853269984659341747863450311749907997002549',
          '115792089237316195423570985008687907853269984659341747863450311749907997002550',
          '115792089237316195423570985008687907853269984653042931687443039491902864365164'
        )
      ).to.be.revertedWithoutReason();
    });

    it('accurate for max inputs and with phantom overflow', async () => {
      expect(await fullMath.mulDivRoundingUp(MaxUint256, MaxUint256, MaxUint256), 'all max inputs').to.eq(MaxUint256);
      expect(
        await fullMath.mulDivRoundingUp(Q128, /**0.5=*/ (50n * Q128) / 100n, /**1.5=*/ (150n * Q128) / 100n),
        'without phantom overflow'
      ).to.eq(Q128 / 3n + 1n);
      expect(await fullMath.mulDivRoundingUp(Q128, 35n * Q128, 8n * Q128), 'with phantom overflow').to.eq(
        (4375n * Q128) / 1000n
      );
      expect(await fullMath.mulDivRoundingUp(Q128, 1000n * Q128, 3000n * Q128), 'repeating decimal').to.eq(
        Q128 / 3n + 1n
      );
    });
  });
});
