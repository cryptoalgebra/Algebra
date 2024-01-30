import { Wallet, ContractTransactionResponse, MaxUint256, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  IAlgebraFactory,
  IAlgebraPool,
  IWNativeToken,
  MockTimeNonfungiblePositionManager,
  MockTimeSwapRouter,
  Quoter,
  TestERC20,
} from '../typechain';
import completeFixture from './shared/completeFixture';
import { MaxUint128 } from './shared/constants';
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
    quoter: Quoter;
    router: MockTimeSwapRouter;
    wnative: IWNativeToken;
    factory: IAlgebraFactory;
  }> = async () => {
    let _tokens;
    const { wnative, factory, router, tokens, nft } = await loadFixture(completeFixture);
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
      nft,
      quoter,
      router,
      wnative,
      factory,
    };
  };

  let nft: MockTimeNonfungiblePositionManager;
  let tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
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
      const { tokens, nft, quoter, router, wnative, factory } = await swapRouterFixture();
      const pool0 = await createPool(nft, wallet, await tokens[0].getAddress(), await tokens[1].getAddress());
      await createPool(nft, wallet, await tokens[1].getAddress(), await tokens[2].getAddress());
      return { tokens, nft, quoter, router, wnative, factory };
    };

    beforeEach(async () => {
      ({ tokens, nft, quoter, router, wnative, factory } = await loadFixture(subFixture));
    });

    describe('#quoteExactInput', () => {
      it('0 -> 1', async () => {
        const { amountOut, fees } = await quoter.quoteExactInput.staticCall(
          encodePath([tokens[0].address, tokens[1].address]),
          3
        );

        expect(amountOut).to.eq(1);
        expect(fees[0]).to.eq(500);
      });

      it('0 -> 1 changes fee', async () => {
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
          encodePath([tokens[0].address, tokens[1].address]),
          expandTo18Decimals(300000)
        );

        expect(fees[0]).to.eq(500);

        await exactInput([tokens[0].address, tokens[1].address], 300000);

        await ethers.provider.send('evm_mine', []);
        await ethers.provider.send('evm_increaseTime', [60 * 60 * 3]);
        await ethers.provider.send('evm_mine', []);

        const { amountOut: amountOut2, fees: fees2 } = await quoter.quoteExactInput.staticCall(
          encodePath([tokens[0].address, tokens[1].address]),
          expandTo18Decimals(300000)
        );

        expect(fees2[0]).to.eq(500);
      });

      it('1 -> 0', async () => {
        const { amountOut, fees } = await quoter.quoteExactInput.staticCall(
          encodePath([tokens[1].address, tokens[0].address]),
          3
        );

        expect(amountOut).to.eq(1);
        expect(fees[0]).to.eq(500);
      });

      it('0 -> 1 -> 2', async () => {
        const { amountOut, fees } = await quoter.quoteExactInput.staticCall(
          encodePath(tokens.map((token) => token.address)),
          5
        );

        expect(amountOut).to.eq(1);
        expect(fees[0]).to.eq(500);
      });

      it('2 -> 1 -> 0', async () => {
        const { amountOut, fees } = await quoter.quoteExactInput.staticCall(
          encodePath(tokens.map((token) => token.address).reverse()),
          5
        );

        expect(amountOut).to.eq(1);
        expect(fees[0]).to.eq(500);
      });
    });

    describe('#quoteExactInputSingle', () => {
      it('0 -> 1', async () => {
        const { amountOut, fee } = await quoter.quoteExactInputSingle.staticCall(
          tokens[0].address,
          tokens[1].address,
          MaxUint128,
          // -2%
          encodePriceSqrt(100, 102)
        );

        expect(amountOut).to.eq(9852);
        expect(fee).to.eq(500);
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
          encodePath([tokens[1].address, tokens[0].address]),
          1
        );

        expect(amountIn).to.eq(3);
        expect(fees[0]).to.eq(500);
      });

      it('1 -> 0', async () => {
        const { amountIn, fees } = await quoter.quoteExactOutput.staticCall(
          encodePath([tokens[0].address, tokens[1].address]),
          1
        );

        expect(amountIn).to.eq(3);
        expect(fees[0]).to.eq(500);
      });

      it('0 -> 1 -> 2', async () => {
        const { amountIn, fees } = await quoter.quoteExactOutput.staticCall(
          encodePath(tokens.map((token) => token.address).reverse()),
          1
        );

        expect(amountIn).to.eq(5);
        expect(fees[0]).to.eq(500);
      });

      it('2 -> 1 -> 0', async () => {
        const { amountIn, fees } = await quoter.quoteExactOutput.staticCall(
          encodePath(tokens.map((token) => token.address)),
          1
        );

        expect(amountIn).to.eq(5);
        expect(fees[0]).to.eq(500);
      });
    });

    describe('#quoteExactOutputSingle', () => {
      it('0 -> 1', async () => {
        const { amountIn, fee } = await quoter.quoteExactOutputSingle.staticCall(
          tokens[0].address,
          tokens[1].address,
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
          MaxUint128,
          encodePriceSqrt(102, 100)
        );

        expect(amountIn).to.eq(9956);
        expect(fee).to.eq(500);
      });
    });
  });
});
