import { BigNumberish, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { DataStorageTest } from '../typechain'
import checkTimepointEquals from './shared/checkTimepointEquals'
import { expect } from './shared/expect'
import { TEST_POOL_START_TIME } from './shared/fixtures'
import snapshotGasCost from './shared/snapshotGasCost'

describe('DataStorage', () => {
  let wallet: Wallet, other: Wallet

  before('create fixture loader', async () => {
    ;[wallet, other] = await (ethers as any).getSigners()
  })

  const dataStorageFixture = async () => {
    const dataStorageTestFactory = await ethers.getContractFactory('DataStorageTest')
    return (await dataStorageTestFactory.deploy()) as any as DataStorageTest
  }

  const initializedDataStorageFixture = async () => {
    const dataStorage = await dataStorageFixture()
    await dataStorage.initialize({
      time: 0,
      tick: 0,
      liquidity: 0,
    })
    return dataStorage
  }

  describe('#initialize', () => {
    let dataStorage: DataStorageTest
    beforeEach('deploy test dataStorage', async () => {
      dataStorage = await loadFixture(dataStorageFixture)
    })
    it('cannot initialize twice', async () => {
      await dataStorage.initialize({ liquidity: 1, tick: 1, time: 1 })
      await expect(dataStorage.initialize({ liquidity: 2, tick: 1, time: 1 })).to.be.reverted;
    })
    it('index is 0', async () => {
      await dataStorage.initialize({ liquidity: 1, tick: 1, time: 1 })
      expect(await dataStorage.index()).to.eq(0)
    })
    it('sets first slot timestamp only', async () => {
      await dataStorage.initialize({ liquidity: 1, tick: 1, time: 1 })
      checkTimepointEquals(await dataStorage.timepoints(0), {
        initialized: true,
        blockTimestamp: 1n,
        tickCumulative: 0n
      })
    })
    it('gas  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(dataStorage.initialize({ liquidity: 1, tick: 1, time: 1 }))
    })
    it('should return interpolated volatility with gap > window', async () =>{
      await dataStorage.initialize({liquidity: 0, tick: 46054, time:1});
      await dataStorage.update({advanceTimeBy: 100, tick: 80054, liquidity:1});
      await dataStorage.update({advanceTimeBy:1, tick: 46054, liquidity: 1});
      let res = await dataStorage.getTimepoints([0])
      res = await dataStorage.getTimepoints([1])
    })
  })

  describe('#write', () => {
    let dataStorage: DataStorageTest

    beforeEach('deploy initialized test dataStorage', async () => {
      dataStorage = await loadFixture(initializedDataStorageFixture)
    })

    it('does nothing if time has not changed', async () => {
      await dataStorage.update({ advanceTimeBy: 1, tick: 3, liquidity: 2 })
      expect(await dataStorage.index()).to.eq(1)
      await dataStorage.update({ advanceTimeBy: 0, tick: -5, liquidity: 9 })
      expect(await dataStorage.index()).to.eq(1)
    })

    it('writes an index if time has changed', async () => {
      await dataStorage.update({ advanceTimeBy: 6, tick: 3, liquidity: 2 })
      expect(await dataStorage.index()).to.eq(1)
      await dataStorage.update({ advanceTimeBy: 4, tick: -5, liquidity: 9 })

      expect(await dataStorage.index()).to.eq(2)
      checkTimepointEquals(await dataStorage.timepoints(1), {
        tickCumulative: 0n,
        initialized: true,
        blockTimestamp: 6n,
      })
    })

    it('accumulates liquidity', async () => {
      await dataStorage.update({ advanceTimeBy: 3, tick: 3, liquidity: 2 })
      await dataStorage.update({ advanceTimeBy: 4, tick: -7, liquidity: 6 })
      await dataStorage.update({ advanceTimeBy: 5, tick: -2, liquidity: 4 })

      expect(await dataStorage.index()).to.eq(3)

      checkTimepointEquals(await dataStorage.timepoints(1), {
        initialized: true,
        tickCumulative: 0n,
        blockTimestamp: 3n,
      })
      checkTimepointEquals(await dataStorage.timepoints(2), {
        initialized: true,
        tickCumulative: 12n,
        blockTimestamp: 7n,
      })
      checkTimepointEquals(await dataStorage.timepoints(3), {
        initialized: true,
        tickCumulative: -23n,
        blockTimestamp: 12n,
      })
      checkTimepointEquals(await dataStorage.timepoints(4), {
        initialized: false,
        tickCumulative: 0n,
        blockTimestamp: 0n,
      })
    })
  })

  describe('#getAverageTick', () => {
    let window = 24 * 60 * 60;
    let dataStorage: DataStorageTest
    beforeEach('deploy initialized test dataStorage', async () => {
      dataStorage = await loadFixture(dataStorageFixture)
    })

    it('in the same block with init', async() => {
      await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
      const tick = await dataStorage.getAverageTick();
      expect(tick).to.be.eq(7200);
    })

    it('in exactly 24h ago', async() => {
      await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
      await dataStorage.update({ advanceTimeBy: 2, tick: 7300, liquidity: 6 });
      await dataStorage.update({ advanceTimeBy: window, tick: 7400, liquidity: 6 });
      const tick = await dataStorage.getAverageTick();
      expect(tick).to.be.eq(7300);
    })

    it('last index is exactly 24h ago', async() => {
      await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
      await dataStorage.update({ advanceTimeBy: 2, tick: 7300, liquidity: 6 });
      await dataStorage.advanceTime(window);
      const tick = await dataStorage.getAverageTick();
      expect(tick).to.be.eq(7200);
    })

    it('last index is more then 24h ago', async() => {
      await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
      await dataStorage.update({ advanceTimeBy: 2, tick: 7300, liquidity: 6 });
      await dataStorage.advanceTime(window + 1);
      const tick = await dataStorage.getAverageTick();
      expect(tick).to.be.eq(7200);

      const tickCumulative = await dataStorage.getTickCumulativeAt(0);
      expect(tickCumulative).to.be.eq(630741700);
    })

    it('find tick cumulative at the start of previous window', async() => {
      await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
      await dataStorage.update({ advanceTimeBy: 2, tick: 7300, liquidity: 6 });
      await dataStorage.update({ advanceTimeBy: window, tick: 7350, liquidity: 6 });
      await dataStorage.advanceTime(1);

      const tickCumulative = await dataStorage.getTickCumulativeAt(window + 1);
      expect(tickCumulative).to.be.eq(14400);
      expect(await dataStorage.getTickCumulativeAt(window)).to.be.eq(tickCumulative + 7300n)
      expect(await dataStorage.getTickCumulativeAt(window - 1)).to.be.eq(tickCumulative + 7300n * 2n)
    })

    describe('oldest timepoint is more than WINDOW seconds ago', async() => {
      beforeEach('initialize', async () => {
        await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
        await dataStorage.update({ advanceTimeBy: window / 2, tick: 7300, liquidity: 6 });
        await dataStorage.update({ advanceTimeBy: window / 2 + 1, tick: 7350, liquidity: 6 });
      })

      it('last timepoint is target', async() => {
        const tick = await dataStorage.getAverageTick();
        expect(tick).to.be.eq(7250);
      })

      it('target is after last timepoint', async() => {
        await dataStorage.advanceTime(10);
        const tick = await dataStorage.getAverageTick();
        expect(tick).to.be.eq(7250);
      })
    })

    describe('oldest timepoint is less than WINDOW seconds ago', async() => {
      beforeEach('initialize', async () => {
        await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
        await dataStorage.update({ advanceTimeBy: 2, tick: 7250, liquidity: 6 });
        await dataStorage.update({ advanceTimeBy: window / 2, tick: 7230, liquidity: 6 });
      })

      it('last timepoint is target', async() => {
        const tick = await dataStorage.getAverageTick();
        expect(tick).to.be.eq(7249);
      })

      it('target is after last timepoint', async() => {
        await dataStorage.advanceTime(10);
        const tick = await dataStorage.getAverageTick();
        expect(tick).to.be.eq(7249);
      })
    })

    it('potential overflow scenario', async () => {
      const window = 24 * 60 * 60;
      await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
      let avrgTick = await dataStorage.getAverageTick();
      expect(avrgTick).to.be.lt(7300)
      expect(avrgTick).to.be.gt(7100);
      await dataStorage.update({ advanceTimeBy: 60*60, tick: 7300, liquidity: 6 })
      avrgTick = await dataStorage.getAverageTick();
      expect(avrgTick).to.be.lt(7300)
      expect(avrgTick).to.be.gt(7199);
      
      await dataStorage.update({ advanceTimeBy: window - 2, tick: 7400, liquidity: 8 })
      avrgTick = await dataStorage.getAverageTick();
      expect(avrgTick).to.be.lt(7400)
      expect(avrgTick).to.be.gt(7200);

      await dataStorage.update({ advanceTimeBy: 2, tick: 7600, liquidity: 8 })
      avrgTick = await dataStorage.getAverageTick();
      expect(avrgTick).to.be.lt(7400)
      expect(avrgTick).to.be.gt(7200);
    })
  })

  describe('#getAverageVolatility', () => {
    let dataStorage: DataStorageTest
    const window = 24 * 60 * 60;
    beforeEach('deploy initialized test dataStorage', async () => {
      dataStorage = await loadFixture(dataStorageFixture)
    })

    it('in the same block with init', async() => {
      await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
      const volatility = await dataStorage.getAverageVolatility();
      expect(volatility).to.be.eq(0);
    })

    it('in exactly 24h ago', async() => {
      await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
      await dataStorage.update({ advanceTimeBy: 2, tick: 7300, liquidity: 6 });
      await dataStorage.update({ advanceTimeBy: window, tick: 7400, liquidity: 6 });
      const volatility = await dataStorage.getAverageVolatility();
      expect(volatility).to.be.eq(3333);
    })

    it('last index is exactly 24h ago', async() => {
      await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
      await dataStorage.update({ advanceTimeBy: 2, tick: 7300, liquidity: 6 });
      await dataStorage.advanceTime(window);
      const volatility = await dataStorage.getAverageVolatility();
      expect(volatility).to.be.eq(3333);
    })

    it('last index is more then 24h ago', async() => {
      await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
      await dataStorage.update({ advanceTimeBy: 2, tick: 7300, liquidity: 6 });
      await dataStorage.advanceTime(window + 1);
      const volatility = await dataStorage.getAverageVolatility();
      expect(volatility).to.be.eq(3333);
    })

    it('specific case for binary search (atOrAfter)', async() => {
      await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
      await dataStorage.update({ advanceTimeBy: 2, tick: 7300, liquidity: 6 });
      await dataStorage.update({ advanceTimeBy: 2 * 60 * 60, tick: 7300, liquidity: 6 });
      await dataStorage.update({ advanceTimeBy: 2 * 60 * 60, tick: 73100, liquidity: 6 });
      await dataStorage.advanceTime(window - 2 * 60*60);
      const volatility = await dataStorage.getAverageVolatility();
      expect(volatility).to.be.eq(1322990997);
    })

    describe('oldest timepoint is more than WINDOW seconds ago', async() => {
      beforeEach('initialize', async () => {
        await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
        await dataStorage.update({ advanceTimeBy: window / 2, tick: 7300, liquidity: 6 });
        await dataStorage.update({ advanceTimeBy: window / 2 + 1, tick: 7350, liquidity: 6 });
      })

      it('last timepoint is target', async() => {
        const volatility = await dataStorage.getAverageVolatility();
        expect(volatility).to.be.eq(1666);
      })

      it('target is after last timepoint', async() => {
        await dataStorage.advanceTime(10);
        const volatility = await dataStorage.getAverageVolatility();
        expect(volatility).to.be.eq(1667);
      })
    })

    describe('oldest timepoint is less than WINDOW seconds ago', async() => {
      beforeEach('initialize', async () => {
        await dataStorage.initialize({ liquidity: 4, tick: 7200, time: 1000 });
        await dataStorage.update({ advanceTimeBy: 2, tick: 7250, liquidity: 6 });
        await dataStorage.update({ advanceTimeBy: window / 2, tick: 7230, liquidity: 6 });
      })

      it('last timepoint is target', async() => {
        const volatility = await dataStorage.getAverageVolatility();
        expect(volatility).to.be.eq(833);
      })

      it('target is after last timepoint', async() => {
        await dataStorage.advanceTime(10);
        const volatility = await dataStorage.getAverageVolatility();
        expect(volatility).to.be.eq(833);
      })
    })
  })

  describe('#getTimepoints', () => {
    describe('before initialization', async () => {
      let dataStorage: DataStorageTest
      beforeEach('deploy test dataStorage', async () => {
        dataStorage = await loadFixture(dataStorageFixture)
      })

      const getSingleTimepoint = async (secondsAgo: number) => {
        const {
          tickCumulatives: [tickCumulative]
        } = await dataStorage.getTimepoints([secondsAgo])
        return { tickCumulative }
      }

      it('fails if an older timepoint does not exist', async () => {
        await dataStorage.initialize({ liquidity: 4, tick: 2, time: 5 })
        await expect(getSingleTimepoint(1)).to.be.revertedWithCustomError(dataStorage, 'targetIsTooOld')
      })

      it('does not fail across overflow boundary', async () => {
        await dataStorage.initialize({ liquidity: 4, tick: 2, time: 2 ** 32 - 1 })
        await dataStorage.advanceTime(2)
        const { tickCumulative} = await getSingleTimepoint(1)
        expect(tickCumulative).to.be.eq(2)
      })


      it('single timepoint at current time', async () => {
        await dataStorage.initialize({ liquidity: 4, tick: 2, time: 5 })
        const { tickCumulative } = await getSingleTimepoint(0)
        expect(tickCumulative).to.eq(0)
      })

      it('single timepoint in past but not earlier than secondsAgo', async () => {
        await dataStorage.initialize({ liquidity: 4, tick: 2, time: 5 })
        await dataStorage.advanceTime(3)
        await expect(getSingleTimepoint(4)).to.be.revertedWithCustomError(dataStorage, 'targetIsTooOld')
      })

      it('single timepoint in past at exactly seconds ago', async () => {
        await dataStorage.initialize({ liquidity: 4, tick: 2, time: 5 })
        await dataStorage.advanceTime(3)
        const { tickCumulative } = await getSingleTimepoint(3)
        expect(tickCumulative).to.eq(0)
      })

      it('single timepoint in past counterfactual in past', async () => {
        await dataStorage.initialize({ liquidity: 4, tick: 2, time: 5 })
        await dataStorage.advanceTime(3)
        const { tickCumulative } = await getSingleTimepoint(1)
        expect(tickCumulative).to.eq(4)
      })

      it('single timepoint in past counterfactual now', async () => {
        await dataStorage.initialize({ liquidity: 4, tick: 2, time: 5 })
        await dataStorage.advanceTime(3)
        const { tickCumulative } = await getSingleTimepoint(0)
        expect(tickCumulative).to.eq(6)
      })

      it('two timepoints in chronological order 0 seconds ago exact', async () => {
        await dataStorage.initialize({ liquidity: 5, tick: -5, time: 5 })
        await dataStorage.update({ advanceTimeBy: 4, tick: 1, liquidity: 2 })
        const { tickCumulative } = await getSingleTimepoint(0)
        expect(tickCumulative).to.eq(-20)
      })

      it('two timepoints in chronological order 0 seconds ago counterfactual', async () => {
        await dataStorage.initialize({ liquidity: 5, tick: -5, time: 5 })
        await dataStorage.update({ advanceTimeBy: 4, tick: 1, liquidity: 2 })
        await dataStorage.advanceTime(7)
        const { tickCumulative } = await getSingleTimepoint(0)
        expect(tickCumulative).to.eq(-13)
      })

      it('two timepoints in chronological order seconds ago is exactly on first timepoint', async () => {
        await dataStorage.initialize({ liquidity: 5, tick: -5, time: 5 })
        await dataStorage.update({ advanceTimeBy: 4, tick: 1, liquidity: 2 })
        await dataStorage.advanceTime(7)
        const { tickCumulative } = await getSingleTimepoint(11)
        expect(tickCumulative).to.eq(0)
      })

      it('two timepoints in chronological order seconds ago is between first and second', async () => {
        await dataStorage.initialize({ liquidity: 5, tick: -5, time: 5 })
        await dataStorage.update({ advanceTimeBy: 4, tick: 1, liquidity: 2 })
        await dataStorage.advanceTime(7)
        const { tickCumulative } = await getSingleTimepoint(9)
        expect(tickCumulative).to.eq(-10)
      })

      it('two timepoints in reverse order 0 seconds ago exact', async () => {
        await dataStorage.initialize({ liquidity: 5, tick: -5, time: 5 })
        await dataStorage.update({ advanceTimeBy: 4, tick: 1, liquidity: 2 })
        await dataStorage.update({ advanceTimeBy: 3, tick: -5, liquidity: 4 })
        const { tickCumulative,  } = await getSingleTimepoint(0)
        expect(tickCumulative).to.eq(-17)
      })

      it('two timepoints in reverse order 0 seconds ago counterfactual', async () => {
        await dataStorage.initialize({ liquidity: 5, tick: -5, time: 5 })
        await dataStorage.update({ advanceTimeBy: 4, tick: 1, liquidity: 2 })
        await dataStorage.update({ advanceTimeBy: 3, tick: -5, liquidity: 4 })
        await dataStorage.advanceTime(7)
        const { tickCumulative,  } = await getSingleTimepoint(0)
        expect(tickCumulative).to.eq(-52)
      })

      it('two timepoints in reverse order seconds ago is exactly on first timepoint', async () => {
        await dataStorage.initialize({ liquidity: 5, tick: -5, time: 5 })
        await dataStorage.update({ advanceTimeBy: 4, tick: 1, liquidity: 2 })
        await dataStorage.update({ advanceTimeBy: 3, tick: -5, liquidity: 4 })
        await dataStorage.advanceTime(7)
        const { tickCumulative } = await getSingleTimepoint(10)
        expect(tickCumulative).to.eq(-20)
      })

      it('two timepoints in reverse order seconds ago is between first and second', async () => {
        await dataStorage.initialize({ liquidity: 5, tick: -5, time: 5 })
        await dataStorage.update({ advanceTimeBy: 4, tick: 1, liquidity: 2 })
        await dataStorage.update({ advanceTimeBy: 3, tick: -5, liquidity: 4 })
        await dataStorage.advanceTime(7)
        const { tickCumulative,  } = await getSingleTimepoint(9)
        expect(tickCumulative).to.eq(-19)
      })

      it('can fetch multiple timepoints', async () => {
        await dataStorage.initialize({ time: 5, tick: 2, liquidity: 2n ** 15n })
        await dataStorage.update({ advanceTimeBy: 13, tick: 6, liquidity: 2n ** 12n })
        await dataStorage.advanceTime(5)

        const { tickCumulatives } = await dataStorage.getTimepoints([0, 3, 8, 13, 15, 18])
        expect(tickCumulatives).to.have.lengthOf(6)
        expect(tickCumulatives[0]).to.eq(56)
        expect(tickCumulatives[1]).to.eq(38)
        expect(tickCumulatives[2]).to.eq(20)
        expect(tickCumulatives[3]).to.eq(10)
        expect(tickCumulatives[4]).to.eq(6)
        expect(tickCumulatives[5]).to.eq(0)
      })

      it('gas for getTimepoints since most recent  [ @skip-on-coverage ]', async () => {
        await dataStorage.initialize({ liquidity: 5, tick: -5, time: 5 })
        await dataStorage.advanceTime(2)
        await snapshotGasCost(dataStorage.getGasCostOfGetPoints([1]))
      })

      it('gas for single timepoint at current time  [ @skip-on-coverage ]', async () => {
        await dataStorage.initialize({ liquidity: 5, tick: -5, time: 5 })
        await snapshotGasCost(dataStorage.getGasCostOfGetPoints([0]))
      })

      it('gas for single timepoint at current time counterfactually computed  [ @skip-on-coverage ]', async () => {
        await dataStorage.initialize({ liquidity: 5, tick: -5, time: 5 })
        await dataStorage.advanceTime(5)
        await snapshotGasCost(dataStorage.getGasCostOfGetPoints([0]))
      })
    })

    for (const startingTime of [5, 2 ** 32 - 5]) {
      describe(`initialized with 5 timepoints with starting time of ${startingTime}`, () => {
        const dataStorageFixture5Timepoints = async () => {
          const dataStorage = await dataStorageFixture()
          await dataStorage.initialize({ liquidity: 5, tick: -5, time: startingTime })
          await dataStorage.update({ advanceTimeBy: 3, tick: 1, liquidity: 2 })
          await dataStorage.update({ advanceTimeBy: 2, tick: -6, liquidity: 4 })
          await dataStorage.update({ advanceTimeBy: 4, tick: -2, liquidity: 4 })
          await dataStorage.update({ advanceTimeBy: 1, tick: -2, liquidity: 9 })
          await dataStorage.update({ advanceTimeBy: 3, tick: 4, liquidity: 2 })
          await dataStorage.update({ advanceTimeBy: 6, tick: 6, liquidity: 7 })
          return dataStorage
        }
        let dataStorage: DataStorageTest
        beforeEach('set up timepoints', async () => {
          dataStorage = await loadFixture(dataStorageFixture5Timepoints)
        })

        const getSingleTimepoint = async (secondsAgo: number) => {
          const {
            tickCumulatives: [tickCumulative]
          } = await dataStorage.getTimepoints([secondsAgo])
          return { tickCumulative }
        }
        it('latest timepoint same time as latest', async () => {
          const { tickCumulative } = await getSingleTimepoint(0)
          expect(tickCumulative).to.eq(-21)
        })
        it('latest timepoint 5 seconds after latest', async () => {
          await dataStorage.advanceTime(5)
          const { tickCumulative } = await getSingleTimepoint(5)
          expect(tickCumulative).to.eq(-21)
        })
        it('current timepoint 5 seconds after latest', async () => {
          await dataStorage.advanceTime(5)
          const { tickCumulative } = await getSingleTimepoint(0)
          expect(tickCumulative).to.eq(9)
        })
        it('between latest timepoint and just before latest timepoint at same time as latest', async () => {
          const { tickCumulative } = await getSingleTimepoint(3)
          expect(tickCumulative).to.eq(-33)
        })
        it('between latest timepoint and just before latest timepoint after the latest timepoint', async () => {
          await dataStorage.advanceTime(5)
          const { tickCumulative } = await getSingleTimepoint(8)
          expect(tickCumulative).to.eq(-33)
        })
        it('older than oldest reverts', async () => {
          await expect(getSingleTimepoint(22)).to.be.revertedWithCustomError(dataStorage, 'targetIsTooOld')
          await dataStorage.advanceTime(5)
          await expect(getSingleTimepoint(27)).to.be.revertedWithCustomError(dataStorage, 'targetIsTooOld')
        })
        it('oldest timepoint', async () => {
          const { tickCumulative } = await getSingleTimepoint(14)
          expect(tickCumulative).to.eq(-13)
        })
        it('oldest timepoint after some time', async () => {
          await dataStorage.advanceTime(6)
          const { tickCumulative } = await getSingleTimepoint(20)
          expect(tickCumulative).to.eq(-13)
        })

        it('fetch many values', async () => {
          await dataStorage.advanceTime(6)
          const { tickCumulatives } = await dataStorage.getTimepoints([
            20,
            17,
            13,
            10,
            5,
            1,
            0,
          ])
          expect({
            tickCumulatives: tickCumulatives.map((tc:any) => tc.toString())
          }).to.matchSnapshot()
        })

        it('gas all of last 20 seconds  [ @skip-on-coverage ]', async () => {
          await dataStorage.advanceTime(6)
          await snapshotGasCost(
            dataStorage.getGasCostOfGetPoints([20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0])
          )
        })

        it('gas latest equal  [ @skip-on-coverage ]', async () => {
          await snapshotGasCost(dataStorage.getGasCostOfGetPoints([0]))
        })
        it('gas latest transform  [ @skip-on-coverage ]', async () => {
          await dataStorage.advanceTime(5)
          await snapshotGasCost(dataStorage.getGasCostOfGetPoints([0]))
        })
        it('gas oldest  [ @skip-on-coverage ]', async () => {
          await snapshotGasCost(dataStorage.getGasCostOfGetPoints([14]))
        })
        it('gas between oldest and oldest + 1  [ @skip-on-coverage ]', async () => {
          await snapshotGasCost(dataStorage.getGasCostOfGetPoints([13]))
        })
        it('gas middle  [ @skip-on-coverage ]', async () => {
          await snapshotGasCost(dataStorage.getGasCostOfGetPoints([5]))
        })
      })
    }
  })

  describe('full dataStorage', function () {
    this.timeout(10_200_000)

    let dataStorage: DataStorageTest

    let BATCH_SIZE = 1000;
    const step = 13;

    const STARTING_TIME = TEST_POOL_START_TIME

    const maxedOutDataStorageFixture = async () => {
      await ethers.provider.send("hardhat_setBalance", [
        wallet.address,
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000000000000000",
      ]);
      const dataStorage = await dataStorageFixture()
      await dataStorage.initialize({ liquidity: 0, tick: 0, time: STARTING_TIME })

      let i = 1;
      for (i = 1; i < 65536; i += BATCH_SIZE) {
        if (i + BATCH_SIZE > 65536) {
          BATCH_SIZE = Math.ceil(65536 / 300) * 300 - i;
          console.log('batch update starting at', i)
          await dataStorage.batchUpdateFixedTimedelta(BATCH_SIZE)
        } else {
          console.log('batch update starting at', i)
          await dataStorage.batchUpdateFast(BATCH_SIZE)
        }
      }
      console.log('Length:', i);
      return dataStorage
    }

    beforeEach('create a full dataStorage', async () => {
      dataStorage = await loadFixture(maxedOutDataStorageFixture)
    })

    it('index wrapped around', async () => {
      expect(await dataStorage.index()).to.eq(163)
    })

    async function checkGetPoints(
      secondsAgo: number,
      expected?: { tickCumulative: BigNumberish }
    ) {
      const { tickCumulatives } = await dataStorage.getTimepoints([secondsAgo])
      const check = {
        tickCumulative: tickCumulatives[0].toString(),
      }
      if (typeof expected === 'undefined') {
        expect(check).to.matchSnapshot()
      } else {
        expect(check).to.deep.eq({
          tickCumulative: expected.tickCumulative.toString()
        })
      }
    }

    it('can getTimepoints into the ordered portion with exact seconds ago', async () => {
      await checkGetPoints(100 * step, {
        tickCumulative: '-27970560813',
      })
    })

    it('can getTimepoints into the ordered portion with unexact seconds ago', async () => {
      await checkGetPoints(100 * step + 5, {
        tickCumulative: '-27970232823',
      })
    })

    it('can getTimepoints at exactly the latest timepoint', async () => {
      await checkGetPoints(0, {
        tickCumulative: '-28055903863',
      })
    })

    it('can getTimepoints at exactly the latest timepoint after some time passes', async () => {
      await dataStorage.advanceTime(5)
      await checkGetPoints(5, {
        tickCumulative: '-28055903863',
      })
    })

    it('can getTimepoints after the latest timepoint counterfactual', async () => {
      await dataStorage.advanceTime(5)
      await checkGetPoints(3, {
        tickCumulative: '-28056035261',
      })
    })

    it('can getTimepoints into the unordered portion of array at exact seconds ago of timepoint', async () => {
      await checkGetPoints(200 * step, {
        tickCumulative: '-27885347763',
      })
    })

    it('can getTimepoints into the unordered portion of array at seconds ago between timepoints', async () => {
      await checkGetPoints(200 * step + 5, {
        tickCumulative: '-27885020273',
      })
    })

    it('can getTimepoints the oldest timepoint 13*65534 seconds ago', async () => {
      await checkGetPoints(step * 65534, {
        tickCumulative: '-175890',
      })
    })

    it('can getTimepoints the oldest timepoint 13*65534 + 5 seconds ago if time has elapsed', async () => {
      await dataStorage.advanceTime(5)
      await checkGetPoints(step * 65534 + 5, {
        tickCumulative: '-175890',
      })
    })

    describe('#getAverageVolatility', () => {
      const window = 24 * 60 * 60;

      describe('oldest timepoint is more than WINDOW seconds ago', async() => {
        beforeEach('initialize', async () => {
          await dataStorage.update({ advanceTimeBy: window + 1, tick: 7250, liquidity: 6 });
        })
  
        it('last timepoint is target', async() => {
          const volatility = await dataStorage.getAverageVolatility();
          expect(volatility).to.be.eq(3684036);
        })
  
        it('target is after last timepoint', async() => {
          await dataStorage.advanceTime(10);
          const volatility = await dataStorage.getAverageVolatility();
          expect(volatility).to.be.eq(3920736);
        })
      })
    })

    it('gas cost of getTimepoints(0)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([0]))
    })
    it(`gas cost of getTimepoints(200 * ${step})  [ @skip-on-coverage ]`, async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([200 * step]))
    })
    it(`gas cost of getTimepoints(200 * ${step} + 5)  [ @skip-on-coverage ]`, async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([200 * step + 5]))
    })
    it('gas cost of getTimepoints(0) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await dataStorage.advanceTime(5)
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([0]))
    })
    it('gas cost of getTimepoints(5) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await dataStorage.advanceTime(5)
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([5]))
    })
    it('gas cost of getTimepoints(middle)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([65534 / 2 * step]))
    })
    it('gas cost of getTimepoints(oldest)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([65534 * step]))
    })
    it('gas cost of getTimepoints(oldest) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await dataStorage.advanceTime(5)
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([65534 * step + 5]))
    })
    it('gas cost of getTimepoints(24h ago)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([24 * 60 * 60]))
    })
    it('gas cost of getTimepoints(24h ago) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await dataStorage.advanceTime(5)
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([24 * 60 * 60]))
    })
    it('gas cost of getTimepoints(24h ago) after 15 minutes [ @skip-on-coverage ]', async () => {
      await dataStorage.advanceTime(15*60)
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([24 * 60 * 60]))
    })
  })

  describe('full dataStorage, maximal density', function () {
    this.timeout(10_200_000)

    let dataStorage: DataStorageTest

    let BATCH_SIZE = 1000;
    let step = 1;

    const STARTING_TIME = TEST_POOL_START_TIME

    const maxedOutDataStorageFixture = async () => {
      await ethers.provider.send("hardhat_setBalance", [
        wallet.address,
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000000000000000",
      ]);
      const dataStorage = await dataStorageFixture()
      await dataStorage.initialize({ liquidity: 0, tick: 0, time: STARTING_TIME })
      await dataStorage.setStep(step);

      let i = 1;
      for (i = 1; i < 65536; i += BATCH_SIZE) {
        if (i + BATCH_SIZE > 65536) {
          BATCH_SIZE = Math.ceil(65536 / 300) * 300 - i;
          console.log('batch update starting at', i)
          await dataStorage.batchUpdateFixedTimedelta(BATCH_SIZE)
        } else {
          console.log('batch update starting at', i)
          await dataStorage.batchUpdateFast(BATCH_SIZE)
        }
      }
      console.log('Length:', i);
      return dataStorage
    }

    beforeEach('create a full dataStorage', async () => {
      dataStorage = await loadFixture(maxedOutDataStorageFixture)
    })

    it('index wrapped around', async () => {
      expect(await dataStorage.index()).to.eq(163)
    })

    async function checkGetPoints(
      secondsAgo: number,
      expected?: { tickCumulative: BigNumberish }
    ) {
      const { tickCumulatives } = await dataStorage.getTimepoints([secondsAgo])
      const check = {
        tickCumulative: tickCumulatives[0].toString(),
      }
      if (typeof expected === 'undefined') {
        expect(check).to.matchSnapshot()
      } else {
        expect(check).to.deep.eq({
          tickCumulative: expected.tickCumulative.toString()
        })
      }
    }

    it('can getTimepoints into the ordered portion with exact seconds ago', async () => {
      await checkGetPoints(100 * step, {
        tickCumulative: '-2151581601',
      })
    })

    it('can getTimepoints into the ordered portion', async () => {
      await checkGetPoints(100 * step + 5, {
        tickCumulative: '-2151253621',
      })
    })

    it('can getTimepoints at exactly the latest timepoint', async () => {
      await checkGetPoints(0, {
        tickCumulative: '-2158146451',
      })
    })

    it('can getTimepoints at exactly the latest timepoint after some time passes', async () => {
      await dataStorage.advanceTime(5)
      await checkGetPoints(5, {
        tickCumulative: '-2158146451',
      })
    })

    it('can getTimepoints after the latest timepoint counterfactual', async () => {
      await dataStorage.advanceTime(5)
      await checkGetPoints(3, {
        tickCumulative: '-2158277849',
      })
    })

    it('can getTimepoints into the unordered portion of array at exact seconds ago of timepoint', async () => {
      await checkGetPoints(200 * step, {
        tickCumulative: '-2145026751',
      })
    })

    it('can getTimepoints the oldest timepoint 65534 seconds ago', async () => {
      await checkGetPoints(step * 65534, {
        tickCumulative: '-13530',
      })
    })

    it('can getTimepoints the oldest timepoint 65534 + 5 seconds ago if time has elapsed', async () => {
      await dataStorage.advanceTime(5)
      await checkGetPoints(step * 65534 + 5, {
        tickCumulative: '-13530',
      })
    })

    describe('#getAverageVolatility', () => {
      const window = 24 * 60 * 60;
  
      it('last timepoint is target', async() => {
        const volatility = await dataStorage.getAverageVolatility();
        expect(volatility).to.be.eq(360563565);
      })

      it('target is after last timepoint', async() => {
        await dataStorage.advanceTime(10);
        const volatility = await dataStorage.getAverageVolatility();
        expect(volatility).to.be.eq(360672374);
      })
    })

    it('gas cost of getTimepoints(0)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([0]))
    })
    it(`gas cost of getTimepoints(200 * ${step})  [ @skip-on-coverage ]`, async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([200 * step]))
    })
    it(`gas cost of getTimepoints(200 * ${step} + 5)  [ @skip-on-coverage ]`, async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([200 * step + 5]))
    })
    it('gas cost of getTimepoints(0) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await dataStorage.advanceTime(5)
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([0]))
    })
    it('gas cost of getTimepoints(5) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await dataStorage.advanceTime(5)
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([5]))
    })
    it('gas cost of getTimepoints(middle)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([65534 / 2 * step]))
    })
    it('gas cost of getTimepoints(oldest)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([65534 * step]))
    })
    it('gas cost of getTimepoints(oldest) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await dataStorage.advanceTime(5)
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([65534 * step + 5]))
    })
    it('gas cost of getTimepoints(24h ago) after 12 hours [ @skip-on-coverage ]', async () => {
      await dataStorage.advanceTime(12 * 60 * 60)
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([24 * 60 * 60]))
    })
  })
})
