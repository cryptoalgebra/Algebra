import { expect } from './shared/expect';
import { ethers } from 'hardhat';
import { AdaptiveFeeTest } from '../typechain';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import snapshotGasCost from './shared/snapshotGasCost';

describe('AdaptiveFee', () => {
  let adaptiveFee: AdaptiveFeeTest;

  async function adaptiveFeeFixture() {
    const factory = await ethers.getContractFactory('AdaptiveFeeTest');
    return (await factory.deploy()) as any as AdaptiveFeeTest;
  }

  beforeEach('deploy AdaptiveFeeTest', async () => {
    adaptiveFee = await loadFixture(adaptiveFeeFixture);
  });

  it('check pack and unpack of config', async () => {
    const config = {
      alpha1: 2900,
      alpha2: 15000 - 3000,
      beta1: 360,
      beta2: 60000,
      gamma1: 59,
      gamma2: 8500,
      baseFee: 100,
    };

    const result = await adaptiveFee.packAndUnpackFeeConfig(config);
    expect(result.alpha1).to.be.eq(config.alpha1);
    expect(result.alpha2).to.be.eq(config.alpha2);
    expect(result.beta1).to.be.eq(config.beta1);
    expect(result.beta2).to.be.eq(config.beta2);
    expect(result.gamma1).to.be.eq(config.gamma1);
    expect(result.gamma2).to.be.eq(config.gamma2);
    expect(result.baseFee).to.be.eq(config.baseFee);
  });

  describe('#getFee', () => {
    it('fee: 0 volatility 0 volume', async () => {
      expect(await adaptiveFee.getFee(0)).to.be.eq(100);
    });

    it('fee grid snapshot', async () => {
      const config = {
        alpha1: 2900,
        alpha2: 15000 - 3000,
        beta1: 360,
        beta2: 60000,
        gamma1: 59,
        gamma2: 8500,
        baseFee: 100,
      };

      const getFee = (volatility: any) => {
        let sigma1 = 0;
        if (config.beta1 - volatility <= -6 * config.gamma1) sigma1 = config.alpha1;
        else if (config.beta1 - volatility >= 6 * config.gamma1) sigma1 = 0;
        else sigma1 = config.alpha1 / (1 + Math.exp((config.beta1 - volatility) / config.gamma1));

        let sigma2 = 0;
        if (config.beta2 - volatility <= -6 * config.gamma2) sigma2 = config.alpha2;
        else if (config.beta2 - volatility >= 6 * config.gamma2) sigma2 = 0;
        else sigma2 = config.alpha2 / (1 + Math.exp((config.beta2 - volatility) / config.gamma2));

        return config.baseFee + sigma1 + sigma2;
      };

      let volats = [
        0, 25, 50, 75, 100, 112, 125, 150, 175, 200, 250, 300, 325, 350, 359, 360, 375, 400, 500, 525, 800, 1000, 1500, 2000, 3000, 5000, 8000, 10000,
        20000, 50000, 60000, 80000, 100000,
      ];
      let res = '';

      let meanError = 0;
      let maxError = 0;
      let prev = 0;
      for (let volatility of volats) {
        let fee = getFee(volatility);
        let cFee = Number((await adaptiveFee.getFee(BigInt(volatility * 15))).toString());
        expect(cFee).to.be.gte(prev);
        prev = cFee;
        let error = ((cFee - fee) * 100) / fee;
        res += '[Volt: ' + volatility + '] Fee:' + cFee + ' Correct: ' + fee + ' Error: ' + error.toFixed(2) + '% \n';
        meanError += error;
        if (Math.abs(error) > maxError) maxError = error;
      }
      meanError /= volats.length;
      res += 'Mean error: ' + meanError.toFixed(2) + '%\n';
      res += 'Max error: ' + maxError.toFixed(2) + '%\n';
      res += '\n======================================\n';

      expect(res).to.matchSnapshot('fee grid snapshot');
    });
  });

  describe('#getFee gas cost  [ @skip-on-coverage ]', () => {
    it('gas cost of 0 volatility', async () => {
      await snapshotGasCost(adaptiveFee.getGasCostOfGetFee(0));
    });

    it('gas cost of 100 volatility', async () => {
      await snapshotGasCost(adaptiveFee.getGasCostOfGetFee(100));
    });

    it('gas cost of 2000 volatility', async () => {
      await snapshotGasCost(adaptiveFee.getGasCostOfGetFee(2000));
    });
  });
});
