import { expect } from './shared/expect';
import { ethers } from 'hardhat';
import { SlidingFeeTest } from '../typechain';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import snapshotGasCost from './shared/snapshotGasCost';

describe('SlidingFee', () => {
  let slidingFeePlugin: SlidingFeeTest;

  async function slidingFeeFixture() {
    const factory = await ethers.getContractFactory('SlidingFeeTest');
    return (await factory.deploy()) as any as SlidingFeeTest;
  }

  beforeEach('deploy SlidingFeeTest', async () => {
    slidingFeePlugin = await loadFixture(slidingFeeFixture);
  });

  it('set config', async () => {
    await slidingFeePlugin.changeBaseFee(500)
    await slidingFeePlugin.changeFactor(1000)

    expect(await slidingFeePlugin.s_baseFee()).to.be.eq(500)
    expect(await slidingFeePlugin.s_priceChangeFactor()).to.be.eq(1000)
  });

  describe('#getSlidingFee', () => {
    beforeEach('set config', async () => {
      await slidingFeePlugin.changeBaseFee(500)
      await slidingFeePlugin.changeFactor(1000)
    });

    for (const factor of [500, 1000, 2000]) {
      it("Shifts correct with positive price change, factor is " + factor, async function () {

          await slidingFeePlugin.changeFactor(factor) 
          // swap, price increased x4 (otz)
          let lastTick = 10000
          let currentTick  = 23864

          await slidingFeePlugin.getFeeForSwap(false, lastTick, currentTick);

          if (factor == 500) {
            expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.approximately((3n << 96n) / 2n, 1n << 81n); // 1.5
            expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.approximately(1n << 95n, 1n << 81n); // 0.5
          }

          if (factor == 1000) {
            expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.approximately(2n << 96n, 1n << 81n); // 2
            expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.approximately(0n << 96n, 1n << 81n); // 0
          }

          if (factor == 2000) {
            expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.eq(2n << 96n); // 2
            expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.eq(0n << 96n); // 0
          }
      });

      it("Shifts correct with negative price change, factor is " + factor, async function () {
          await slidingFeePlugin.changeFactor(factor)

          // swap, price decreased x0.25 (zto)
          let lastTick = 23864  
          let currentTick  = 10000 

          await slidingFeePlugin.getFeeForSwap(false, lastTick, currentTick);
        
          if (factor == 500) {
            expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.approximately((3n << 96n )/ 4n, 1n << 81n); // 0.75
            expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.approximately((5n << 96n) / 4n, 1n << 81n); // 1.25
          }

          if (factor == 1000) {
            expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.approximately(1n << 95n, 1n << 81n); // 0
            expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.approximately((3n << 96n) / 2n, 1n << 81n); // 2
          }

          if (factor == 2000) {
            expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.eq(0n << 96n); // 0
            expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.eq(2n << 96n); // 2
          }
      });
    }

    it("Factors should be reset", async function () {

      // swap, price increased x2.25 (otz)
      let lastTick = 10000
      let currentTick = 18110 
      await slidingFeePlugin.getFeeForSwap(false, lastTick, currentTick); // 1.5, 0.5

      // swap, price decreased x0.25 (zto)
      lastTick = 18110
      currentTick = 4246
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick); // 1, 1

      expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.approximately(1n << 96n, 1n << 81n); // 1
      expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.approximately(1n << 96n, 1n << 81n); // 1
    });

    it("Shift correct after two oneToZero (positive) movements", async function () {
      await slidingFeePlugin.changeFactor(500)
      // swap, price increased x4 (otz)
      let lastTick = 10000
      let currentTick  = 23864
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);

      // swap, price increased x2.25 (otz)
      lastTick = 23864
      currentTick  = 31974
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);


      expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.approximately((7n << 96n) / 4n, 1n << 81n); // 1.75
      expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.approximately((1n << 96n) / 4n, 1n << 81n); // 0.25
    });

    it("Shift correct after two zeroToOne (positive) movements", async function () {
      await slidingFeePlugin.changeFactor(500)
      // swap, price decreased x0.25 (zt0)
      let lastTick = 23864
      let currentTick  = 10000
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);


      // swap, price decreased x0.25 (zt0)
      lastTick = 10000
      currentTick  = -3864
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);

      expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.approximately(1n << 95n , 1n << 81n); // 0.5
      expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.approximately((3n << 96n) / 2n, 1n << 81n); // 1.5
    });

  });

  describe('#getFee gas cost  [ @skip-on-coverage ]', () => {
    it('gas cost of same tick', async () => {
      await snapshotGasCost(slidingFeePlugin.getGasCostOfGetFeeForSwap(true, 100, 100));
    });

    it('gas cost of tick increase', async () => {
      await snapshotGasCost(slidingFeePlugin.getGasCostOfGetFeeForSwap(true, 10000, 40000));
    });

    it('gas cost of tick decrease', async () => {
      await snapshotGasCost(slidingFeePlugin.getGasCostOfGetFeeForSwap(false, 40000, 10000));
    });
  });

});
