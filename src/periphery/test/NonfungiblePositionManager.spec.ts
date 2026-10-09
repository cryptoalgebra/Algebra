import { BaseContract, BigNumberish, ContractTransactionResponse, Wallet, MaxUint256, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture, reset } from '@nomicfoundation/hardhat-network-helpers';
import {
  TestPositionNFTOwner,
  MockTimeNonfungiblePositionManager,
  TestERC20,
  IWNativeToken,
  IAlgebraFactory,
  SwapRouter,
  MockPositionFollower,
  TestPositionManagerCaller,
} from '../typechain';
import completeFixture from './shared/completeFixture';
import { computePoolAddress } from './shared/computePoolAddress';
import { FeeAmount, MaxUint128, TICK_SPACINGS, ZERO_ADDRESS } from './shared/constants';
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

  const logArgs = async (tx: Promise<ContractTransactionResponse>, contract: BaseContract, name: string) => {
    const address = await contract.getAddress();
    const receipt = (await (await tx).wait())!;
    const log = receipt.logs.find((l) => l.address === address && contract.interface.parseLog(l)?.name === name);
    return contract.interface.parseLog(log!)!.args;
  };

  // a range above the current price takes token0 only, so the two amounts differ
  const mintAbovePrice = (recipient: string) =>
    nft.mint({
      token0: tokens[0].getAddress(),
      token1: tokens[1].getAddress(),
      deployer: ZERO_ADDRESS,
      tickLower: TICK_SPACINGS[FeeAmount.MEDIUM],
      tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM] * 2,
      recipient,
      amount0Desired: 100,
      amount1Desired: 100,
      amount0Min: 0,
      amount1Min: 0,
      deadline: 1,
    });

  // a full-range position owned by `other`; it gets token id 1
  const createPosition = async (amount = 100) => {
    await nft.createAndInitializePoolIfNecessary(
      tokens[0].getAddress(),
      tokens[1].getAddress(),
      ZERO_ADDRESS,
      encodePriceSqrt(1, 1),
      '0x'
    );
    await nft.mint({
      token0: tokens[0].getAddress(),
      token1: tokens[1].getAddress(),
      deployer: ZERO_ADDRESS,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      recipient: other.getAddress(),
      amount0Desired: amount,
      amount1Desired: amount,
      amount0Min: 0,
      amount1Min: 0,
      deadline: 1,
    });
  };

  before('create fixture loader', async () => {
    // gas depends on deployed addresses, so start from a fresh chain regardless of earlier spec files
    await reset();
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
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x');
      const codeAfter = await wallet.provider.getCode(expectedAddress);
      expect(codeAfter).to.not.eq('0x');
    });

    it('is payable', async () => {
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x', { value: 1 });
    });

    it('fails if tokens are not sorted', async () => {
      await expect(
        nft.createAndInitializePoolIfNecessary(tokens[1], tokens[0], ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x')
      ).to.be.revertedWith('Invalid order of tokens');
    });

    it('does not create a missing custom pool', async () => {
      expect(
        await nft.createAndInitializePoolIfNecessary.staticCall(
          tokens[0],
          tokens[1],
          other.address,
          encodePriceSqrt(1, 1),
          '0x'
        )
      ).to.eq(ZeroAddress);
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], other.address, encodePriceSqrt(1, 1), '0x');
      expect(await factory.customPoolByPair(other.address, tokens[0], tokens[1])).to.eq(ZeroAddress);
    });

    it('works if pool is created but not initialized', async () => {
      if (!wallet.provider) throw new Error('No provider');

      const expectedAddress = computePoolAddress(await factory.poolDeployer(), [
        await tokens[0].getAddress(),
        await tokens[1].getAddress(),
      ]);
      await factory.createPool(tokens[0], tokens[1], '0x');
      const code = await wallet.provider.getCode(expectedAddress);
      expect(code).to.not.eq('0x');
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], ZERO_ADDRESS, encodePriceSqrt(2, 1), '0x');
    });

    it('works if pool is created and initialized', async () => {
      const expectedAddress = computePoolAddress(await factory.poolDeployer(), [
        await tokens[0].getAddress(),
        await tokens[1].getAddress(),
      ]);
      await factory.createPool(tokens[0], tokens[1], '0x');
      const pool = new ethers.Contract(expectedAddress, IAlgebraPoolABI, wallet);

      await pool.initialize(encodePriceSqrt(3, 1));

      if (!wallet.provider) throw new Error('No provider');
      const code = await wallet.provider.getCode(expectedAddress);
      expect(code).to.not.eq('0x');
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], ZERO_ADDRESS, encodePriceSqrt(4, 1), '0x');
    });

    it('could theoretically use eth via multicall', async () => {
      const [token0, token1] = await sortedTokens(wnative, tokens[0]);

      const createAndInitializePoolIfNecessaryData = nft.interface.encodeFunctionData(
        'createAndInitializePoolIfNecessary',
        [await token0.getAddress(), await token1.getAddress(), ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x']
      );

      await nft.multicall([createAndInitializePoolIfNecessaryData], { value: expandTo18Decimals(1) });
    });

    it('gas [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x'));
    });
  });

  describe('#mint', () => {
    it('fails if slippage is too high', async () => {
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x');
      await expect(
        nft.mint({
          token0: tokens[0],
          token1: tokens[1],
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: other.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 101,
          amount1Min: 0,
          deadline: 1,
        })
      ).to.be.revertedWith('Price slippage check');
    });

    it('fails if pool does not exist', async () => {
      await expect(
        nft.mint({
          token0: tokens[0],
          token1: tokens[1],
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          recipient: wallet.address,
          deadline: 1,
        })
      ).to.be.revertedWithoutReason();
    });

    it('fails if cannot transfer', async () => {
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x');
      await tokens[0].approve(nft, 0);
      await expect(
        nft.mint({
          token0: tokens[0],
          token1: tokens[1],
          deployer: ZERO_ADDRESS,
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
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x');
      await nft.setTime(2);
      await expect(
        nft.mint({
          token0: tokens[0],
          token1: tokens[1],
          deployer: ZERO_ADDRESS,
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
        ZERO_ADDRESS,
        encodePriceSqrt(1, 1), 
        '0x'
      );
      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        deployer: ZERO_ADDRESS,
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
        ZERO_ADDRESS,
        encodePriceSqrt(1, 1), 
        '0x'
      ]);

      const mintData = nft.interface.encodeFunctionData('mint', [
        {
          token0: await token0.getAddress(),
          token1: await token1.getAddress(),
          deployer: ZERO_ADDRESS,
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

    it('emits an event', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        ZERO_ADDRESS,
        encodePriceSqrt(1, 1),
        '0x'
      );
      const pool = poolAtAddress(await factory.poolByPair(tokens[0], tokens[1]), wallet);

      const mint = mintAbovePrice(other.address);
      const { liquidityAmount, amount0, amount1 } = await logArgs(mint, pool, 'Mint');
      expect(amount0).to.be.gt(0);
      expect(amount1).to.eq(0);

      await expect(mint)
        .to.emit(nft, 'IncreaseLiquidity')
        .withArgs(1, liquidityAmount, liquidityAmount, amount0, amount1, await pool.getAddress());
    });

    it('gas first mint for pool [ @skip-on-coverage ]', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        ZERO_ADDRESS,
        encodePriceSqrt(1, 1), 
        '0x'
      );

      await snapshotGasCost(
        nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
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
      await nft.createAndInitializePoolIfNecessary(token0, token1, ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x');

      await snapshotGasCost(
        nft.multicall(
          [
            nft.interface.encodeFunctionData('mint', [
              {
                token0: await token0.getAddress(),
                token1: await token1.getAddress(),
                deployer: ZERO_ADDRESS,
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
      await nft.createAndInitializePoolIfNecessary(token0, token1, ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x');

      await snapshotGasCost(
        nft.multicall(
          [
            nft.interface.encodeFunctionData('mint', [
              {
                token0: await token0.getAddress(),
                token1: await token1.getAddress(),
                deployer: ZERO_ADDRESS,
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
      await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x');

      await nft.mint({
        token0: await tokens[0].getAddress(),
        token1: await tokens[1].getAddress(),
        deployer: ZERO_ADDRESS,
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
          deployer: ZERO_ADDRESS,
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
        ZERO_ADDRESS,
        encodePriceSqrt(1, 1), 
        '0x'
      );

      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        deployer: ZERO_ADDRESS,
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
          deployer: ZERO_ADDRESS,
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
    beforeEach('create a position', () => createPosition(1000));

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

    it('emits an event', async () => {
      const pool = poolAtAddress(await factory.poolByPair(tokens[0], tokens[1]), wallet);
      await mintAbovePrice(other.address);

      const increase = nft.increaseLiquidity({
        tokenId: 2,
        amount0Desired: 50,
        amount1Desired: 50,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      });
      const { liquidityAmount, amount0, amount1 } = await logArgs(increase, pool, 'Mint');
      expect(amount0).to.be.gt(0);
      expect(amount1).to.eq(0);

      await expect(increase)
        .to.emit(nft, 'IncreaseLiquidity')
        .withArgs(2, liquidityAmount, liquidityAmount, amount0, amount1, await pool.getAddress());
    });

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

    it('fails for a position off the new tick spacing, which can still be withdrawn', async () => {
      const pool = poolAtAddress(await factory.poolByPair(tokens[0], tokens[1]), wallet);
      await pool.setTickSpacing(200);
      await expect(
        nft.increaseLiquidity({
          tokenId: tokenId,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        })
      ).to.be.revertedWithCustomError(pool, 'tickIsNotSpaced');

      await nft
        .connect(other)
        .decreaseLiquidity({ tokenId, liquidity: 1000, amount0Min: 0, amount1Min: 0, deadline: 1 });
      expect((await nft.positions(tokenId)).liquidity).to.eq(0);
    });

    it('can be paid with Native', async () => {
      const [token0, token1] = await sortedTokens(tokens[0], wnative);

      const tokenId = 1;

      await nft.createAndInitializePoolIfNecessary(token0, token1, ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x');

      const mintData = nft.interface.encodeFunctionData('mint', [
        {
          token0: await token0.getAddress(),
          token1: await token1.getAddress(),
          deployer: ZERO_ADDRESS,
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
    beforeEach('create a position', () => createPosition());

    it('emits an event', async () => {
      const pool = poolAtAddress(await factory.poolByPair(tokens[0], tokens[1]), wallet);
      await mintAbovePrice(other.address);
      const { liquidity } = await nft.positions(2);

      const decrease = nft
        .connect(other)
        .decreaseLiquidity({ tokenId: 2, liquidity: liquidity / 2n, amount0Min: 0, amount1Min: 0, deadline: 1 });
      const { liquidityAmount, amount0, amount1 } = await logArgs(decrease, pool, 'Burn');
      expect(liquidityAmount).to.eq(liquidity / 2n);
      expect(amount0).to.be.gt(0);
      expect(amount1).to.eq(0);

      await expect(decrease)
        .to.emit(nft, 'DecreaseLiquidity')
        .withArgs(2, liquidity / 2n, amount0, amount1);
    });

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

    it('cannot use 0 or more than all the liquidity as liquidityDelta', async () => {
      await expect(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 0, amount0Min: 0, amount1Min: 0, deadline: 1 })
      ).to.be.revertedWithoutReason();
      await expect(
        nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 101, amount0Min: 0, amount1Min: 0, deadline: 1 })
      ).to.be.revertedWithoutReason();
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

    it('cannot decrease for more than the liquidity of the nft position', async () => {
      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        deployer: ZERO_ADDRESS,
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
      ).to.be.revertedWithoutReason();
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
    beforeEach('create a position', () => createPosition());

    it('cannot be called by other addresses, nor with 0 for both amounts', async () => {
      await expect(
        nft.collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        })
      ).to.be.revertedWith('Not approved');
      await expect(
        nft.connect(other).collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: 0,
          amount1Max: 0,
        })
      ).to.be.revertedWithoutReason();
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

    it('pays the fee in the fee token when the pool fixes it, whichever way the swap went', async () => {
      for (const token of tokens) await token.approve(router, MaxUint256);
      const [t0, t1] = [await tokens[0].getAddress(), await tokens[1].getAddress()];
      const pool = await ethers.getContractAt('IAlgebraPool', await factory.poolByPair(t0, t1), wallet);
      await pool.setFeeMode(1);

      await nft.mint({
        token0: t0,
        token1: t1,
        deployer: ZERO_ADDRESS,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount0Desired: expandTo18Decimals(1),
        amount1Desired: expandTo18Decimals(1),
        amount0Min: 0,
        amount1Min: 0,
        deadline: 2n ** 32n,
      });

      // token1 goes in, so the fee token is the output token of this swap
      await router.exactInputSingle({
        tokenIn: t1,
        tokenOut: t0,
        deployer: ZERO_ADDRESS,
        limitSqrtPrice: encodePriceSqrt(102, 100),
        amountOutMinimum: 0,
        deadline: 2n ** 32n,
        amountIn: expandTo18Decimals(1) / 10n,
        recipient: wallet.address,
      });
      // and back with token0 in, where the fee token is the input token
      await router.exactInputSingle({
        tokenIn: t0,
        tokenOut: t1,
        deployer: ZERO_ADDRESS,
        limitSqrtPrice: encodePriceSqrt(98, 100),
        amountOutMinimum: 0,
        deadline: 2n ** 32n,
        amountIn: expandTo18Decimals(1) / 10n,
        recipient: wallet.address,
      });

      const owed = await nft.connect(other).collect.staticCall({
        tokenId: 2,
        recipient: other.address,
        amount0Max: MaxUint128,
        amount1Max: MaxUint128,
      });
      expect(owed.amount0).to.eq(14933733051701n);
      expect(owed.amount1).to.eq(0);

      // the event carries what the manager itself booked, which the pool's own accounting cannot vouch for
      const before = await tokens[0].balanceOf(other.address);
      await expect(
        nft.connect(other).collect({ tokenId: 2, recipient: other.address, amount0Max: MaxUint128, amount1Max: MaxUint128 })
      )
        .to.emit(nft, 'Collect')
        .withArgs(2, other.address, 14933733051701n, 0);
      expect((await tokens[0].balanceOf(other.address)) - before).to.eq(owed.amount0);
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
    beforeEach('create a position', () => createPosition());

    it('emits an event', async () => {
      await nft
        .connect(other)
        .decreaseLiquidity({ tokenId, liquidity: 100, amount0Min: 0, amount1Min: 0, deadline: 1 });
      await nft.connect(other).collect({
        tokenId,
        recipient: wallet.address,
        amount0Max: MaxUint128,
        amount1Max: MaxUint128,
      });

      await expect(nft.connect(other).burn(tokenId))
        .to.emit(nft, 'Transfer')
        .withArgs(other.address, ZeroAddress, tokenId);
    });

    it('cannot be called by other addresses', async () => {
      await expect(nft.burn(tokenId)).to.be.revertedWith('Not approved');
    });

    it('cannot be called while there is still liquidity', async () => {
      await expect(nft.connect(other).burn(tokenId)).to.be.revertedWithoutReason();
    });

    it('cannot be called while there is still partial liquidity', async () => {
      await nft.connect(other).decreaseLiquidity({ tokenId, liquidity: 50, amount0Min: 0, amount1Min: 0, deadline: 1 });
      await expect(nft.connect(other).burn(tokenId)).to.be.revertedWithoutReason();
    });

    it('cannot be called while there is still tokens owed', async () => {
      await nft
        .connect(other)
        .decreaseLiquidity({ tokenId, liquidity: 100, amount0Min: 0, amount1Min: 0, deadline: 1 });
      await expect(nft.connect(other).burn(tokenId)).to.be.revertedWithoutReason();
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

  describe('#isApprovedOrOwner', () => {
    const tokenId = 1;
    beforeEach('create a position', () => createPosition());

    it('accepts the owner, the approved address and an operator, and nobody else', async () => {
      expect(await nft.isApprovedOrOwner(other.address, tokenId)).to.eq(true);
      expect(await nft.isApprovedOrOwner(wallet.address, tokenId)).to.eq(false);

      await nft.connect(other).approve(wallet.address, tokenId);
      expect(await nft.isApprovedOrOwner(wallet.address, tokenId)).to.eq(true);

      await nft.connect(other).approve(ZERO_ADDRESS, tokenId);
      expect(await nft.isApprovedOrOwner(wallet.address, tokenId)).to.eq(false);
      await nft.connect(other).setApprovalForAll(wallet.address, true);
      expect(await nft.isApprovedOrOwner(wallet.address, tokenId)).to.eq(true);
    });

    it('cannot be asked about a nonexistent token', async () => {
      await expect(nft.isApprovedOrOwner(wallet.address, 2)).to.be.revertedWith('ERC721: invalid token ID');
    });
  });

  describe('#transferFrom', () => {
    const tokenId = 1;
    beforeEach('create a position', () => createPosition());

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
    describe('owned by eoa', () => {
      const tokenId = 1;
      beforeEach('create a position', () => createPosition());

      it('changes the operator of the position, increments the nonce and emits an event', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1);
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s))
          .to.emit(nft, 'Approval')
          .withArgs(other.address, wallet.address, tokenId);
        expect((await nft.positions(tokenId)).nonce).to.eq(1);
        expect((await nft.positions(tokenId)).operator).to.eq(wallet.address);
      });

      it('cannot be called twice with the same signature', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, wallet.address, tokenId, 1);
        await nft.permit(wallet.address, tokenId, 1, v, r, s);
        await expect(nft.permit(wallet.address, tokenId, 1, v, r, s)).to.be.revertedWith('Unauthorized');
      });

      it('fails when the spender is the owner', async () => {
        const { v, r, s } = await getPermitNFTSignature(other, nft, other.address, tokenId, 1);
        await expect(nft.permit(other.address, tokenId, 1, v, r, s)).to.be.revertedWith('Approval to current owner');
      });

      it('fails with an invalid signature and with one not from the owner', async () => {
        const { v, r, s } = await getPermitNFTSignature(wallet, nft, wallet.address, tokenId, 1);
        await expect(nft.permit(wallet.address, tokenId, 1, v + 3, r, s)).to.be.revertedWith('Invalid signature');
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
          ZERO_ADDRESS,
          encodePriceSqrt(1, 1), 
          '0x'
        );

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
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
    beforeEach('create a position', () => createPosition());

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
      const tx = await exit({
        nft: nft.connect(other),
        tokenId,
        liquidity: 100,
        amount0Min: 0,
        amount1Min: 0,
        recipient: wallet.address,
      });
      const bottomTick = getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]);
      const topTick = getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]);
      await expect(tx)
        .to.emit(pool, 'Burn')
        .withArgs(await nft.getAddress(), bottomTick, topTick, 100, 99, 99);
      await expect(tx)
        .to.emit(pool, 'Collect')
        .withArgs(await nft.getAddress(), wallet.address, bottomTick, topTick, 99, 99);
      // the last action burns the position token
      await expect(tx).to.emit(nft, 'Transfer').withArgs(other.address, ZERO_ADDRESS, tokenId);
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
    beforeEach('create a position', () => createPosition());

    it('reverts for invalid token id', async () => {
      await expect(nft.tokenURI(tokenId + 1)).to.be.revertedWith('ERC721: invalid token ID');
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
        ZERO_ADDRESS,
        encodePriceSqrt(1, 1), 
        '0x'
      );
      // nft 1 earns 25% of fees
      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        deployer: ZERO_ADDRESS,
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
        deployer: ZERO_ADDRESS,
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
          path: encodePath([await tokens[0].getAddress(), ZERO_ADDRESS, await tokens[1].getAddress()]),
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
    beforeEach('create a position', () => createPosition());

    describe('set farming center', async () => {
      it('cannot set fc without role', async () => {
        await expect(nft.connect(other).setFarmingCenter(wallet.address)).to.be.revertedWithoutReason();
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

        await expect(nft.connect(other).approveForFarming(tokenId, true, nft)).to.be.revertedWithoutReason();
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

      it('can not switch on or off if not farming center', async () => {
        await nft.setFarmingCenter(wallet.address);
        await nft.connect(other).approveForFarming(tokenId, true, wallet.address);

        await expect(nft.connect(other).switchFarmingStatus(tokenId, true)).to.be.revertedWith('Only FarmingCenter');
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
        await expect(
          nft.connect(other).increaseLiquidity({
            tokenId: tokenId,
            amount0Desired: 100,
            amount1Desired: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 1,
          })
        ).to.be.revertedWithoutReason();
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
        await expect(
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
        ).to.be.revertedWithoutReason();
        expect(await mockFollower.wasCalled()).to.be.false;
      });
    });
  });

  describe('#liquidity lock', () => {
    const tokenId = 1;
    const LOCK_PERIOD = 300;

    beforeEach('create pool and position', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].getAddress(),
        tokens[1].getAddress(),
        ZERO_ADDRESS,
        encodePriceSqrt(1, 1),
        '0x'
      );

      await nft.setTime(1000);

      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        deployer: ZERO_ADDRESS,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount0Desired: 1000,
        amount1Desired: 1000,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10000,
      });
    });

    describe('#setLiquidityLockPeriod', () => {
      it('can be set by admin up to MAX_LIQUIDITY_LOCK_PERIOD, emitting an event each time', async () => {
        let previous = 0;
        for (const period of [LOCK_PERIOD, 600]) {
          await expect(nft.setLiquidityLockPeriod(period), `period ${period}`)
            .to.emit(nft, 'LiquidityLockPeriodChanged')
            .withArgs(previous, period);
          expect(await nft.liquidityLockPeriod(), `period ${period}`).to.eq(period);
          previous = period;
        }
      });

      it('cannot be set by non-admin', async () => {
        await expect(nft.connect(other).setLiquidityLockPeriod(LOCK_PERIOD)).to.be.revertedWith('NA');
      });

      it('cannot exceed MAX_LIQUIDITY_LOCK_PERIOD (10 minutes)', async () => {
        await expect(nft.setLiquidityLockPeriod(601)).to.be.revertedWith('LOCK_PERIOD_TOO_LONG');
      });

      it('does nothing if lock setting is permanently disabled', async () => {
        await nft.permanentlyDisableLiquidityLock();
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        expect(await nft.liquidityLockPeriod()).to.eq(0);
      });

      it('emits event with old and new values', async () => {
        await nft.setLiquidityLockPeriod(100);
        await expect(nft.setLiquidityLockPeriod(200))
          .to.emit(nft, 'LiquidityLockPeriodChanged')
          .withArgs(100, 200);
      });
    });

    describe('#permanentlyDisableLiquidityLock', () => {
      it('can be called by admin', async () => {
        await expect(nft.permanentlyDisableLiquidityLock())
          .to.emit(nft, 'LiquidityLockSettingDisabled')
          .to.emit(nft, 'LiquidityLockPeriodChanged')
          .withArgs(0, 0);
        expect(await nft.liquidityLockSettingDisabled()).to.eq(true);
        expect(await nft.liquidityLockPeriod()).to.eq(0);
      });

      it('cannot be called by non-admin', async () => {
        await expect(nft.connect(other).permanentlyDisableLiquidityLock()).to.be.revertedWith('NA');
      });

      it('resets liquidityLockPeriod to 0', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await expect(nft.permanentlyDisableLiquidityLock())
          .to.emit(nft, 'LiquidityLockPeriodChanged')
          .withArgs(LOCK_PERIOD, 0);
        expect(await nft.liquidityLockPeriod()).to.eq(0);
      });

      it('prevents setLiquidityLockPeriod from working after disable', async () => {
        await nft.permanentlyDisableLiquidityLock();
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        expect(await nft.liquidityLockPeriod()).to.eq(0);
      });
    });

    describe('#setWhitelistStatus', () => {
      it('can whitelist an address', async () => {
        await expect(nft.setWhitelistStatus(other.address, true))
          .to.emit(nft, 'WhitelistStatusChanged')
          .withArgs(other.address, true);
        expect(await nft.isWhitelisted(other.address)).to.eq(true);
      });

      it('can remove from whitelist', async () => {
        await nft.setWhitelistStatus(other.address, true);
        await expect(nft.setWhitelistStatus(other.address, false))
          .to.emit(nft, 'WhitelistStatusChanged')
          .withArgs(other.address, false);
        expect(await nft.isWhitelisted(other.address)).to.eq(false);
      });

      it('cannot be called by non-admin', async () => {
        await expect(nft.connect(other).setWhitelistStatus(other.address, true)).to.be.revertedWithoutReason();
      });
    });

    describe('#liquidityUnlockTime', () => {
      it('returns 0 when no lock period set', async () => {
        expect(await nft.liquidityUnlockTime(tokenId)).to.eq(0);
      });

      it('returns unlock time after mint with lock period', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(2000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        expect(await nft.liquidityUnlockTime(2)).to.eq(2000 + LOCK_PERIOD);
      });

      it('returns 0 when lock setting is disabled', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(2000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        await nft.permanentlyDisableLiquidityLock();
        expect(await nft.liquidityUnlockTime(2)).to.eq(0);
      });

      it('returns 0 when lock period is set to 0', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(2000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        await nft.setLiquidityLockPeriod(0);
        expect(await nft.liquidityUnlockTime(2)).to.eq(0);
      });
    });

    describe('mint with lock', () => {
      it('sets unlock time on mint when lock period > 0', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        expect(await nft.liquidityUnlockTime(2)).to.eq(5000 + LOCK_PERIOD);
      });

      it('emits LiquidityUnlockTimeUpdated on mint', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(5000);

        await expect(
          nft.mint({
            token0: tokens[0].getAddress(),
            token1: tokens[1].getAddress(),
            deployer: ZERO_ADDRESS,
            tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            recipient: wallet.address,
            amount0Desired: 100,
            amount1Desired: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        )
          .to.emit(nft, 'LiquidityUnlockTimeUpdated')
          .withArgs(2, 5000 + LOCK_PERIOD);
      });

      it('does not set unlock time when whitelisted', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setWhitelistStatus(wallet.address, true);
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        // unlock time not set because whitelisted
        expect(await nft.liquidityUnlockTime(2)).to.eq(0);
      });

      it('does not set unlock time when lock period is 0', async () => {
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        expect(await nft.liquidityUnlockTime(2)).to.eq(0);
      });
    });

    describe('decreaseLiquidity with lock', () => {
      it('blocks decrease when liquidity is locked', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        // try to decrease before unlock — should fail
        await nft.setTime(5100);
        await expect(
          nft.decreaseLiquidity({
            tokenId: 2,
            liquidity: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.be.revertedWith('LL');
      });

      it('allows decrease after lock period expires', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        await nft.setTime(5000 + LOCK_PERIOD);
        await expect(
          nft.decreaseLiquidity({
            tokenId: 2,
            liquidity: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.not.be.reverted;
      });

      it('allows decrease at exactly unlock time', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        await nft.setTime(5000 + LOCK_PERIOD);
        await expect(
          nft.decreaseLiquidity({
            tokenId: 2,
            liquidity: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.not.be.reverted;
      });

      it('whitelisted user can decrease even when locked', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setWhitelistStatus(wallet.address, true);
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        // time is before unlock but whitelisted
        await nft.setTime(5001);
        await expect(
          nft.decreaseLiquidity({
            tokenId: 2,
            liquidity: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.not.be.reverted;
      });

      it('position minted without lock can be decreased freely', async () => {
        // tokenId 1 was minted without lock period
        await nft.setTime(1001);
        await expect(
          nft.decreaseLiquidity({
            tokenId: 1,
            liquidity: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.not.be.reverted;
      });

      it('setting liquidityLockPeriod to 0 retroactively unlocks positions', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        // still locked
        await nft.setTime(5001);
        await expect(
          nft.decreaseLiquidity({
            tokenId: 2,
            liquidity: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.be.revertedWith('LL');

        // set period to 0 — retroactively unlocks
        await nft.setLiquidityLockPeriod(0);
        await expect(
          nft.decreaseLiquidity({
            tokenId: 2,
            liquidity: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.not.be.reverted;
      });

      it('permanently disabling lock allows decrease of locked positions', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        await nft.setTime(5001);
        await nft.permanentlyDisableLiquidityLock();

        await expect(
          nft.decreaseLiquidity({
            tokenId: 2,
            liquidity: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.not.be.reverted;
      });
    });

    describe('increaseLiquidity with lock', () => {
      it('updates unlock time on increaseLiquidity', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(5000);

        // mint with lock
        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        expect(await nft.liquidityUnlockTime(2)).to.eq(5000 + LOCK_PERIOD);

        // increase at a later time
        await nft.setTime(5200);
        await nft.increaseLiquidity({
          tokenId: 2,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        // unlock time should be extended
        expect(await nft.liquidityUnlockTime(2)).to.eq(5200 + LOCK_PERIOD);
      });

      it('non-approved user cannot increaseLiquidity when lock is active', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(5000);

        // mint a position owned by wallet
        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        // other is not approved or owner
        await expect(
          nft.connect(other).increaseLiquidity({
            tokenId: 2,
            amount0Desired: 100,
            amount1Desired: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.be.revertedWith('NA');
      });

      it('approved user can increaseLiquidity when lock is active', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        // approve other
        await nft.approve(other.address, 2);

        await expect(
          nft.connect(other).increaseLiquidity({
            tokenId: 2,
            amount0Desired: 100,
            amount1Desired: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.not.be.reverted;
      });

      it('whitelisted user can increaseLiquidity when lock is active', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setWhitelistStatus(other.address, true);
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        await expect(
          nft.connect(other).increaseLiquidity({
            tokenId: 2,
            amount0Desired: 100,
            amount1Desired: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.not.be.reverted;
      });

      it('anyone can increaseLiquidity when lock period is 0', async () => {
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        // other is not owner, but lock period is 0 so no restriction
        await expect(
          nft.connect(other).increaseLiquidity({
            tokenId: 2,
            amount0Desired: 100,
            amount1Desired: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.not.be.reverted;
      });
    });

    describe('collect while locked', () => {
      it('allows collecting fees even when liquidity is locked', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        // still locked
        await nft.setTime(5001);
        await expect(
          nft.collect({
            tokenId: 2,
            recipient: wallet.address,
            amount0Max: MaxUint128,
            amount1Max: MaxUint128,
          })
        ).to.not.be.reverted;
      });
    });

    describe('burn with lock', () => {
      it('can burn an empty position that was previously locked', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        // wait for unlock
        await nft.setTime(5000 + LOCK_PERIOD);

        // decrease all liquidity
        const { liquidity } = await nft.positions(2);
        await nft.decreaseLiquidity({
          tokenId: 2,
          liquidity: liquidity,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        // collect
        await nft.collect({
          tokenId: 2,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        });

        // burn
        await expect(nft.burn(2)).to.not.be.reverted;
      });
    });

    describe('lock interaction with increase and decrease', () => {
      it('increaseLiquidity extends lock, preventing early decrease', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setTime(5000);

        await nft.mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        // original unlock at 5300
        expect(await nft.liquidityUnlockTime(2)).to.eq(5000 + LOCK_PERIOD);

        // increase at 5200, extending unlock to 5500
        await nft.setTime(5200);
        await nft.increaseLiquidity({
          tokenId: 2,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });

        expect(await nft.liquidityUnlockTime(2)).to.eq(5200 + LOCK_PERIOD);

        // try at original unlock time 5300 — should fail now
        await nft.setTime(5300);
        await expect(
          nft.decreaseLiquidity({
            tokenId: 2,
            liquidity: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.be.revertedWith('LL');

        // succeed at new unlock time
        await nft.setTime(5200 + LOCK_PERIOD);
        await expect(
          nft.decreaseLiquidity({
            tokenId: 2,
            liquidity: 100,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 10000,
          })
        ).to.not.be.reverted;
      });
    });

    // position 2 of `wallet`, minted at 5000 under the lock, so it unlocks at 5300
    const mintLocked = async () => {
      await nft.setLiquidityLockPeriod(LOCK_PERIOD);
      await nft.setTime(5000);
      await nft.mint({
        token0: tokens[0].getAddress(),
        token1: tokens[1].getAddress(),
        deployer: ZERO_ADDRESS,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount0Desired: 1000,
        amount1Desired: 1000,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10000,
      });
    };
    const decrease = { tokenId: 2, liquidity: 100, amount0Min: 0, amount1Min: 0, deadline: 10000 };
    const increase = {
      tokenId: 2,
      amount0Desired: 100,
      amount1Desired: 100,
      amount0Min: 0,
      amount1Min: 0,
      deadline: 10000,
    };

    describe('lock across later changes', () => {
      it('lowering the lock period does not shorten a lock already set', async () => {
        await mintLocked();
        await nft.setLiquidityLockPeriod(60);
        expect(await nft.liquidityUnlockTime(2)).to.eq(5000 + LOCK_PERIOD);

        // the new period has passed, the one the position was locked with has not
        await nft.setTime(5060);
        await expect(nft.decreaseLiquidity(decrease)).to.be.revertedWith('LL');
        await nft.setTime(5000 + LOCK_PERIOD);
        await expect(nft.decreaseLiquidity(decrease)).to.emit(nft, 'DecreaseLiquidity');
      });

      it('switching the lock off and on again brings back the lock set before', async () => {
        await mintLocked();
        await nft.setLiquidityLockPeriod(0);
        expect(await nft.liquidityUnlockTime(2)).to.eq(0);
        await nft.setTime(5001);
        await expect(nft.decreaseLiquidity(decrease)).to.emit(nft, 'DecreaseLiquidity');

        // the unlock time stored at the mint is still there, nothing cleared it while the lock was off
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        expect(await nft.liquidityUnlockTime(2)).to.eq(5000 + LOCK_PERIOD);
        await expect(nft.decreaseLiquidity(decrease)).to.be.revertedWith('LL');
        await nft.setTime(5000 + LOCK_PERIOD);
        await expect(nft.decreaseLiquidity(decrease)).to.emit(nft, 'DecreaseLiquidity');
      });

      it('the lock stays with the token when the position is transferred', async () => {
        await mintLocked();
        await nft.transferFrom(wallet.address, other.address, 2);
        expect(await nft.liquidityUnlockTime(2)).to.eq(5000 + LOCK_PERIOD);

        await nft.setTime(5001);
        await expect(nft.connect(other).decreaseLiquidity(decrease)).to.be.revertedWith('LL');
      });

      it('an approved operator is held by the lock as well', async () => {
        await mintLocked();
        await nft.approve(other.address, 2);

        await nft.setTime(5001);
        await expect(nft.connect(other).decreaseLiquidity(decrease)).to.be.revertedWith('LL');
      });
    });

    describe('lock through a contract', () => {
      let caller: TestPositionManagerCaller;

      beforeEach('deploy a contract between the account and the position manager', async () => {
        caller = (await (
          await ethers.getContractFactory('TestPositionManagerCaller')
        ).deploy(nft)) as any as TestPositionManagerCaller;
        for (const token of tokens) {
          await token.transfer(caller, 1_000_000);
          await caller.approve(token);
        }
      });

      it('a whitelisted contract mints without a lock even when tx.origin is not whitelisted', async () => {
        await nft.setLiquidityLockPeriod(LOCK_PERIOD);
        await nft.setWhitelistStatus(caller, true);
        await nft.setTime(5000);

        await caller.connect(other).mint({
          token0: tokens[0].getAddress(),
          token1: tokens[1].getAddress(),
          deployer: ZERO_ADDRESS,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: other.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10000,
        });
        expect(await nft.liquidityUnlockTime(2)).to.eq(0);
        await expect(nft.connect(other).decreaseLiquidity(decrease)).to.emit(nft, 'DecreaseLiquidity');
      });

      it('an approved or whitelisted contract can add liquidity under the lock for a stranger tx.origin', async () => {
        await mintLocked();

        // neither `other` nor the contract has any right to the position yet
        await expect(caller.connect(other).increaseLiquidity(increase)).to.be.revertedWith('NA');

        await nft.approve(caller, 2);
        await expect(caller.connect(other).increaseLiquidity(increase)).to.emit(nft, 'IncreaseLiquidity');

        await nft.approve(ZERO_ADDRESS, 2);
        await nft.setWhitelistStatus(caller, true);
        await expect(caller.connect(other).increaseLiquidity(increase)).to.emit(nft, 'IncreaseLiquidity');
      });

      it('decrease skips the lock for a whitelisted msg.sender, but not for a whitelisted tx.origin', async () => {
        await mintLocked();
        await nft.approve(caller, 2);

        // a whitelisted tx.origin spares a position the lock when it is set, but does not lift it on decrease
        await nft.setWhitelistStatus(wallet.address, true);
        await nft.setTime(5001);
        await expect(caller.decreaseLiquidity(decrease)).to.be.revertedWith('LL');

        await nft.setWhitelistStatus(caller, true);
        await expect(caller.decreaseLiquidity(decrease)).to.emit(nft, 'DecreaseLiquidity');
      });
    });
  });
});
