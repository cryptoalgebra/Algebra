import { MaxUint256, Contract, ContractTransactionResponse, Wallet, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { IWNativeToken, MockTimeNonfungiblePositionManager, MockTimeSwapRouter, TestERC20 } from '../typechain';
import completeFixture from './shared/completeFixture';
import { FeeAmount, TICK_SPACINGS } from './shared/constants';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { expandTo18Decimals } from './shared/expandTo18Decimals';
import { expect } from './shared/expect';
import { encodePath } from './shared/path';
import { getMaxTick, getMinTick } from './shared/ticks';
import { computePoolAddress } from './shared/computePoolAddress';

type TestERC20WithAddress = TestERC20 & { address: string };

describe('SwapRouter', function () {
  this.timeout(40000);
  let wallet: Wallet;
  let trader: Wallet;

  let factory: Contract;
  let wnative: IWNativeToken;
  let router: MockTimeSwapRouter;
  let nft: MockTimeNonfungiblePositionManager;
  let tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
  let getBalances: (who: string | MockTimeSwapRouter) => Promise<{
    wnative: bigint;
    token0: bigint;
    token1: bigint;
    token2: bigint;
  }>;

  const liquidity = 1000000;

  async function createPool(
    _nft: MockTimeNonfungiblePositionManager,
    _wallet: Wallet,
    tokenAddressA: string,
    tokenAddressB: string
  ) {
    if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase())
      [tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA];

    await _nft.createAndInitializePoolIfNecessary(tokenAddressA, tokenAddressB, encodePriceSqrt(1, 1));

    const liquidityParams = {
      token0: tokenAddressA,
      token1: tokenAddressB,
      fee: FeeAmount.MEDIUM,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      recipient: _wallet.address,
      amount0Desired: 1000000,
      amount1Desired: 1000000,
      amount0Min: 0,
      amount1Min: 0,
      deadline: 1,
    };

    return _nft.mint(liquidityParams);
  }

  const swapRouterFixture: () => Promise<{
    wnative: IWNativeToken;
    factory: Contract;
    router: MockTimeSwapRouter;
    nft: MockTimeNonfungiblePositionManager;
    tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
  }> = async () => {
    const { wnative, factory, router, tokens, nft } = await loadFixture(completeFixture);
    let _tokens = tokens as [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
    // approve & fund wallets
    for (const token of _tokens) {
      await token.approve(router, MaxUint256);
      await token.approve(nft, MaxUint256);
      await token.connect(trader).approve(router, MaxUint256);
      await token.transfer(trader.address, expandTo18Decimals(1_000_000));
      token.address = await token.getAddress();
    }

    await createPool(nft, wallet, _tokens[0].address, _tokens[1].address);
    await createPool(nft, wallet, _tokens[1].address, _tokens[2].address);

    return {
      wnative,
      factory: factory as any as Contract,
      router,
      tokens: _tokens,
      nft,
    };
  };

  async function createPoolWNativeToken(tokenAddress: string) {
    await wnative.deposit({ value: liquidity });
    await wnative.approve(nft, MaxUint256);
    return createPool(nft, wallet, await wnative.getAddress(), tokenAddress);
  }

  before('create fixture loader', async () => {
    [wallet, trader] = await (ethers as any).getSigners();
  });

  // helper for getting wnative and token balances
  beforeEach('load fixture', async () => {
    ({ router, wnative, factory, tokens, nft } = await loadFixture(swapRouterFixture));

    getBalances = async (who: string | MockTimeSwapRouter) => {
      let addr;
      if (typeof who == 'string') addr = who;
      else if ('getAddress' in who) {
        addr = await who.getAddress();
      } else throw new Error('Invalid who');
      const balances = await Promise.all([
        wnative.balanceOf(addr),
        tokens[0].balanceOf(addr),
        tokens[1].balanceOf(addr),
        tokens[2].balanceOf(addr),
      ]);
      return {
        wnative: balances[0],
        token0: balances[1],
        token1: balances[2],
        token2: balances[3],
      };
    };
  });

  // ensure the swap router never ends up with a balance
  afterEach('check balances', async () => {
    const balances = await getBalances(router);
    expect(Object.values(balances).every((b) => b == 0n)).to.be.eq(true);
    const balance = await ethers.provider.getBalance(router);
    expect(balance == 0n).to.be.eq(true);
  });

  it('bytecode size [ @skip-on-coverage ]', async () => {
    if (!wallet.provider) throw new Error('No provider');
    expect(((await wallet.provider.getCode(router)).length - 2) / 2).to.matchSnapshot();
  });

  describe('swaps', () => {
    it('cannot swap entirely within 0-liquidity region', async () => {
      const _liquidity = (await nft.positions(1)).liquidity;
      await nft.decreaseLiquidity({
        tokenId: 1,
        amount0Min: 0,
        amount1Min: 0,
        liquidity: _liquidity,
        deadline: 2,
      });

      await expect(
        router.exactInputSingle({
          tokenIn: tokens[0].address,
          tokenOut: tokens[1].address,
          limitSqrtPrice: 0,
          amountOutMinimum: 0,
          deadline: 1,
          amountIn: 100,
          recipient: wallet.address,
        })
      ).to.be.revertedWith('Zero liquidity swap');
    });

    describe('#exactInput', () => {
      async function exactInput(
        _tokens: string[],
        amountIn: number = 3,
        amountOutMinimum: number = 1,
        setTime: number = 1
      ): Promise<ContractTransactionResponse> {
        const inputIsWNativeToken = (await wnative.getAddress()) === _tokens[0];
        const outputIsWNativeToken = _tokens[_tokens.length - 1] === (await wnative.getAddress());

        const value = inputIsWNativeToken ? amountIn : 0;

        const params = {
          path: encodePath(_tokens),
          recipient: outputIsWNativeToken ? ZeroAddress : trader.address,
          deadline: 1,
          amountIn,
          amountOutMinimum,
        };

        const data = [router.interface.encodeFunctionData('exactInput', [params])];
        if (outputIsWNativeToken)
          data.push(router.interface.encodeFunctionData('unwrapWNativeToken', [amountOutMinimum, trader.address]));

        // ensure that the swap fails if the limit is any tighter
        params.amountOutMinimum += 1;
        await expect(router.connect(trader).exactInput(params, { value })).to.be.revertedWith('Too little received');
        params.amountOutMinimum -= 1;

        if (setTime != 1) await router.setTime(setTime);
        // optimized for the gas test
        return data.length === 1
          ? router.connect(trader).exactInput(params, { value })
          : router.connect(trader).multicall(data, { value });
      }

      it('reverts if deadline passed', async () => {
        await expect(
          exactInput(
            tokens.slice(0, 2).map((token) => token.address),
            3,
            1,
            2
          )
        ).to.be.revertedWith('Transaction too old');
      });

      describe('single-pool', () => {
        it('0 -> 1', async () => {
          const pool = await factory.poolByPair(tokens[0].address, tokens[1].address);

          // get balances before
          const poolBefore = await getBalances(pool);
          const traderBefore = await getBalances(trader.address);

          await exactInput(tokens.slice(0, 2).map((token) => token.address));

          // get balances after
          const poolAfter = await getBalances(pool);
          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n);
          expect(traderAfter.token1).to.be.eq(traderBefore.token1 + 1n);
          expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n);
          expect(poolAfter.token1).to.be.eq(poolBefore.token1 - 1n);
        });

        it('1 -> 0', async () => {
          const pool = await factory.poolByPair(tokens[1].address, tokens[0].address);

          // get balances before
          const poolBefore = await getBalances(pool);
          const traderBefore = await getBalances(trader.address);

          await exactInput(
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

          await exactInput(
            tokens.map((token) => token.address),
            5,
            1
          );

          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 5n);
          expect(traderAfter.token2).to.be.eq(traderBefore.token2 + 1n);
        });

        it('2 -> 1 -> 0', async () => {
          const traderBefore = await getBalances(trader.address);

          await exactInput(tokens.map((token) => token.address).reverse(), 5, 1);

          const traderAfter = await getBalances(trader.address);

          expect(traderAfter.token2).to.be.eq(traderBefore.token2 - 5n);
          expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n);
        });

        it('events', async () => {
          await expect(
            exactInput(
              tokens.map((token) => token.address),
              5,
              1
            )
          )
            .to.emit(tokens[0], 'Transfer')
            .withArgs(
              trader.address,
              computePoolAddress(await factory.poolDeployer(), [tokens[0].address, tokens[1].address]),
              5
            )
            .to.emit(tokens[1], 'Transfer')
            .withArgs(
              computePoolAddress(await factory.poolDeployer(), [tokens[0].address, tokens[1].address]),
              await router.getAddress(),
              3
            )
            .to.emit(tokens[1], 'Transfer')
            .withArgs(
              await router.getAddress(),
              computePoolAddress(await factory.poolDeployer(), [tokens[1].address, tokens[2].address]),
              3
            )
            .to.emit(tokens[2], 'Transfer')
            .withArgs(
              computePoolAddress(await factory.poolDeployer(), [tokens[1].address, tokens[2].address]),
              trader.address,
              1
            );
        });
      });

      describe('Native input', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address);
          });

          it('WNativeToken -> 0', async () => {
            const pool = await factory.poolByPair(await wnative.getAddress(), tokens[0].address);

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await expect(exactInput([await wnative.getAddress(), tokens[0].address]))
              .to.emit(wnative, 'Deposit')
              .withArgs(await router.getAddress(), 3);

            // get balances after
            const poolAfter = await getBalances(pool);
            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n);
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative + 3n);
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n);
          });

          it('WNativeToken -> 0 -> 1', async () => {
            const traderBefore = await getBalances(trader.address);

            await expect(exactInput([await wnative.getAddress(), tokens[0].address, tokens[1].address], 5))
              .to.emit(wnative, 'Deposit')
              .withArgs(await router.getAddress(), 5);

            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token1).to.be.eq(traderBefore.token1 + 1n);
          });
        });
      });

      describe('Native output', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address);
            await createPoolWNativeToken(tokens[1].address);
          });

          it('0 -> WNativeToken', async () => {
            const pool = await factory.poolByPair(tokens[0].address, await wnative.getAddress());

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await expect(exactInput([tokens[0].address, await wnative.getAddress()]))
              .to.emit(wnative, 'Withdrawal')
              .withArgs(await router.getAddress(), 1);

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

            await expect(exactInput([tokens[0].address, tokens[1].address, await wnative.getAddress()], 5))
              .to.emit(wnative, 'Withdrawal')
              .withArgs(await router.getAddress(), 1);

            // get balances after
            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 5n);
          });
        });
      });
    });

    describe('#exactInputSingle', () => {
      async function exactInputSingle(
        tokenIn: string,
        tokenOut: string,
        amountIn: number = 3,
        amountOutMinimum: number = 1,
        limitSqrtPrice?: bigint,
        setTime: number = 1
      ): Promise<ContractTransactionResponse> {
        const inputIsWNativeToken = (await wnative.getAddress()) === tokenIn;
        const outputIsWNativeToken = tokenOut === (await wnative.getAddress());

        const value = inputIsWNativeToken ? amountIn : 0;

        const params = {
          tokenIn,
          tokenOut,
          fee: FeeAmount.MEDIUM,
          limitSqrtPrice:
            limitSqrtPrice ?? tokenIn.toLowerCase() < tokenOut.toLowerCase()
              ? BigInt('4295128740')
              : BigInt('1461446703485210103287273052203988822378723970341'),
          recipient: outputIsWNativeToken ? ZeroAddress : trader.address,
          deadline: 1,
          amountIn,
          amountOutMinimum,
        };

        const data = [router.interface.encodeFunctionData('exactInputSingle', [params])];
        if (outputIsWNativeToken)
          data.push(router.interface.encodeFunctionData('unwrapWNativeToken', [amountOutMinimum, trader.address]));

        // ensure that the swap fails if the limit is any tighter
        params.amountOutMinimum += 1;
        await expect(router.connect(trader).exactInputSingle(params, { value })).to.be.revertedWith(
          'Too little received'
        );
        params.amountOutMinimum -= 1;

        if (setTime != 1) await router.setTime(setTime);
        // optimized for the gas test
        return data.length === 1
          ? router.connect(trader).exactInputSingle(params, { value })
          : router.connect(trader).multicall(data, { value });
      }

      it('reverts if deadline passed', async () => {
        await expect(exactInputSingle(tokens[0].address, tokens[1].address, 3, 1, undefined, 2)).to.be.revertedWith(
          'Transaction too old'
        );
      });

      it('0 -> 1', async () => {
        const pool = await factory.poolByPair(tokens[0].address, tokens[1].address);

        // get balances before
        const poolBefore = await getBalances(pool);
        const traderBefore = await getBalances(trader.address);

        await exactInputSingle(tokens[0].address, tokens[1].address);

        // get balances after
        const poolAfter = await getBalances(pool);
        const traderAfter = await getBalances(trader.address);

        expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n);
        expect(traderAfter.token1).to.be.eq(traderBefore.token1 + 1n);
        expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n);
        expect(poolAfter.token1).to.be.eq(poolBefore.token1 - 1n);
      });

      it('1 -> 0', async () => {
        const pool = await factory.poolByPair(tokens[1].address, tokens[0].address);

        // get balances before
        const poolBefore = await getBalances(pool);
        const traderBefore = await getBalances(trader.address);

        await exactInputSingle(tokens[1].address, tokens[0].address);

        // get balances after
        const poolAfter = await getBalances(pool);
        const traderAfter = await getBalances(trader.address);

        expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n);
        expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 3n);
        expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n);
        expect(poolAfter.token1).to.be.eq(poolBefore.token1 + 3n);
      });

      describe('Native input', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address);
          });

          it('WNativeToken -> 0', async () => {
            const pool = await factory.poolByPair(await wnative.getAddress(), tokens[0].address);

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await expect(exactInputSingle(await wnative.getAddress(), tokens[0].address))
              .to.emit(wnative, 'Deposit')
              .withArgs(await router.getAddress(), 3);

            // get balances after
            const poolAfter = await getBalances(pool);
            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n);
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative + 3n);
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n);
          });
        });
      });

      describe('Native output', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address);
            await createPoolWNativeToken(tokens[1].address);
          });

          it('0 -> WNativeToken', async () => {
            const pool = await factory.poolByPair(tokens[0].address, await wnative.getAddress());

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await expect(exactInputSingle(tokens[0].address, await wnative.getAddress()))
              .to.emit(wnative, 'Withdrawal')
              .withArgs(await router.getAddress(), 1);

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

    describe('#exactInputSingleSupportingFeeOnTransferTokens', () => {
      async function exactInputSingleSupportingFeeOnTransferTokens(
        tokenIn: string,
        tokenOut: string,
        amountIn: number = 300000,
        amountOutMinimum: number = 100000,
        limitSqrtPrice?: bigint,
        setTime: number = 1
      ): Promise<ContractTransactionResponse> {
        const inputIsWNativeToken = (await wnative.getAddress()) === tokenIn;
        const outputIsWNativeToken = tokenOut === (await wnative.getAddress());

        const value = inputIsWNativeToken ? amountIn : 0;

        const params = {
          tokenIn,
          tokenOut,
          limitSqrtPrice:
            limitSqrtPrice ?? tokenIn.toLowerCase() < tokenOut.toLowerCase()
              ? BigInt('4295128740')
              : BigInt('1461446703485210103287273052203988822378723970341'),
          recipient: outputIsWNativeToken ? ZeroAddress : trader.address,
          deadline: 1,
          amountIn,
          amountOutMinimum,
        };

        const data = [router.interface.encodeFunctionData('exactInputSingleSupportingFeeOnTransferTokens', [params])];
        if (outputIsWNativeToken)
          data.push(router.interface.encodeFunctionData('unwrapWNativeToken', [amountOutMinimum, trader.address]));

        // ensure that the swap fails if the limit is tighter
        params.amountOutMinimum *= 5;
        await expect(router.connect(trader).exactInputSingleSupportingFeeOnTransferTokens(params)).to.be.revertedWith(
          'Too little received'
        );
        params.amountOutMinimum /= 5;

        if (setTime != 1) await router.setTime(setTime);

        // optimized for the gas test
        return data.length === 1
          ? router.connect(trader).exactInputSingleSupportingFeeOnTransferTokens(params)
          : router.connect(trader).multicall(data, { value });
      }

      beforeEach('turn on fee', async () => {
        await tokens[0].setFee(50);
        await tokens[1].setFee(50);
      });

      it('reverts if deadline passed', async () => {
        await expect(
          exactInputSingleSupportingFeeOnTransferTokens(tokens[0].address, tokens[1].address, 3, 1, undefined, 2)
        ).to.be.revertedWith('Transaction too old');
      });

      it('0 -> 1', async () => {
        const pool = await factory.poolByPair(tokens[0].address, tokens[1].address);

        // get balances before
        const poolBefore = await getBalances(pool);
        const traderBefore = await getBalances(trader.address);

        await exactInputSingleSupportingFeeOnTransferTokens(tokens[0].address, tokens[1].address);

        // get balances after
        const poolAfter = await getBalances(pool);
        const traderAfter = await getBalances(trader.address);

        expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 300000n);
        expect(traderAfter.token1).to.be.eq(traderBefore.token1 + 210618n);
        expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 285000n);
        expect(poolAfter.token1).to.be.eq(poolBefore.token1 - 221703n);
      });

      it('1 -> 0', async () => {
        const pool = await factory.poolByPair(tokens[1].address, tokens[0].address);

        // get balances before
        const poolBefore = await getBalances(pool);
        const traderBefore = await getBalances(trader.address);

        await exactInputSingleSupportingFeeOnTransferTokens(tokens[1].address, tokens[0].address);

        // get balances after
        const poolAfter = await getBalances(pool);
        const traderAfter = await getBalances(trader.address);

        expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 210618n);
        expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 300000n);
        expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 221703n);
        expect(poolAfter.token1).to.be.eq(poolBefore.token1 + 285000n);
      });

      describe('Native output', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address);
            await createPoolWNativeToken(tokens[1].address);
          });

          it('0 -> WNativeToken', async () => {
            const pool = await factory.poolByPair(tokens[0].address, await wnative.getAddress());

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await expect(exactInputSingleSupportingFeeOnTransferTokens(tokens[0].address, await wnative.getAddress()))
              .to.emit(wnative, 'Withdrawal')
              .withArgs(await router.getAddress(), 219146);

            // get balances after
            const poolAfter = await getBalances(pool);
            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 300000n);
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative - 219146n);
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 285000n);
          });
        });
      });
    });

    describe('#exactOutput', () => {
      async function exactOutput(
        _tokens: string[],
        amountOut: number = 1,
        amountInMaximum: number = 3,
        setTime: number = 1
      ): Promise<ContractTransactionResponse> {
        const inputIsWNativeToken = _tokens[0] === (await wnative.getAddress());
        const outputIsWNativeToken = _tokens[_tokens.length - 1] === (await wnative.getAddress());

        const value = inputIsWNativeToken ? amountInMaximum : 0;

        const params = {
          path: encodePath(_tokens.slice().reverse()),
          recipient: outputIsWNativeToken ? ZeroAddress : trader.address,
          deadline: 1,
          amountOut,
          amountInMaximum,
        };

        const data = [router.interface.encodeFunctionData('exactOutput', [params])];
        if (inputIsWNativeToken)
          data.push(router.interface.encodeFunctionData('unwrapWNativeToken', [0, trader.address]));
        if (outputIsWNativeToken)
          data.push(router.interface.encodeFunctionData('unwrapWNativeToken', [amountOut, trader.address]));

        // ensure that the swap fails if the limit is any tighter
        params.amountInMaximum -= 1;
        await expect(router.connect(trader).exactOutput(params, { value })).to.be.revertedWith('Too much requested');
        params.amountInMaximum += 1;

        if (setTime != 1) await router.setTime(setTime);
        return router.connect(trader).multicall(data, { value });
      }

      it('reverts if deadline passed', async () => {
        await expect(
          exactOutput(
            tokens.slice(0, 2).map((token) => token.address),
            1,
            3,
            2
          )
        ).to.be.revertedWith('Transaction too old');
      });

      describe('single-pool', () => {
        it('0 -> 1', async () => {
          const pool = await factory.poolByPair(tokens[0].address, tokens[1].address);

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
          const pool = await factory.poolByPair(tokens[1].address, tokens[0].address);

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

        it('events', async () => {
          await expect(
            exactOutput(
              tokens.map((token) => token.address),
              1,
              5
            )
          )
            .to.emit(tokens[2], 'Transfer')
            .withArgs(
              computePoolAddress(await factory.poolDeployer(), [tokens[2].address, tokens[1].address]),
              trader.address,
              1
            )
            .to.emit(tokens[1], 'Transfer')
            .withArgs(
              computePoolAddress(await factory.poolDeployer(), [tokens[1].address, tokens[0].address]),
              computePoolAddress(await factory.poolDeployer(), [tokens[2].address, tokens[1].address]),
              3
            )
            .to.emit(tokens[0], 'Transfer')
            .withArgs(
              trader.address,
              computePoolAddress(await factory.poolDeployer(), [tokens[1].address, tokens[0].address]),
              5
            );
        });
      });

      describe('Native input', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address);
          });

          it('WNativeToken -> 0', async () => {
            const pool = await factory.poolByPair(await wnative.getAddress(), tokens[0].address);

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await expect(exactOutput([await wnative.getAddress(), tokens[0].address]))
              .to.emit(wnative, 'Deposit')
              .withArgs(await router.getAddress(), 3);

            // get balances after
            const poolAfter = await getBalances(pool);
            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n);
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative + 3n);
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n);
          });

          it('WNativeToken -> 0 -> 1', async () => {
            const traderBefore = await getBalances(trader.address);

            await expect(exactOutput([await wnative.getAddress(), tokens[0].address, tokens[1].address], 1, 5))
              .to.emit(wnative, 'Deposit')
              .withArgs(await router.getAddress(), 5);

            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token1).to.be.eq(traderBefore.token1 + 1n);
          });
        });
      });

      describe('Native output', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address);
            await createPoolWNativeToken(tokens[1].address);
          });

          it('0 -> WNativeToken', async () => {
            const pool = await factory.poolByPair(tokens[0].address, await wnative.getAddress());

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await expect(exactOutput([tokens[0].address, await wnative.getAddress()]))
              .to.emit(wnative, 'Withdrawal')
              .withArgs(await router.getAddress(), 1);

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

            await expect(exactOutput([tokens[0].address, tokens[1].address, await wnative.getAddress()], 1, 5))
              .to.emit(wnative, 'Withdrawal')
              .withArgs(await router.getAddress(), 1);

            // get balances after
            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 5n);
          });
        });
      });
    });

    describe('#exactOutputSingle', () => {
      async function exactOutputSingle(
        tokenIn: string,
        tokenOut: string,
        amountOut: number = 1,
        amountInMaximum: number = 3,
        limitSqrtPrice?: bigint,
        setTime: number = 1
      ): Promise<ContractTransactionResponse> {
        const inputIsWNativeToken = tokenIn === (await wnative.getAddress());
        const outputIsWNativeToken = tokenOut === (await wnative.getAddress());

        const value = inputIsWNativeToken ? amountInMaximum : 0;

        const params = {
          tokenIn,
          tokenOut,
          fee: FeeAmount.MEDIUM,
          recipient: outputIsWNativeToken ? ZeroAddress : trader.address,
          deadline: 1,
          amountOut,
          amountInMaximum,
          limitSqrtPrice:
            limitSqrtPrice ?? tokenIn.toLowerCase() < tokenOut.toLowerCase()
              ? BigInt('4295128740')
              : BigInt('1461446703485210103287273052203988822378723970341'),
        };

        const data = [router.interface.encodeFunctionData('exactOutputSingle', [params])];
        if (inputIsWNativeToken) data.push(router.interface.encodeFunctionData('refundNativeToken'));
        if (outputIsWNativeToken)
          data.push(router.interface.encodeFunctionData('unwrapWNativeToken', [amountOut, trader.address]));

        // ensure that the swap fails if the limit is any tighter
        params.amountInMaximum -= 1;
        await expect(router.connect(trader).exactOutputSingle(params, { value })).to.be.revertedWith(
          'Too much requested'
        );
        params.amountInMaximum += 1;

        if (setTime != 1) await router.setTime(setTime);

        return router.connect(trader).multicall(data, { value });
      }

      it('reverts if deadline passed', async () => {
        await expect(exactOutputSingle(tokens[0].address, tokens[1].address, 1, 3, undefined, 2)).to.be.revertedWith(
          'Transaction too old'
        );
      });

      it('0 -> 1', async () => {
        const pool = await factory.poolByPair(tokens[0].address, tokens[1].address);

        // get balances before
        const poolBefore = await getBalances(pool);
        const traderBefore = await getBalances(trader.address);

        await exactOutputSingle(tokens[0].address, tokens[1].address);

        // get balances after
        const poolAfter = await getBalances(pool);
        const traderAfter = await getBalances(trader.address);

        expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n);
        expect(traderAfter.token1).to.be.eq(traderBefore.token1 + 1n);
        expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n);
        expect(poolAfter.token1).to.be.eq(poolBefore.token1 - 1n);
      });

      it('1 -> 0', async () => {
        const pool = await factory.poolByPair(tokens[1].address, tokens[0].address);

        // get balances before
        const poolBefore = await getBalances(pool);
        const traderBefore = await getBalances(trader.address);

        await exactOutputSingle(tokens[1].address, tokens[0].address);

        // get balances after
        const poolAfter = await getBalances(pool);
        const traderAfter = await getBalances(trader.address);

        expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n);
        expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 3n);
        expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n);
        expect(poolAfter.token1).to.be.eq(poolBefore.token1 + 3n);
      });

      describe('Native input', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address);
          });

          it('WNativeToken -> 0', async () => {
            const pool = await factory.poolByPair(await wnative.getAddress(), tokens[0].address);

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await expect(exactOutputSingle(await wnative.getAddress(), tokens[0].address))
              .to.emit(wnative, 'Deposit')
              .withArgs(await router.getAddress(), 3);

            // get balances after
            const poolAfter = await getBalances(pool);
            const traderAfter = await getBalances(trader.address);

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n);
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative + 3n);
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n);
          });
        });
      });

      describe('Native output', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address);
            await createPoolWNativeToken(tokens[1].address);
          });

          it('0 -> WNativeToken', async () => {
            const pool = await factory.poolByPair(tokens[0].address, await wnative.getAddress());

            // get balances before
            const poolBefore = await getBalances(pool);
            const traderBefore = await getBalances(trader.address);

            await expect(exactOutputSingle(tokens[0].address, await wnative.getAddress()))
              .to.emit(wnative, 'Withdrawal')
              .withArgs(await router.getAddress(), 1);

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

    describe('*WithFee', () => {
      const feeRecipient = '0xfEE0000000000000000000000000000000000000';

      it('#sweepTokenWithFee', async () => {
        const amountOutMinimum = 100;
        const params = {
          path: encodePath([tokens[0].address, tokens[1].address]),
          recipient: await router.getAddress(),
          deadline: 1,
          amountIn: 102,
          amountOutMinimum,
        };

        const data = [
          router.interface.encodeFunctionData('exactInput', [params]),
          router.interface.encodeFunctionData('sweepTokenWithFee', [
            tokens[1].address,
            amountOutMinimum,
            trader.address,
            100,
            feeRecipient,
          ]),
        ];

        await router.connect(trader).multicall(data);

        const balance = await tokens[1].balanceOf(feeRecipient);
        expect(balance == 1n).to.be.eq(true);
      });

      it('#unwrapWNativeTokenWithFee', async () => {
        const startBalance = await ethers.provider.getBalance(feeRecipient);
        await createPoolWNativeToken(tokens[0].address);

        const amountOutMinimum = 100;
        const params = {
          path: encodePath([tokens[0].address, await wnative.getAddress()]),
          recipient: await router.getAddress(),
          deadline: 1,
          amountIn: 102,
          amountOutMinimum,
        };

        const data = [
          router.interface.encodeFunctionData('exactInput', [params]),
          router.interface.encodeFunctionData('unwrapWNativeTokenWithFee', [
            amountOutMinimum,
            trader.address,
            100,
            feeRecipient,
          ]),
        ];

        await router.connect(trader).multicall(data);
        const endBalance = await ethers.provider.getBalance(feeRecipient);
        expect(endBalance - startBalance == 1n).to.be.eq(true);
      });
    });
  });
});
