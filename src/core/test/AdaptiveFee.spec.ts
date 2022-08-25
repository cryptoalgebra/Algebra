import { expect } from './shared/expect'
import { AdaptiveFeeTest } from '../typechain/test/AdaptiveFeeTest'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import snapshotGasCost from './shared/snapshotGasCost'

const { BigNumber } = ethers

describe('AdaptiveFee', () => {
  let adaptiveFee: AdaptiveFeeTest
  const fixture = async () => {
    const factory = await ethers.getContractFactory('AdaptiveFeeTest')
    return (await factory.deploy()) as AdaptiveFeeTest
  }
  beforeEach('deploy AdaptiveFeeTest', async () => {
    adaptiveFee = await loadFixture(fixture)
  })

  describe('#getFee', () => {
    it('fee: 0 volat 0 volume', async () => {
      console.log( (await adaptiveFee.getFee(BigNumber.from(0), BigNumber.from(0))).toString());
    })



    it('fee grid snapshot', async () => {
      const config = {
        alpha1: 2900,
        alpha2: 15000 - 3000,
        beta1: 360,
        beta2: 60000,
        gamma1: 59,
        gamma2: 8500,
        volumeBeta: 0,
        volumeGamma: 10,
        baseFee: 100
      }

      const getFee = (volume: any, volatility: any) => {
        let sigm1 = 0
        if (config.beta1 - volatility <= -6*config.gamma1) sigm1 = config.alpha1;
        else if (config.beta1 - volatility >= 6*config.gamma1) sigm1 = 0;
        else sigm1 = config.alpha1 / (1 + Math.exp((config.beta1 - volatility)/config.gamma1));

        let sigm2 = 0;
        if (config.beta2 - volatility <= -6*config.gamma2) sigm2 = config.alpha2;
        else if (config.beta2 - volatility >= 6*config.gamma2) sigm2 = 0;
        else sigm2 = config.alpha2 / (1 + Math.exp((config.beta2 - volatility)/config.gamma2));

        let volumeSigm = 0;
        if (config.volumeBeta - volume <= -6*config.volumeGamma) volumeSigm = sigm1 + sigm2;
        else if (config.volumeBeta - volume >= 6*config.volumeGamma) volumeSigm = 0;
        else volumeSigm = (sigm1 + sigm2) / (1 + Math.exp((config.volumeBeta - volume)/config.volumeGamma));
        
        return config.baseFee + volumeSigm;
      }

      let volats = [0, 25, 50, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400, 500, 800, 1000, 1500, 2000, 3000, 5000, 8000, 10000, 20000 , 50000, 60000, 80000, 100000];
      let volumes = [0, 15, 30, 45, 60];
      let res = '';
      for (let vol of volumes) {
        let meanError = 0;
        let maxError = 0
        let prev = 0;
        for (let volat of volats) {
          let fee = getFee(vol, volat);
          let cFee = Number((await adaptiveFee.getFee(BigNumber.from(volat), BigNumber.from(vol))).toString())
          expect(cFee).to.be.gte(prev);
          prev = cFee;
          let error = (cFee - fee) * 100 / fee;
          res += '[Volm: ' + vol + 'Volt: ' + volat + '] Fee:' + cFee + ' Correct: ' + fee + ' Error: ' + (error).toFixed(2) +'% \n';
          meanError += error;
          if (Math.abs(error) > maxError) maxError = error;
        }
        meanError /= volats.length;
        res += 'Mean error: ' + meanError.toFixed(2) + '%\n';
        res += 'Max error: ' + maxError.toFixed(2) + '%\n';
        res +='\n======================================\n'
      }
      expect(res).to.matchSnapshot('fee grid snapshot')
    })
  })

  describe('#getFee gas cost  [ @skip-on-coverage ]', () => {
    it('gas cost of 0 volat 0 volume', async () => {
      await snapshotGasCost(adaptiveFee.getGasCostOfGetFee(BigNumber.from(0), BigNumber.from(0)));
    })

    it('gas cost of 0 volat 100 volume', async () => {
      await snapshotGasCost(adaptiveFee.getGasCostOfGetFee(BigNumber.from(0), BigNumber.from(100)));
    })

    it('gas cost of 100 volat 0 volume', async () => {
      await snapshotGasCost(adaptiveFee.getGasCostOfGetFee(BigNumber.from(100), BigNumber.from(0)));
    })

    it('gas cost of 100 volat 100 volume', async () => {
      await snapshotGasCost(adaptiveFee.getGasCostOfGetFee(BigNumber.from(100), BigNumber.from(100)));
    })

    it('gas cost of 2000 volat 100 volume', async () => {
      await snapshotGasCost(adaptiveFee.getGasCostOfGetFee(BigNumber.from(2000), BigNumber.from(100)));
    })
  })
})
