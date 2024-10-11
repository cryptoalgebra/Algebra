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

  describe('#FeeFactors', () => {
    beforeEach('set config', async () => {
      await slidingFeePlugin.changeBaseFee(500)
      await slidingFeePlugin.changeFactor(1000)
    });

    for (const factor of [500, 1000, 2000]) {
      it("Shifts correct with positive price change, factor is " + factor, async function () {

          await slidingFeePlugin.changeFactor(factor) 
          // swap, price increased x2 (otz)
          let lastTick = 10000
          let currentTick  = 16932

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
          let lastTick = 16932  
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

      // swap, price increased x1.5 (otz)
      let lastTick = 10000
      let currentTick =  14055
      await slidingFeePlugin.getFeeForSwap(false, lastTick, currentTick); // 1.5, 0.5

      // swap, price decreased x0.5 (zto)
      lastTick = 14055
      currentTick = 7123
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick); // 1, 1

      expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.approximately(1n << 96n, 1n << 81n); // 1
      expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.approximately(1n << 96n, 1n << 81n); // 1
    });

    it("Huge swap otz", async function () {

      // swap, price changed from min to max
      let lastTick = -887272
      let currentTick = 887272

      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);

      expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.eq(2n << 96n); // 2
      expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.eq(0n << 96n); // 0
    });

    it("Huge swap zto", async function () {

      // swap, price changed from min to max
      let lastTick = 887272
      let currentTick = -887272

      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);

      expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.eq(0n << 96n); // 0
      expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.eq(2n << 96n); // 2
    });

    it("Shift correct after two oneToZero movements", async function () {
      await slidingFeePlugin.changeFactor(500)
      // swap, price increased x2 (otz)
      let lastTick = 10000
      let currentTick  = 16932
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);

      // swap, price increased x1.5 (otz)
      lastTick = 16932
      currentTick  = 20987
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);


      expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.approximately((7n << 96n) / 4n, 1n << 81n); // 1.75
      expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.approximately((1n << 96n) / 4n, 1n << 81n); // 0.25
    });

    it("Shift correct after two zeroToOne movements", async function () {
      await slidingFeePlugin.changeFactor(500)
      // swap, price decreased x0.5 (zt0)
      let lastTick = 20987
      let currentTick  = 14055
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);


      // swap, price decreased x0.5 (zt0)
      lastTick = 14055
      currentTick  = 7123
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);

      expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.approximately(1n << 95n , 1n << 81n); // 0.5
      expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.approximately((3n << 96n) / 2n, 1n << 81n); // 1.5
    });
    
    it("Shift correct after two oneToZero movements(negative ticks)", async function () {
      await slidingFeePlugin.changeFactor(500)
      // swap, price increased x2 (otz)
      let lastTick = -20987
      let currentTick  = -14055
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);


     // swap, price increased x1.5(otz)
      lastTick = -14055
      currentTick  = -10000
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);
      
      expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.approximately((7n << 96n) / 4n, 1n << 81n); // 1.75
      expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.approximately((1n << 96n) / 4n, 1n << 81n); // 0.25

    });

    it("Shift correct after two zeroToOne movements(negative ticks)", async function () {
      await slidingFeePlugin.changeFactor(500)
      // swap, price decreased x0.5 (zto)
      let lastTick = -10000
      let currentTick  = -16932
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);

      // swap, price decreased x0.5 (zto)
      lastTick = -16932
      currentTick  = -23864
      await slidingFeePlugin.getFeeForSwap(true, lastTick, currentTick);
      
      expect((await slidingFeePlugin.s_feeFactors()).oneToZeroFeeFactor).to.be.approximately(1n << 95n, 1n << 81n); // 0.5
      expect((await slidingFeePlugin.s_feeFactors()).zeroToOneFeeFactor).to.be.approximately((3n << 96n) / 2n, 1n << 81n); // 1.5
    });

  });

  describe('#getSlidingFee', () => {

    async function getFee(zto: boolean, lastTick: number, currentTick: number) : Promise<number>{
      let tx = await slidingFeePlugin.getFeeForSwap(zto, lastTick, currentTick); 
      return (await tx.wait()).logs[0].args['fee']
    } 
    
    beforeEach('set config', async () => {
      await slidingFeePlugin.changeBaseFee(500)
      await slidingFeePlugin.changeFactor(1000)
    });

    it("returns base fee value", async function () {
      let fee = await getFee(false, 10000, 10000)
      expect(fee).to.be.eq(500)
    });

    it("one to zero fee should be increased x1.5", async function () {
      let feeOtZ = await getFee(false, 10000, 14055)
      expect(feeOtZ).to.be.eq(750)
    });

    it("zero to one fee should be decreased x1.5", async function () {
      let feeZtO = await getFee(true, 10000, 14054)
      expect(feeZtO).to.be.eq(250)
    });

    it("handle overflow", async function () {
      await slidingFeePlugin.changeBaseFee(50000)
      let feeOtZ = await getFee(false, 10000,100000)
      expect(feeOtZ).to.be.eq(65535)
    });

    it("MIN fee is 1 (0.0001%)", async function () {
      await slidingFeePlugin.changeBaseFee(50000)
      let feeOtZ = await getFee(true, 10000,100000)
      expect(feeOtZ).to.be.eq(1)
    });

  })


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