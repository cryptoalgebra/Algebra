import { BigNumberish, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { VolatilityOracleTest } from '../typechain';
import checkTimepointEquals from './shared/checkTimepointEquals';
import { expect } from './shared/expect';
import { TEST_POOL_START_TIME } from './shared/fixtures';
import snapshotGasCost from './shared/snapshotGasCost';

describe('VolatilityOracle', () => {
  let wallet: Wallet;

  before('create fixture loader', async () => {
    [wallet] = await (ethers as any).getSigners();
  });

  const volatilityOracleFixture = async () => {
    const volatilityOracleTestFactory = await ethers.getContractFactory('VolatilityOracleTest');
    return (await volatilityOracleTestFactory.deploy()) as any as VolatilityOracleTest;
  };

  const initializedVolatilityOracleFixture = async () => {
    const volatilityOracle = await volatilityOracleFixture();
    await volatilityOracle.initialize({
      time: 0,
      tick: 0,
    });
    return volatilityOracle;
  };

  describe('#initialize', () => {
    let volatilityOracle: VolatilityOracleTest;
    beforeEach('deploy test volatilityOracle', async () => {
      volatilityOracle = await loadFixture(volatilityOracleFixture);
    });
    it('cannot initialize twice', async () => {
      await volatilityOracle.initialize({ tick: 1, time: 1 });
      await expect(volatilityOracle.initialize({ tick: 1, time: 1 })).to.be.revertedWithCustomError(
        volatilityOracle,
        'volatilityOracleAlreadyInitialized'
      );
    });
    it('index is 0', async () => {
      await volatilityOracle.initialize({ tick: 1, time: 1 });
      expect(await volatilityOracle.index()).to.eq(0);
    });
    it('sets first slot timestamp only', async () => {
      await volatilityOracle.initialize({ tick: 1, time: 1 });
      checkTimepointEquals(await volatilityOracle.timepoints(0), {
        initialized: true,
        blockTimestamp: 1n,
        tickCumulative: 0n,
      });
    });
    it('gas  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(volatilityOracle.initialize({ tick: 1, time: 1 }));
    });
    it('should return interpolated volatility with gap > window', async () => {
      await volatilityOracle.initialize({ tick: 46054, time: 1 });
      await volatilityOracle.update({ advanceTimeBy: 100, tick: 80054 });
      await volatilityOracle.update({ advanceTimeBy: 1, tick: 46054 });
      await volatilityOracle.getTimepoints([0]);
      await volatilityOracle.getTimepoints([1]);
    });
  });

  describe('#write', () => {
    let volatilityOracle: VolatilityOracleTest;

    beforeEach('deploy initialized test volatilityOracle', async () => {
      volatilityOracle = await loadFixture(initializedVolatilityOracleFixture);
    });

    it('does nothing if time has not changed', async () => {
      await volatilityOracle.update({ advanceTimeBy: 1, tick: 3 });
      expect(await volatilityOracle.index()).to.eq(1);
      await volatilityOracle.update({ advanceTimeBy: 0, tick: -5 });
      expect(await volatilityOracle.index()).to.eq(1);
    });

    it('writes an index if time has changed', async () => {
      await volatilityOracle.update({ advanceTimeBy: 6, tick: 3 });
      expect(await volatilityOracle.index()).to.eq(1);
      await volatilityOracle.update({ advanceTimeBy: 4, tick: -5 });

      expect(await volatilityOracle.index()).to.eq(2);
      checkTimepointEquals(await volatilityOracle.timepoints(1), {
        tickCumulative: 0n,
        initialized: true,
        blockTimestamp: 6n,
      });
    });

    it('accumulates liquidity', async () => {
      await volatilityOracle.update({ advanceTimeBy: 3, tick: 3 });
      await volatilityOracle.update({ advanceTimeBy: 4, tick: -7 });
      await volatilityOracle.update({ advanceTimeBy: 5, tick: -2 });

      expect(await volatilityOracle.index()).to.eq(3);

      checkTimepointEquals(await volatilityOracle.timepoints(1), {
        initialized: true,
        tickCumulative: 0n,
        blockTimestamp: 3n,
      });
      checkTimepointEquals(await volatilityOracle.timepoints(2), {
        initialized: true,
        tickCumulative: 12n,
        blockTimestamp: 7n,
      });
      checkTimepointEquals(await volatilityOracle.timepoints(3), {
        initialized: true,
        tickCumulative: -23n,
        blockTimestamp: 12n,
      });
      checkTimepointEquals(await volatilityOracle.timepoints(4), {
        initialized: false,
        tickCumulative: 0n,
        blockTimestamp: 0n,
      });
    });
  });

  describe('#getAverageTick', () => {
    let window = 24 * 60 * 60;
    let volatilityOracle: VolatilityOracleTest;
    beforeEach('deploy initialized test volatilityOracle', async () => {
      volatilityOracle = await loadFixture(volatilityOracleFixture);
    });

    it('in the same block with init', async () => {
      await volatilityOracle.initialize({ tick: 7200, time: 1000 });
      const tick = await volatilityOracle.getAverageTick();
      expect(tick).to.be.eq(7200);
    });

    it('does not change after write', async () => {
      await volatilityOracle.initialize({ tick: 7200, time: 1000 });
      await volatilityOracle.update({ advanceTimeBy: 60 * 60, tick: 7500 });
      await volatilityOracle.advanceTime(60 * 5);
      const tickBeforeWrite = await volatilityOracle.getAverageTick();
      await volatilityOracle.update({ advanceTimeBy: 0, tick: 100000 });
      const tickAfterWrite = await volatilityOracle.getAverageTick();
      expect(tickBeforeWrite).to.be.eq(tickAfterWrite);
      await volatilityOracle.advanceTime(1);
      expect(tickBeforeWrite).to.be.not.eq(await volatilityOracle.getAverageTick());
    });

    it('in exactly 24h ago', async () => {
      await volatilityOracle.initialize({ tick: 7200, time: 1000 });
      await volatilityOracle.update({ advanceTimeBy: 2, tick: 7300 });
      await volatilityOracle.update({ advanceTimeBy: window, tick: 7400 });
      const tick = await volatilityOracle.getAverageTick();
      expect(tick).to.be.eq(7300);
    });

    it('last index is exactly 24h ago', async () => {
      await volatilityOracle.initialize({ tick: 7200, time: 1000 });
      await volatilityOracle.update({ advanceTimeBy: 2, tick: 7300 });
      await volatilityOracle.advanceTime(window);
      const tick = await volatilityOracle.getAverageTick();
      expect(tick).to.be.eq(7300);
    });

    it('last index is more then 24h ago', async () => {
      await volatilityOracle.initialize({ tick: 7200, time: 1000 });
      await volatilityOracle.update({ advanceTimeBy: 2, tick: 7300 });
      await volatilityOracle.advanceTime(window + 1);
      const tick = await volatilityOracle.getAverageTick();
      expect(tick).to.be.eq(7300);

      const tickCumulative = await volatilityOracle.getTickCumulativeAt(0);
      expect(tickCumulative).to.be.eq(630741700);
    });

    it('find tick cumulative at the start of previous window', async () => {
      await volatilityOracle.initialize({ tick: 7200, time: 1000 });
      await volatilityOracle.update({ advanceTimeBy: 2, tick: 7300 });
      await volatilityOracle.update({ advanceTimeBy: window, tick: 7350 });
      await volatilityOracle.advanceTime(1);

      const tickCumulative = await volatilityOracle.getTickCumulativeAt(window + 1);
      expect(tickCumulative).to.be.eq(14400);
      expect(await volatilityOracle.getTickCumulativeAt(window)).to.be.eq(tickCumulative + 7300n);
      expect(await volatilityOracle.getTickCumulativeAt(window - 1)).to.be.eq(tickCumulative + 7300n * 2n);
    });

    describe('oldest timepoint is more than WINDOW seconds ago', async () => {
      beforeEach('initialize', async () => {
        await volatilityOracle.initialize({ tick: 7200, time: 1000 });
        await volatilityOracle.update({ advanceTimeBy: window / 2, tick: 7300 });
        await volatilityOracle.update({ advanceTimeBy: window / 2 + 1, tick: 7350 });
      });

      it('last timepoint is target', async () => {
        const tick = await volatilityOracle.getAverageTick();
        expect(tick).to.be.eq(7250);
      });

      it('target is after last timepoint', async () => {
        await volatilityOracle.advanceTime(10);
        const tick = await volatilityOracle.getAverageTick();
        expect(tick).to.be.eq(7250);
      });
    });

    describe('oldest timepoint is less than WINDOW seconds ago', async () => {
      beforeEach('initialize', async () => {
        await volatilityOracle.initialize({ tick: 7200, time: 1000 });
        await volatilityOracle.update({ advanceTimeBy: 2, tick: 7250 });
        await volatilityOracle.update({ advanceTimeBy: window / 2, tick: 7230 });
      });

      it('last timepoint is target', async () => {
        const tick = await volatilityOracle.getAverageTick();
        expect(tick).to.be.eq(7249);
      });

      it('target is after last timepoint', async () => {
        await volatilityOracle.advanceTime(10);
        const tick = await volatilityOracle.getAverageTick();
        expect(tick).to.be.eq(7249);
      });
    });

    it('potential overflow scenario', async () => {
      await volatilityOracle.initialize({ tick: 7200, time: 1000 });
      let averageTick = await volatilityOracle.getAverageTick();
      expect(averageTick).to.be.lt(7300);
      expect(averageTick).to.be.gt(7100);
      await volatilityOracle.update({ advanceTimeBy: 60 * 60, tick: 7300 });
      averageTick = await volatilityOracle.getAverageTick();
      expect(averageTick).to.be.lt(7300);
      expect(averageTick).to.be.gt(7199);

      await volatilityOracle.update({ advanceTimeBy: window - 2, tick: 7400 });
      averageTick = await volatilityOracle.getAverageTick();
      expect(averageTick).to.be.lt(7400);
      expect(averageTick).to.be.gt(7200);

      await volatilityOracle.update({ advanceTimeBy: 2, tick: 7600 });
      averageTick = await volatilityOracle.getAverageTick();
      expect(averageTick).to.be.lt(7400);
      expect(averageTick).to.be.gt(7200);
    });
  });

  describe('#getAverageVolatility', () => {
    let volatilityOracle: VolatilityOracleTest;
    const window = 24 * 60 * 60;
    beforeEach('deploy initialized test volatilityOracle', async () => {
      volatilityOracle = await loadFixture(volatilityOracleFixture);
    });

    it('in the same block with init', async () => {
      await volatilityOracle.initialize({ tick: 7200, time: 1000 });
      const volatility = await volatilityOracle.getAverageVolatility();
      expect(volatility).to.be.eq(0);
    });

    it('in exactly 24h ago', async () => {
      await volatilityOracle.initialize({ tick: 7200, time: 1000 });
      await volatilityOracle.update({ advanceTimeBy: 2, tick: 7300 });
      await volatilityOracle.update({ advanceTimeBy: window, tick: 7500 });
      const volatility = await volatilityOracle.getAverageVolatility();
      expect(volatility).to.be.eq(3333);
    });

    it('last index is exactly 24h ago', async () => {
      await volatilityOracle.initialize({ tick: 7200, time: 1000 });
      await volatilityOracle.update({ advanceTimeBy: 2, tick: 7300 });
      await volatilityOracle.advanceTime(window);
      const volatility = await volatilityOracle.getAverageVolatility();
      expect(volatility).to.be.eq(3333);
    });

    it('last index is more then 24h ago', async () => {
      await volatilityOracle.initialize({ tick: 7200, time: 1000 });
      await volatilityOracle.update({ advanceTimeBy: 2, tick: 7300 });
      await volatilityOracle.advanceTime(window + 1);
      const volatility = await volatilityOracle.getAverageVolatility();
      expect(volatility).to.be.eq(3333);
    });

    it('specific case for binary search (atOrAfter)', async () => {
      await volatilityOracle.initialize({ tick: 7200, time: 1000 });
      await volatilityOracle.update({ advanceTimeBy: 2, tick: 7300 });
      await volatilityOracle.update({ advanceTimeBy: 2 * 60 * 60, tick: 7300 });
      await volatilityOracle.update({ advanceTimeBy: 2 * 60 * 60, tick: 73100 });
      await volatilityOracle.advanceTime(window - 2 * 60 * 60);
      const volatility = await volatilityOracle.getAverageVolatility();
      expect(volatility).to.be.eq(1442410782);
    });

    describe('oldest timepoint is more than WINDOW seconds ago', async () => {
      beforeEach('initialize', async () => {
        await volatilityOracle.initialize({ tick: 7200, time: 1000 });
        await volatilityOracle.update({ advanceTimeBy: window / 2, tick: 7300 });
        await volatilityOracle.update({ advanceTimeBy: window / 2 + 1, tick: 7350 });
      });

      it('last timepoint is target', async () => {
        const volatility = await volatilityOracle.getAverageVolatility();
        expect(volatility).to.be.eq(2916);
      });

      it('target is after last timepoint', async () => {
        await volatilityOracle.advanceTime(10);
        const volatility = await volatilityOracle.getAverageVolatility();
        expect(volatility).to.be.eq(2917);
      });
    });

    describe('oldest timepoint is less than WINDOW seconds ago', async () => {
      beforeEach('initialize', async () => {
        await volatilityOracle.initialize({ tick: 7200, time: 1000 });
        await volatilityOracle.update({ advanceTimeBy: 2, tick: 7250 });
        await volatilityOracle.update({ advanceTimeBy: window / 2, tick: 7230 });
      });

      it('last timepoint is target', async () => {
        const volatility = await volatilityOracle.getAverageVolatility();
        expect(volatility).to.be.eq(850);
      });

      it('target is after last timepoint', async () => {
        await volatilityOracle.advanceTime(10);
        const volatility = await volatilityOracle.getAverageVolatility();
        expect(volatility).to.be.eq(850);
      });
    });
  });

  describe('#getTimepoints', () => {
    describe('before initialization', async () => {
      let volatilityOracle: VolatilityOracleTest;
      beforeEach('deploy test volatilityOracle', async () => {
        volatilityOracle = await loadFixture(volatilityOracleFixture);
      });

      const getSingleTimepoint = async (secondsAgo: number) => {
        const {
          tickCumulatives: [tickCumulative],
          volatilityCumulatives: [volatilityCumulative],
        } = await volatilityOracle.getTimepoints([secondsAgo]);
        return { tickCumulative, volatilityCumulative };
      };

      it('fails if an older timepoint does not exist', async () => {
        await volatilityOracle.initialize({ tick: 2, time: 5 });
        await expect(getSingleTimepoint(1)).to.be.revertedWithCustomError(volatilityOracle, 'targetIsTooOld');
      });

      it('does not fail across overflow boundary', async () => {
        await volatilityOracle.initialize({ tick: 2, time: 2 ** 32 - 1 });
        await volatilityOracle.advanceTime(2);
        const { tickCumulative } = await getSingleTimepoint(1);
        expect(tickCumulative).to.be.eq(2);
      });

      it('single timepoint at current time', async () => {
        await volatilityOracle.initialize({ tick: 2, time: 5 });
        const { tickCumulative } = await getSingleTimepoint(0);
        expect(tickCumulative).to.eq(0);
      });

      it('timepoint does not change after time', async () => {
        await volatilityOracle.initialize({ tick: 2, time: 5 });
        await volatilityOracle.update({ advanceTimeBy: 24 * 60, tick: 1500 });
        await volatilityOracle.advanceTime(10 * 60);
        const { tickCumulative: tickCumulativeBefore } = await getSingleTimepoint(0);
        await volatilityOracle.advanceTime(5);
        const { tickCumulative: tickCumulativeAfter } = await getSingleTimepoint(5);
        expect(tickCumulativeBefore).to.be.eq(tickCumulativeAfter);
        const { tickCumulative: tickCumulativeNew } = await getSingleTimepoint(0);
        expect(tickCumulativeBefore).to.be.not.eq(tickCumulativeNew);
      });

      it('single timepoint at current time equal after write', async () => {
        await volatilityOracle.initialize({ tick: 2, time: 5 });
        await volatilityOracle.update({ advanceTimeBy: 60 * 10, tick: 10 });
        await volatilityOracle.update({ advanceTimeBy: 24 * 60, tick: 15 });
        await volatilityOracle.advanceTime(10 * 60);
        const { tickCumulative, volatilityCumulative } = await getSingleTimepoint(0);
        await volatilityOracle.update({ advanceTimeBy: 0, tick: 15 });
        const { tickCumulative: tickCumulativeAfterWrite, volatilityCumulative: volatilityCumulativeAfterWrite } = await getSingleTimepoint(0);

        expect(tickCumulativeAfterWrite).to.be.eq(tickCumulative);
        expect(volatilityCumulativeAfterWrite).to.be.eq(volatilityCumulative);
      });

      it('single timepoint at current time not equal after write and time passed', async () => {
        await volatilityOracle.initialize({ tick: 2, time: 5 });
        await volatilityOracle.update({ advanceTimeBy: 60 * 10, tick: 10 });
        await volatilityOracle.update({ advanceTimeBy: 24 * 60, tick: 15 });
        await volatilityOracle.advanceTime(10 * 60);
        const { tickCumulative, volatilityCumulative } = await getSingleTimepoint(0);
        await volatilityOracle.update({ advanceTimeBy: 0, tick: 15 });
        await volatilityOracle.advanceTime(10);
        const { tickCumulative: tickCumulativeAfterWrite, volatilityCumulative: volatilityCumulativeAfterWrite } = await getSingleTimepoint(0);

        expect(tickCumulativeAfterWrite).to.be.not.eq(tickCumulative);
        expect(volatilityCumulativeAfterWrite).to.be.not.eq(volatilityCumulative);
      });

      it('single timepoint in past but not earlier than secondsAgo', async () => {
        await volatilityOracle.initialize({ tick: 2, time: 5 });
        await volatilityOracle.advanceTime(3);
        await expect(getSingleTimepoint(4)).to.be.revertedWithCustomError(volatilityOracle, 'targetIsTooOld');
      });

      it('single timepoint in past at exactly seconds ago', async () => {
        await volatilityOracle.initialize({ tick: 2, time: 5 });
        await volatilityOracle.advanceTime(3);
        const { tickCumulative } = await getSingleTimepoint(3);
        expect(tickCumulative).to.eq(0);
      });

      it('single timepoint in past counterfactual in past', async () => {
        await volatilityOracle.initialize({ tick: 2, time: 5 });
        await volatilityOracle.advanceTime(3);
        const { tickCumulative } = await getSingleTimepoint(1);
        expect(tickCumulative).to.eq(4);
      });

      it('single timepoint in past counterfactual now', async () => {
        await volatilityOracle.initialize({ tick: 2, time: 5 });
        await volatilityOracle.advanceTime(3);
        const { tickCumulative } = await getSingleTimepoint(0);
        expect(tickCumulative).to.eq(6);
      });

      it('single timepoint in past exactly at the start of window', async () => {
        await volatilityOracle.initialize({ tick: 2, time: 5 });
        await volatilityOracle.update({ advanceTimeBy: 4, tick: 1 });
        await volatilityOracle.update({ advanceTimeBy: 24 * 60 * 60, tick: 1 });
        const { tickCumulative } = await getSingleTimepoint(24 * 60 * 60);
        expect(tickCumulative).to.eq(8);
      });

      it('single timepoint in past exactly at the start of window after some time', async () => {
        await volatilityOracle.initialize({ tick: 2, time: 5 });
        await volatilityOracle.update({ advanceTimeBy: 4, tick: 1 });
        await volatilityOracle.update({ advanceTimeBy: 24 * 60 * 60, tick: 1 });
        await volatilityOracle.advanceTime(3);
        const { tickCumulative } = await getSingleTimepoint(24 * 60 * 60 + 3);
        expect(tickCumulative).to.eq(8);
      });

      it('two timepoints in chronological order 0 seconds ago exact', async () => {
        await volatilityOracle.initialize({ tick: -5, time: 5 });
        await volatilityOracle.update({ advanceTimeBy: 4, tick: 1 });
        const { tickCumulative } = await getSingleTimepoint(0);
        expect(tickCumulative).to.eq(-20);
      });

      it('two timepoints in chronological order 0 seconds ago counterfactual', async () => {
        await volatilityOracle.initialize({ tick: -5, time: 5 });
        await volatilityOracle.update({ advanceTimeBy: 4, tick: 1 });
        await volatilityOracle.advanceTime(7);
        const { tickCumulative } = await getSingleTimepoint(0);
        expect(tickCumulative).to.eq(-13);
      });

      it('two timepoints in chronological order seconds ago is exactly on first timepoint', async () => {
        await volatilityOracle.initialize({ tick: -5, time: 5 });
        await volatilityOracle.update({ advanceTimeBy: 4, tick: 1 });
        await volatilityOracle.advanceTime(7);
        const { tickCumulative } = await getSingleTimepoint(11);
        expect(tickCumulative).to.eq(0);
      });

      it('two timepoints in chronological order seconds ago is between first and second', async () => {
        await volatilityOracle.initialize({ tick: -5, time: 5 });
        await volatilityOracle.update({ advanceTimeBy: 4, tick: 1 });
        await volatilityOracle.advanceTime(7);
        const { tickCumulative } = await getSingleTimepoint(9);
        expect(tickCumulative).to.eq(-10);
      });

      it('two timepoints in reverse order 0 seconds ago exact', async () => {
        await volatilityOracle.initialize({ tick: -5, time: 5 });
        await volatilityOracle.update({ advanceTimeBy: 4, tick: 1 });
        await volatilityOracle.update({ advanceTimeBy: 3, tick: -5 });
        const { tickCumulative } = await getSingleTimepoint(0);
        expect(tickCumulative).to.eq(-17);
      });

      it('two timepoints in reverse order 0 seconds ago counterfactual', async () => {
        await volatilityOracle.initialize({ tick: -5, time: 5 });
        await volatilityOracle.update({ advanceTimeBy: 4, tick: 1 });
        await volatilityOracle.update({ advanceTimeBy: 3, tick: -5 });
        await volatilityOracle.advanceTime(7);
        const { tickCumulative } = await getSingleTimepoint(0);
        expect(tickCumulative).to.eq(-52);
      });

      it('two timepoints in reverse order seconds ago is exactly on first timepoint', async () => {
        await volatilityOracle.initialize({ tick: -5, time: 5 });
        await volatilityOracle.update({ advanceTimeBy: 4, tick: 1 });
        await volatilityOracle.update({ advanceTimeBy: 3, tick: -5 });
        await volatilityOracle.advanceTime(7);
        const { tickCumulative } = await getSingleTimepoint(10);
        expect(tickCumulative).to.eq(-20);
      });

      it('two timepoints in reverse order seconds ago is between first and second', async () => {
        await volatilityOracle.initialize({ tick: -5, time: 5 });
        await volatilityOracle.update({ advanceTimeBy: 4, tick: 1 });
        await volatilityOracle.update({ advanceTimeBy: 3, tick: -5 });
        await volatilityOracle.advanceTime(7);
        const { tickCumulative } = await getSingleTimepoint(9);
        expect(tickCumulative).to.eq(-19);
      });

      it('can fetch multiple timepoints', async () => {
        await volatilityOracle.initialize({ time: 5, tick: 2 });
        await volatilityOracle.update({ advanceTimeBy: 13, tick: 6 });
        await volatilityOracle.advanceTime(5);

        const { tickCumulatives } = await volatilityOracle.getTimepoints([0, 3, 8, 13, 15, 18]);
        expect(tickCumulatives).to.have.lengthOf(6);
        expect(tickCumulatives[0]).to.eq(56);
        expect(tickCumulatives[1]).to.eq(38);
        expect(tickCumulatives[2]).to.eq(20);
        expect(tickCumulatives[3]).to.eq(10);
        expect(tickCumulatives[4]).to.eq(6);
        expect(tickCumulatives[5]).to.eq(0);
      });

      it('gas for getTimepoints since most recent  [ @skip-on-coverage ]', async () => {
        await volatilityOracle.initialize({ tick: -5, time: 5 });
        await volatilityOracle.advanceTime(2);
        await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([1]));
      });

      it('gas for single timepoint at current time  [ @skip-on-coverage ]', async () => {
        await volatilityOracle.initialize({ tick: -5, time: 5 });
        await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([0]));
      });

      it('gas for single timepoint at current time after some time  [ @skip-on-coverage ]', async () => {
        await volatilityOracle.initialize({ tick: -5, time: 5 });
        await volatilityOracle.advanceTime(5);
        await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([0]));
      });
    });

    for (const startingTime of [5, 2 ** 32 - 5]) {
      describe(`initialized with 5 timepoints with starting time of ${startingTime}`, () => {
        const volatilityOracleFixture5Timepoints = async () => {
          const volatilityOracle = await volatilityOracleFixture();
          await volatilityOracle.initialize({ tick: -5, time: startingTime });
          await volatilityOracle.update({ advanceTimeBy: 3, tick: 1 });
          await volatilityOracle.update({ advanceTimeBy: 2, tick: -6 });
          await volatilityOracle.update({ advanceTimeBy: 4, tick: -2 });
          await volatilityOracle.update({ advanceTimeBy: 1, tick: -2 });
          await volatilityOracle.update({ advanceTimeBy: 3, tick: 4 });
          await volatilityOracle.update({ advanceTimeBy: 6, tick: 6 });
          return volatilityOracle;
        };
        let volatilityOracle: VolatilityOracleTest;
        beforeEach('set up timepoints', async () => {
          volatilityOracle = await loadFixture(volatilityOracleFixture5Timepoints);
        });

        const getSingleTimepoint = async (secondsAgo: number) => {
          const {
            tickCumulatives: [tickCumulative],
          } = await volatilityOracle.getTimepoints([secondsAgo]);
          return { tickCumulative };
        };
        it('latest timepoint same time as latest', async () => {
          const { tickCumulative } = await getSingleTimepoint(0);
          expect(tickCumulative).to.eq(-21);
        });
        it('latest timepoint 5 seconds after latest', async () => {
          await volatilityOracle.advanceTime(5);
          const { tickCumulative } = await getSingleTimepoint(5);
          expect(tickCumulative).to.eq(-21);
        });
        it('current timepoint 5 seconds after latest', async () => {
          await volatilityOracle.advanceTime(5);
          const { tickCumulative } = await getSingleTimepoint(0);
          expect(tickCumulative).to.eq(9);
        });
        it('between latest timepoint and just before latest timepoint at same time as latest', async () => {
          const { tickCumulative } = await getSingleTimepoint(3);
          expect(tickCumulative).to.eq(-33);
        });
        it('between latest timepoint and just before latest timepoint after the latest timepoint', async () => {
          await volatilityOracle.advanceTime(5);
          const { tickCumulative } = await getSingleTimepoint(8);
          expect(tickCumulative).to.eq(-33);
        });
        it('older than oldest reverts', async () => {
          await expect(getSingleTimepoint(22)).to.be.revertedWithCustomError(volatilityOracle, 'targetIsTooOld');
          await volatilityOracle.advanceTime(5);
          await expect(getSingleTimepoint(27)).to.be.revertedWithCustomError(volatilityOracle, 'targetIsTooOld');
        });
        it('oldest timepoint', async () => {
          const { tickCumulative } = await getSingleTimepoint(14);
          expect(tickCumulative).to.eq(-13);
        });
        it('oldest timepoint after some time', async () => {
          await volatilityOracle.advanceTime(6);
          const { tickCumulative } = await getSingleTimepoint(20);
          expect(tickCumulative).to.eq(-13);
        });

        it('fetch many values', async () => {
          await volatilityOracle.advanceTime(6);
          const { tickCumulatives } = await volatilityOracle.getTimepoints([20, 17, 13, 10, 5, 1, 0]);
          expect({
            tickCumulatives: tickCumulatives.map((tc: any) => tc.toString()),
          }).to.matchSnapshot();
        });

        it('gas all of last 20 seconds  [ @skip-on-coverage ]', async () => {
          await volatilityOracle.advanceTime(6);
          await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]));
        });

        it('gas latest equal  [ @skip-on-coverage ]', async () => {
          await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([0]));
        });
        it('gas latest transform  [ @skip-on-coverage ]', async () => {
          await volatilityOracle.advanceTime(5);
          await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([0]));
        });
        it('gas oldest  [ @skip-on-coverage ]', async () => {
          await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([14]));
        });
        it('gas between oldest and oldest + 1  [ @skip-on-coverage ]', async () => {
          await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([13]));
        });
        it('gas middle  [ @skip-on-coverage ]', async () => {
          await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([5]));
        });
      });
    }
  });

  describe('index overflow tests', async () => {
    let volatilityOracle: VolatilityOracleTest;
    const startingTime = 100n;
    const MAX_UINT16 = 2n ** 16n - 1n;
    const DAY = 24n * 60n * 60n;
    beforeEach('deploy test volatilityOracle', async () => {
      volatilityOracle = await loadFixture(volatilityOracleFixture);
    });

    it('can overflow in first time', async () => {
      await volatilityOracle.initialize({ tick: -5, time: startingTime });
      await volatilityOracle.update({ advanceTimeBy: 3, tick: 1 });

      await volatilityOracle.writeTimepointDirectly(MAX_UINT16 - 1n, {
        initialized: true,
        blockTimestamp: startingTime + 2n * DAY,
        tickCumulative: -5n * 2n * DAY,
        volatilityCumulative: 10n * 2n * DAY,
        tick: -5,
        averageTick: -5,
        windowStartIndex: MAX_UINT16 - 2n,
      });
      await volatilityOracle.setState(startingTime + 2n * DAY, MAX_UINT16 - 1n);
      await volatilityOracle.advanceTime(DAY + 1n);

      await volatilityOracle.update({ advanceTimeBy: 3, tick: 1 });
      expect(await volatilityOracle.index()).to.be.eq(MAX_UINT16);
      expect(await volatilityOracle.getOldestIndex()).to.be.eq(0);

      await volatilityOracle.update({ advanceTimeBy: 3, tick: 1 });
      expect(await volatilityOracle.index()).to.be.eq(0);
      expect(await volatilityOracle.getOldestIndex()).to.be.eq(1);
    });

    it('can overflow twice', async () => {
      await volatilityOracle.initialize({ tick: -5, time: startingTime });
      await volatilityOracle.update({ advanceTimeBy: 3, tick: 1 });

      // first
      await volatilityOracle.writeTimepointDirectly(MAX_UINT16 - 1n, {
        initialized: true,
        blockTimestamp: startingTime + 2n * DAY,
        tickCumulative: -5n * 2n * DAY,
        volatilityCumulative: 10n * 2n * DAY,
        tick: -5,
        averageTick: -5,
        windowStartIndex: MAX_UINT16 - 2n,
      });
      await volatilityOracle.setState(startingTime + 2n * DAY, MAX_UINT16 - 1n);
      await volatilityOracle.advanceTime(DAY + 1n);
      await volatilityOracle.update({ advanceTimeBy: 3, tick: 1 });
      await volatilityOracle.update({ advanceTimeBy: 3, tick: 1 });

      // second
      await volatilityOracle.writeTimepointDirectly(MAX_UINT16 - 1n, {
        initialized: true,
        blockTimestamp: startingTime + 4n * DAY,
        tickCumulative: 1n * 4n * DAY,
        volatilityCumulative: 10n * 4n * DAY,
        tick: 1,
        averageTick: 1,
        windowStartIndex: MAX_UINT16 - 2n,
      });
      await volatilityOracle.setState(startingTime + 4n * DAY, MAX_UINT16 - 1n);
      await volatilityOracle.advanceTime(DAY + 1n);

      await volatilityOracle.update({ advanceTimeBy: 3, tick: 1 });
      expect(await volatilityOracle.index()).to.be.eq(MAX_UINT16);
      expect(await volatilityOracle.getOldestIndex()).to.be.eq(0);

      await volatilityOracle.update({ advanceTimeBy: 3, tick: 1 });
      expect(await volatilityOracle.index()).to.be.eq(0);
      expect(await volatilityOracle.getOldestIndex()).to.be.eq(1);
    });
  });

  describe('full volatilityOracle', function () {
    this.timeout(10_200_000);

    let volatilityOracle: VolatilityOracleTest;

    let BATCH_SIZE = 1000;
    const step = 13;

    const STARTING_TIME = TEST_POOL_START_TIME;

    const maxedOutVolatilityOracleFixture = async () => {
      await ethers.provider.send('hardhat_setBalance', [wallet.address, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000000000000000']);
      const _volatilityOracle = await volatilityOracleFixture();
      await _volatilityOracle.initialize({ tick: 0, time: STARTING_TIME });

      let i = 1;
      for (i = 1; i < 65536; i += BATCH_SIZE) {
        if (i + BATCH_SIZE > 65536) {
          BATCH_SIZE = Math.ceil(65536 / 300) * 300 - i;
          console.log('batch update starting at', i);
          await _volatilityOracle.batchUpdateFixedTimedelta(BATCH_SIZE);
        } else {
          console.log('batch update starting at', i);
          await _volatilityOracle.batchUpdateFast(BATCH_SIZE);
        }
      }
      console.log('Length:', i);
      return _volatilityOracle;
    };

    beforeEach('create a full volatilityOracle', async () => {
      volatilityOracle = await loadFixture(maxedOutVolatilityOracleFixture);
    });

    it('index wrapped around', async () => {
      expect(await volatilityOracle.index()).to.eq(163);
    });

    async function checkGetPoints(secondsAgo: number, expected?: { tickCumulative: BigNumberish }) {
      const { tickCumulatives } = await volatilityOracle.getTimepoints([secondsAgo]);
      const check = {
        tickCumulative: tickCumulatives[0].toString(),
      };
      if (typeof expected === 'undefined') {
        expect(check).to.matchSnapshot();
      } else {
        expect(check).to.deep.eq({
          tickCumulative: expected.tickCumulative.toString(),
        });
      }
    }

    it('can getTimepoints into the ordered portion with exact seconds ago', async () => {
      await checkGetPoints(100 * step, {
        tickCumulative: '-27970560813',
      });
    });

    it('can getTimepoints into the ordered portion with inexact seconds ago', async () => {
      await checkGetPoints(100 * step + 5, {
        tickCumulative: '-27970232823',
      });
    });

    it('can getTimepoints at exactly the latest timepoint', async () => {
      await checkGetPoints(0, {
        tickCumulative: '-28055903863',
      });
    });

    it('can getTimepoints at exactly the latest timepoint after some time passes', async () => {
      await volatilityOracle.advanceTime(5);
      await checkGetPoints(5, {
        tickCumulative: '-28055903863',
      });
    });

    it('can getTimepoints after the latest timepoint counterfactual', async () => {
      await volatilityOracle.advanceTime(5);
      await checkGetPoints(3, {
        tickCumulative: '-28056035261',
      });
    });

    it('can getTimepoints into the unordered portion of array at exact seconds ago of timepoint', async () => {
      await checkGetPoints(200 * step, {
        tickCumulative: '-27885347763',
      });
    });

    it('can getTimepoints into the unordered portion of array at seconds ago between timepoints', async () => {
      await checkGetPoints(200 * step + 5, {
        tickCumulative: '-27885020273',
      });
    });

    it('can getTimepoints the oldest timepoint 13*65534 seconds ago', async () => {
      await checkGetPoints(step * 65534, {
        tickCumulative: '-175890',
      });
    });

    it('can getTimepoints the oldest timepoint 13*65534 + 5 seconds ago if time has elapsed', async () => {
      await volatilityOracle.advanceTime(5);
      await checkGetPoints(step * 65534 + 5, {
        tickCumulative: '-175890',
      });
    });

    describe('#getAverageVolatility', () => {
      const window = 24 * 60 * 60;

      describe('oldest timepoint is more than WINDOW seconds ago', async () => {
        beforeEach('initialize', async () => {
          await volatilityOracle.update({ advanceTimeBy: window + 1, tick: 7250 });
        });

        it('last timepoint is target', async () => {
          const volatility = await volatilityOracle.getAverageVolatility();
          expect(volatility).to.be.eq(3682928);
        });

        it('target is after last timepoint', async () => {
          await volatilityOracle.advanceTime(10);
          const volatility = await volatilityOracle.getAverageVolatility();
          expect(volatility).to.be.eq(4298339);
        });
      });
    });

    it('gas cost of getTimepoints(0)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([0]));
    });
    it(`gas cost of getTimepoints(200 * ${step})  [ @skip-on-coverage ]`, async () => {
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([200 * step]));
    });
    it(`gas cost of getTimepoints(200 * ${step} + 5)  [ @skip-on-coverage ]`, async () => {
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([200 * step + 5]));
    });
    it('gas cost of getTimepoints(0) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await volatilityOracle.advanceTime(5);
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([0]));
    });
    it('gas cost of getTimepoints(5) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await volatilityOracle.advanceTime(5);
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([5]));
    });
    it('gas cost of getTimepoints(middle)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([(65534 / 2) * step]));
    });
    it('gas cost of getTimepoints(oldest)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([65534 * step]));
    });
    it('gas cost of getTimepoints(oldest) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await volatilityOracle.advanceTime(5);
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([65534 * step + 5]));
    });
    it('gas cost of getTimepoints(24h ago)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([24 * 60 * 60]));
    });
    it('gas cost of getTimepoints(24h ago) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await volatilityOracle.advanceTime(5);
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([24 * 60 * 60]));
    });
    it('gas cost of getTimepoints(24h ago) after 15 minutes [ @skip-on-coverage ]', async () => {
      await volatilityOracle.advanceTime(15 * 60);
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([24 * 60 * 60]));
    });

    it.skip('second index wrap', async () => {
      let i = Number(await volatilityOracle.index());
      for (; i < 65536; i += BATCH_SIZE) {
        if (i + BATCH_SIZE > 65536) {
          BATCH_SIZE = Math.ceil(65536 / 300) * 300 - i;
          console.log('batch update starting at', i);
          await volatilityOracle.batchUpdateFixedTimedelta(BATCH_SIZE);
        } else {
          console.log('batch update starting at', i);
          await volatilityOracle.batchUpdateFast(BATCH_SIZE);
        }
      }
      expect(await volatilityOracle.index()).to.eq(163);
    });
  });

  describe('full volatilityOracle, maximal density', function () {
    this.timeout(10_200_000);

    let volatilityOracle: VolatilityOracleTest;

    let BATCH_SIZE = 1000;
    let step = 1;

    const STARTING_TIME = TEST_POOL_START_TIME;

    const maxedOutVolatilityOracleFixture = async () => {
      await ethers.provider.send('hardhat_setBalance', [wallet.address, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000000000000000']);
      const _volatilityOracle = await volatilityOracleFixture();
      await _volatilityOracle.initialize({ tick: 0, time: STARTING_TIME });
      await _volatilityOracle.setStep(step);

      let i = 1;
      for (i = 1; i < 65536; i += BATCH_SIZE) {
        if (i + BATCH_SIZE > 65536) {
          BATCH_SIZE = Math.ceil(65536 / 300) * 300 - i;
          console.log('batch update starting at', i);
          await _volatilityOracle.batchUpdateFixedTimedelta(BATCH_SIZE);
        } else {
          console.log('batch update starting at', i);
          await _volatilityOracle.batchUpdateFast(BATCH_SIZE);
        }
      }
      console.log('Length:', i);
      return _volatilityOracle;
    };

    beforeEach('create a full volatilityOracle', async () => {
      volatilityOracle = await loadFixture(maxedOutVolatilityOracleFixture);
    });

    it('index wrapped around', async () => {
      expect(await volatilityOracle.index()).to.eq(163);
    });

    async function checkGetPoints(secondsAgo: number, expected?: { tickCumulative: BigNumberish }) {
      const { tickCumulatives } = await volatilityOracle.getTimepoints([secondsAgo]);
      const check = {
        tickCumulative: tickCumulatives[0].toString(),
      };
      if (typeof expected === 'undefined') {
        expect(check).to.matchSnapshot();
      } else {
        expect(check).to.deep.eq({
          tickCumulative: expected.tickCumulative.toString(),
        });
      }
    }

    it('can getTimepoints into the ordered portion with exact seconds ago', async () => {
      await checkGetPoints(100 * step, {
        tickCumulative: '-2151581601',
      });
    });

    it('can getTimepoints into the ordered portion', async () => {
      await checkGetPoints(100 * step + 5, {
        tickCumulative: '-2151253621',
      });
    });

    it('can getTimepoints at exactly the latest timepoint', async () => {
      await checkGetPoints(0, {
        tickCumulative: '-2158146451',
      });
    });

    it('can getTimepoints at exactly the latest timepoint after some time passes', async () => {
      await volatilityOracle.advanceTime(5);
      await checkGetPoints(5, {
        tickCumulative: '-2158146451',
      });
    });

    it('can getTimepoints after the latest timepoint counterfactual', async () => {
      await volatilityOracle.advanceTime(5);
      await checkGetPoints(3, {
        tickCumulative: '-2158277849',
      });
    });

    it('can getTimepoints into the unordered portion of array at exact seconds ago of timepoint', async () => {
      await checkGetPoints(200 * step, {
        tickCumulative: '-2145026751',
      });
    });

    it('can getTimepoints the oldest timepoint 65534 seconds ago', async () => {
      await checkGetPoints(step * 65534, {
        tickCumulative: '-13530',
      });
    });

    it('can getTimepoints the oldest timepoint 65534 + 5 seconds ago if time has elapsed', async () => {
      await volatilityOracle.advanceTime(5);
      await checkGetPoints(step * 65534 + 5, {
        tickCumulative: '-13530',
      });
    });

    describe('#getAverageVolatility', () => {
      it('last timepoint is target', async () => {
        const volatility = await volatilityOracle.getAverageVolatility();
        expect(volatility).to.be.eq(360563298);
      });

      it('target is after last timepoint', async () => {
        await volatilityOracle.advanceTime(10);
        const volatility = await volatilityOracle.getAverageVolatility();
        expect(volatility).to.be.eq(360672090);
      });
    });

    it('gas cost of getTimepoints(0)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([0]));
    });
    it(`gas cost of getTimepoints(200 * ${step})  [ @skip-on-coverage ]`, async () => {
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([200 * step]));
    });
    it(`gas cost of getTimepoints(200 * ${step} + 5)  [ @skip-on-coverage ]`, async () => {
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([200 * step + 5]));
    });
    it('gas cost of getTimepoints(0) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await volatilityOracle.advanceTime(5);
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([0]));
    });
    it('gas cost of getTimepoints(5) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await volatilityOracle.advanceTime(5);
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([5]));
    });
    it('gas cost of getTimepoints(middle)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([(65534 / 2) * step]));
    });
    it('gas cost of getTimepoints(oldest)  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([65534 * step]));
    });
    it('gas cost of getTimepoints(oldest) after 5 seconds  [ @skip-on-coverage ]', async () => {
      await volatilityOracle.advanceTime(5);
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([65534 * step + 5]));
    });
    it('gas cost of getTimepoints(24h ago) after 12 hours [ @skip-on-coverage ]', async () => {
      await volatilityOracle.advanceTime(12 * 60 * 60);
      await snapshotGasCost(volatilityOracle.getGasCostOfGetPoints([24 * 60 * 60]));
    });
  });
});
