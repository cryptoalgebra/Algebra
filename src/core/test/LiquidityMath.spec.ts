import { expect } from './shared/expect';
import { LiquidityMathTest } from '../typechain';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import snapshotGasCost from './shared/snapshotGasCost';

describe('LiquidityMath', () => {
  let liquidityMath: LiquidityMathTest;
  const fixture = async () => {
    const factory = await ethers.getContractFactory('LiquidityMathTest');
    return (await factory.deploy()) as any as LiquidityMathTest;
  };
  beforeEach('deploy LiquidityMathTest', async () => {
    liquidityMath = await loadFixture(fixture);
  });

  describe('#addDelta', () => {
    it('1 + 0', async () => {
      expect(await liquidityMath.addDelta(1, 0)).to.eq(1);
    });
    it('1 + -1', async () => {
      expect(await liquidityMath.addDelta(1, -1)).to.eq(0);
    });
    it('1 + 1', async () => {
      expect(await liquidityMath.addDelta(1, 1)).to.eq(2);
    });
    it('2**128-15 + 15 overflows', async () => {
      await expect(liquidityMath.addDelta(2n ** 128n - 15n, 15)).to.be.revertedWithCustomError(
        liquidityMath,
        'liquidityAdd'
      );
    });
    it('0 + -1 underflows', async () => {
      await expect(liquidityMath.addDelta(0, -1)).to.be.revertedWithCustomError(liquidityMath, 'liquiditySub');
    });
    it('3 + -4 underflows', async () => {
      await expect(liquidityMath.addDelta(3, -4)).to.be.revertedWithCustomError(liquidityMath, 'liquiditySub');
    });
    it('gas add  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(liquidityMath.getGasCostOfAddDelta(15, 4));
    });
    it('gas sub  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(liquidityMath.getGasCostOfAddDelta(15, -4));
    });
  });
});
