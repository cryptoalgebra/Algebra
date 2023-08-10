import { expect } from 'chai'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { BigNumberish, ContractFactory, MaxUint256 } from 'ethers'
import { TestERC20, WeightedDataStorageTest } from '../typechain'
import { sortedTokens } from './shared/tokenSort'

describe('WeightedDataStorageLibrary', () => {
  let tokens: TestERC20[]
  let dataStorage: WeightedDataStorageTest

  const dataStorageTestFixture = async () => {
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const tokens = await sortedTokens(
      await tokenFactory.deploy(MaxUint256 / 2n) as any as TestERC20,
      await tokenFactory.deploy(MaxUint256 / 2n) as any as TestERC20,
    )

    const dataStorageFactory = await ethers.getContractFactory('WeightedDataStorageTest')
    const dataStorage = await dataStorageFactory.deploy()

    return {
      tokens: tokens as any[] as TestERC20[],
      dataStorage: dataStorage as any as WeightedDataStorageTest,
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
      const secondsPerLiqCumulatives: [BigNumberish, BigNumberish] = [10, 20]
      const mockObservable = await observableWith({
        period,
        tickCumulatives: [12, 12],
        secondsPerLiqCumulatives,
        volumePerLiquidityCumulatives: [12, 12]
      })
      const timepoint = await dataStorage.consult(mockObservable, period)

      expect(timepoint.arithmeticMeanTick).to.equal(0)
      expect(timepoint.harmonicMeanLiquidity).to.equal(calculateHarmonicAvgLiq(period, secondsPerLiqCumulatives))
    })

    it('correct rounding for .5 negative tick', async () => {
      const period = 4

      const secondsPerLiqCumulatives: [BigNumberish, BigNumberish] = [10, 15]
      const mockObservable = await observableWith({
        period,
        tickCumulatives: [-10, -12],
        secondsPerLiqCumulatives,
        volumePerLiquidityCumulatives: [12, 12]
      })

      const timepoint = await dataStorage.consult(mockObservable, period)

      // Always round to negative infinity
      // In this case, we need to subtract one because integer division rounds to 0
      expect(timepoint.arithmeticMeanTick).to.equal(-1)
      expect(timepoint.harmonicMeanLiquidity).to.equal(calculateHarmonicAvgLiq(period, secondsPerLiqCumulatives))
    })

    it('correct output for liquidity overflow', async () => {
      const period = 1

      const secondsPerLiqCumulatives: [BigNumberish, BigNumberish] = [10, 11]
      const mockObservable = await observableWith({
        period,
        tickCumulatives: [12, 12],
        secondsPerLiqCumulatives,
        volumePerLiquidityCumulatives: [12, 12]
      })

      const timepoint = await dataStorage.consult(mockObservable, period)

      expect(timepoint.arithmeticMeanTick).to.equal(0)

      // Make sure liquidity doesn't overflow uint128
      expect(timepoint.harmonicMeanLiquidity).to.equal(2n ** 128n - 1n)
    })

    function calculateHarmonicAvgLiq(period: number, secondsPerLiqCumulatives: [BigNumberish, BigNumberish]) {
      const [secondsPerLiq0, secondsPerLiq1] = secondsPerLiqCumulatives.map(BigInt)
      const delta = secondsPerLiq1 - secondsPerLiq0

      const maxUint160 = 2n ** 160n - 1n
      return maxUint160 * BigInt(period) / (delta << 32n);
    }

    function observableWith({
      period,
      tickCumulatives,
      secondsPerLiqCumulatives,
      volumePerLiquidityCumulatives
    }: {
      period: number
      tickCumulatives: [BigNumberish, BigNumberish]
      secondsPerLiqCumulatives: [BigNumberish, BigNumberish]
      volumePerLiquidityCumulatives: [BigNumberish, BigNumberish]
    }) {
      return mockObservableFactory.deploy(
        [period, 0],
        tickCumulatives.map(BigInt),
        secondsPerLiqCumulatives.map(BigInt),
        [0,0],
        volumePerLiquidityCumulatives.map(BigInt)
      )
    }
  })

  describe('#getArithmeticMeanTickWeightedByLiquidity', () => {
    it('single timepoint returns average tick', async () => {
      const averageTick = 10
      const timepoint = timepointWith({ arithmeticMeanTick: averageTick, harmonicMeanLiquidity: 10 })

      const dataStorageTick = await dataStorage.getArithmeticMeanTickWeightedByLiquidity([timepoint])

      expect(dataStorageTick).to.equal(averageTick)
    })

    it('multiple timepoints with same weight result in average across tiers', async () => {
      const timepoint1 = timepointWith({ arithmeticMeanTick: 10, harmonicMeanLiquidity: 10 })
      const timepoint2 = timepointWith({ arithmeticMeanTick: 20, harmonicMeanLiquidity: 10 })

      const dataStorageTick = await dataStorage.getArithmeticMeanTickWeightedByLiquidity([timepoint1, timepoint2])

      expect(dataStorageTick).to.equal(15)
    })

    it('multiple timepoints with different weights are weighted correctly', async () => {
      const timepoint1 = timepointWith({ arithmeticMeanTick: 10, harmonicMeanLiquidity: 10 })
      const timepoint2 = timepointWith({ arithmeticMeanTick: 20, harmonicMeanLiquidity: 15 })

      const dataStorageTick = await dataStorage.getArithmeticMeanTickWeightedByLiquidity([timepoint1, timepoint2])

      expect(dataStorageTick).to.equal(16)
    })

    it('correct rounding for .5 negative tick', async () => {
      const timepoint1 = timepointWith({ arithmeticMeanTick: -10, harmonicMeanLiquidity: 10 })
      const timepoint2 = timepointWith({ arithmeticMeanTick: -11, harmonicMeanLiquidity: 10 })

      const dataStorageTick = await dataStorage.getArithmeticMeanTickWeightedByLiquidity([timepoint1, timepoint2])

      expect(dataStorageTick).to.equal(-11)
    })

    function timepointWith({
      arithmeticMeanTick,
      harmonicMeanLiquidity,
    }: {
      arithmeticMeanTick: BigNumberish
      harmonicMeanLiquidity: BigNumberish
    }) {
      return {
        arithmeticMeanTick,
        harmonicMeanLiquidity,
      }
    }
  })
})
