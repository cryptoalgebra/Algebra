import { Contract, ContractTransactionResponse, MaxUint256, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  abi as DELTA_PLUGIN_ABI,
  bytecode as DELTA_PLUGIN_BYTECODE,
} from '@cryptoalgebra/integral-core/artifacts/contracts/test/MockDeltaPlugin.sol/MockDeltaPlugin.json';
import { IAlgebraPool, MockTimeSwapRouter, Quoter, QuoterV2, TestERC20 } from '../typechain';
import completeFixture from './shared/completeFixture';
import { ZERO_ADDRESS } from './shared/constants';
import { expandTo18Decimals } from './shared/expandTo18Decimals';
import { expect } from './shared/expect';
import { encodePath } from './shared/path';
import { createPool } from './shared/quoter';

// beforeSwap, afterSwapCalculation and the amount deltas
const DELTAS_PLUGIN_CONFIG = 1 | 512 | 1024;
const AMOUNT = 10000n;
const IN_DECREASE = 100n;
const OUT_DECREASE = 50n;
const IN_INCREASE = 30n;

describe('SwapRouter with plugin amount deltas', () => {
  let wallet: Wallet;
  let trader: Wallet;
  let tokens: [TestERC20, TestERC20, TestERC20];
  let addresses: string[];
  let plugins: Contract[];
  let router: MockTimeSwapRouter;
  let quoter: Quoter;
  let quoterV2: QuoterV2;

  const fixture = async () => {
    const { factory, router, nft, tokens, wnative } = await completeFixture();
    for (const token of tokens) {
      await token.approve(nft, MaxUint256);
      await token.connect(trader).approve(router, MaxUint256);
      await token.transfer(trader.address, expandTo18Decimals(1_000_000));
    }
    const addresses = await Promise.all(tokens.map((token) => token.getAddress()));

    // the 0-1 and 1-2 pools, each with its own plugin, so every hop pays the deltas to a separate address
    const pluginFactory = await ethers.getContractFactory(DELTA_PLUGIN_ABI, DELTA_PLUGIN_BYTECODE);
    const plugins: Contract[] = [];
    for (const [tokenA, tokenB] of [addresses.slice(0, 2), addresses.slice(1, 3)]) {
      await createPool(nft, wallet, tokenA, tokenB, ZERO_ADDRESS);
      const pool = (await ethers.getContractAt(
        'IAlgebraPool',
        await factory.poolByPair(tokenA, tokenB),
        wallet
      )) as any as IAlgebraPool;
      const plugin = (await pluginFactory.deploy()) as any as Contract;
      await pool.setPlugin(plugin);
      await pool.setPluginConfig(DELTAS_PLUGIN_CONFIG);
      plugins.push(plugin);
    }

    const poolDeployer = await factory.poolDeployer();
    const quoter = (await (
      await ethers.getContractFactory('Quoter')
    ).deploy(factory, wnative, poolDeployer)) as any as Quoter;
    const quoterV2 = (await (
      await ethers.getContractFactory('QuoterV2')
    ).deploy(factory, wnative, poolDeployer)) as any as QuoterV2;

    return { tokens, addresses, plugins, router, quoter, quoterV2 };
  };

  // a route is a list of token indexes; it goes through the default-deployer pools
  const encodeRoute = (route: number[]) =>
    encodePath(route.flatMap((token, i) => (i == 0 ? [addresses[token]] : [ZERO_ADDRESS, addresses[token]])));

  // per token: the balance changes of the trader, the router, the 0-1 plugin and the 1-2 plugin. The trader pays
  // `paid` of the first token and gets `received` of the last; every hop gives its plugin `inDelta` of its input
  // token and `outDelta` of its output token
  function balanceChanges(route: number[], paid: bigint, received: bigint, inDelta: bigint, outDelta: bigint) {
    const changes = tokens.map(() => [0n, 0n, 0n, 0n]);
    changes[route[0]][0] -= paid;
    changes[route[route.length - 1]][0] += received;
    for (let i = 1; i < route.length; i++) {
      // the hop goes through the 0-1 or the 1-2 pool, whose plugins are the third and the fourth holder
      const plugin = 2 + Math.min(route[i - 1], route[i]);
      changes[route[i - 1]][plugin] += inDelta;
      changes[route[i]][plugin] += outDelta;
    }
    return changes;
  }

  async function expectBalanceChanges(tx: ContractTransactionResponse, changes: bigint[][], label: string) {
    for (const [i, token] of tokens.entries())
      await expect(tx, label).to.changeTokenBalances(token, [trader, router, ...plugins], changes[i]);
  }

  before(async () => {
    [wallet, trader] = await (ethers as any).getSigners();
  });

  beforeEach(async () => {
    ({ tokens, addresses, plugins, router, quoter, quoterV2 } = await loadFixture(fixture));
  });

  it('with the dynamic fee both quoters return the pool fee, the swap pays the dynamic one', async () => {
    const DYNAMIC_FEE = 128;
    const dynamicFee = 3000n;
    const factory = await ethers.getContractAt('IAlgebraFactory', await quoter.factory());
    const pool = (await ethers.getContractAt(
      'IAlgebraPool',
      await factory.poolByPair(addresses[0], addresses[1]),
      wallet
    )) as any as IAlgebraPool;
    await pool.setPluginConfig(DELTAS_PLUGIN_CONFIG | DYNAMIC_FEE);
    await plugins[0].setDynamicFee(dynamicFee);
    const { lastFee } = await pool.globalState();
    expect(lastFee).to.not.eq(dynamicFee);

    const [amountOut, fee] = await quoter.quoteExactInputSingle.staticCall(
      addresses[0],
      addresses[1],
      ZERO_ADDRESS,
      AMOUNT,
      0
    );
    const quoteV2 = await quoterV2.quoteExactInputSingle.staticCall({
      tokenIn: addresses[0],
      tokenOut: addresses[1],
      deployer: ZERO_ADDRESS,
      amountIn: AMOUNT,
      limitSqrtPrice: 0,
    });
    expect([fee, quoteV2.fee]).to.deep.eq([lastFee, lastFee]);

    const tx = router.connect(trader).exactInputSingle({
      recipient: trader.address,
      deadline: 2n ** 32n,
      amountIn: AMOUNT,
      amountOutMinimum: amountOut,
      tokenIn: addresses[0],
      tokenOut: addresses[1],
      deployer: ZERO_ADDRESS,
      limitSqrtPrice: 0,
    });
    await expect(tx)
      .to.emit(pool, 'SwapFee')
      .withArgs(await router.getAddress(), dynamicFee, 0, 0);
    await expect(tx).to.changeTokenBalance(tokens[1], trader, amountOut);
  });

  it('exactIn: both quoters return what the trader gets after the deltas, a higher minimum reverts', async () => {
    for (const plugin of plugins) {
      await plugin.setInDecrease(IN_DECREASE, false, 0);
      await plugin.setOutDecrease(OUT_DECREASE, false, 0);
    }
    const swap = (route: number[], inAdvance: boolean, amountOutMinimum: bigint) => {
      const common = { recipient: trader.address, deadline: 2n ** 32n, amountIn: AMOUNT, amountOutMinimum };
      if (route.length > 2) return router.connect(trader).exactInput({ ...common, path: encodeRoute(route) });
      const single = {
        ...common,
        tokenIn: addresses[route[0]],
        tokenOut: addresses[route[1]],
        deployer: ZERO_ADDRESS,
        limitSqrtPrice: 0,
      };
      return inAdvance
        ? router.connect(trader).exactInputSingleSupportingFeeOnTransferTokens(single)
        : router.connect(trader).exactInputSingle(single);
    };

    const routes: [string, number[], boolean][] = [
      ['0 -> 1', [0, 1], false],
      ['1 -> 0', [1, 0], false],
      ['0 -> 1 paid in advance', [0, 1], true],
      ['1 -> 0 paid in advance', [1, 0], true],
      ['0 -> 1 -> 2', [0, 1, 2], false],
      ['2 -> 1 -> 0', [2, 1, 0], false],
    ];
    for (const [label, route, inAdvance] of routes) {
      const { amountOut } = await quoter.quoteExactInput.staticCall(encodeRoute(route), AMOUNT);
      const { amountOutList } = await quoterV2.quoteExactInput.staticCall(encodeRoute(route), AMOUNT);
      expect(amountOutList[amountOutList.length - 1], label).to.eq(amountOut);

      await expect(swap(route, inAdvance, amountOut + 1n), label).to.be.revertedWith('Too little received');
      const tx = await swap(route, inAdvance, amountOut);
      await expectBalanceChanges(tx, balanceChanges(route, AMOUNT, amountOut, IN_DECREASE, OUT_DECREASE), label);
    }
  });

  it('exactOut: both quoters return what the trader pays with the delta, a lower maximum reverts', async () => {
    for (const plugin of plugins) await plugin.setInIncrease(IN_INCREASE, false, 0);
    // exact output swaps take the route backwards
    const swap = (route: number[], amountInMaximum: bigint) => {
      const common = { recipient: trader.address, deadline: 2n ** 32n, amountOut: AMOUNT, amountInMaximum };
      if (route.length > 2)
        return router.connect(trader).exactOutput({ ...common, path: encodeRoute([...route].reverse()) });
      return router.connect(trader).exactOutputSingle({
        ...common,
        tokenIn: addresses[route[0]],
        tokenOut: addresses[route[1]],
        deployer: ZERO_ADDRESS,
        limitSqrtPrice: 0,
      });
    };

    const routes: [string, number[]][] = [
      ['0 -> 1', [0, 1]],
      ['1 -> 0', [1, 0]],
      ['0 -> 1 -> 2', [0, 1, 2]],
      ['2 -> 1 -> 0', [2, 1, 0]],
    ];
    for (const [label, route] of routes) {
      const path = encodeRoute([...route].reverse());
      const { amountIn } = await quoter.quoteExactOutput.staticCall(path, AMOUNT);
      const { amountInList } = await quoterV2.quoteExactOutput.staticCall(path, AMOUNT);
      expect(amountInList[amountInList.length - 1], label).to.eq(amountIn);

      await expect(swap(route, amountIn - 1n), label).to.be.revertedWith('Too much requested');
      const tx = await swap(route, amountIn);
      await expectBalanceChanges(tx, balanceChanges(route, amountIn, AMOUNT, IN_INCREASE, 0n), label);
    }
  });
});
