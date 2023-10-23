import { expect } from './shared/expect';
import { BitMathTest } from '../typechain';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import snapshotGasCost from './shared/snapshotGasCost';

describe('BitMath', () => {
  let bitMath: BitMathTest;
  const fixture = async () => {
    const factory = await ethers.getContractFactory('BitMathTest');
    return (await factory.deploy()) as any as BitMathTest;
  };
  beforeEach('deploy BitMathTest', async () => {
    bitMath = await loadFixture(fixture);
  });

  describe('#leastSignificantBit', () => {
    it('1', async () => {
      expect(await bitMath.leastSignificantBit(1)).to.eq(0);
    });
    it('2', async () => {
      expect(await bitMath.leastSignificantBit(2)).to.eq(1);
    });
    it('all powers of 2', async () => {
      const results = await Promise.all(
        [...Array(255)].map((_, i) => bitMath.leastSignificantBit(2n ** BigInt(i)))
      );
      expect(results).to.deep.eq([...Array(255)].map((_, i) => i));
    });
    it('uint256(-1)', async () => {
      expect(await bitMath.leastSignificantBit(2n ** 256n - 1n)).to.eq(0);
    });

    it('gas cost of smaller number  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(bitMath.getGasCostOfLeastSignificantBit(3568n));
    });
    it('gas cost of min number  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(bitMath.getGasCostOfLeastSignificantBit(1n));
    });
    it('gas cost of max uint128  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(bitMath.getGasCostOfLeastSignificantBit(2n ** 128n - 1n));
    });
    it('gas cost of max uint256  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(bitMath.getGasCostOfLeastSignificantBit(2n ** 256n - 1n));
    });
  });
});
