import { BigNumber, BigNumberish, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { DataStorageTest } from '../typechain/test/DataStorageTest'
import { DataStorageOperator } from '../typechain/DataStorageOperator'
import checkTimepointEquals from './shared/checkTimepointEquals'
import { expect } from './shared/expect'
import { TEST_POOL_START_TIME } from './shared/fixtures'
import snapshotGasCost from './shared/snapshotGasCost'
import { MaxUint128 } from './shared/utilities'

describe('DataStorage', () => {
  let wallet: Wallet, other: Wallet

  before('create fixture loader', async () => {
    ;[wallet, other] = await (ethers as any).getSigners()
  })

  const dataStorageFixture = async () => {
    const dataStorageTestFactory = await ethers.getContractFactory('DataStorageTest')
    return (await dataStorageTestFactory.deploy()) as DataStorageTest
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
        blockTimestamp: 1,
        tickCumulative: 0
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
        tickCumulative: 0,
        initialized: true,
        blockTimestamp: 6,
      })
    })

    it('accumulates liquidity', async () => {
      await dataStorage.update({ advanceTimeBy: 3, tick: 3, liquidity: 2 })
      await dataStorage.update({ advanceTimeBy: 4, tick: -7, liquidity: 6 })
      await dataStorage.update({ advanceTimeBy: 5, tick: -2, liquidity: 4 })

      expect(await dataStorage.index()).to.eq(3)

      checkTimepointEquals(await dataStorage.timepoints(1), {
        initialized: true,
        tickCumulative: 0,
        blockTimestamp: 3,
      })
      checkTimepointEquals(await dataStorage.timepoints(2), {
        initialized: true,
        tickCumulative: 12,
        blockTimestamp: 7,
      })
      checkTimepointEquals(await dataStorage.timepoints(3), {
        initialized: true,
        tickCumulative: -23,
        blockTimestamp: 12,
      })
      checkTimepointEquals(await dataStorage.timepoints(4), {
        initialized: false,
        tickCumulative: 0,
        blockTimestamp: 0,
      })
    })
  })

  describe('#getAverageTick', () => {
    let dataStorage: DataStorageTest
    beforeEach('deploy initialized test dataStorage', async () => {
      dataStorage = await loadFixture(dataStorageFixture)
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
        await dataStorage.initialize({ time: 5, tick: 2, liquidity: BigNumber.from(2).pow(15) })
        await dataStorage.update({ advanceTimeBy: 13, tick: 6, liquidity: BigNumber.from(2).pow(12) })
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
            tickCumulatives: tickCumulatives.map((tc:any) => tc.toNumber())
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

  describe.skip('full dataStorage', function () {
    this.timeout(1_200_000)

    let dataStorage: DataStorageTest

    const BATCH_SIZE = 300

    const STARTING_TIME = TEST_POOL_START_TIME

    const maxedOutDataStorageFixture = async () => {
      await ethers.provider.send("hardhat_setBalance", [
        wallet.address,
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000000000000000",
      ]);
      const dataStorage = await dataStorageFixture()
      await dataStorage.initialize({ liquidity: 0, tick: 0, time: STARTING_TIME })

      for (let i = 0; i < 65535; i += BATCH_SIZE) {
        console.log('batch update starting at', i)
        const batch = Array(BATCH_SIZE)
          .fill(null)
          .map((_, j) => ({
            tick: -i - j,
            liquidity: i + j,
          }))
        await dataStorage.batchUpdateFixedTimedelta(batch)
      }
      return dataStorage
    }

    beforeEach('create a full dataStorage', async () => {
      dataStorage = await loadFixture(maxedOutDataStorageFixture)
    })

    it('index wrapped around', async () => {
      expect(await dataStorage.index()).to.eq(164)
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
      await checkGetPoints(100 * 13, {
        tickCumulative: '-27970560813',
      })
    })

    it('can getTimepoints into the ordered portion with unexact seconds ago', async () => {
      await checkGetPoints(100 * 13 + 5, {
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
      await checkGetPoints(200 * 13, {
        tickCumulative: '-27885347763',
      })
    })

    it('can getTimepoints into the unordered portion of array at seconds ago between timepoints', async () => {
      await checkGetPoints(200 * 13 + 5, {
        tickCumulative: '-27885020273',
      })
    })

    it('can getTimepoints the oldest timepoint 13*65534 seconds ago', async () => {
      await checkGetPoints(13 * 65534, {
        tickCumulative: '-175890',
      })
    })

    it('can getTimepoints the oldest timepoint 13*65534 + 5 seconds ago if time has elapsed', async () => {
      await dataStorage.advanceTime(5)
      await checkGetPoints(13 * 65534 + 5, {
        tickCumulative: '-175890',
      })
    })

    it('gas cost of getTimepoints(0)', async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([0]))
    })
    it('gas cost of getTimepoints(200 * 13)', async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([200 + 13]))
    })
    it('gas cost of getTimepoints(200 * 13 + 5)', async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([200 + 13 + 5]))
    })
    it('gas cost of getTimepoints(0) after 5 seconds', async () => {
      await dataStorage.advanceTime(5)
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([0]))
    })
    it('gas cost of getTimepoints(5) after 5 seconds', async () => {
      await dataStorage.advanceTime(5)
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([5]))
    })
    it('gas cost of getTimepoints(oldest)', async () => {
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([65534 * 13]))
    })
    it('gas cost of getTimepoints(oldest) after 5 seconds', async () => {
      await dataStorage.advanceTime(5)
      await snapshotGasCost(dataStorage.getGasCostOfGetPoints([65534 * 13 + 5]))
    })
  })
})

describe('DataStorageOperator external methods', () => {
  let wallet: Wallet, other: Wallet;
  let dataStorageOperator: DataStorageOperator;
  before('get signers', async () => {
    ;[wallet, other] = await (ethers as any).getSigners()
  })

  beforeEach('deploy DataStorageOperator', async () => {
    const dataStorageOperatorFactory = await ethers.getContractFactory('DataStorageOperator')
    dataStorageOperator = (await dataStorageOperatorFactory.deploy(ethers.constants.AddressZero)) as DataStorageOperator;
  })

  it('cannot call onlyPool methods', async () => {
    await expect(dataStorageOperator.initialize(1000, 1)).to.be.revertedWith('only pool can call this');
    await expect(dataStorageOperator.write(10, 100, 2)).to.be.revertedWith('only pool can call this');
  })

  describe('#changeFeeConfiguration', () => {
    const configuration  = {
      alpha1: 3002,
      alpha2: 10009,
      beta1: 1001,
      beta2: 1006,
      gamma1: 20,
      gamma2: 22,
      baseFee: 150
    }
    it('fails if caller is not factory', async () => {
      await expect(dataStorageOperator.connect(other).changeFeeConfiguration(
        configuration
      )).to.be.reverted;
    })

    it('updates baseFeeConfiguration', async () => {
      await dataStorageOperator.changeFeeConfiguration(
        configuration
      );

      const newConfig = await dataStorageOperator.feeConfig();

      expect(newConfig.alpha1).to.eq(configuration.alpha1);
      expect(newConfig.alpha2).to.eq(configuration.alpha2);
      expect(newConfig.beta1).to.eq(configuration.beta1);
      expect(newConfig.beta2).to.eq(configuration.beta2);
      expect(newConfig.gamma1).to.eq(configuration.gamma1);
      expect(newConfig.gamma2).to.eq(configuration.gamma2);
      expect(newConfig.baseFee).to.eq(configuration.baseFee);
    })

    it('emits event', async () => {
      await expect(dataStorageOperator.changeFeeConfiguration(
        configuration
      )).to.emit(dataStorageOperator, 'FeeConfiguration')
        .withArgs(
          [...Object.values(configuration)]
        );
    })

    it('cannot exceed max fee', async () => {
      let wrongConfig = {...configuration};
      wrongConfig.alpha1 = 30000;
      wrongConfig.alpha2 = 30000;
      wrongConfig.baseFee = 15000;
      await expect(dataStorageOperator.changeFeeConfiguration(
        wrongConfig
      )).to.be.revertedWith('Max fee exceeded');
    })

    it('cannot set zero gamma', async () => {
      let wrongConfig1 = {...configuration};
      wrongConfig1.gamma1 = 0;
      await expect(dataStorageOperator.changeFeeConfiguration(
        wrongConfig1
      )).to.be.revertedWith('Gammas must be > 0');
      
      let wrongConfig2 = {...configuration};
      wrongConfig2.gamma2 = 0;
      await expect(dataStorageOperator.changeFeeConfiguration(
        wrongConfig2
      )).to.be.revertedWith('Gammas must be > 0');
    })
  })
})
