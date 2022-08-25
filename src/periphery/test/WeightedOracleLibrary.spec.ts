import { expect } from 'chai'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { BigNumber, BigNumberish, constants, ContractFactory } from 'ethers'
import { TestERC20, WeightedDataStorageTest } from '../typechain'

describe('WeightedDataStorageLibrary', () => {
  let tokens: TestERC20[]
  let dataStorage: WeightedDataStorageTest

  const dataStorageTestFixture = async () => {
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const tokens = (await Promise.all([
      tokenFactory.deploy(constants.MaxUint256.div(2)), // do not use maxu256 to avoid overflowing
      tokenFactory.deploy(constants.MaxUint256.div(2)),
    ])) as [TestERC20, TestERC20]

    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    const dataStorageFactory = await ethers.getContractFactory('WeightedDataStorageTest')
    const dataStorage = await dataStorageFactory.deploy()

    return {
      tokens: tokens as TestERC20[],
      dataStorage: dataStorage as WeightedDataStorageTest,
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
      await expect(dataStorage.consult(dataStorage.address, 0)).to.be.revertedWith('BP')
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
      const timepoint = await dataStorage.consult(mockObservable.address, period)

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

      const timepoint = await dataStorage.consult(mockObservable.address, period)

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

      const timepoint = await dataStorage.consult(mockObservable.address, period)

      expect(timepoint.arithmeticMeanTick).to.equal(0)

      // Make sure liquidity doesn't overflow uint128
      expect(timepoint.harmonicMeanLiquidity).to.equal(BigNumber.from(2).pow(128).sub(1))
    })

    function calculateHarmonicAvgLiq(period: number, secondsPerLiqCumulatives: [BigNumberish, BigNumberish]) {
      const [secondsPerLiq0, secondsPerLiq1] = secondsPerLiqCumulatives.map(BigNumber.from)
      const delta = secondsPerLiq1.sub(secondsPerLiq0)

      const maxUint160 = BigNumber.from(2).pow(160).sub(1)
      return maxUint160.mul(period).div(delta.shl(32))
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
        tickCumulatives.map(BigNumber.from),
        secondsPerLiqCumulatives.map(BigNumber.from),
        [0,0],
        volumePerLiquidityCumulatives.map(BigNumber.from)
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
