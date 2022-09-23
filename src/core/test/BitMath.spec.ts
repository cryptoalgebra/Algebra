import { expect } from './shared/expect'
import { BitMathTest } from '../typechain/test/BitMathTest'
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import snapshotGasCost from './shared/snapshotGasCost'

const { BigNumber } = ethers

describe('BitMath', () => {
  let bitMath: BitMathTest
  const fixture = async () => {
    const factory = await ethers.getContractFactory('BitMathTest')
    return (await factory.deploy()) as BitMathTest
  }
  beforeEach('deploy BitMathTest', async () => {
    bitMath = await loadFixture(fixture)
  })

  describe('#mostSignificantBit', () => {
    it('1', async () => {
      expect(await bitMath.mostSignificantBit(1)).to.eq(0)
    })
    it('2', async () => {
      expect(await bitMath.mostSignificantBit(2)).to.eq(1)
    })
    it('all powers of 2', async () => {
      const results = await Promise.all(
        [...Array(255)].map((_, i) => bitMath.mostSignificantBit(BigNumber.from(2).pow(i)))
      )
      expect(results).to.deep.eq([...Array(255)].map((_, i) => i))
    })
    it('uint256(-1)', async () => {
      expect(await bitMath.mostSignificantBit(BigNumber.from(2).pow(256).sub(1))).to.eq(255)
    })

    it('gas cost of smaller number  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(bitMath.getGasCostOfMostSignificantBit(BigNumber.from(3568)))
    })
    it('gas cost of min number  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(bitMath.getGasCostOfMostSignificantBit(BigNumber.from(1)))
    })
    it('gas cost of max uint128  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(bitMath.getGasCostOfMostSignificantBit(BigNumber.from(2).pow(128).sub(1)))
    })
    it('gas cost of max uint256  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(bitMath.getGasCostOfMostSignificantBit(BigNumber.from(2).pow(256).sub(1)))
    })
  })

  describe('#leastSignificantBit', () => {
    it('1', async () => {
      expect(await bitMath.leastSignificantBit(1)).to.eq(0)
    })
    it('2', async () => {
      expect(await bitMath.leastSignificantBit(2)).to.eq(1)
    })
    it('all powers of 2', async () => {
      const results = await Promise.all(
        [...Array(255)].map((_, i) => bitMath.leastSignificantBit(BigNumber.from(2).pow(i)))
      )
      expect(results).to.deep.eq([...Array(255)].map((_, i) => i))
    })
    it('uint256(-1)', async () => {
      expect(await bitMath.leastSignificantBit(BigNumber.from(2).pow(256).sub(1))).to.eq(0)
    })

    it('gas cost of smaller number  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(bitMath.getGasCostOfLeastSignificantBit(BigNumber.from(3568)))
    })
    it('gas cost of min number  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(bitMath.getGasCostOfLeastSignificantBit(BigNumber.from(1)))
    })
    it('gas cost of max uint128  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(bitMath.getGasCostOfLeastSignificantBit(BigNumber.from(2).pow(128).sub(1)))
    })
    it('gas cost of max uint256  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(bitMath.getGasCostOfLeastSignificantBit(BigNumber.from(2).pow(256).sub(1)))
    })
  })
})
