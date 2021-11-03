import { expect } from './shared/expect'
import { AdaptiveFeeTest } from '../typechain/AdaptiveFeeTest'
import { ethers, waffle } from 'hardhat'
import snapshotGasCost from './shared/snapshotGasCost'

const { BigNumber } = ethers

describe('AdaptiveFee', () => {
  let adaptiveFee: AdaptiveFeeTest
  const fixture = async () => {
    const factory = await ethers.getContractFactory('AdaptiveFeeTest')
    return (await factory.deploy()) as AdaptiveFeeTest
  }
  beforeEach('deploy AdaptiveFeeTest', async () => {
    adaptiveFee = await waffle.loadFixture(fixture)
  })

  describe('#getFee', () => {
    it('fee: 0 volat 0 volume', async () => {
      console.log( (await adaptiveFee.getFee(BigNumber.from(0), BigNumber.from(0))).toString());
    })

    it('fee grid snapshot', async () => {
      let volats = [0, 50, 100, 150, 200, 250, 300, 350, 400, 500, 800, 1000, 1500, 2000];
      let volumes = [0, 15, 30, 45, 60];
      let res = '';
      for (let vol of volumes) {
        for (let volat of volats) {
          res += ('[Volm: ' + vol + 'Volt: ' + volat + ']' + (await adaptiveFee.getFee(BigNumber.from(volat), BigNumber.from(vol))).toString()) + '\n';
        }
        res +='\n======================================\n'
      }
      expect(res).to.matchSnapshot('fee grid snapshot')
    })
  })

  describe('#getFee gas cost', () => {
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
