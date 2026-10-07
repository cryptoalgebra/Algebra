import { Wallet, ContractTransactionResponse, MaxUint256, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  CustomPoolDeployerTest,
  IAlgebraFactory,
  IWNativeToken,
  MockTimeNonfungiblePositionManager,
  MockTimeSwapRouter,
  Quoter,
  TestERC20,
} from '../typechain';
import completeFixture from './shared/completeFixture';
import { MaxUint128, ZERO_ADDRESS } from './shared/constants';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { expandTo18Decimals } from './shared/expandTo18Decimals';
import { expect } from './shared/expect';
import { encodePath } from './shared/path';
import { createPool } from './shared/quoter';

type TestERC20WithAddress = TestERC20 & { address: string };

describe('Quoter', () => {
  let wallet: Wallet;
  let trader: Wallet;

  const swapRouterFixture: () => Promise<{
    nft: MockTimeNonfungiblePositionManager;
    tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
    customPoolDeployer: CustomPoolDeployerTest;
    path: [string, string, string, string, string];
    quoter: Quoter;
    router: MockTimeSwapRouter;
    wnative: IWNativeToken;
    factory: IAlgebraFactory;
  }> = async () => {
    let _tokens;
    const { wnative, factory, router, tokens, customPoolDeployer, path, nft } = await loadFixture(completeFixture);
    _tokens = tokens as [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];

    // approve & fund wallets
    for (const token of _tokens) {
      await token.approve(router, MaxUint256);
      await token.approve(nft, MaxUint256);
      await token.connect(trader).approve(router, MaxUint256);
      await token.transfer(trader.address, expandTo18Decimals(1_000_000));
      token.address = await token.getAddress();
    }

    const quoterFactory = await ethers.getContractFactory('Quoter');
    quoter = (await quoterFactory.deploy(factory, wnative, await factory.poolDeployer())) as any as Quoter;

    return {
      tokens: _tokens,
      path: path,
      customPoolDeployer: customPoolDeployer,
      nft,
      quoter,
      router,
      wnative,
      factory,
    };
  };

  let nft: MockTimeNonfungiblePositionManager;
  let tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
  let path: [string, string, string, string, string];
  let quoter: Quoter;
  let router: MockTimeSwapRouter;
  let wnative: IWNativeToken;
  let factory: IAlgebraFactory;

  before('create fixture loader', async () => {
    const wallets = await (ethers as any).getSigners();
    [wallet, trader] = wallets;
  });

  describe('quotes', () => {
    const subFixture = async () => {
      const { tokens, customPoolDeployer, path, nft, quoter, router, wnative, factory } = await swapRouterFixture();
      await createPool(nft, wallet, await tokens[0].getAddress(), await tokens[1].getAddress(), ZERO_ADDRESS);

      await customPoolDeployer.createCustomPool(customPoolDeployer, wallet.address, await tokens[1].getAddress(), await tokens[2].getAddress(), '0x');
      await createPool(nft, wallet, await tokens[1].getAddress(), await tokens[2].getAddress(), await customPoolDeployer.getAddress());

      return { tokens, path, nft, quoter, router, wnative, factory };
    };

    beforeEach(async () => {
      ({ tokens, path, nft, quoter, router, wnative, factory } = await loadFixture(subFixture));
    });

    describe('#quoteExactInput', () => {
      it('0 -> 1', async () => {
        const { amountOut, fees } = await quoter.quoteExactInput.staticCall(
          encodePath([tokens[0].address, ZERO_ADDRESS, tokens[1].address]),
          3
        );

        expect(amountOut).to.eq(1);
        expect(fees[0]).to.eq(500);
      });

      it('0 -> 1 keeps the fee and quotes nothing once the range is drained', async () => {
        async function exactInput(
          tokens: string[],
          amountIn: number = 3,
          amountOutMinimum: number = 1
        ): Promise<ContractTransactionResponse> {
          const inputIsWNativeToken = (await wnative.getAddress()) === tokens[0];
          const outputIsWNativeToken = tokens[tokens.length - 1] === (await wnative.getAddress());

          const value = inputIsWNativeToken ? amountIn : 0;

          const params = {
            path: encodePath(tokens),
            recipient: outputIsWNativeToken ? ZeroAddress : trader.address,
            deadline: 1,
            amountIn: expandTo18Decimals(amountIn),
            amountOutMinimum: 0,
          };

          const data = [router.interface.encodeFunctionData('exactInput', [params])];
          if (outputIsWNativeToken)
            data.push(router.interface.encodeFunctionData('unwrapWNativeToken', [amountOutMinimum, trader.address]));

          // optimized for the gas test
          return data.length === 1
            ? router.connect(trader).exactInput(params, { value })
            : router.connect(trader).multicall(data, { value });
        }

        const { amountOut, fees } = await quoter.quoteExactInput.staticCall(
          encodePath([tokens[0].address, ZERO_ADDRESS, tokens[1].address]),
          expandTo18Decimals(300000)
        );

        expect(amountOut).to.eq(999999);
        expect(fees[0]).to.eq(500);

        await exactInput([tokens[0].address, ZERO_ADDRESS, tokens[1].address], 300000);

        await ethers.provider.send('evm_mine', []);
        await ethers.provider.send('evm_increaseTime', [60 * 60 * 3]);
        await ethers.provider.send('evm_mine', []);

        const { amountOut: amountOut2, fees: fees2 } = await quoter.quoteExactInput.staticCall(
          encodePath([tokens[0].address, ZERO_ADDRESS, tokens[1].address]),
          expandTo18Decimals(300000)
        );

        // the swap above pushed the price out of the only position, so the same quote now yields nothing
        expect(amountOut2).to.eq(0);
        expect(fees2[0]).to.eq(500);
      });

      it('1 -> 0', async () => {
        const { amountOut, fees } = await quoter.quoteExactInput.staticCall(
          encodePath([tokens[1].address, ZERO_ADDRESS, tokens[0].address]),
          3
        );

        expect(amountOut).to.eq(1);
        expect(fees[0]).to.eq(500);
      });

      it('0 -> 1 -> 2', async () => {
        const { amountOut, fees } = await quoter.quoteExactInput.staticCall(
          encodePath(path),
          5
        );

        expect(amountOut).to.eq(1);
        expect(fees[0]).to.eq(500);
        expect(fees[1]).to.eq(500);
      });

      it('2 -> 1 -> 0', async () => {
        const { amountOut, fees } = await quoter.quoteExactInput.staticCall(
          encodePath(path.slice().reverse()),
          5
        );

        expect(amountOut).to.eq(1);
        expect(fees[0]).to.eq(500);
        expect(fees[1]).to.eq(500);
      });
    });

    describe('with the fee fixed to token0', () => {
      it('quotes what an executed swap pays out, in both directions', async () => {
        const poolAddress = await factory.poolByPair(tokens[0].address, tokens[1].address);
        const pool = await ethers.getContractAt('IAlgebraPool', poolAddress, wallet);
        await pool.setFeeMode(1);

        // 1 -> 0 runs second, so it quotes against the price the first swap left behind
        const cases: [string, string, bigint, bigint][] = [
          [tokens[0].address, tokens[1].address, encodePriceSqrt(100, 102), 998n],
          [tokens[1].address, tokens[0].address, encodePriceSqrt(102, 100), 999n],
        ];

        for (const [tokenIn, tokenOut, limitSqrtPrice, expectedOut] of cases) {
          const { amountOut, fee } = await quoter.quoteExactInputSingle.staticCall(
            tokenIn,
            tokenOut,
            ZERO_ADDRESS,
            1000,
            limitSqrtPrice
          );
          expect(amountOut).to.eq(expectedOut);
          expect(fee).to.eq(500);

          const received = tokenOut === tokens[0].address ? tokens[0] : tokens[1];
          await expect(
            router.connect(trader).exactInputSingle({
              tokenIn,
              tokenOut,
              deployer: ZERO_ADDRESS,
              limitSqrtPrice,
              amountOutMinimum: 0,
              deadline: 2n ** 32n,
              amountIn: 1000,
              recipient: trader.address,
            })
          ).to.changeTokenBalance(received, trader, amountOut);
        }

        // both swaps took their fee out of token0, so the other accumulator never moved
        expect(await pool.totalFeeGrowth1Token()).to.eq(0);
      });

      it('quotes what an executed exactOut swap costs, in both directions', async () => {
        const poolAddress = await factory.poolByPair(tokens[0].address, tokens[1].address);
        const pool = await ethers.getContractAt('IAlgebraPool', poolAddress, wallet);
        await pool.setFeeMode(1);

        // without a price limit the quoter and the router both insist on the full amount out;
        // 1 -> 0 takes the fee from that output and quotes against the price 0 -> 1 left behind
        const cases: [TestERC20WithAddress, TestERC20WithAddress, bigint][] = [
          [tokens[0], tokens[1], 1003n],
          [tokens[1], tokens[0], 1000n],
        ];

        for (const [tokenIn, tokenOut, expectedIn] of cases) {
          const { amountIn, fee } = await quoter.quoteExactOutputSingle.staticCall(
            tokenIn.address,
            tokenOut.address,
            ZERO_ADDRESS,
            1000,
            0
          );
          expect(amountIn).to.eq(expectedIn);
          expect(fee).to.eq(500);

          // the quote is the most the router may take
          const tx = await router.connect(trader).exactOutputSingle({
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            deployer: ZERO_ADDRESS,
            recipient: trader.address,
            deadline: 2n ** 32n,
            amountOut: 1000,
            amountInMaximum: amountIn,
            limitSqrtPrice: 0,
          });
          await expect(tx).to.changeTokenBalance(tokenOut, trader, 1000);
          await expect(tx).to.changeTokenBalance(tokenIn, trader, -amountIn);
        }

        expect(await pool.totalFeeGrowth1Token()).to.eq(0);
      });
    });

    describe('with the fee taken from the output of every hop', () => {
      it('a two-hop exactOut costs what the quoter says and delivers the exact amount', async () => {
        const pool01 = await ethers.getContractAt(
          'IAlgebraPool',
          await factory.poolByPair(tokens[0].address, tokens[1].address),
          wallet
        );
        const pool12 = await ethers.getContractAt(
          'IAlgebraPool',
          await factory.customPoolByPair(path[3], tokens[1].address, tokens[2].address),
          wallet
        );
        // the tokens are sorted, so each hop gives out token1 of its pool, and that is where the fee stays
        await pool01.setFeeMode(2);
        await pool12.setFeeMode(2);

        // the router runs the last hop first and pays for it from inside the swap callback
        const exactOutputPath = encodePath(path.slice().reverse());
        const { amountIn } = await quoter.quoteExactOutput.staticCall(exactOutputPath, 1000);
        expect(amountIn).to.eq(1006n);

        const tx = await router.connect(trader).exactOutput({
          path: exactOutputPath,
          recipient: trader.address,
          deadline: 2n ** 32n,
          amountOut: 1000,
          amountInMaximum: amountIn,
        });
        await expect(tx).to.changeTokenBalance(tokens[2], trader, 1000);
        await expect(tx).to.changeTokenBalance(tokens[0], trader, -amountIn);
        expect(await tokens[1].balanceOf(router)).to.eq(0);
        expect(await pool01.totalFeeGrowth0Token()).to.eq(0);
        expect(await pool12.totalFeeGrowth0Token()).to.eq(0);
      });
    });

    describe('#quoteExactInputSingle', () => {
      it('0 -> 1', async () => {
        const { amountOut, fee } = await quoter.quoteExactInputSingle.staticCall(
          tokens[0].address,
          tokens[1].address,
          ZERO_ADDRESS,
          MaxUint128,
          // -2%
          encodePriceSqrt(100, 102)
        );

        expect(amountOut).to.eq(9852);
        expect(fee).to.eq(500);
      });

      it('reverts on a swap entirely within a zero-liquidity region', async () => {
        const { liquidity } = await nft.positions(1);
        await nft.decreaseLiquidity({ tokenId: 1, amount0Min: 0, amount1Min: 0, liquidity, deadline: 2 });

        await expect(
          quoter.quoteExactInputSingle.staticCall(tokens[0].address, tokens[1].address, ZERO_ADDRESS, 100, 0)
        ).to.be.revertedWith('Zero liquidity swap');
      });

      it('reports an unexpected error when the pool reverts without data', async () => {
        const pool = await ethers.getContractAt(
          'IAlgebraPool',
          await factory.poolByPair(tokens[0].address, tokens[1].address)
        );
        const plugin = await (await ethers.getContractFactory('MockSilentRevertPlugin')).deploy();
        await pool.setPlugin(plugin);
        await pool.setPluginConfig(1); // before swap hook

        await expect(
          quoter.quoteExactInputSingle.staticCall(tokens[0].address, tokens[1].address, ZERO_ADDRESS, 100, 0)
        ).to.be.revertedWith('Unexpected error');
      });

      it('1 -> 0, bubbles custom error', async () => {
        const pool = await ethers.getContractAt(
          'IAlgebraPool',
          await factory.poolByPair(tokens[1].address, tokens[0].address)
        );

        await expect(
          quoter.quoteExactInputSingle.staticCall(
            tokens[1].address,
            tokens[0].address,
            ZERO_ADDRESS,
            MaxUint128,
            // -2%, invalid direction
            encodePriceSqrt(98, 100)
          )
        ).to.be.revertedWithCustomError(pool, 'invalidLimitSqrtPrice');
      });

      it('1 -> 0', async () => {
        const { amountOut, fee } = await quoter.quoteExactInputSingle.staticCall(
          tokens[1].address,
          tokens[0].address,
          ZERO_ADDRESS,
          MaxUint128,
          // +2%
          encodePriceSqrt(102, 100)
        );

        expect(amountOut).to.eq(9852);
        expect(fee).to.eq(500);
      });
    });

    describe('#quoteExactOutput', () => {
      it('0 -> 1', async () => {
        const { amountIn, fees } = await quoter.quoteExactOutput.staticCall(
          encodePath([tokens[1].address, ZERO_ADDRESS, tokens[0].address]),
          1
        );

        expect(amountIn).to.eq(3);
        expect(fees[0]).to.eq(500);
      });

      it('1 -> 0', async () => {
        const { amountIn, fees } = await quoter.quoteExactOutput.staticCall(
          encodePath([tokens[0].address, ZERO_ADDRESS, tokens[1].address]),
          1
        );

        expect(amountIn).to.eq(3);
        expect(fees[0]).to.eq(500);
      });

      it('0 -> 1 -> 2', async () => {
        const { amountIn, fees } = await quoter.quoteExactOutput.staticCall(encodePath(path.slice().reverse()), 1);

        expect(amountIn).to.eq(5);
        expect(fees[0]).to.eq(500);
        expect(fees[1]).to.eq(500);
      });

      it('2 -> 1 -> 0', async () => {
        const { amountIn, fees } = await quoter.quoteExactOutput.staticCall(
          encodePath(path),
          1
        );

        expect(amountIn).to.eq(5);
        expect(fees[0]).to.eq(500);
        expect(fees[1]).to.eq(500);
      });
    });

    describe('#quoteExactOutputSingle', () => {
      it('without a price limit reverts when the pool cannot deliver the full amount', async () => {
        const [token0, token1] = [tokens[0].address, tokens[2].address].sort((a, b) =>
          a.toLowerCase() < b.toLowerCase() ? -1 : 1
        );
        await nft.createAndInitializePoolIfNecessary(token0, token1, ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x');
        // liquidity only around the current price: past it the price runs to the limit for free
        await nft.mint({
          token0,
          token1,
          deployer: ZERO_ADDRESS,
          tickLower: -60,
          tickUpper: 60,
          recipient: wallet.address,
          amount0Desired: 1000,
          amount1Desired: 1000,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        });

        await expect(
          quoter.quoteExactOutputSingle.staticCall(tokens[0].address, tokens[2].address, ZERO_ADDRESS, 10_000, 0)
        ).to.be.revertedWith('Not received full amountOut');
      });

      it('0 -> 1', async () => {
        const { amountIn, fee } = await quoter.quoteExactOutputSingle.staticCall(
          tokens[0].address,
          tokens[1].address,
          ZERO_ADDRESS,
          MaxUint128,
          encodePriceSqrt(100, 102)
        );

        expect(amountIn).to.eq(9956);
        expect(fee).to.eq(500);
      });

      it('1 -> 0', async () => {
        const { amountIn, fee } = await quoter.quoteExactOutputSingle.staticCall(
          tokens[1].address,
          tokens[0].address,
          ZERO_ADDRESS,
          MaxUint128,
          encodePriceSqrt(102, 100)
        );

        expect(amountIn).to.eq(9956);
        expect(fee).to.eq(500);
      });
    });
  });
});
