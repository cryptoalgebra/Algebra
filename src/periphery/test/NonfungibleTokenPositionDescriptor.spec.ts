import { Wallet, MaxUint256 } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from './shared/expect';
import { NonfungibleTokenPositionDescriptor, MockTimeNonfungiblePositionManager, TestERC20 } from '../typechain';
import completeFixture from './shared/completeFixture';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { FeeAmount, TICK_SPACINGS, tokenAddresses } from './shared/constants';
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
    const { factory, nft, router, nftDescriptor } = await loadFixture(completeFixture);
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
    it('returns -100 for WNativeToken', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(wnative)).to.eq(-100);
    });

    it('returns 200 for USDC', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(tokenAddresses.USDC)).to.eq(300);
    });

    it('returns 100 for DAI', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(tokenAddresses.DAI)).to.eq(100);
    });

    it('returns  150 for USDT', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(tokenAddresses.USDT)).to.eq(200);
    });

    it('returns -200 for WETH', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(tokenAddresses.WETH)).to.eq(-200);
    });

    it('returns -250 for WBTC', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(tokenAddresses.WBTC)).to.eq(-300);
    });

    it('returns 0 for any non-ratioPriority token', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(tokens[0])).to.eq(0);
    });
  });

  describe('#flipRatio', () => {
    it('returns false if neither token has priority ordering', async () => {
      expect(await nftPositionDescriptor.flipRatio(tokens[0], tokens[2])).to.eq(false);
    });

    it('returns true if both tokens are numerators but token0 has a higher priority ordering', async () => {
      expect(await nftPositionDescriptor.flipRatio(tokenAddresses.USDC, tokenAddresses.DAI)).to.eq(true);
    });

    it('returns true if both tokens are denominators but token1 has lower priority ordering', async () => {
      expect(await nftPositionDescriptor.flipRatio(await wnative.getAddress(), tokenAddresses.WBTC)).to.eq(true);
    });

    it('returns true if token0 is a numerator and token1 is a denominator', async () => {
      expect(await nftPositionDescriptor.flipRatio(tokenAddresses.DAI, tokenAddresses.WBTC)).to.eq(true);
    });

    it('returns false if token1 is a numerator and token0 is a denominator', async () => {
      expect(await nftPositionDescriptor.flipRatio(tokenAddresses.WBTC, tokenAddresses.DAI)).to.eq(false);
    });
  });

  describe('#tokenURI', () => {
    it('displays Native as token symbol for WNativeToken token', async () => {
      const [token0, token1] = await sortedTokens(wnative, tokens[1]);
      await nft.createAndInitializePoolIfNecessary(token0, token1, encodePriceSqrt(1, 1));
      await wnative.approve(nft, 100);
      await tokens[1].approve(nft, 100);
      await nft.mint({
        token0: token0,
        token1: token1,
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
      await nft.createAndInitializePoolIfNecessary(token0, token1, encodePriceSqrt(1, 1));
      await tokens[1].approve(nft, 100);
      await tokens[2].approve(nft, 100);
      await nft.mint({
        token0: token0,
        token1: token1,
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
  });
});
