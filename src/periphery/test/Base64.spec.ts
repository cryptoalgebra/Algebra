import { ethers } from 'hardhat';
import { base64Encode } from './shared/base64';
import { expect } from './shared/expect';
import { Base64Test } from '../typechain';
// a seeded generator, so a failing fuzz run can be replayed
const seededBytes = (() => {
  let state = 0x1f2e3d4c;
  return (length: number) =>
    Buffer.from(
      Array.from({ length }, () => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return (state >>> 7) & 0xff;
      })
    );
})();
import snapshotGasCost from './shared/snapshotGasCost';

function stringToHex(str: string): string {
  return `0x${Buffer.from(str, 'utf8').toString('hex')}`;
}

describe('Base64', () => {
  let base64: Base64Test;
  before('deploy test contract', async () => {
    base64 = (await (await ethers.getContractFactory('Base64Test')).deploy()) as any as Base64Test;
  });

  describe('#encode', () => {
    it('is correct for empty bytes', async () => {
      expect(await base64.encode(stringToHex(''))).to.eq('');
    });

    for (const example of [
      'test string',
      'this is a test',
      'alphabet soup',
      'aLpHaBeT',
      'includes\nnewlines',
      '<some html>',
      '😀',
      'f',
      'fo',
      'foo',
      'foob',
      'fooba',
      'foobar',
      'this is a very long string that should cost a lot of gas to encode :)',
    ]) {
      it(`works for "${example}"`, async () => {
        expect(await base64.encode(stringToHex(example))).to.eq(base64Encode(example));
      });

      it(`gas cost of encode(${example}) [ @skip-on-coverage ]`, async () => {
        await snapshotGasCost(base64.getGasCostOfEncode(stringToHex(example)));
      });
    }

    describe('max size string (24kB)', () => {
      let str: string;
      before(() => {
        str = Array<null>(24 * 1024)
          .fill(null)
          .map((_, i) => String.fromCharCode(i % 1024))
          .join('');
      });
      it('correctness', async () => {
        expect(await base64.encode(stringToHex(str))).to.eq(base64Encode(str));
      });
      it('gas cost [ @skip-on-coverage ]', async () => {
        await snapshotGasCost(base64.getGasCostOfEncode(stringToHex(str)));
      });
    });

    it('tiny fuzzing', async () => {
      const inputs = [];
      for (let i = 0; i < 100; i++) {
        inputs.push(seededBytes(i));
      }

      const promises = inputs.map((input) => {
        return base64.encode(`0x${input.toString('hex')}`);
      });

      const results = await Promise.all(promises);

      for (let i = 0; i < inputs.length; i++) {
        expect(inputs[i].toString('base64')).to.eq(results[i]);
      }
    }).timeout(300_000);
  });
});
