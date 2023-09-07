import { Contract, Wallet, MaxUint256, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  IAlgebraFactory,
  IWNativeToken,
  MockTimeNonfungiblePositionManager,
  SwapRouterL2,
  TestERC20,
} from '../typechain';
import completeFixtureCompressed from './shared/completeFixtureCompressed';
import { FeeAmount, TICK_SPACINGS } from './shared/constants';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { expandTo18Decimals } from './shared/expandTo18Decimals';
import { expect } from './shared/expect';
import { encodePath } from './shared/path';
import { getMaxTick, getMinTick } from './shared/ticks';
import { computePoolAddress } from './shared/computePoolAddress';
import { encodeRouterCalldata, EncodeRouterCalldataParams } from './shared/encodeRouterCalldata';

type TestERC20WithAddress = TestERC20 & {
  address: string;
};
describe.only('SwapRouterL2', function () {
  this.timeout(40000);
  let wallet: Wallet;
  let trader: Wallet;

  const swapRouterFixture: () => Promise<{
    wnative: IWNativeToken;
    factory: IAlgebraFactory;
    routerL2: SwapRouterL2;
    nft: MockTimeNonfungiblePositionManager;
    tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
  }> = async () => {
    const { wnative, factory, routerL2, tokens, nft } = await completeFixtureCompressed();

    // approve & fund wallets
    for (const token of tokens) {
      await token.approve(routerL2, MaxUint256);
      await token.approve(nft, MaxUint256);
      await token.connect(trader).approve(routerL2, MaxUint256);
      await token.transfer(trader.address, expandTo18Decimals(1_000_000));
      (token as TestERC20WithAddress).address = await token.getAddress();
    }

    return {
      wnative,
      factory,
      routerL2,
      tokens: tokens as [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress],
      nft,
    };
  };

  let factory: IAlgebraFactory;
  let wnative: IWNativeToken;
  let routerL2: SwapRouterL2;
  let nft: MockTimeNonfungiblePositionManager;
  let tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
  let tokensMap: Record<string, number> = {};
  let getBalances: (who: Contract | SwapRouterL2 | TestERC20 | string | TestERC20WithAddress) => Promise<{
    wnative: bigint;
    token0: bigint;
    token1: bigint;
    token2: bigint;
  }>;

  before('create fixture loader', async () => {
    [wallet, trader] = await (ethers as any).getSigners();
  });

  // helper for getting wnative and token balances
  beforeEach('load fixture', async () => {
    ({ routerL2, wnative, factory, tokens, nft } = await loadFixture(swapRouterFixture));
    tokensMap[await wnative.getAddress()] = 0;
    let nextTokenIndex = 1;
    for (let token of tokens) {
      tokensMap[await token.getAddress()] = nextTokenIndex;
      await routerL2.addTokenAddress(token);
      nextTokenIndex++;

      await token.transfer(routerL2, 1);
    }

    await wnative.deposit({ value: 10 });
    await wnative.transfer(routerL2, 1);

    getBalances = async (who: Contract | SwapRouterL2 | TestERC20 | string) => {
      const balances = await Promise.all([
        wnative.balanceOf(who),
        tokens[0].balanceOf(who),
        tokens[1].balanceOf(who),
        tokens[2].balanceOf(who),
      ]);
      return {
        wnative: balances[0],
        token0: balances[1],
        token1: balances[2],
        token2: balances[3],
      };
    };
  });

  // ensure the swap routerL2 never ends up with a balance
  afterEach('load fixture', async () => {
    const balances = await getBalances(routerL2);
    expect(Object.values(balances).every((b) => b == 1n)).to.be.eq(true);
    const balance = await ethers.provider.getBalance(routerL2);
    expect(balance).to.be.eq(0);
  });

  it('bytecode size [ @skip-on-coverage ]', async () => {
    if (!wallet.provider) throw new Error('Invalid provider');
    expect(((await wallet.provider.getCode(routerL2)).length - 2) / 2).to.matchSnapshot();
  });

  describe('swaps', () => {
    const liquidity = 1000000;
    async function createPool(tokenAddressA: string, tokenAddressB: string) {
      if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase())
        [tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA];

      await nft.createAndInitializePoolIfNecessary(tokenAddressA, tokenAddressB, encodePriceSqrt(1, 1));

      const liquidityParams = {
        token0: tokenAddressA,
        token1: tokenAddressB,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount0Desired: 1000000,
        amount1Desired: 1000000,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      };

      return nft.mint(liquidityParams);
    }

    async function createPoolWNativeToken(tokenAddress: string) {
      await wnative.deposit({ value: liquidity });
      await wnative.approve(nft, MaxUint256);
      return createPool(await wnative.getAddress(), tokenAddress);
    }

    beforeEach('create 0-1 and 1-2 pools', async () => {
      await createPool(await tokens[0].getAddress(), await tokens[1].getAddress());
      await createPool(await tokens[1].getAddress(), await tokens[2].getAddress());
    });

    async function sendPayload(from: Wallet, value: number, params: EncodeRouterCalldataParams): Promise<boolean> {
      let calldata = encodeRouterCalldata(params);
      let tx = await routerL2.addTokenAddress.populateTransaction(ZeroAddress, { value: value });
      tx.data = '0x' + calldata;
      tx.from = from.address;
      let txResponse = await from.sendTransaction(tx);

      await txResponse.wait();
      return true;
    }

    describe('#exactInput', () => {
      async function exactInput(
        tokens: string[],
        params: {
          amountIn?: number;
          amountOutMinimum?: number;
          wrappedNative?: boolean;
          unwrapResultWNative?: boolean;
          hasDeadline?: boolean;
          deadline?: bigint;
        }
      ): Promise<boolean> {
        let { amountIn, amountOutMinimum, wrappedNative, unwrapResultWNative } = params;
        if (amountIn === undefined) amountIn = 3;
        if (amountOutMinimum === undefined) amountOutMinimum = 1;

        const inputIsWNativeToken = (await wnative.getAddress()) === tokens[0];
        const outputIsWNativeToken = tokens[tokens.length - 1] === (await wnative.getAddress());
        const value = inputIsWNativeToken ? (wrappedNative ? 0 : amountIn) : 0;
        let tokensIndexes: number[] = tokens.map((token: string) => tokensMap[token]);

        const encodeParams: EncodeRouterCalldataParams = {
          exactIn: true,
          hasRecipient: true,
          hasDeadline: !!params.hasDeadline,
          deadline: params.deadline ? params.deadline : BigInt(0),
          tokens: tokensIndexes,
          recipient: outputIsWNativeToken ? ZeroAddress : trader.address,
          amountIn: BigInt(amountIn),
          amountOut: BigInt(amountOutMinimum),
          wrappedNative,
          unwrapResultWNative,
        };

        await sendPayload(trader, value, encodeParams);

        // ensure that the swap fails if the limit is any tighter
        encodeParams.amountOut += 1n;
        await expect(sendPayload(trader, value, encodeParams)).to.be.revertedWith('Too little received');
        return true;
      }

      describe('single-pool', () => {
        it('0 -> 1', async () => {
          const pool = await factory.poolByPair(tokens[0], tokens[1]);

          // get balances before
          const poolBefore = await getBalances(pool);
          const traderBefore = await getBalances(trader.address);

          await exactInput(
            tokens.slice(0, 2).map((token) => token.address),
            {}
          );

          // get balances after
          const poolAfter = await getBalances(pool);
          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n);
          expect(traderAfter.token1).to.be.eq(traderBefore.token1 + 1n);
          expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n);
          expect(poolAfter.token1).to.be.eq(poolBefore.token1 - 1n);
        });

        it('0 -> 1 with deadline', async () => {
          const pool = await factory.poolByPair(tokens[0], tokens[1]);

          // get balances before
          const poolBefore = await getBalances(pool);
          const traderBefore = await getBalances(trader.address);

          await expect(
            exactInput(
              tokens.slice(0, 2).map((token) => token.address),
              { hasDeadline: true, deadline: BigInt(Math.floor(Date.now() / 1000) - 1) }
            )
          ).to.be.revertedWith('Transaction too old');

          const deadline = BigInt(Math.floor(Date.now() / 1000) + 100000);
          await exactInput(
            tokens.slice(0, 2).map((token) => token.address),
            { hasDeadline: true, deadline }
          );

          // get balances after
          const poolAfter = await getBalances(pool);
          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n);
          expect(traderAfter.token1).to.be.eq(traderBefore.token1 + 1n);
          expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n);
          expect(poolAfter.token1).to.be.eq(poolBefore.token1 - 1n);
        });

        it('1 -> 0', async () => {
          const pool = await factory.poolByPair(tokens[1], tokens[0]);

          // get balances before
          const poolBefore = await getBalances(pool);
          const traderBefore = await getBalances(trader.address);

          await exactInput(
            tokens
              .slice(0, 2)
              .reverse()
              .map((token) => token.address),
            {}
          );

          // get balances after
          const poolAfter = await getBalances(pool);
          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n);
          expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 3n);
          expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n);
          expect(poolAfter.token1).to.be.eq(poolBefore.token1 + 3n);
        });
      });

      describe('multi-pool', () => {
        it('0 -> 1 -> 2', async () => {
          const traderBefore = await getBalances(trader.address);
          await exactInput(
            tokens.map((token) => token.address),
            { amountIn: 5, amountOutMinimum: 1 }
          );

          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 5n);
          expect(traderAfter.token2).to.be.eq(traderBefore.token2 + 1n);
        });

        it('0 -> 1 -> 2 with deadline', async () => {
          const traderBefore = await getBalances(trader.address);

          await expect(
            exactInput(
              tokens.map((token) => token.address),
              {
                amountIn: 5,
                amountOutMinimum: 1,
                hasDeadline: true,
                deadline: BigInt(Math.floor(Date.now() / 1000) - 1),
              }
            )
          ).to.be.revertedWith('Transaction too old');

          const deadline = BigInt(Math.floor(Date.now() / 1000) + 100000);
          await exactInput(
            tokens.map((token) => token.address),
            { amountIn: 5, amountOutMinimum: 1, hasDeadline: true, deadline }
          );

          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 5n);
          expect(traderAfter.token2).to.be.eq(traderBefore.token2 + 1n);
        });

        it('2 -> 1 -> 0', async () => {
          const traderBefore = await getBalances(trader.address);

          await exactInput(tokens.map((token) => token.address).reverse(), { amountIn: 5, amountOutMinimum: 1 });

          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token2).to.be.eq(traderBefore.token2 - 5n);
          expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n);
        });
      });

      describe('Native input', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(await tokens[0].getAddress());
          });

          it('WNativeToken -> 0', async () => {
            const pool = await factory.poolByPair(wnative, tokens[0]);

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await exactInput([await wnative.getAddress(), await tokens[0].getAddress()], {});

            // get balances after
            const poolAfter = await getBalances(pool);
            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n);
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative + 3n);
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n);
          });

          it('WNativeToken -> 0 -> 1', async () => {
            const traderBefore = await getBalances(trader.address);

            await exactInput([await wnative.getAddress(), await tokens[0].getAddress(), await tokens[1].getAddress()], {
              amountIn: 5,
            });

            const traderAfter = await getBalances(trader.address);
            expect(traderAfter.token1).to.be.eq(traderBefore.token1 + 1n);
          });
        });
      });

      describe('Native output', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(await tokens[0].getAddress());
            await createPoolWNativeToken(await tokens[1].getAddress());
          });

          it('0 -> WNativeToken', async () => {
            const pool = await factory.poolByPair(tokens[0], wnative);

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await exactInput([await tokens[0].getAddress(), await wnative.getAddress()], {
              amountIn: 3,
              amountOutMinimum: 1,
              unwrapResultWNative: true,
            });

            // get balances after
            const poolAfter = await getBalances(pool);
            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n);
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative - 1n);
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n);
          });
        });
      });
    });

    describe('#exactInputSupportingFee', () => {
      async function exactInputSupportingFee(
        tokens: string[],
        params: {
          amountIn?: number;
          amountOutMinimum?: number;
          wrappedNative?: boolean;
          unwrapResultWNative?: boolean;
          hasDeadline?: boolean;
          deadline?: bigint;
        }
      ): Promise<boolean> {
        let { amountIn, amountOutMinimum, wrappedNative, unwrapResultWNative } = params;
        if (amountIn === undefined) amountIn = 3;
        if (amountOutMinimum === undefined) amountOutMinimum = 1;

        const inputIsWNativeToken = (await wnative.getAddress()) === tokens[0];
        const outputIsWNativeToken = tokens[tokens.length - 1] === (await wnative.getAddress());
        const value = inputIsWNativeToken ? (wrappedNative ? 0 : amountIn) : 0;
        let tokensIndexes: number[] = tokens.map((token: string) => tokensMap[token]);

        const encodeParams: EncodeRouterCalldataParams = {
          exactIn: true,
          feeOnTransfer: true,
          hasRecipient: true,
          hasDeadline: !!params.hasDeadline,
          deadline: params.deadline ? params.deadline : 0n,
          tokens: tokensIndexes,
          recipient: outputIsWNativeToken ? ZeroAddress : trader.address,
          amountIn: BigInt(amountIn),
          amountOut: BigInt(amountOutMinimum),
          wrappedNative,
          unwrapResultWNative,
        };

        await sendPayload(trader, value, encodeParams);
        return true;
      }

      beforeEach(async () => {
        for (let token of tokens) {
          await token.transfer(trader.address, 110);
          await token.connect(trader).approve(routerL2, 110);
        }
      });

      describe('single-pool', () => {
        it('0 -> 1', async () => {
          await tokens[0].setFee(50);
          const pool = await factory.poolByPair(tokens[0], tokens[1]);

          // get balances before
          const poolBefore = await getBalances(pool);
          const traderBefore = await getBalances(trader.address);

          await exactInputSupportingFee(
            tokens.slice(0, 2).map((token) => token.address),
            { amountIn: 100, amountOutMinimum: 25 }
          );

          // get balances after
          const poolAfter = await getBalances(pool);
          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 100n);
          expect(traderAfter.token1).to.be.gt(traderBefore.token1 + 25n);
          expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 95n);
          expect(poolAfter.token1).to.be.lt(poolBefore.token1);
        });

        it('1 -> 0', async () => {
          await tokens[1].setFee(50);
          const pool = await factory.poolByPair(tokens[1], tokens[0]);

          // get balances before
          const poolBefore = await getBalances(pool);
          const traderBefore = await getBalances(trader.address);

          await exactInputSupportingFee(
            tokens
              .slice(0, 2)
              .reverse()
              .map((token) => token.address),
            { amountIn: 100, amountOutMinimum: 25 }
          );

          // get balances after
          const poolAfter = await getBalances(pool);
          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token0).to.be.gt(traderBefore.token0 + 25n);
          expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 100n);
          expect(poolAfter.token0).to.be.lt(poolBefore.token0 - 25n);
          expect(poolAfter.token1).to.be.eq(poolBefore.token1 + 95n);
        });
      });

      describe('multi-pool', () => {
        it('0 -> 1 -> 2', async () => {
          await tokens[0].setFee(50);
          const traderBefore = await getBalances(trader.address);
          await exactInputSupportingFee(
            tokens.map((token) => token.address),
            { amountIn: 100, amountOutMinimum: 10 }
          );

          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 100n);
          expect(traderAfter.token2).to.be.gt(traderBefore.token2 + 10n);
        });

        it('2 -> 1 -> 0', async () => {
          await tokens[2].setFee(50);
          const traderBefore = await getBalances(trader.address);

          await exactInputSupportingFee(tokens.map((token) => token.address).reverse(), {
            amountIn: 100,
            amountOutMinimum: 10,
          });

          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token2).to.be.eq(traderBefore.token2 - 100n);
          expect(traderAfter.token0).to.be.gt(traderBefore.token0 + 10n);
        });
      });

      describe('Native output', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(await tokens[0].getAddress());
            await createPoolWNativeToken(await tokens[1].getAddress());
          });

          it('0 -> WNativeToken', async () => {
            await tokens[0].setFee(50);
            const pool = await factory.poolByPair(tokens[0], wnative);

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await exactInputSupportingFee([await tokens[0].getAddress(), await wnative.getAddress()], {
              amountIn: 100,
              amountOutMinimum: 10,
              unwrapResultWNative: true,
            });

            // get balances after
            const poolAfter = await getBalances(pool);
            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 100n);
            expect(poolAfter.wnative).to.be.lt(poolBefore.wnative - 10n);
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 95n);
          });
        });
      });
    });

    describe('#exactOutput', () => {
      async function exactOutput(
        tokens: string[],
        amountOut: number = 1,
        amountInMaximum: number = 3,
        wrappedNative: boolean = false,
        unwrapResultWNative: boolean = false
      ): Promise<boolean> {
        const inputIsWNativeToken = tokens[0] === (await wnative.getAddress());
        const outputIsWNativeToken = tokens[tokens.length - 1] === (await wnative.getAddress());

        const value = inputIsWNativeToken ? (wrappedNative ? 0 : amountInMaximum) : 0;

        let tokensIndexes: number[] = tokens
          .slice()
          .reverse()
          .map((token: string) => tokensMap[token]);
        const params: EncodeRouterCalldataParams = {
          exactIn: false,
          hasRecipient: true,
          hasDeadline: false,
          tokens: tokensIndexes,
          recipient: outputIsWNativeToken ? ZeroAddress : trader.address,
          amountIn: BigInt(amountOut),
          amountOut: BigInt(amountInMaximum),
          wrappedNative,
          unwrapResultWNative,
        };
        await sendPayload(trader, value, params);

        // ensure that the swap fails if the limit is any tighter
        params.amountOut -= 1n;
        await expect(sendPayload(trader, value > 0 ? value - 1 : 0, params)).to.be.revertedWith('Too much requested');
        return true;
      }

      describe('single-pool', () => {
        it('0 -> 1', async () => {
          const pool = await factory.poolByPair(tokens[0], tokens[1]);

          // get balances before
          const poolBefore = await getBalances(pool);
          const traderBefore = await getBalances(trader.address);

          await exactOutput(tokens.slice(0, 2).map((token) => token.address));

          // get balances after
          const poolAfter = await getBalances(pool);
          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n);
          expect(traderAfter.token1).to.be.eq(traderBefore.token1 + 1n);
          expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n);
          expect(poolAfter.token1).to.be.eq(poolBefore.token1 - 1n);
        });

        it('1 -> 0', async () => {
          const pool = await factory.poolByPair(tokens[1], tokens[0]);

          // get balances before
          const poolBefore = await getBalances(pool);
          const traderBefore = await getBalances(trader.address);

          await exactOutput(
            tokens
              .slice(0, 2)
              .reverse()
              .map((token) => token.address)
          );

          // get balances after
          const poolAfter = await getBalances(pool);
          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n);
          expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 3n);
          expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n);
          expect(poolAfter.token1).to.be.eq(poolBefore.token1 + 3n);
        });
      });

      describe('multi-pool', () => {
        it('0 -> 1 -> 2', async () => {
          const traderBefore = await getBalances(trader.address);

          await exactOutput(
            tokens.map((token) => token.address),
            1,
            5
          );

          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 5n);
          expect(traderAfter.token2).to.be.eq(traderBefore.token2 + 1n);
        });

        it('2 -> 1 -> 0', async () => {
          const traderBefore = await getBalances(trader.address);

          await exactOutput(tokens.map((token) => token.address).reverse(), 1, 5);

          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token2).to.be.eq(traderBefore.token2 - 5n);
          expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n);
        });
      });

      describe('Native input', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(await tokens[0].getAddress());
            await wnative.deposit({ value: 1000 });
            await wnative.transfer(trader.address, 1000);
            await wnative.connect(trader).approve(routerL2, 1000);
          });

          it('WNativeToken -> 0', async () => {
            const pool = await factory.poolByPair(wnative, tokens[0]);

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await exactOutput([await wnative.getAddress(), await tokens[0].getAddress()]);

            // get balances after
            const poolAfter = await getBalances(pool);
            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n);
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative + 3n);
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n);
          });

          it('WNativeToken -> 0 -> 1', async () => {
            const traderBefore = await getBalances(trader.address);

            await exactOutput(
              [await wnative.getAddress(), await tokens[0].getAddress(), await tokens[1].getAddress()],
              1,
              5
            );

            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token1).to.be.eq(traderBefore.token1 + 1n);
          });
        });
      });

      describe('Native output', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(await tokens[0].getAddress());
            await createPoolWNativeToken(await tokens[1].getAddress());
          });

          it('0 -> WNativeToken', async () => {
            const pool = await factory.poolByPair(tokens[0], wnative);

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await exactOutput([await tokens[0].getAddress(), await wnative.getAddress()], 1, 3, false, true);

            // get balances after
            const poolAfter = await getBalances(pool);
            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n);
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative - 1n);
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n);
          });

          it('0 -> 1 -> WNativeToken', async () => {
            // get balances before
            const traderBefore = await getBalances(trader.address);

            await exactOutput(
              [await tokens[0].getAddress(), await tokens[1].getAddress(), await wnative.getAddress()],
              1,
              5,
              false,
              true
            );

            // get balances after
            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 5n);
          });
        });
      });
    });
  });
});
