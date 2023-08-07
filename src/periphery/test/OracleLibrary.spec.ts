import { expect } from 'chai'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { MaxUint256,  ContractFactory } from 'ethers'
import { DataStorageTest, TestERC20 } from '../typechain'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import snapshotGasCost from './shared/snapshotGasCost'
import { sortedTokens } from './shared/tokenSort'

describe('DataStorageLibrary', () => {
  let tokens: TestERC20[]
  let dataStorage: DataStorageTest

  const dataStorageTestFixture = async () => {
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const tokens: [TestERC20, TestERC20] = await sortedTokens(
      (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20, // do not use maxu256 to avoid overflowing
      (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20,
    );

    const dataStorageFactory = await ethers.getContractFactory('DataStorageTest')
    const dataStorage = await dataStorageFactory.deploy()

    return {
      tokens: tokens as TestERC20[],
      dataStorage: dataStorage as any as DataStorageTest,
    }
  }

  beforeEach('deploy fixture', async () => {
    const fixtures = await loadFixture(dataStorageTestFixture)
    tokens = fixtures['tokens']
    dataStorage = fixtures['dataStorage']
  })

  describe('#consult', () => {
    let mockObservableFactory: ContractFactory

    before('create mockObservableFactory', async () => {
      mockObservableFactory = await ethers.getContractFactory('MockObservable')
    })

    it('reverts when period is 0', async () => {
      await expect(dataStorage.consult(dataStorage, 0)).to.be.revertedWith('BP')
    })

    it('correct output when tick is 0', async () => {
      const period = 3
      const tickCumulatives = [12n, 12n]
      const mockObservable = await mockObservableFactory.deploy([period, 0], tickCumulatives, [0, 0], [0,0], [0,0])
      const dataStorageTick = await dataStorage.consult(mockObservable, period)

      expect(dataStorageTick).to.equal(0n)
    })

    it('correct output for positive tick', async () => {
      const period = 3
      const tickCumulatives = [7n, 12n]
      const mockObservable = await mockObservableFactory.deploy([period, 0], tickCumulatives, [0, 0], [0,0], [0,0])
      const dataStorageTick = await dataStorage.consult(mockObservable, period)

      // Always round to negative infinity
      // In this case, we don't have do anything
      expect(dataStorageTick).to.equal(1n)
    })

    it('correct output for negative tick', async () => {
      const period = 3
      const tickCumulatives = [-7n, -12n]
      const mockObservable = await mockObservableFactory.deploy([period, 0], tickCumulatives, [0, 0], [0,0], [0,0])
      const dataStorageTick = await dataStorage.consult(mockObservable, period)

      // Always round to negative infinity
      // In this case, we need to subtract one because integer division rounds to 0
      expect(dataStorageTick).to.equal(-2n)
    })

    it('correct rounding for .5 negative tick', async () => {
      const period = 4
      const tickCumulatives = [-10n, -12n]
      const mockObservable = await mockObservableFactory.deploy([period, 0], tickCumulatives, [0, 0], [0,0], [0,0])
      const dataStorageTick = await dataStorage.consult(mockObservable, period)

      // Always round to negative infinity
      // In this case, we need to subtract one because integer division rounds to 0
      expect(dataStorageTick).to.equal(-1n)
    })

    it('gas test [ @skip-on-coverage ]', async () => {
      const period = 3
      const tickCumulatives = [7n, 12n]
      const mockObservable = await mockObservableFactory.deploy([period, 0], tickCumulatives, [0, 0], [0,0], [0,0])

      await snapshotGasCost(dataStorage.getGasCostOfConsult(mockObservable, period))
    })
  })

  describe('#getQuoteAtTick', () => {
    // sanity check
    it('token0: returns correct value when tick = 0', async () => {
      const quoteAmount = await dataStorage.getQuoteAtTick(
        0n,
        expandTo18Decimals(1),
        tokens[0].address,
        tokens[1].address
      )

      expect(quoteAmount).to.equal(expandTo18Decimals(1))
    })

    // sanity check
    it('token1: returns correct value when tick = 0', async () => {
      const quoteAmount = await dataStorage.getQuoteAtTick(
        0n,
        expandTo18Decimals(1),
        tokens[1].address,
        tokens[0].address
      )

      expect(quoteAmount).to.equal(expandTo18Decimals(1))
    })

    it('token0: returns correct value when at min tick | 0 < sqrtRatioX96 <= type(uint128).max', async () => {
      const quoteAmount = await dataStorage.getQuoteAtTick(
        -887272n,
        2n ** 128n - 1n,
        tokens[0].address,
        tokens[1].address
      )
      expect(quoteAmount).to.equal(1n)
    })

    it('token1: returns correct value when at min tick | 0 < sqrtRatioX96 <= type(uint128).max', async () => {
      const quoteAmount = await dataStorage.getQuoteAtTick(
        -887272n,
        2n ** 128n - 1n,
        tokens[1].address,
        tokens[0].address
      )
      expect(quoteAmount).to.equal(
        '115783384738768196242144082653949453838306988932806144552194799290216044976282'
      )
    })

    it('token0: returns correct value when at max tick | sqrtRatioX96 > type(uint128).max', async () => {
      const quoteAmount = await dataStorage.getQuoteAtTick(
        887272n,
        2n ** 128n - 1n,
        tokens[0].address,
        tokens[1].address
      )
      expect(quoteAmount).to.equal(
        '115783384785599357996676985412062652720342362943929506828539444553934033845703'
      )
    })

    it('token1: returns correct value when at max tick | sqrtRatioX96 > type(uint128).max', async () => {
      const quoteAmount = await dataStorage.getQuoteAtTick(
        887272n,
        2n ** 128n - 1n,
        tokens[1].address,
        tokens[0].address
      )
      expect(quoteAmount).to.equal(1n)
    })

    it('gas test [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        dataStorage.getGasCostOfGetQuoteAtTick(
          10n,
          expandTo18Decimals(1),
          tokens[0].address,
          tokens[1].address
        )
      )
    })
  })
})
