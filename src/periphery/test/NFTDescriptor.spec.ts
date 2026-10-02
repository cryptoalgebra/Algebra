import { MaxUint256 } from 'ethers';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from './shared/expect';
import { TestERC20Metadata, NFTDescriptorTest } from '../typechain';
import { FeeAmount, TEN, TICK_SPACINGS } from './shared/constants';
import snapshotGasCost from './shared/snapshotGasCost';
import { formatSqrtRatioX96 } from './shared/formatSqrtRatioX96';
import { getMaxTick, getMinTick } from './shared/ticks';
import { extractJSONFromURI } from './shared/extractJSONFromURI';
import fs from 'fs';
import isSvg from 'is-svg';

const LOWEST_SQRT_RATIO = 4310618292;
const HIGHEST_SQRT_RATIO = 33849n * TEN ** 34n;

type TestERC20MetadataWithAddress = TestERC20Metadata & { address: string };
describe('NFTDescriptor', () => {
  const nftDescriptorFixture: () => Promise<{
    tokens: [
      TestERC20MetadataWithAddress,
      TestERC20MetadataWithAddress,
      TestERC20MetadataWithAddress,
      TestERC20MetadataWithAddress
    ];
    nftDescriptor: NFTDescriptorTest;
  }> = async () => {
    const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptor');
    const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy();

    const tokenFactory = await ethers.getContractFactory('TestERC20Metadata');
    const NFTDescriptorFactory = await ethers.getContractFactory('NFTDescriptorTest', {
      libraries: {
        NFTDescriptor: await nftDescriptorLibrary.getAddress(),
      },
    });
    const nftDescriptor = (await NFTDescriptorFactory.deploy()) as any as NFTDescriptorTest;
    tokenFactory.deploy(MaxUint256 / 2n, 'Test ERC20', 'TEST1');
    const tokens: [
      TestERC20MetadataWithAddress,
      TestERC20MetadataWithAddress,
      TestERC20MetadataWithAddress,
      TestERC20MetadataWithAddress
    ] = [
      (await tokenFactory.deploy(MaxUint256 / 2n, 'Test ERC20', 'TEST1')) as any as TestERC20MetadataWithAddress, // do not use maxu256 to avoid overflowing
      (await tokenFactory.deploy(MaxUint256 / 2n, 'Test ERC20', 'TEST2')) as any as TestERC20MetadataWithAddress,
      (await tokenFactory.deploy(MaxUint256 / 2n, 'Test ERC20', 'TEST3')) as any as TestERC20MetadataWithAddress,
      (await tokenFactory.deploy(MaxUint256 / 2n, 'Test ERC20', 'TEST4')) as any as TestERC20MetadataWithAddress,
    ];
    for (let token of tokens) {
      token.address = await token.getAddress();
    }

    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1));
    return {
      nftDescriptor,
      tokens,
    };
  };

  let nftDescriptor: NFTDescriptorTest;
  let tokens: [
    TestERC20MetadataWithAddress,
    TestERC20MetadataWithAddress,
    TestERC20MetadataWithAddress,
    TestERC20MetadataWithAddress
  ];

  beforeEach('load fixture', async () => {
    ({ nftDescriptor, tokens } = await loadFixture(nftDescriptorFixture));
  });

  describe('#constructTokenURI', () => {
    let tokenId: number;
    let baseTokenAddress: string;
    let quoteTokenAddress: string;
    let baseTokenSymbol: string;
    let quoteTokenSymbol: string;
    let baseTokenDecimals: number;
    let quoteTokenDecimals: number;
    let flipRatio: boolean;
    let tickLower: number;
    let tickUpper: number;
    let tickCurrent: number;
    let tickSpacing: number;
    let poolAddress: string;

    beforeEach(async () => {
      tokenId = 123;
      baseTokenAddress = tokens[0].address;
      quoteTokenAddress = tokens[1].address;
      baseTokenSymbol = await tokens[0].symbol();
      quoteTokenSymbol = await tokens[1].symbol();
      baseTokenDecimals = Number(await tokens[0].decimals());
      quoteTokenDecimals = Number(await tokens[1].decimals());
      flipRatio = false;
      tickLower = getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]);
      tickUpper = getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]);
      tickCurrent = 0;
      tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];
      poolAddress = `0x${'b'.repeat(40)}`;
    });

    it('returns the valid JSON string with min and max ticks', async () => {
      const json = extractJSONFromURI(
        await nftDescriptor.constructTokenURI({
          tokenId,
          baseTokenAddress,
          quoteTokenAddress,
          baseTokenSymbol,
          quoteTokenSymbol,
          baseTokenDecimals,
          quoteTokenDecimals,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent,
          tickSpacing,
          poolAddress,
        })
      );

      const tokenUri = constructTokenMetadata(
        tokenId,
        quoteTokenAddress,
        baseTokenAddress,
        poolAddress,
        quoteTokenSymbol,
        baseTokenSymbol,
        flipRatio,
        tickLower,
        tickUpper,
        tickCurrent,
        '0.3%',
        'MIN<>MAX'
      );

      expect(json.description).to.equal(tokenUri.description);
      expect(json.name).to.equal(tokenUri.name);
    });

    it('returns the valid JSON string with mid ticks', async () => {
      tickLower = -10;
      tickUpper = 10;
      tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      const json = extractJSONFromURI(
        await nftDescriptor.constructTokenURI({
          tokenId,
          baseTokenAddress,
          quoteTokenAddress,
          baseTokenSymbol,
          quoteTokenSymbol,
          baseTokenDecimals,
          quoteTokenDecimals,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent,
          tickSpacing,
          poolAddress,
        })
      );

      const tokenMetadata = constructTokenMetadata(
        tokenId,
        quoteTokenAddress,
        baseTokenAddress,
        poolAddress,
        quoteTokenSymbol,
        baseTokenSymbol,
        flipRatio,
        tickLower,
        tickUpper,
        tickCurrent,
        '0.3%',
        '0.99900<>1.0010'
      );

      expect(json.description).to.equal(tokenMetadata.description);
      expect(json.name).to.equal(tokenMetadata.name);
    });

    it('returns valid JSON when token symbols contain quotes', async () => {
      quoteTokenSymbol = '"TES"T1"';
      const json = extractJSONFromURI(
        await nftDescriptor.constructTokenURI({
          tokenId,
          baseTokenAddress,
          quoteTokenAddress,
          baseTokenSymbol,
          quoteTokenSymbol,
          baseTokenDecimals,
          quoteTokenDecimals,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent,
          tickSpacing,
          poolAddress,
        })
      );

      const tokenMetadata = constructTokenMetadata(
        tokenId,
        quoteTokenAddress,
        baseTokenAddress,
        poolAddress,
        quoteTokenSymbol,
        baseTokenSymbol,
        flipRatio,
        tickLower,
        tickUpper,
        tickCurrent,
        '0.3%',
        'MIN<>MAX'
      );

      expect(json.description).to.equal(tokenMetadata.description);
      expect(json.name).to.equal(tokenMetadata.name);
    });

    describe('when the token ratio is flipped', () => {
      it('returns the valid JSON for mid ticks', async () => {
        flipRatio = true;
        tickLower = -10;
        tickUpper = 10;

        const json = extractJSONFromURI(
          await nftDescriptor.constructTokenURI({
            tokenId,
            baseTokenAddress,
            quoteTokenAddress,
            baseTokenSymbol,
            quoteTokenSymbol,
            baseTokenDecimals,
            quoteTokenDecimals,
            flipRatio,
            tickLower,
            tickUpper,
            tickCurrent,
            tickSpacing,
            poolAddress,
          })
        );

        const tokenMetadata = constructTokenMetadata(
          tokenId,
          quoteTokenAddress,
          baseTokenAddress,
          poolAddress,
          quoteTokenSymbol,
          baseTokenSymbol,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent,
          '0.3%',
          '0.99900<>1.0010'
        );

        expect(json.description).to.equal(tokenMetadata.description);
        expect(json.name).to.equal(tokenMetadata.name);
      });

      it('returns the valid JSON for min/max ticks', async () => {
        flipRatio = true;

        const json = extractJSONFromURI(
          await nftDescriptor.constructTokenURI({
            tokenId,
            baseTokenAddress,
            quoteTokenAddress,
            baseTokenSymbol,
            quoteTokenSymbol,
            baseTokenDecimals,
            quoteTokenDecimals,
            flipRatio,
            tickLower,
            tickUpper,
            tickCurrent,
            tickSpacing,
            poolAddress,
          })
        );

        const tokenMetadata = constructTokenMetadata(
          tokenId,
          quoteTokenAddress,
          baseTokenAddress,
          poolAddress,
          quoteTokenSymbol,
          baseTokenSymbol,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent,
          '0.3%',
          'MIN<>MAX'
        );

        expect(json.description).to.equal(tokenMetadata.description);
        expect(json.name).to.equal(tokenMetadata.name);
      });
    });

    it('gas [ @skip-on-coverage ]', async () => {
      quoteTokenAddress = '0xabcdeabcdefabcdefabcdefabcdefabcdefabcdf';
      baseTokenAddress = '0x1234567890123456789123456789012345678901';
      quoteTokenSymbol = 'UNI';
      baseTokenSymbol = 'WNativeToken';
      await snapshotGasCost(
        nftDescriptor.getGasCostOfConstructTokenURI({
          tokenId,
          baseTokenAddress,
          quoteTokenAddress,
          baseTokenSymbol,
          quoteTokenSymbol,
          baseTokenDecimals,
          quoteTokenDecimals,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent,
          tickSpacing,
          poolAddress,
        })
      );
    });

    it('snapshot matches', async () => {
      // get snapshot with super rare special sparkle
      tokenId = 1;
      poolAddress = `0x${'b'.repeat(40)}`;
      // get a snapshot with svg fade
      tickCurrent = -1;
      tickLower = 0;
      tickUpper = 1000;
      tickSpacing = TICK_SPACINGS[FeeAmount.LOW];
      quoteTokenAddress = '0xabcdeabcdefabcdefabcdefabcdefabcdefabcdf';
      baseTokenAddress = '0x1234567890123456789123456789012345678901';
      quoteTokenSymbol = 'UNI';
      baseTokenSymbol = 'WNativeToken';
      expect(
        await nftDescriptor.constructTokenURI({
          tokenId,
          quoteTokenAddress,
          baseTokenAddress,
          quoteTokenSymbol,
          baseTokenSymbol,
          baseTokenDecimals,
          quoteTokenDecimals,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent,
          tickSpacing,
          poolAddress,
        })
      ).toMatchSnapshot();
    });
  });

  describe('#addressToString', () => {
    it('returns the correct string for a given address', async () => {
      let addressStr = await nftDescriptor.addressToString(`0x${'1234abcdef'.repeat(4)}`);
      expect(addressStr).to.eq('0x1234abcdef1234abcdef1234abcdef1234abcdef');
      addressStr = await nftDescriptor.addressToString(`0x${'1'.repeat(40)}`);
      expect(addressStr).to.eq(`0x${'1'.repeat(40)}`);
    });
  });

  describe('#tickToDecimalString', () => {
    let tickSpacing: number;
    let minTick: number;
    let maxTick: number;

    describe.skip('when tickspacing is 10', () => {
      before(() => {
        tickSpacing = TICK_SPACINGS[FeeAmount.LOW];
        minTick = getMinTick(tickSpacing);
        maxTick = getMaxTick(tickSpacing);
      });

      it('returns MIN on lowest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(minTick, tickSpacing, 18, 18, false)).to.equal('MIN');
      });

      it('returns MAX on the highest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(maxTick, tickSpacing, 18, 18, false)).to.equal('MAX');
      });

      it('returns the correct decimal string when the tick is in range', async () => {
        expect(await nftDescriptor.tickToDecimalString(1, tickSpacing, 18, 18, false)).to.equal('1.0001');
      });

      it('returns the correct decimal string when tick is mintick for different tickspace', async () => {
        const otherMinTick = getMinTick(200);
        expect(await nftDescriptor.tickToDecimalString(otherMinTick, tickSpacing, 18, 18, false)).to.equal(
          '0.0000000000000000000000000000000000000029387'
        );
      });
    });

    describe('when tickspacing is 60', () => {
      before(() => {
        tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];
        minTick = getMinTick(tickSpacing);
        maxTick = getMaxTick(tickSpacing);
      });

      it('returns MIN on lowest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(minTick, tickSpacing, 18, 18, false)).to.equal('MIN');
      });

      it('returns MAX on the highest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(maxTick, tickSpacing, 18, 18, false)).to.equal('MAX');
      });

      it('returns the correct decimal string when the tick is in range', async () => {
        expect(await nftDescriptor.tickToDecimalString(-1, tickSpacing, 18, 18, false)).to.equal('0.99990');
      });

      it('returns the correct decimal string when tick is mintick for different tickspace', async () => {
        const otherMinTick = getMinTick(200);
        expect(await nftDescriptor.tickToDecimalString(otherMinTick, tickSpacing, 18, 18, false)).to.equal(
          '0.0000000000000000000000000000000000000029387'
        );
      });
    });

    describe.skip('when tickspacing is 200', () => {
      before(() => {
        tickSpacing = TICK_SPACINGS[FeeAmount.HIGH];
        minTick = getMinTick(tickSpacing);
        maxTick = getMaxTick(tickSpacing);
      });

      it('returns MIN on lowest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(minTick, tickSpacing, 18, 18, false)).to.equal('MIN');
      });

      it('returns MAX on the highest tick', async () => {
        expect(await nftDescriptor.tickToDecimalString(maxTick, tickSpacing, 18, 18, false)).to.equal('MAX');
      });

      it('returns the correct decimal string when the tick is in range', async () => {
        expect(await nftDescriptor.tickToDecimalString(0, tickSpacing, 18, 18, false)).to.equal('1.0000');
      });

      it('returns the correct decimal string when tick is mintick for different tickspace', async () => {
        const otherMinTick = getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]);
        expect(await nftDescriptor.tickToDecimalString(otherMinTick, tickSpacing, 18, 18, false)).to.equal(
          '0.0000000000000000000000000000000000000029387'
        );
      });
    });

    describe('when token ratio is flipped', () => {
      it('returns the inverse of default ratio for medium, large and small numbers', async () => {
        const tickSpacing = TICK_SPACINGS[FeeAmount.HIGH];
        const cases: [string, number, string, string][] = [
          ['medium', 10, '1.0010', '0.99900'],
          ['large', 487272, '1448400000000000000000', '0.00000000000000000000069041'],
          ['small', -387272, '0.000000000000000015200', '65791000000000000'],
        ];
        for (const [label, tick, direct, flipped] of cases) {
          expect(await nftDescriptor.tickToDecimalString(tick, tickSpacing, 18, 18, false), label).to.eq(direct);
          expect(await nftDescriptor.tickToDecimalString(tick, tickSpacing, 18, 18, true), label).to.eq(flipped);
        }
      });

      it('returns the correct string with differing token decimals', async () => {
        const tickSpacing = TICK_SPACINGS[FeeAmount.HIGH];
        expect(await nftDescriptor.tickToDecimalString(1000, tickSpacing, 18, 18, true)).to.eq('0.90484');
        expect(await nftDescriptor.tickToDecimalString(1000, tickSpacing, 18, 10, true)).to.eq('90484000');
        expect(await nftDescriptor.tickToDecimalString(1000, tickSpacing, 10, 18, true)).to.eq('0.0000000090484');
      });

      it('returns MIN for highest tick', async () => {
        const tickSpacing = TICK_SPACINGS[FeeAmount.HIGH];
        const lowestTick = getMinTick(TICK_SPACINGS[FeeAmount.HIGH]);
        expect(await nftDescriptor.tickToDecimalString(lowestTick, tickSpacing, 18, 18, true)).to.eq('MAX');
      });

      it('returns MAX for lowest tick', async () => {
        const tickSpacing = TICK_SPACINGS[FeeAmount.HIGH];
        const highestTick = getMaxTick(TICK_SPACINGS[FeeAmount.HIGH]);
        expect(await nftDescriptor.tickToDecimalString(highestTick, tickSpacing, 18, 18, true)).to.eq('MIN');
      });
    });
  });

  describe('#fixedPointToDecimalString', () => {
    describe('returns the correct string for', () => {
      it('the highest possible price', async () => {
        const ratio = encodePriceSqrt(33849, 1 / 10 ** 34);
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq(
          '338490000000000000000000000000000000000'
        );
      });

      it('large numbers', async () => {
        let ratio = encodePriceSqrt(25811, 1 / 10 ** 11);
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('2581100000000000');
        ratio = encodePriceSqrt(17662, 1 / 10 ** 5);
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('1766200000');
      });

      it('whole numbers and each position of the decimal point', async () => {
        const cases: [string, number, number, string][] = [
          ['exactly 5 sigfig whole number', 42026, 1, '42026'],
          ['decimal at index 4', 12087, 10, '1208.7'],
          ['decimal at index 3', 12087, 100, '120.87'],
          ['decimal at index 2', 12087, 1000, '12.087'],
          ['decimal at index 1', 12345, 10000, '1.2345'],
          ['trailing 0s after the decimal', 1, 1, '1.0000'],
          ['exactly 5 numbers after the decimal', 12345, 100000, '0.12345'],
        ];
        for (const [label, amount1, amount0, expected] of cases) {
          expect(await nftDescriptor.fixedPointToDecimalString(encodePriceSqrt(amount1, amount0), 18, 18), label).to.eq(
            expected
          );
        }
      });

      it('very small numbers', async () => {
        let ratio = encodePriceSqrt(38741, 10 ** 20);
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq('0.00000000000000038741');
        ratio = encodePriceSqrt(88498, 10 ** 35);
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq(
          '0.00000000000000000000000000000088498'
        );
      });

      it('smallest number', async () => {
        const ratio = encodePriceSqrt(39000, 10 ** 43);
        expect(await nftDescriptor.fixedPointToDecimalString(ratio, 18, 18)).to.eq(
          '0.0000000000000000000000000000000000000029387'
        );
      });
    });

    describe('when tokens have different decimal precision', () => {
      describe('when baseToken has more precision decimals than quoteToken', () => {
        it('returns the correct string when the decimal difference is even', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(encodePriceSqrt(1, 1), 18, 16)).to.eq('100.00');
        });

        it('returns the correct string when the decimal difference is odd', async () => {
          const tenRatio = encodePriceSqrt(10, 1);
          expect(await nftDescriptor.fixedPointToDecimalString(tenRatio, 18, 17)).to.eq('100.00');
        });

        it('does not account for higher token0 precision if difference is more than 18', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(encodePriceSqrt(1, 1), 24, 5)).to.eq('1.0000');
        });
      });

      describe('when quoteToken has more precision decimals than baseToken', () => {
        it('returns the correct string when the decimal difference is even', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(encodePriceSqrt(1, 1), 10, 18)).to.eq('0.000000010000');
        });

        it('returns the correct string when the decimal difference is odd', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(encodePriceSqrt(1, 1), 7, 18)).to.eq(
            '0.000000000010000'
          );
        });

        // skipped: the contract reverts, the price adjusted for decimals is below 2^-128 and its square rounds to 0
        it.skip('returns the correct string when the decimal difference brings ratio below the minimum', async () => {
          const lowRatio = encodePriceSqrt(88498, 10 ** 35);
          expect(await nftDescriptor.fixedPointToDecimalString(lowRatio, 10, 20)).to.eq(
            '0.000000000000000000000000000000000000000088498'
          );
        });

        it('does not account for higher token1 precision if difference is more than 18', async () => {
          expect(await nftDescriptor.fixedPointToDecimalString(encodePriceSqrt(1, 1), 5, 24)).to.eq('1.0000');
        });
      });

      it('some fuzz', async () => {
        // seeded, so a failing draw can be replayed
        let state = 0x6d2b79f5;
        const next = () => {
          state = (state * 1103515245 + 12345) & 0x7fffffff;
          return state / 0x80000000;
        };
        const random = (min: number, max: number): number => Math.floor(min + next() * (max + 1 - min));
        const randomRatioBytes = (length: number) =>
          Buffer.from(Array.from({ length }, () => Math.floor(next() * 256)));

        const inputs: [bigint, number, number][] = [];
        let i = 0;
        while (i <= 20) {
          const ratio = BigInt(`0x${randomRatioBytes(random(7, 20)).toString('hex')}`);
          const decimals0 = random(3, 21);
          const decimals1 = random(3, 21);
          const decimalDiff = BigInt(Math.abs(decimals0 - decimals1));

          // fixedPointToDecimalString reverts when the decimal difference pushes the price out of these bounds
          if (ratio / TEN ** decimalDiff > LOWEST_SQRT_RATIO && ratio * TEN ** decimalDiff < HIGHEST_SQRT_RATIO) {
            inputs.push([ratio, decimals0, decimals1]);
            i++;
          }
        }

        for (let i in inputs) {
          let ratio: bigint | number;
          let decimals0: number;
          let decimals1: number;
          [ratio, decimals0, decimals1] = inputs[i];
          let result = await nftDescriptor.fixedPointToDecimalString(ratio, decimals0, decimals1);
          expect(formatSqrtRatioX96(ratio, decimals0, decimals1)).to.eq(result);
        }
      }).timeout(300_000);
    });
  });

  describe('#feeToPercentString', () => {
    it('returns the correct fee', async () => {
      const cases: [number, string][] = [
        [0, '0%'],
        [1, '0.0001%'],
        [30, '0.003%'],
        [33, '0.0033%'],
        [500, '0.05%'],
        [2500, '0.25%'],
        [3000, '0.3%'],
        [10000, '1%'],
        [17000, '1.7%'],
        [100000, '10%'],
        [150000, '15%'],
        [102000, '10.2%'],
        [1000000, '100%'],
        [1005000, '100.5%'],
        [10000000, '1000%'],
        [12300000, '1230%'],
      ];
      for (const [fee, expected] of cases) {
        expect(await nftDescriptor.feeToPercentString(fee), `fee ${fee}`).to.eq(expected);
      }
    });
  });

  describe('#tokenToColorHex', () => {
    function tokenToColorHex(tokenAddress: string, startIndex: number): string {
      return `${tokenAddress.slice(startIndex, startIndex + 6).toLowerCase()}`;
    }

    it('returns the correct hash for the first and the last 3 bytes of the address', async () => {
      expect(await nftDescriptor.tokenToColorHex(tokens[0].address, 136)).to.eq(tokenToColorHex(tokens[0].address, 2));
      expect(await nftDescriptor.tokenToColorHex(tokens[1].address, 136)).to.eq(tokenToColorHex(tokens[1].address, 2));
      expect(await nftDescriptor.tokenToColorHex(tokens[0].address, 0)).to.eq(tokenToColorHex(tokens[0].address, 36));
      expect(await nftDescriptor.tokenToColorHex(tokens[1].address, 0)).to.eq(tokenToColorHex(tokens[1].address, 36));
    });
  });

  describe('#rangeLocation', () => {
    it('returns the correct coordinates for each range midpoint bucket', async () => {
      const cases: [string, number, number, string, string][] = [
        ['under -125_000', -887_272, -887_100, '8', '7'],
        ['-125_000 to -75_000', -100_000, -90_000, '8', '10.5'],
        ['-75_000 to -25_000', -50_000, -20_000, '8', '14.25'],
        ['-25_000 to -5_000', -10_000, -5_000, '10', '18'],
        ['-5_000 to 0', -5_000, -4_000, '11', '21'],
        ['0 to 5_000', 4_000, 5_000, '13', '23'],
        ['5_000 to 25_000', 10_000, 15_000, '15', '25'],
        ['25_000 to 75_000', 25_000, 50_000, '18', '26'],
        ['75_000 to 125_000', 100_000, 125_000, '21', '27'],
        ['above 125_000', 200_000, 100_000, '24', '27'],
      ];
      for (const [label, tickLower, tickUpper, x, y] of cases) {
        const coords = await nftDescriptor.rangeLocation(tickLower, tickUpper);
        expect(coords[0], label).to.eq(x);
        expect(coords[1], label).to.eq(y);
      }
    });

    it('math does not overflow on max value', async () => {
      const coords = await nftDescriptor.rangeLocation(887_272, 887_272);
      expect(coords[0]).to.eq('24');
      expect(coords[1]).to.eq('27');
    });
  });

  describe('#svgImage', () => {
    let tokenId: number;
    let baseTokenAddress: string;
    let quoteTokenAddress: string;
    let baseTokenSymbol: string;
    let quoteTokenSymbol: string;
    let baseTokenDecimals: number;
    let quoteTokenDecimals: number;
    let flipRatio: boolean;
    let tickLower: number;
    let tickUpper: number;
    let tickCurrent: number;
    let tickSpacing: number;
    let poolAddress: string;

    beforeEach(async () => {
      tokenId = 123;
      quoteTokenAddress = '0x1234567890123456789123456789012345678901';
      baseTokenAddress = '0xabcdeabcdefabcdefabcdefabcdefabcdefabcdf';
      quoteTokenSymbol = 'UNI';
      baseTokenSymbol = 'WNativeToken';
      tickLower = -1000;
      tickUpper = 2000;
      tickCurrent = 40;
      baseTokenDecimals = Number(await tokens[0].decimals());
      quoteTokenDecimals = Number(await tokens[1].decimals());
      flipRatio = false;
      tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];
      poolAddress = `0x${'b'.repeat(40)}`;
    });

    it('matches the current snapshot', async () => {
      const svg = await nftDescriptor.generateSVGImage({
        tokenId,
        baseTokenAddress,
        quoteTokenAddress,
        baseTokenSymbol,
        quoteTokenSymbol,
        baseTokenDecimals,
        quoteTokenDecimals,
        flipRatio,
        tickLower,
        tickUpper,
        tickCurrent,
        tickSpacing,
        poolAddress,
      });

      expect(svg).toMatchSnapshot();
      fs.writeFileSync('./test/__snapshots__/NFTDescriptor.svg', svg);
    });

    it('returns a valid SVG', async () => {
      const svg = await nftDescriptor.generateSVGImage({
        tokenId,
        baseTokenAddress,
        quoteTokenAddress,
        baseTokenSymbol,
        quoteTokenSymbol,
        baseTokenDecimals,
        quoteTokenDecimals,
        flipRatio,
        tickLower,
        tickUpper,
        tickCurrent,
        tickSpacing,
        poolAddress,
      });
      expect(isSvg(svg)).to.eq(true);
    });

    it('fades the curve by where the current tick is relative to the range', async () => {
      const svgAt = (current: number) =>
        nftDescriptor.generateSVGImage({
          tokenId,
          baseTokenAddress,
          quoteTokenAddress,
          baseTokenSymbol,
          quoteTokenSymbol,
          baseTokenDecimals,
          quoteTokenDecimals,
          flipRatio,
          tickLower,
          tickUpper,
          tickCurrent: current,
          tickSpacing,
          poolAddress,
        });

      expect(await svgAt(tickUpper + 1)).to.contain('mask="url(#fade-up)"');
      expect(await svgAt(tickLower - 1)).to.contain('mask="url(#fade-down)"');
      expect(await svgAt(tickCurrent)).to.contain('mask="url(#none)"');
    });
  });

  describe('#isRare', () => {
    it('depends on the token id', async () => {
      expect(await nftDescriptor.isRare(1, `0x${'b'.repeat(40)}`)).to.eq(true);
      expect(await nftDescriptor.isRare(2, `0x${'b'.repeat(40)}`)).to.eq(false);
    });
  });

  function constructTokenMetadata(
    tokenId: number,
    quoteTokenAddress: string,
    baseTokenAddress: string,
    poolAddress: string,
    quoteTokenSymbol: string,
    baseTokenSymbol: string,
    flipRatio: boolean,
    tickLower: number,
    tickUpper: number,
    tickCurrent: number,
    feeTier: string,
    prices: string
  ): { name: string; description: string } {
    quoteTokenSymbol = quoteTokenSymbol.replace(/"/gi, '"');
    baseTokenSymbol = baseTokenSymbol.replace(/"/gi, '"');
    return {
      name: `Algebra - ${quoteTokenSymbol}/${baseTokenSymbol} - ${prices}`,
      description: `This NFT represents a liquidity position in a Algebra ${quoteTokenSymbol}-${baseTokenSymbol} pool. The owner of this NFT can modify or redeem the position.\n\
\nPool Address: ${poolAddress}\n${quoteTokenSymbol} Address: ${quoteTokenAddress.toLowerCase()}\n${baseTokenSymbol} Address: ${baseTokenAddress.toLowerCase()}\
\nToken ID: ${tokenId}\n\n⚠️ DISCLAIMER: Due diligence is imperative when assessing this NFT. Make sure token addresses match the expected tokens, as \
token symbols may be imitated.`,
    };
  }
});
