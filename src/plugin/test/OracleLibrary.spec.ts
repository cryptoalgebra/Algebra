import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ContractFactory } from 'ethers';
import { OracleLibraryTest, TestERC20 } from '../typechain';
import { expandTo18Decimals } from './shared/utilities';
import snapshotGasCost from './shared/snapshotGasCost';
import { tokensFixture } from './shared/externalFixtures';

describe('OracleLibrary', () => {
  let tokens: TestERC20[];
  let oracleLibraryTest: OracleLibraryTest;

  const oracleLibraryTestFixture = async () => {
    const tokensFixtureRes = await tokensFixture();
    tokens = [tokensFixtureRes.token0, tokensFixtureRes.token1];

    const oracleLibraryFactory = await ethers.getContractFactory('OracleLibraryTest');
    const oracleLibrary = await oracleLibraryFactory.deploy();

    return {
      tokens: tokens as TestERC20[],
      oracleLibraryTest: oracleLibrary as any as OracleLibraryTest,
    };
  };

  beforeEach('deploy fixture', async () => {
    const fixtures = await loadFixture(oracleLibraryTestFixture);
    tokens = fixtures.tokens;
    oracleLibraryTest = fixtures.oracleLibraryTest;
  });

  describe('#consult', () => {
    let mockVolatilityOracleFactory: ContractFactory;

    before('create mockVolatilityOracleFactory', async () => {
      mockVolatilityOracleFactory = await ethers.getContractFactory('MockVolatilityOracle');
    });

    it('reverts when period is 0', async () => {
      await expect(oracleLibraryTest.consult(oracleLibraryTest, 0)).to.be.revertedWith('Period is zero');
    });

    it('correct output when tick is 0', async () => {
      const period = 3;
      const tickCumulatives = [12n, 12n];
      const mockVolatilityOracle = await mockVolatilityOracleFactory.deploy([period, 0], tickCumulatives);
      const oracleLibraryTick = await oracleLibraryTest.consult(mockVolatilityOracle, period);

      expect(oracleLibraryTick).to.equal(0n);
    });

    it('correct output for positive tick', async () => {
      const period = 3;
      const tickCumulatives = [7n, 12n];
      const mockVolatilityOracle = await mockVolatilityOracleFactory.deploy([period, 0], tickCumulatives);
      const oracleLibraryTick = await oracleLibraryTest.consult(mockVolatilityOracle, period);

      // Always round to negative infinity
      // In this case, we don't have do anything
      expect(oracleLibraryTick).to.equal(1n);
    });

    it('correct output for negative tick', async () => {
      const period = 3;
      const tickCumulatives = [-7n, -12n];
      const mockVolatilityOracle = await mockVolatilityOracleFactory.deploy([period, 0], tickCumulatives);
      const oracleLibraryTick = await oracleLibraryTest.consult(mockVolatilityOracle, period);

      // Always round to negative infinity
      // In this case, we need to subtract one because integer division rounds to 0
      expect(oracleLibraryTick).to.equal(-2n);
    });

    it('correct rounding for .5 negative tick', async () => {
      const period = 4;
      const tickCumulatives = [-10n, -12n];
      const mockVolatilityOracle = await mockVolatilityOracleFactory.deploy([period, 0], tickCumulatives);
      const oracleLibraryTick = await oracleLibraryTest.consult(mockVolatilityOracle, period);

      // Always round to negative infinity
      // In this case, we need to subtract one because integer division rounds to 0
      expect(oracleLibraryTick).to.equal(-1n);
    });

    it('gas test [ @skip-on-coverage ]', async () => {
      const period = 3;
      const tickCumulatives = [7n, 12n];
      const mockVolatilityOracle = await mockVolatilityOracleFactory.deploy([period, 0], tickCumulatives);

      await snapshotGasCost(oracleLibraryTest.getGasCostOfConsult(mockVolatilityOracle, period));
    });
  });

  describe('#oldestTimepointMetadata', () => {
    it('returns correct value without overflow', async () => {
      const period = 3;
      const tickCumulatives = [7n, 12n];
      const mockVolatilityOracleFactory = await ethers.getContractFactory('MockVolatilityOracle');
      const mockVolatilityOracle = await mockVolatilityOracleFactory.deploy([period, 1], tickCumulatives);

      const oldestTimepointMetadata = await oracleLibraryTest.oldestTimepointMetadata(mockVolatilityOracle);
      expect(oldestTimepointMetadata.index).to.be.eq(0);
      expect(oldestTimepointMetadata.timestamp).to.be.eq(period);
    });

    it('returns correct value with overflow', async () => {
      const period = 3;
      const tickCumulatives = [7n, 12n];
      const mockVolatilityOracleFactory = await ethers.getContractFactory('MockVolatilityOracle');
      const mockVolatilityOracle = await mockVolatilityOracleFactory.deploy([period, 2], tickCumulatives);
      await mockVolatilityOracle.setTimepoint(2, true, 1000, 10, 20);

      const oldestTimepointMetadata = await oracleLibraryTest.oldestTimepointMetadata(mockVolatilityOracle);
      expect(oldestTimepointMetadata.index).to.be.eq(2);
      expect(oldestTimepointMetadata.timestamp).to.be.eq(1000);
    });
  });

  describe('#latestTimepointMetadata', () => {
    it('returns correct value', async () => {
      const period = 3;
      const tickCumulatives = [7n, 12n];
      const mockVolatilityOracleFactory = await ethers.getContractFactory('MockVolatilityOracle');
      const mockVolatilityOracle = await mockVolatilityOracleFactory.deploy([period, 1], tickCumulatives);

      const oldestTimepointMetadata = await oracleLibraryTest.lastTimepointMetadata(mockVolatilityOracle);
      expect(oldestTimepointMetadata.index).to.be.eq(1);
      expect(oldestTimepointMetadata.timestamp).to.be.eq(101);
    });
  });

  describe('#isInitialized', () => {
    it('returns correct value', async () => {
      const period = 3;
      const tickCumulatives = [7n, 12n];
      const mockVolatilityOracleFactory = await ethers.getContractFactory('MockVolatilityOracle');
      const mockVolatilityOracle = await mockVolatilityOracleFactory.deploy([period, 1], tickCumulatives);

      const result = await oracleLibraryTest.isInitialized(mockVolatilityOracle);
      expect(result).to.be.eq(true);
    });
  });

  describe('#isConnected', () => {
    it('returns correct value', async () => {
      const period = 3;
      const tickCumulatives = [7n, 12n];
      const mockVolatilityOracleFactory = await ethers.getContractFactory('MockVolatilityOracle');
      const mockVolatilityOracle = await mockVolatilityOracleFactory.deploy([period, 1], tickCumulatives);

      const mockPoolFactory = await ethers.getContractFactory('MockPool');
      const mockPool = await mockPoolFactory.deploy();

      expect(await oracleLibraryTest.isConnected(mockVolatilityOracle, mockPool)).to.be.false;

      await mockPool.setPlugin(mockVolatilityOracle);
      expect(await oracleLibraryTest.isConnected(mockVolatilityOracle, mockPool)).to.be.false;

      await mockPool.setPluginConfig(1);
      expect(await oracleLibraryTest.isConnected(mockVolatilityOracle, mockPool)).to.be.true;
    });
  });

  describe('#getQuoteAtTick', () => {
    // sanity check
    it('token0: returns correct value when tick = 0', async () => {
      const quoteAmount = await oracleLibraryTest.getQuoteAtTick(0n, expandTo18Decimals(1), tokens[0], tokens[1]);

      expect(quoteAmount).to.equal(expandTo18Decimals(1));
    });

    // sanity check
    it('token1: returns correct value when tick = 0', async () => {
      const quoteAmount = await oracleLibraryTest.getQuoteAtTick(0n, expandTo18Decimals(1), tokens[1], tokens[0]);

      expect(quoteAmount).to.equal(expandTo18Decimals(1));
    });

    it('token0: returns correct value when at min tick | 0 < sqrtRatioX96 <= type(uint128).max', async () => {
      const quoteAmount = await oracleLibraryTest.getQuoteAtTick(-887272n, 2n ** 128n - 1n, tokens[0], tokens[1]);
      expect(quoteAmount).to.equal(1n);
    });

    it('token1: returns correct value when at min tick | 0 < sqrtRatioX96 <= type(uint128).max', async () => {
      const quoteAmount = await oracleLibraryTest.getQuoteAtTick(-887272n, 2n ** 128n - 1n, tokens[1], tokens[0]);
      expect(quoteAmount).to.equal('115783384738768196242144082653949453838306988932806144552194799290216044976282');
    });

    it('token0: returns correct value when at max tick | sqrtRatioX96 > type(uint128).max', async () => {
      const quoteAmount = await oracleLibraryTest.getQuoteAtTick(887272n, 2n ** 128n - 1n, tokens[0], tokens[1]);
      expect(quoteAmount).to.equal('115783384785599357996676985412062652720342362943929506828539444553934033845703');
    });

    it('token1: returns correct value when at max tick | sqrtRatioX96 > type(uint128).max', async () => {
      const quoteAmount = await oracleLibraryTest.getQuoteAtTick(887272n, 2n ** 128n - 1n, tokens[1], tokens[0]);
      expect(quoteAmount).to.equal(1n);
    });

    it('gas test [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(oracleLibraryTest.getGasCostOfGetQuoteAtTick(10n, expandTo18Decimals(1), tokens[0], tokens[1]));
    });
  });
});
