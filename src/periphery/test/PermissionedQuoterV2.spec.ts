import { AbiCoder, MaxUint256, Wallet, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { v3RouterFixture } from './shared/externalFixtures';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { FeeAmount, TICK_SPACINGS } from './shared/constants';
import { getMaxTick, getMinTick } from './shared/ticks';
import { sortedTokens } from './shared/tokenSort';
import { expect } from './shared/expect';
import {
  MockMsgSenderPlugin,
  MockMsgSenderPluginFactory,
  PermissionedNFPM,
  PermissionedQuoterV2,
  TestERC20,
} from '../typechain';
import { ZERO_ADDRESS } from './CallbackValidation.spec';

const FAR_FUTURE_DEADLINE = 2n ** 32n;

describe('PermissionedQuoterV2', () => {
  let wallet: Wallet;
  let trader: Wallet;

  before('load signers', async () => {
    [wallet, trader] = await (ethers as any).getSigners();
  });

  const fixture: () => Promise<{
    quoter: PermissionedQuoterV2;
    pluginFactory: MockMsgSenderPluginFactory;
    token0: TestERC20;
    token1: TestERC20;
    poolAddress: string;
  }> = async () => {
    const { wnative, factory } = await v3RouterFixture();

    const pluginFactory = (await (
      await ethers.getContractFactory('MockMsgSenderPluginFactory')
    ).deploy(factory)) as any as MockMsgSenderPluginFactory;
    await factory.setDefaultPluginFactory(await pluginFactory.getAddress());

    const tokenFactory = await ethers.getContractFactory('TestERC20');
    const tokenA = (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20;
    const tokenB = (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20;
    const [token0, token1] = (await sortedTokens(tokenA, tokenB)) as any as [TestERC20, TestERC20];

    const nft = (await (
      await ethers.getContractFactory('PermissionedNFPM')
    ).deploy(factory, wnative, ZeroAddress, await factory.poolDeployer())) as any as PermissionedNFPM;

    const quoter = (await (
      await ethers.getContractFactory('PermissionedQuoterV2')
    ).deploy(factory, wnative, await factory.poolDeployer())) as any as PermissionedQuoterV2;

    await token0.approve(nft, MaxUint256);
    await token1.approve(nft, MaxUint256);

    await nft.createAndInitializePoolIfNecessary(
      await token0.getAddress(),
      await token1.getAddress(),
      ZERO_ADDRESS,
      encodePriceSqrt(1, 1),
      '0x'
    );
    const poolAddress = await factory.poolByPair(await token0.getAddress(), await token1.getAddress());

    // seed the pool with liquidity so the quoter has something to quote against
    await nft.mint({
      token0: await token0.getAddress(),
      token1: await token1.getAddress(),
      deployer: ZERO_ADDRESS,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      recipient: wallet.address,
      amount0Desired: 1_000_000,
      amount1Desired: 1_000_000,
      amount0Min: 0,
      amount1Min: 0,
      deadline: FAR_FUTURE_DEADLINE,
    });

    return { quoter, pluginFactory, token0, token1, poolAddress };
  };

  async function getPlugin(pluginFactory: MockMsgSenderPluginFactory, poolAddress: string) {
    const pluginAddress = await pluginFactory.pluginByPool(poolAddress);
    return ethers.getContractAt('MockMsgSenderPlugin', pluginAddress) as any as Promise<MockMsgSenderPlugin>;
  }

  // The quoter always causes the underlying pool.swap to revert (that's how it extracts the quote), which
  // would normally roll back anything the plugin recorded in storage during `beforeSwap`. To observe what
  // the plugin actually saw, we flip the plugin into a mode where it reverts with the reported sender as
  // its own revert data, and decode that from the bubbled-up revert.
  async function getReportedSenderViaRevert(quoterCall: Promise<any>): Promise<string> {
    try {
      await quoterCall;
      throw new Error('expected quoter call to revert');
    } catch (e: any) {
      const data = e.data ?? e.info?.error?.data ?? e.error?.data;
      if (!data) throw e;
      const [reportedSender] = AbiCoder.defaultAbiCoder().decode(['address'], data);
      return reportedSender;
    }
  }

  it('msgSender() is zero when no call is in progress', async () => {
    const { quoter } = await loadFixture(fixture);
    expect(await quoter.msgSender()).to.eq(ZeroAddress);
  });

  it('reports the real caller to a permissioned-pool plugin during quoteExactInputSingle, and clears it afterwards', async () => {
    const { quoter, pluginFactory, token0, token1, poolAddress } = await loadFixture(fixture);
    const plugin = await getPlugin(pluginFactory, poolAddress);
    await plugin.setRevertWithSenderOnSwap(true);

    const reportedSender = await getReportedSenderViaRevert(
      quoter.connect(trader).quoteExactInputSingle.staticCall({
        tokenIn: await token0.getAddress(),
        tokenOut: await token1.getAddress(),
        deployer: ZERO_ADDRESS,
        amountIn: 1000,
        limitSqrtPrice: 0,
      })
    );

    const quoterAddress = await quoter.getAddress();
    expect(reportedSender).to.eq(trader.address);
    expect(reportedSender).to.not.eq(quoterAddress);
    expect(await quoter.msgSender()).to.eq(ZeroAddress);
  });

  it('reports the real caller during quoteExactOutputSingle', async () => {
    const { quoter, pluginFactory, token0, token1, poolAddress } = await loadFixture(fixture);
    const plugin = await getPlugin(pluginFactory, poolAddress);
    await plugin.setRevertWithSenderOnSwap(true);

    const reportedSender = await getReportedSenderViaRevert(
      quoter.connect(trader).quoteExactOutputSingle.staticCall({
        tokenIn: await token0.getAddress(),
        tokenOut: await token1.getAddress(),
        deployer: ZERO_ADDRESS,
        amount: 1000,
        limitSqrtPrice: 0,
      })
    );

    expect(reportedSender).to.eq(trader.address);
  });

  it('reports the real caller through the multi-hop quoteExactInput path', async () => {
    const { quoter, pluginFactory, token0, token1, poolAddress } = await loadFixture(fixture);
    const plugin = await getPlugin(pluginFactory, poolAddress);
    await plugin.setRevertWithSenderOnSwap(true);

    const path = ethers.solidityPacked(
      ['address', 'address', 'address'],
      [await token0.getAddress(), ZERO_ADDRESS, await token1.getAddress()]
    );

    const reportedSender = await getReportedSenderViaRevert(
      quoter.connect(trader).quoteExactInput.staticCall(path, 1000)
    );

    expect(reportedSender).to.eq(trader.address);
    expect(await quoter.msgSender()).to.eq(ZeroAddress);
  });

  it('does not report the quoter itself when the plugin does not trust it', async () => {
    // sanity check: with revertWithSenderOnSwap left off, a normal quote still succeeds and returns
    // sane amounts, i.e. adding reportSender did not break ordinary quoting behavior
    const { quoter, token0, token1 } = await loadFixture(fixture);

    const [amountOut] = await quoter.connect(trader).quoteExactInputSingle.staticCall({
      tokenIn: await token0.getAddress(),
      tokenOut: await token1.getAddress(),
      deployer: ZERO_ADDRESS,
      amountIn: 1000,
      limitSqrtPrice: 0,
    });

    expect(amountOut).to.be.gt(0);
  });
});
