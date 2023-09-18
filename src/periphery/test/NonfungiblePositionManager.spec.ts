import { BigNumberish, Wallet, MaxUint256, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  TestPositionNFTOwner,
  MockTimeNonfungiblePositionManager,
  TestERC20,
  IWNativeToken,
  IAlgebraFactory,
  SwapRouter,
  MockPositionFollower,
} from '../typechain';
import completeFixture from './shared/completeFixture';
import { computePoolAddress } from './shared/computePoolAddress';
import { FeeAmount, MaxUint128, TICK_SPACINGS } from './shared/constants';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { expect } from './shared/expect';
import getPermitNFTSignature from './shared/getPermitNFTSignature';
import { encodePath } from './shared/path';
import poolAtAddress from './shared/poolAtAddress';
import snapshotGasCost from './shared/snapshotGasCost';
import { getMaxTick, getMinTick } from './shared/ticks';
import { expandTo18Decimals } from './shared/expandTo18Decimals';
import { sortedTokens } from './shared/tokenSort';
import { extractJSONFromURI } from './shared/extractJSONFromURI';

import { abi as IAlgebraPoolABI } from '@cryptoalgebra/integral-core/artifacts/contracts/interfaces/IAlgebraPool.sol/IAlgebraPool.json';

describe('NonfungiblePositionManager', () => {
  let wallets: Wallet[];
  let wallet: Wallet, other: Wallet;

  const nftFixture: () => Promise<{
    nft: MockTimeNonfungiblePositionManager;
    factory: IAlgebraFactory;
    tokens: [TestERC20, TestERC20, TestERC20];
    wnative: IWNativeToken;
    router: SwapRouter;
  }> = async () => {
    const { wnative, factory, tokens, nft, router } = await completeFixture();

    // approve & fund wallets
    for (const token of tokens) {
      await token.approve(nft.getAddress(), MaxUint256);
      await token.connect(other).approve(nft.getAddress(), MaxUint256);
      await token.transfer(other.getAddress(), expandTo18Decimals(1_000_000));
    }

    return {
      nft,
      factory,
      tokens,
      wnative,
      router,
    };
  };

  let factory: IAlgebraFactory;
  let nft: MockTimeNonfungiblePositionManager;
  let tokens: [TestERC20, TestERC20, TestERC20];
  let wnative: IWNativeToken;
  let router: SwapRouter;

  before('create fixture loader', async () => {
    wallets = await (ethers as any).getSigners();
    [wallet, other] = wallets;
  });

  beforeEach('load fixture', async () => {
    ({ nft, factory, tokens, wnative, router } = await loadFixture(nftFixture));
  });

  it('bytecode size [ @skip-on-coverage ]', async () => {
    if (!wallet.provider) throw new Error('No provider');
    expect(((await wallet.provider.getCode(nft)).length - 2) / 2).to.matchSnapshot();
  });

  describe('#createAndInitializePoolIfNecessary', () => {
    it('creates the pool at the expected address', async () => {
      if (!wallet.provider) throw new Error('No provider');

      const expectedAddress = computePoolAddress(await factory.poolDeployer(), [
        await tokens[0].getAddress(),
        await tokens[1].getAddress(),
      ]);
      const code = await wallet.provider.getCode(expectedAddress);
      expect(code).to.eq('0x');
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], encodePriceSqrt(1, 1));
      const codeAfter = await wallet.provider.getCode(expectedAddress);
      expect(codeAfter).to.not.eq('0x');
    });

    it('is payable', async () => {
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], encodePriceSqrt(1, 1), { value: 1 });
    });

    it('works if pool is created but not initialized', async () => {
      if (!wallet.provider) throw new Error('No provider');

      const expectedAddress = computePoolAddress(await factory.poolDeployer(), [
        await tokens[0].getAddress(),
        await tokens[1].getAddress(),
      ]);
      await factory.createPool(tokens[0], tokens[1]);
      const code = await wallet.provider.getCode(expectedAddress);
      expect(code).to.not.eq('0x');
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], encodePriceSqrt(2, 1));
    });

    it('works if pool is created and initialized', async () => {
      const expectedAddress = computePoolAddress(await factory.poolDeployer(), [
        await tokens[0].getAddress(),
        await tokens[1].getAddress(),
      ]);
      await factory.createPool(tokens[0], tokens[1]);
      const pool = new ethers.Contract(expectedAddress, IAlgebraPoolABI, wallet);

      await pool.initialize(encodePriceSqrt(3, 1));

      if (!wallet.provider) throw new Error('No provider');
      const code = await wallet.provider.getCode(expectedAddress);
      expect(code).to.not.eq('0x');
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], encodePriceSqrt(4, 1));
    });

    it('could theoretically use eth via multicall', async () => {
      const [token0, token1] = await sortedTokens(wnative, tokens[0]);

      const createAndInitializePoolIfNecessaryData = nft.interface.encodeFunctionData(
        'createAndInitializePoolIfNecessary',
        [await token0.getAddress(), await token1.getAddress(), encodePriceSqrt(1, 1)]
      );

      await nft.multicall([createAndInitializePoolIfNecessaryData], { value: expandTo18Decimals(1) });
    });

    it('gas [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], encodePriceSqrt(1, 1)));
    });
  });

  describe('#mint', () => {
    it('fails if pool does not exist', async () => {
      await expect(
        nft.mint({
          token0: tokens[0],
          token1: tokens[1],
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallet.address,
          deadline: 1,
        })
      ).to.be.reverted;
    });

    it('fails if cannot transfer', async () => {
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], encodePriceSqrt(1, 1));
      await tokens[0].approve(nft, 0);
      await expect(
        nft.mint({
          token0: tokens[0],
          token1: tokens[1],
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallet.address,
          deadline: 1,
        })
      ).to.be.revertedWith('STF');
    });

    it('fails if deadline passed', async () => {
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], encodePriceSqrt(1, 1));
      await nft.setTime(2);
      await expect(
        nft.mint({
          token0: tokens[0],
          token1: tokens[1],
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallet.address,
          deadline: 1,
        })
      ).to.be.revertedWith('Transaction too old');
    });

    it('creates a token', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        encodePriceSqrt(1, 1)
      );
      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.getAddress(),
        amount0Desired: 15,
        amount1Desired: 15,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      });
      expect(await nft.balanceOf(other.getAddress())).to.eq(1);
      expect(await nft.tokenOfOwnerByIndex(other.getAddress(), 0)).to.eq(1);
      const {
        token0,
        token1,
        tickLower,
        tickUpper,
        liquidity,
        tokensOwed0,
        tokensOwed1,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
      } = await nft.positions(1);
      expect(token0).to.eq(await tokens[0].getAddress());
      expect(token1).to.eq(await tokens[1].getAddress());
      expect(tickLower).to.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(tickUpper).to.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(liquidity).to.eq(15);
      expect(tokensOwed0).to.eq(0);
      expect(tokensOwed1).to.eq(0);
      expect(feeGrowthInside0LastX128).to.eq(0);
      expect(feeGrowthInside1LastX128).to.eq(0);
    });

    it('can use eth via multicall', async () => {
      const [token0, token1] = await sortedTokens(wnative, tokens[0]);

      // remove any approval
      await wnative.approve(nft, 0);

      const createAndInitializeData = nft.interface.encodeFunctionData('createAndInitializePoolIfNecessary', [
        await token0.getAddress(),
        await token1.getAddress(),
        encodePriceSqrt(1, 1),
      ]);

      const mintData = nft.interface.encodeFunctionData('mint', [
        {
          token0: await token0.getAddress(),
          token1: await token1.getAddress(),
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: other.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        },
      ]);

      const refundNativeTokenData = nft.interface.encodeFunctionData('refundNativeToken');

      if (!wallet.provider) throw new Error('No provider');
      const balanceBefore = await wallet.provider.getBalance(wallet.address);
      let tx = await nft.multicall([createAndInitializeData, mintData, refundNativeTokenData], {
        value: expandTo18Decimals(1), // necessary so the balance doesn't change by anything that's not spent
      });
      let rcpt = await tx.wait();
      const balanceAfter = await wallet.provider.getBalance(wallet.address);
      let gasPrice = tx.gasPrice || 0n;
      if (!rcpt) throw new Error('No receipt');
      expect(balanceBefore - balanceAfter - gasPrice * rcpt.gasUsed).to.eq(100);
    });

    it('emits an event');

    it('gas first mint for pool [ @skip-on-coverage ]', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        encodePriceSqrt(1, 1)
      );

      await snapshotGasCost(
        nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10,
        })
      );
    });

    it('gas first mint for pool using eth with zero refund [ @skip-on-coverage ]', async () => {
      const [token0, token1] = await sortedTokens(wnative, tokens[0]);
      await nft.createAndInitializePoolIfNecessary(token0, token1, encodePriceSqrt(1, 1));

      await snapshotGasCost(
        nft.multicall(
          [
            nft.interface.encodeFunctionData('mint', [
              {
                token0: await token0.getAddress(),
                token1: await token1.getAddress(),
                tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
                tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
                recipient: wallet.address,
                amount0Desired: 100,
                amount1Desired: 100,
                amount0Min: 0,
                amount1Min: 0,
                deadline: 10,
              },
            ]),
            nft.interface.encodeFunctionData('refundNativeToken'),
          ],
          { value: 100 }
        )
      );
    });

    it('gas first mint for pool using eth with non-zero refund [ @skip-on-coverage ]', async () => {
      const [token0, token1] = await sortedTokens(wnative, tokens[0]);
      await nft.createAndInitializePoolIfNecessary(token0, token1, encodePriceSqrt(1, 1));

      await snapshotGasCost(
        nft.multicall(
          [
            nft.interface.encodeFunctionData('mint', [
              {
                token0: await token0.getAddress(),
                token1: await token1.getAddress(),
                tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
                tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
                recipient: wallet.address,
                amount0Desired: 100,
                amount1Desired: 100,
                amount0Min: 0,
                amount1Min: 0,
                deadline: 10,
              },
            ]),
            nft.interface.encodeFunctionData('refundNativeToken'),
          ],
          { value: 1000 }
        )
      );
    });

    it('gas mint on same ticks [ @skip-on-coverage ]', async () => {
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], encodePriceSqrt(1, 1));

      await nft.mint({
        token0: await tokens[0].getAddress(),
        token1: await tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.getAddress(),
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      });

      await snapshotGasCost(
        nft.mint({
          token0: await tokens[0].getAddress(),
          token1: await tokens[1].getAddress(),
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10,
        })
      );
    });

    it('gas mint for same pool, different ticks [ @skip-on-coverage ]', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        encodePriceSqrt(1, 1)
      );

      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.getAddress(),
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      });

      await snapshotGasCost(
        nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]) + TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]) - TICK_SPACINGS[FeeAmount.MEDIUM],
          recipient: wallet.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10,
        })
      );
    });
  });

  describe('#increaseLiquidity', () => {
    const tokenId = 1;
    beforeEach('create a position', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        encodePriceSqrt(1, 1)
      );

      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.getAddress(),
        amount0Desired: 1000,
        amount1Desired: 1000,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });
    });

    it('increases position liquidity', async () => {
      await nft.increaseLiquidity({
        tokenId: tokenId,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });
      const { liquidity } = await nft.positions(tokenId);
      expect(liquidity).to.eq(1100);
    });

    it('updates fees if needed', async () => {
      const pool = await factory.poolByPair(tokens[0], tokens[1]);

      await tokens[0].transfer(pool, 1000);
      await tokens[1].transfer(pool, 1000);

      await nft.increaseLiquidity({
        tokenId: tokenId,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });
      const { tokensOwed0, tokensOwed1 } = await nft.positions(tokenId);
      expect(tokensOwed0).to.eq(1000);
      expect(tokensOwed1).to.eq(1000);
    });

    it('emits an event');

    it('fails if deadline passed', async () => {
      await nft.setTime(2);
      await expect(
        nft.increaseLiquidity({
          tokenId: tokenId,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        })
      ).to.be.revertedWith('Transaction too old');
    });

    it('can be paid with Native', async () => {
      const [token0, token1] = await sortedTokens(tokens[0], wnative);

      const tokenId = 1;

      await nft.createAndInitializePoolIfNecessary(token0, token1, encodePriceSqrt(1, 1));

      const mintData = nft.interface.encodeFunctionData('mint', [
        {
          token0: await token0.getAddress(),
          token1: await token1.getAddress(),
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: other.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        },
      ]);
      const refundNativeTokenData = nft.interface.encodeFunctionData('unwrapWNativeToken', [0, other.address]);
      await nft.multicall([mintData, refundNativeTokenData], { value: expandTo18Decimals(1) });

      const increaseLiquidityData = nft.interface.encodeFunctionData('increaseLiquidity', [
        {
          tokenId: tokenId,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        },
      ]);
      await nft.multicall([increaseLiquidityData, refundNativeTokenData], { value: expandTo18Decimals(1) });
    });

    it('gas [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        nft.increaseLiquidity({
          tokenId: tokenId,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        })
      );
    });
  });

  describe('#decreaseLiquidity', () => {
    const tokenId = 1;
    beforeEach('create a position', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        encodePriceSqrt(1, 1)
      );

      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.getAddress(),
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });
    });

    it('emits an event');

    it('fails if past deadline', async () => {
      await nft.setTime(2);
      await expect(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 })
      ).to.be.revertedWith('Transaction too old');
    });

    it('fails if slippage too high', async () => {
      await expect(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 100000, amount1Min: 0, deadline: 1 })
      ).to.be.revertedWith('Price slippage check');
      await expect(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 100000, deadline: 1 })
      ).to.be.revertedWith('Price slippage check');
      await expect(
        nft
          .connect(other)
          .decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 100000, amount1Min: 100000, deadline: 1 })
      ).to.be.revertedWith('Price slippage check');
    });

    it('cannot be called by other addresses', async () => {
      await expect(
        nft.decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 })
      ).to.be.revertedWith('Not approved');
    });

    it('cannot use 0 as liquidityDelta', async () => {
      expect(nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 0, amount0Min: 0, amount1Min: 0, deadline: 1 }))
        .to.be.revertedWithoutReason;
    });

    it('decreases position liquidity', async () => {
      await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 25, amount0Min: 0, amount1Min: 0, deadline: 1 });
      const { liquidity } = await nft.positions(tokenId);
      expect(liquidity).to.eq(75);
    });

    it('is payable', async () => {
      await nft
        .connect(other)
        .decreaseLiquidity({ tokenId, liquidity: 25, amount0Min: 0, amount1Min: 0, deadline: 1 }, { value: 1 });
    });

    it('accounts for tokens owed', async () => {
      await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 25, amount0Min: 0, amount1Min: 0, deadline: 1 });
      const { tokensOwed0, tokensOwed1 } = await nft.positions(tokenId);
      expect(tokensOwed0).to.eq(24);
      expect(tokensOwed1).to.eq(24);
    });

    it('can decrease for all the liquidity', async () => {
      await nft
        .connect(other)
        .decreaseLiquidity({ tokenId, liquidity: 100, amount0Min: 0, amount1Min: 0, deadline: 1 });
      const { liquidity } = await nft.positions(tokenId);
      expect(liquidity).to.eq(0);
    });

    it('cannot decrease for more than all the liquidity', async () => {
      await expect(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 101, amount0Min: 0, amount1Min: 0, deadline: 1 })
      ).to.be.reverted;
    });

    it('cannot decrease for more than the liquidity of the nft position', async () => {
      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.getAddress(),
        amount0Desired: 200,
        amount1Desired: 200,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });
      await expect(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 101, amount0Min: 0, amount1Min: 0, deadline: 1 })
      ).to.be.reverted;
    });

    it('gas partial decrease [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 })
      );
    });

    it('gas complete decrease [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 100, amount0Min: 0, amount1Min: 0, deadline: 1 })
      );
    });
  });

  describe('#collect', () => {
    const tokenId = 1;
    beforeEach('create a position', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        encodePriceSqrt(1, 1)
      );

      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.getAddress(),
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });
    });

    it('cannot be called by other addresses', async () => {
      await expect(
        nft.collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })
      ).to.be.revertedWith('Not approved');
    });

    it('cannot be called with 0 for both amounts', async () => {
      await expect(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: 0,
          amount1Max: 0,
        })
      ).to.be.reverted;
    });

    it('can be called with token1 only', async () => {
      await expect(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: 0,
          amount1Max: 100,
        })
      ).to.be.not.reverted;
    });

    it('no op if no tokens are owed', async () => {
      await expect(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })
      )
        .to.not.emit(tokens[0], 'Transfer')
        .to.not.emit(tokens[1], 'Transfer');
    });

    it('transfers tokens owed from burn', async () => {
      await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 });
      const poolAddress = computePoolAddress(await factory.poolDeployer(), [
        await tokens[0].getAddress(),
        await tokens[1].getAddress(),
      ]);
      await expect(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })
      )
        .to.emit(tokens[0], 'Transfer')
        .withArgs(poolAddress, wallet.address, 49)
        .to.emit(tokens[1], 'Transfer')
        .withArgs(poolAddress, wallet.address, 49);
    });

    it('transfers tokens owed from burn to nft if recipient is 0', async () => {
      await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 });
      const poolAddress = computePoolAddress(await factory.poolDeployer(), [
        await tokens[0].getAddress(),
        await tokens[1].getAddress(),
      ]);
      await expect(
        nft.connect(other).collect({
          tokenId,
          recipient: ZeroAddress,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })
      )
        .to.emit(tokens[0], 'Transfer')
        .withArgs(poolAddress, await nft.getAddress(), 49)
        .to.emit(tokens[1], 'Transfer')
        .withArgs(poolAddress, await nft.getAddress(), 49);
    });

    it('gas transfers both [ @skip-on-coverage ]', async () => {
      await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 });
      await snapshotGasCost(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })
      );
    });

    it('gas transfers token0 only [ @skip-on-coverage ]', async () => {
      await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 });
      await snapshotGasCost(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: 0,
        })
      );
    });

    it('gas transfers token1 only [ @skip-on-coverage ]', async () => {
      await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 });
      await snapshotGasCost(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: 0,
          amount1Max: MaxUint128,
        })
      );
    });
  });

  describe('#burn', () => {
    const tokenId = 1;
    beforeEach('create a position', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        encodePriceSqrt(1, 1)
      );

      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.getAddress(),
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });
    });

    it('emits an event');

    it('cannot be called by other addresses', async () => {
      await expect(nft.burn(tokenId)).to.be.revertedWith('Not approved');
    });

    it('cannot be called while there is still liquidity', async () => {
      await expect(nft.connect(other).burn(tokenId)).to.be.revertedWith('Not cleared');
    });

    it('cannot be called while there is still partial liquidity', async () => {
      await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 });
      await expect(nft.connect(other).burn(tokenId)).to.be.revertedWith('Not cleared');
    });

    it('cannot be called while there is still tokens owed', async () => {
      await nft
        .connect(other)
        .decreaseLiquidity({ tokenId, liquidity: 100, amount0Min: 0, amount1Min: 0, deadline: 1 });
      await expect(nft.connect(other).burn(tokenId)).to.be.revertedWith('Not cleared');
    });

    it('deletes the token', async () => {
      await nft
        .connect(other)
        .decreaseLiquidity({ tokenId, liquidity: 100, amount0Min: 0, amount1Min: 0, deadline: 1 });
      await nft.connect(other).collect({
        tokenId,
        recipient: wallet.address,
        amount0Max: MaxUint128,
        amount1Max: MaxUint128,
      });
      await nft.connect(other).burn(tokenId);
      await expect(nft.positions(tokenId)).to.be.revertedWith('Invalid token ID');
    });

    it('gas [ @skip-on-coverage ]', async () => {
      await nft
        .connect(other)
        .decreaseLiquidity({ tokenId, liquidity: 100, amount0Min: 0, amount1Min: 0, deadline: 1 });
      await nft.connect(other).collect({
        tokenId,
        recipient: wallet.address,
        amount0Max: MaxUint128,
        amount1Max: MaxUint128,
      });
      await snapshotGasCost(nft.connect(other).burn(tokenId));
    });
  });

  describe('#getApproved', async () => {
    it('cannot get approved for nonexistent  token', async () => {
      await expect(nft.getApproved(1)).to.be.revertedWith('ERC721: invalid token ID');
    });
  });

  describe('#transferFrom', () => {
    const tokenId = 1;
    beforeEach('create a position', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        encodePriceSqrt(1, 1)
      );

      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.getAddress(),
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });
    });

    it('can only be called by authorized or owner', async () => {
      await expect(nft.transferFrom(other.getAddress(), wallet.address, tokenId)).to.be.revertedWith(
        'ERC721: caller is not token owner or approved'
      );
    });

    it('changes the owner', async () => {
      await nft.connect(other).transferFrom(other.getAddress(), wallet.address, tokenId);
      expect(await nft.ownerOf(tokenId)).to.eq(wallet.address);
    });

    it('removes existing approval', async () => {
      await nft.connect(other).approve(wallet.address, tokenId);
      expect(await nft.getApproved(tokenId)).to.eq(wallet.address);
      await nft.transferFrom(other.getAddress(), wallet.address, tokenId);
      expect(await nft.getApproved(tokenId)).to.eq(ZeroAddress);
    });

    it('gas [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(nft.connect(other).transferFrom(other.getAddress(), wallet.address, tokenId));
    });

    it('gas comes from approved [ @skip-on-coverage ]', async () => {
      await nft.connect(other).approve(wallet.address, tokenId);
      await snapshotGasCost(nft.transferFrom(other.getAddress(), wallet.address, tokenId));
    });
  });

  describe('#permit', () => {
    it('emits an event');

    describe('owned by eoa', () => {
      const tokenId = 1;
      beforeEach('create a position', async () => {
        await nft.createAndInitializePoolIfNecessary(
          tokens[0].getAddress(),
          tokens[1].getAddress(),
          encodePriceSqrt(1, 1)
        );

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: other.getAddress(),
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        });
      });

      it('changes the operator of the position and increments the nonce', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1);
        await nft.permit(wallet.address, tokenId, 1, v, r, s);
        expect((await nft.positions(tokenId)).nonce).to.eq(1);
        expect((await nft.positions(tokenId)).operator).to.eq(wallet.address);
      });

      it('cannot be called twice with the same signature', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1);
        await nft.permit(wallet.address, tokenId, 1, v, r, s);
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s)).to.be.reverted;
      });

      it('fails with invalid signature', async () => {
        const { v, r, s } = await getPermitNFTSignature(wallet, nft, wallet.address, tokenId, 1);
        await expect(nft.permit(wallet.address, tokenId, 1, v + 3, r, s)).to.be.revertedWith('Invalid signature');
      });

      it('fails with signature not from owner', async () => {
        const { v, r, s } = await getPermitNFTSignature(wallet, nft, wallet.address, tokenId, 1);
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s)).to.be.revertedWith('Unauthorized');
      });

      it('fails with expired signature', async () => {
        await nft.setTime(2);
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1);
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s)).to.be.revertedWith('Permit expired');
      });

      it('gas [ @skip-on-coverage ]', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1);
        await snapshotGasCost(nft.permit(wallet.address, tokenId, 1, v, r, s));
      });
    });
    describe('owned by verifying contract', () => {
      const tokenId = 1;
      let testPositionNFTOwner: TestPositionNFTOwner;

      beforeEach('deploy test owner and create a position', async () => {
        testPositionNFTOwner = (await (
          await ethers.getContractFactory('TestPositionNFTOwner')
        ).deploy()) as any as TestPositionNFTOwner;

        await nft.createAndInitializePoolIfNecessary(
          tokens[0].getAddress(),
          tokens[1].getAddress(),
          encodePriceSqrt(1, 1)
        );

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: testPositionNFTOwner.getAddress(),
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        });
      });

      it('changes the operator of the position and increments the nonce', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1);
        await testPositionNFTOwner.setOwner(other.getAddress());
        await nft.permit(wallet.address, tokenId, 1, v, r, s);
        expect((await nft.positions(tokenId)).nonce).to.eq(1);
        expect((await nft.positions(tokenId)).operator).to.eq(wallet.address);
      });

      it('fails if owner contract is owned by different address', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1);
        await testPositionNFTOwner.setOwner(wallet.address);
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s)).to.be.revertedWith('Unauthorized');
      });

      it('fails with signature not from owner', async () => {
        const { v, r, s } = await getPermitNFTSignature(wallet, nft, wallet.address, tokenId, 1);
        await testPositionNFTOwner.setOwner(other.getAddress());
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s)).to.be.revertedWith('Unauthorized');
      });

      it('fails with expired signature', async () => {
        await nft.setTime(2);
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1);
        await testPositionNFTOwner.setOwner(other.getAddress());
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s)).to.be.revertedWith('Permit expired');
      });

      it('gas [ @skip-on-coverage ]', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1);
        await testPositionNFTOwner.setOwner(other.getAddress());
        await snapshotGasCost(nft.permit(wallet.address, tokenId, 1, v, r, s));
      });
    });
  });

  describe('multicall exit', () => {
    const tokenId = 1;
    beforeEach('create a position', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        encodePriceSqrt(1, 1)
      );

      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.getAddress(),
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });
    });

    async function exit({
      nft,
      liquidity,
      tokenId,
      amount0Min,
      amount1Min,
      recipient,
    }: {
      nft: MockTimeNonfungiblePositionManager;
      tokenId: BigNumberish;
      liquidity: BigNumberish;
      amount0Min: BigNumberish;
      amount1Min: BigNumberish;
      recipient: string;
    }) {
      const decreaseLiquidityData = nft.interface.encodeFunctionData('decreaseLiquidity', [
        { tokenId, liquidity, amount0Min, amount1Min, deadline: 1 },
      ]);
      const collectData = nft.interface.encodeFunctionData('collect', [
        {
          tokenId,
          recipient,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        },
      ]);
      const burnData = nft.interface.encodeFunctionData('burn', [tokenId]);

      return nft.multicall([decreaseLiquidityData, collectData, burnData]);
    }

    it('executes all the actions', async () => {
      const pool = poolAtAddress(
        computePoolAddress(await factory.poolDeployer(), [await tokens[0].getAddress(), await tokens[1].getAddress()]),
        wallet
      );
      await expect(
        exit({
          nft: nft.connect(other),
          tokenId,
          liquidity: 100,
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallet.address,
        })
      )
        .to.emit(pool, 'Burn')
        .to.emit(pool, 'Collect');
    });

    it('gas [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        exit({
          nft: nft.connect(other),
          tokenId,
          liquidity: 100,
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallet.address,
        })
      );
    });
  });

  describe('#tokenURI', async () => {
    const tokenId = 1;
    beforeEach('create a position', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        encodePriceSqrt(1, 1)
      );

      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.getAddress(),
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });
    });

    it('reverts for invalid token id', async () => {
      await expect(nft.tokenURI(tokenId + 1)).to.be.reverted;
    });

    it('returns a data URI with correct mime type', async () => {
      expect(await nft.tokenURI(tokenId)).to.match(/data:application\/json;base64,.+/);
    });

    it('content is valid JSON and structure', async () => {
      const content = extractJSONFromURI(await nft.tokenURI(tokenId));
      expect(content).to.haveOwnProperty('name').is.a('string');
      expect(content).to.haveOwnProperty('description').is.a('string');
      expect(content).to.haveOwnProperty('image').is.a('string');
    });
  });

  describe('fees accounting', () => {
    beforeEach('create two positions', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        encodePriceSqrt(1, 1)
      );
      // nft 1 earns 25% of fees
      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
        recipient: wallet.address,
      });
      // nft 2 earns 75% of fees
      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),

        amount0Desired: 300,
        amount1Desired: 300,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
        recipient: wallet.address,
      });
    });

    describe('10k of token0 fees collect', () => {
      beforeEach('swap for ~10k of fees', async () => {
        const swapAmount = 3_333_333;
        await tokens[0].approve(router.getAddress(), swapAmount);
        await router.exactInput({
          recipient: wallet.address,
          deadline: 1,
          path: encodePath([await tokens[0].getAddress(), await tokens[1].getAddress()]),
          amountIn: swapAmount,
          amountOutMinimum: 0,
        });
      });
      it('expected amounts', async () => {
        const { amount0: nft1Amount0, amount1: nft1Amount1 } = await nft.collect.staticCall({
          tokenId: 1,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        });
        const { amount0: nft2Amount0, amount1: nft2Amount1 } = await nft.collect.staticCall({
          tokenId: 2,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        });
        console.log(nft1Amount0.toString(), nft1Amount1.toString(), nft2Amount0.toString(), nft2Amount1.toString());
        expect(nft1Amount0).to.eq(416);
        expect(nft1Amount1).to.eq(0);
        expect(nft2Amount0).to.eq(1250);
        expect(nft2Amount1).to.eq(0);
      });

      it('actually collected', async () => {
        const poolAddress = computePoolAddress(await factory.poolDeployer(), [
          await tokens[0].getAddress(),
          await tokens[1].getAddress(),
        ]);

        await expect(
          nft.collect({
            tokenId: 1,
            recipient: wallet.address,
            amount0Max: MaxUint128,
            amount1Max: MaxUint128,
          })
        )
          .to.emit(tokens[0], 'Transfer')
          .withArgs(poolAddress, wallet.address, 416)
          .to.not.emit(tokens[1], 'Transfer');
        await expect(
          nft.collect({
            tokenId: 2,
            recipient: wallet.address,
            amount0Max: MaxUint128,
            amount1Max: MaxUint128,
          })
        )
          .to.emit(tokens[0], 'Transfer')
          .withArgs(poolAddress, wallet.address, 1250)
          .to.not.emit(tokens[1], 'Transfer');
      });
    });
  });

  describe('#farming methods', () => {
    const tokenId = 1;
    beforeEach('create a position', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        encodePriceSqrt(1, 1)
      );

      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.getAddress(),
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });
    });

    describe('set farming center', async () => {
      it('cannot set fc without role', async () => {
        expect(nft.connect(other).setFarmingCenter(wallet.address)).to.be.revertedWithoutReason;
      });

      it('can set fc', async () => {
        await nft.setFarmingCenter(wallet.address);
        const farmingCenterAddress = await nft.farmingCenter();
        expect(farmingCenterAddress).to.be.eq(wallet.address);
      });
    });

    describe('approve for farming', async () => {
      it('can not approve for farming if not authorized', async () => {
        await nft.setFarmingCenter(wallet.address);

        await expect(nft.approveForFarming(tokenId, true, wallet.address)).to.be.revertedWith('Not approved');
      });

      it('can approve for farming', async () => {
        await nft.setFarmingCenter(wallet.address);

        await nft.connect(other).approveForFarming(tokenId, true, wallet.address);
        expect(await nft.farmingApprovals(tokenId)).to.be.eq(wallet.address);
      });

      it('can not approve for invalid farming', async () => {
        await nft.setFarmingCenter(wallet.address);

        await expect(nft.connect(other).approveForFarming(tokenId, true, nft)).to.be.revertedWith(
          'Invalid farming address'
        );
      });

      it('can revoke approval for farming', async () => {
        await nft.setFarmingCenter(wallet.address);

        await nft.connect(other).approveForFarming(tokenId, true, wallet.address);
        await nft.connect(other).approveForFarming(tokenId, false, wallet.address);
        expect(await nft.farmingApprovals(tokenId)).to.be.eq(ZeroAddress);
      });

      it('can revoke approval for farming if farming center changed', async () => {
        await nft.setFarmingCenter(wallet.address);

        await nft.connect(other).approveForFarming(tokenId, true, wallet.address);
        await nft.setFarmingCenter(nft);
        await nft.connect(other).approveForFarming(tokenId, false, wallet.address);
        expect(await nft.farmingApprovals(tokenId)).to.be.eq(ZeroAddress);
      });
    });

    describe('switch farming status', async () => {
      it('can not switch on if not approved', async () => {
        await nft.setFarmingCenter(wallet.address);

        await expect(nft.switchFarmingStatus(tokenId, true)).to.be.revertedWith('Not approved for farming');
      });

      it('can switch off if not approved', async () => {
        await nft.setFarmingCenter(wallet.address);

        await expect(nft.switchFarmingStatus(tokenId, false)).to.be.not.reverted;
      });

      it('can not switch on if not farming center', async () => {
        await nft.setFarmingCenter(wallet.address);
        await nft.connect(other).approveForFarming(tokenId, true, wallet.address);

        await expect(nft.connect(other).switchFarmingStatus(tokenId, true)).to.be.revertedWith('Only FarmingCenter');
      });

      it('can not switch off if not farming center', async () => {
        await nft.setFarmingCenter(wallet.address);
        await nft.connect(other).approveForFarming(tokenId, true, wallet.address);

        await expect(nft.connect(other).switchFarmingStatus(tokenId, false)).to.be.revertedWith('Only FarmingCenter');
      });

      it('can switch on', async () => {
        await nft.setFarmingCenter(wallet.address);
        await nft.connect(other).approveForFarming(tokenId, true, wallet.address);

        await nft.switchFarmingStatus(tokenId, true);
        const farmedIn = await nft.tokenFarmedIn(tokenId);
        expect(farmedIn).to.be.eq(wallet.address);
      });

      it('can switch off', async () => {
        await nft.setFarmingCenter(wallet.address);
        await nft.connect(other).approveForFarming(tokenId, true, wallet.address);

        await nft.switchFarmingStatus(tokenId, true);
        await nft.switchFarmingStatus(tokenId, false);
        const farmedIn = await nft.tokenFarmedIn(tokenId);
        expect(farmedIn).to.be.eq(ZeroAddress);
      });

      it('can switch off without approval', async () => {
        await nft.setFarmingCenter(wallet.address);
        await nft.connect(other).approveForFarming(tokenId, true, wallet.address);

        await nft.switchFarmingStatus(tokenId, true);

        await nft.connect(other).approveForFarming(tokenId, false, wallet.address);
        await nft.switchFarmingStatus(tokenId, false);
        const farmedIn = await nft.tokenFarmedIn(tokenId);
        expect(farmedIn).to.be.eq(ZeroAddress);
      });
    });

    describe('applyLiquidityDeltaInFarming', async () => {
      let mockFollower: MockPositionFollower;

      beforeEach('deploy mockFollower', async () => {
        const followerFactory = await ethers.getContractFactory('MockPositionFollower');
        mockFollower = (await followerFactory.deploy()) as any as MockPositionFollower;

        await nft.setFarmingCenter(mockFollower);
      });

      it('works', async () => {
        await nft.connect(other).approveForFarming(tokenId, true, mockFollower);
        await mockFollower.enterToFarming(nft, tokenId);

        expect(await mockFollower.wasCalled()).to.be.false;

        await nft.connect(other).increaseLiquidity({
          tokenId: tokenId,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        });

        expect(await mockFollower.wasCalled()).to.be.true;
      });

      it('does nothing if fc zero', async () => {
        await nft.connect(other).approveForFarming(tokenId, true, mockFollower);
        await mockFollower.enterToFarming(nft, tokenId);

        await nft.setFarmingCenter(ZeroAddress);
        expect(await mockFollower.wasCalled()).to.be.false;

        await nft.connect(other).increaseLiquidity({
          tokenId: tokenId,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        });

        expect(await mockFollower.wasCalled()).to.be.false;
      });

      it('does nothing if fc changed', async () => {
        await nft.connect(other).approveForFarming(tokenId, true, mockFollower);
        await mockFollower.enterToFarming(nft, tokenId);

        await nft.setFarmingCenter(other.address);
        expect(await mockFollower.wasCalled()).to.be.false;

        await nft.connect(other).increaseLiquidity({
          tokenId: tokenId,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        });

        expect(await mockFollower.wasCalled()).to.be.false;
      });

      it('catches panic', async () => {
        await nft.connect(other).approveForFarming(tokenId, true, mockFollower);
        await mockFollower.enterToFarming(nft, tokenId);

        expect(await mockFollower.wasCalled()).to.be.false;

        await mockFollower.setFailForToken(tokenId, 1);
        await expect(
          nft.connect(other).increaseLiquidity({
            tokenId: tokenId,
            amount0Desired: 100,
            amount1Desired: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 1,
          })
        )
          .to.emit(nft, 'FarmingFailed')
          .withArgs(tokenId);

        expect(await mockFollower.wasCalled()).to.be.false;

        await mockFollower.setFailForToken(tokenId, 2);
        await expect(
          nft.connect(other).increaseLiquidity({
            tokenId: tokenId,
            amount0Desired: 100,
            amount1Desired: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 1,
          })
        )
          .to.emit(nft, 'FarmingFailed')
          .withArgs(tokenId);

        expect(await mockFollower.wasCalled()).to.be.false;
      });

      it('catches error with message', async () => {
        await nft.connect(other).approveForFarming(tokenId, true, mockFollower);
        await mockFollower.enterToFarming(nft, tokenId);

        expect(await mockFollower.wasCalled()).to.be.false;

        await mockFollower.setFailForToken(tokenId, 3);
        await expect(
          nft.connect(other).increaseLiquidity({
            tokenId: tokenId,
            amount0Desired: 100,
            amount1Desired: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 1,
          })
        )
          .to.emit(nft, 'FarmingFailed')
          .withArgs(tokenId);
        expect(await mockFollower.wasCalled()).to.be.false;
      });

      it('reverts if error without message', async () => {
        await nft.connect(other).approveForFarming(tokenId, true, mockFollower);
        await mockFollower.enterToFarming(nft, tokenId);

        expect(await mockFollower.wasCalled()).to.be.false;

        await mockFollower.setFailForToken(tokenId, 4);
        expect(
          nft.connect(other).increaseLiquidity({
            tokenId: tokenId,
            amount0Desired: 100,
            amount1Desired: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 1,
          })
        ).to.be.revertedWithoutReason;
        expect(await mockFollower.wasCalled()).to.be.false;
      });

      it('reverts if custom error', async () => {
        await nft.connect(other).approveForFarming(tokenId, true, mockFollower);
        await mockFollower.enterToFarming(nft, tokenId);

        expect(await mockFollower.wasCalled()).to.be.false;

        await mockFollower.setFailForToken(tokenId, 5);
        await expect(
          nft.connect(other).increaseLiquidity({
            tokenId: tokenId,
            amount0Desired: 100,
            amount1Desired: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 1,
          })
        ).to.be.revertedWithCustomError(mockFollower, 'someCustomError');
        expect(await mockFollower.wasCalled()).to.be.false;
      });

      it('reverts if out of gas', async () => {
        await nft.connect(other).approveForFarming(tokenId, true, mockFollower);
        await mockFollower.enterToFarming(nft, tokenId);

        expect(await mockFollower.wasCalled()).to.be.false;

        const gasLimit = await nft.connect(other).increaseLiquidity.estimateGas({
          tokenId: tokenId,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        });

        await mockFollower.setFailForToken(tokenId, 6);
        expect(
          nft.connect(other).increaseLiquidity(
            {
              tokenId: tokenId,
              amount0Desired: 100,
              amount1Desired: 100,
              amount0Min: 0,
              amount1Min: 0,
              deadline: 1,
            },
            { gasLimit: gasLimit + 10000n }
          )
        ).to.be.revertedWithoutReason;
        expect(await mockFollower.wasCalled()).to.be.false;
      });
    });
  });
});
