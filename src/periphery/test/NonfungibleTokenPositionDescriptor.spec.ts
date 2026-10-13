import { Wallet, MaxUint256 } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from './shared/expect';
import { NonfungibleTokenPositionDescriptor, MockTimeNonfungiblePositionManager, TestERC20 } from '../typechain';
import completeFixture from './shared/completeFixture';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { FeeAmount, TICK_SPACINGS, tokenAddresses, ZERO_ADDRESS } from './shared/constants';
import { getMaxTick, getMinTick } from './shared/ticks';
import { sortedTokens } from './shared/tokenSort';
import { extractJSONFromURI } from './shared/extractJSONFromURI';

type TestERC20WithAddress = TestERC20 & { address: string | undefined };

describe('NonfungibleTokenPositionDescriptor', () => {
  let wallets: Wallet[];

  const nftPositionDescriptorCompleteFixture: () => Promise<{
    nftPositionDescriptor: NonfungibleTokenPositionDescriptor;
    tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
    nft: MockTimeNonfungiblePositionManager;
  }> = async () => {
    const { nft, nftDescriptor } = await loadFixture(completeFixture);
    const tokenFactory = await ethers.getContractFactory('TestERC20');
    const tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress] = [
      (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20WithAddress, // do not use maxu256 to avoid overflowing
      (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20WithAddress,
      (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20WithAddress,
    ];

    tokens[0].address = await tokens[0].getAddress();
    tokens[1].address = await tokens[1].getAddress();
    tokens[2].address = await tokens[2].getAddress();

    tokens.sort((tokenA: TestERC20WithAddress, tokenB: TestERC20WithAddress) => {
      if (!tokenA.address || !tokenB.address) return 0;
      return tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? -1 : 1;
    });

    return {
      nftPositionDescriptor: nftDescriptor,
      tokens,
      nft,
    };
  };

  let nftPositionDescriptor: NonfungibleTokenPositionDescriptor;
  let tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
  let nft: MockTimeNonfungiblePositionManager;
  let wnative: TestERC20;

  before('create fixture loader', async () => {
    wallets = await (ethers as any).getSigners();
  });

  beforeEach('load fixture', async () => {
    ({ tokens, nft, nftPositionDescriptor } = await loadFixture(nftPositionDescriptorCompleteFixture));
    const tokenFactory = await ethers.getContractFactory('TestERC20');
    wnative = tokenFactory.attach(await nftPositionDescriptor.WNativeToken()) as any as TestERC20;
  });

  describe('#tokenRatioPriority', () => {
    it('returns the priority of each known token and 0 for the rest', async () => {
      const cases: [string, string, number][] = [
        ['WNativeToken', await wnative.getAddress(), -100],
        ['USDC', tokenAddresses.USDC, 300],
        ['DAI', tokenAddresses.DAI, 100],
        ['USDT', tokenAddresses.USDT, 200],
        ['WETH', tokenAddresses.WETH, -200],
        ['WBTC', tokenAddresses.WBTC, -300],
        ['non-ratioPriority token', await tokens[0].getAddress(), 0],
      ];
      for (const [label, token, priority] of cases) {
        expect(await nftPositionDescriptor.tokenRatioPriority(token), label).to.eq(priority);
      }
    });
  });

  describe('#flipRatio', () => {
    it('flips by the priority ordering of the two tokens', async () => {
      const cases: [string, string, string, boolean][] = [
        ['neither token has priority ordering', await tokens[0].getAddress(), await tokens[2].getAddress(), false],
        ['both numerators, token0 has the higher priority', tokenAddresses.USDC, tokenAddresses.DAI, true],
        ['both denominators, token1 has the lower priority', await wnative.getAddress(), tokenAddresses.WBTC, true],
        ['token0 is a numerator, token1 a denominator', tokenAddresses.DAI, tokenAddresses.WBTC, true],
        ['token1 is a numerator, token0 a denominator', tokenAddresses.WBTC, tokenAddresses.DAI, false],
      ];
      for (const [label, token0, token1, flipped] of cases) {
        expect(await nftPositionDescriptor.flipRatio(token0, token1), label).to.eq(flipped);
      }
    });
  });

  describe('#tokenURI', () => {
    it('displays Native as token symbol for WNativeToken token', async () => {
      const [token0, token1] = await sortedTokens(wnative, tokens[1]);
      await nft.createAndInitializePoolIfNecessary(token0, token1, ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x');
      await wnative.approve(nft, 100);
      await tokens[1].approve(nft, 100);
      await nft.mint({
        token0: token0,
        token1: token1,
        deployer: ZERO_ADDRESS,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });

      const metadata = extractJSONFromURI(await nft.tokenURI(1));
      expect(metadata.name).to.match(/(\sMATIC\/TEST|TEST\/MATIC)/);
      expect(metadata.description).to.match(/(TEST-MATIC|\sMATIC-TEST)/);
      expect(metadata.description).to.match(/(\nMATIC\sAddress)/);
    });

    it('displays returned token symbols when neither token is WNativeToken ', async () => {
      const [token0, token1] = await sortedTokens(tokens[2], tokens[1]);
      await nft.createAndInitializePoolIfNecessary(token0, token1, ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x');
      await tokens[1].approve(nft, 100);
      await tokens[2].approve(nft, 100);
      await nft.mint({
        token0: token0,
        token1: token1,
        deployer: ZERO_ADDRESS,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });

      const metadata = extractJSONFromURI(await nft.tokenURI(1));
      expect(metadata.name).to.match(/TEST\/TEST/);
      expect(metadata.description).to.match(/TEST-TEST/);
    });

    it('uses token0 as the quote token when its ratio priority is higher', async () => {
      const [token0, token1] = await sortedTokens(tokens[2], tokens[1]);
      const library = await (await ethers.getContractFactory('NFTDescriptor')).deploy();
      const descriptorFactory = await ethers.getContractFactory('NonfungibleTokenPositionDescriptor', {
        libraries: { NFTDescriptor: await library.getAddress() },
      });
      const descriptor = (await descriptorFactory.deploy(wnative, 'MATIC', [
        { tokenAddress: await token0.getAddress(), tokenRatioSortOrder: 300 },
      ])) as any as NonfungibleTokenPositionDescriptor;

      await nft.createAndInitializePoolIfNecessary(token0, token1, ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x');
      await tokens[1].approve(nft, 100);
      await tokens[2].approve(nft, 100);
      await nft.mint({
        token0: token0,
        token1: token1,
        deployer: ZERO_ADDRESS,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });

      const metadata = extractJSONFromURI(await descriptor.tokenURI(nft, 1));
      const [address0, address1] = [
        (await token0.getAddress()).toLowerCase(),
        (await token1.getAddress()).toLowerCase(),
      ];
      expect(metadata.description).to.contain(`\nTEST Address: ${address0}\nTEST Address: ${address1}`);
    });
  });

  it('can be deployed without token ratio priorities', async () => {
    const library = await (await ethers.getContractFactory('NFTDescriptor')).deploy();
    const descriptorFactory = await ethers.getContractFactory('NonfungibleTokenPositionDescriptor', {
      libraries: { NFTDescriptor: await library.getAddress() },
    });
    const descriptor = (await descriptorFactory.deploy(
      wnative,
      'MATIC',
      []
    )) as any as NonfungibleTokenPositionDescriptor;

    expect(await descriptor.tokenRatioPriority(wnative)).to.eq(-100);
    expect(await descriptor.tokenRatioPriority(tokens[0])).to.eq(0);
  });
});
