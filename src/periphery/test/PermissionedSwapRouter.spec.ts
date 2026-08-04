import { MaxUint256, Wallet, ZeroAddress } from 'ethers';
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
  PermissionedSwapRouter,
  TestERC20,
} from '../typechain';
import { ZERO_ADDRESS } from './CallbackValidation.spec';

// far enough in the future that the tests never trip `checkDeadline`
const FAR_FUTURE_DEADLINE = 2n ** 32n;

describe('PermissionedSwapRouter', () => {
  let wallet: Wallet;
  let trader: Wallet;

  before('load signers', async () => {
    [wallet, trader] = await (ethers as any).getSigners();
  });

  const fixture: () => Promise<{
    router: PermissionedSwapRouter;
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

    const router = (await (
      await ethers.getContractFactory('PermissionedSwapRouter')
    ).deploy(factory, wnative, await factory.poolDeployer())) as any as PermissionedSwapRouter;

    await token0.approve(nft, MaxUint256);
    await token1.approve(nft, MaxUint256);
    await token0.approve(router, MaxUint256);
    await token1.approve(router, MaxUint256);
    await token0.connect(trader).approve(router, MaxUint256);
    await token1.connect(trader).approve(router, MaxUint256);
    await token0.transfer(trader.address, 10_000_000);
    await token1.transfer(trader.address, 10_000_000);

    await nft.createAndInitializePoolIfNecessary(
      await token0.getAddress(),
      await token1.getAddress(),
      ZERO_ADDRESS,
      encodePriceSqrt(1, 1),
      '0x'
    );
    const poolAddress = await factory.poolByPair(await token0.getAddress(), await token1.getAddress());

    // seed the pool with liquidity so the router has something to swap against
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

    return { router, pluginFactory, token0, token1, poolAddress };
  };

  async function getPlugin(pluginFactory: MockMsgSenderPluginFactory, poolAddress: string) {
    const pluginAddress = await pluginFactory.pluginByPool(poolAddress);
    return ethers.getContractAt('MockMsgSenderPlugin', pluginAddress) as any as Promise<MockMsgSenderPlugin>;
  }

  it('msgSender() is zero when no call is in progress', async () => {
    const { router } = await loadFixture(fixture);
    expect(await router.msgSender()).to.eq(ZeroAddress);
  });

  it('reports the real caller to a permissioned-pool plugin during exactInputSingle, and clears it afterwards', async () => {
    const { router, pluginFactory, token0, token1, poolAddress } = await loadFixture(fixture);
    const plugin = await getPlugin(pluginFactory, poolAddress);

    expect(await plugin.lastSwapSender()).to.eq(ZeroAddress);

    await router.connect(trader).exactInputSingle({
      tokenIn: await token0.getAddress(),
      tokenOut: await token1.getAddress(),
      deployer: ZERO_ADDRESS,
      recipient: trader.address,
      deadline: FAR_FUTURE_DEADLINE,
      amountIn: 1000,
      amountOutMinimum: 0,
      limitSqrtPrice: 0,
    });

    const routerAddress = await router.getAddress();
    const reportedSender = await plugin.lastSwapSender();
    expect(reportedSender).to.eq(trader.address);
    expect(reportedSender).to.not.eq(routerAddress);
    expect(await router.msgSender()).to.eq(ZeroAddress);
  });

  it('reports the real caller during exactOutputSingle', async () => {
    const { router, pluginFactory, token0, token1, poolAddress } = await loadFixture(fixture);
    const plugin = await getPlugin(pluginFactory, poolAddress);

    await router.connect(trader).exactOutputSingle({
      tokenIn: await token0.getAddress(),
      tokenOut: await token1.getAddress(),
      deployer: ZERO_ADDRESS,
      recipient: trader.address,
      deadline: FAR_FUTURE_DEADLINE,
      amountOut: 1000,
      amountInMaximum: 1_000_000,
      limitSqrtPrice: 0,
    });

    expect(await plugin.lastSwapSender()).to.eq(trader.address);
  });

  it('preserves the real caller through multicall', async () => {
    const { router, pluginFactory, token0, token1, poolAddress } = await loadFixture(fixture);
    const plugin = await getPlugin(pluginFactory, poolAddress);

    const swapData = router.interface.encodeFunctionData('exactInputSingle', [
      {
        tokenIn: await token0.getAddress(),
        tokenOut: await token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: FAR_FUTURE_DEADLINE,
        amountIn: 1000,
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      },
    ]);

    await router.connect(trader).multicall([swapData]);

    expect(await plugin.lastSwapSender()).to.eq(trader.address);
  });
});
