import { MaxUint256, Wallet, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { v3RouterFixture } from './shared/externalFixtures';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { FeeAmount, TICK_SPACINGS } from './shared/constants';
import { getMaxTick, getMinTick } from './shared/ticks';
import { sortedTokens } from './shared/tokenSort';
import { expect } from './shared/expect';
import { MockMsgSenderPlugin, MockMsgSenderPluginFactory, PermissionedNFPM, TestERC20 } from '../typechain';
import { ZERO_ADDRESS } from './CallbackValidation.spec';

// far enough in the future that the tests never trip `checkDeadline`
const FAR_FUTURE_DEADLINE = 2n ** 32n;

describe('PermissionedNFPM', () => {
  let wallet: Wallet;
  let other: Wallet;

  before('load signers', async () => {
    [wallet, other] = await (ethers as any).getSigners();
  });

  const fixture: () => Promise<{
    nft: PermissionedNFPM;
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
    const [token0, token1] = await sortedTokens(tokenA, tokenB);

    const nft = (await (
      await ethers.getContractFactory('PermissionedNFPM')
    ).deploy(factory, wnative, ZeroAddress, await factory.poolDeployer())) as any as PermissionedNFPM;

    await (token0 as any as TestERC20).approve(nft, MaxUint256);
    await (token1 as any as TestERC20).approve(nft, MaxUint256);
    await (token0 as any as TestERC20).connect(other).approve(nft, MaxUint256);
    await (token1 as any as TestERC20).connect(other).approve(nft, MaxUint256);
    await (token0 as any as TestERC20).transfer(other.address, 10_000_000);
    await (token1 as any as TestERC20).transfer(other.address, 10_000_000);

    await nft.createAndInitializePoolIfNecessary(
      await (token0 as any as TestERC20).getAddress(),
      await (token1 as any as TestERC20).getAddress(),
      ZERO_ADDRESS,
      encodePriceSqrt(1, 1),
      '0x'
    );
    const poolAddress = await factory.poolByPair(
      await (token0 as any as TestERC20).getAddress(),
      await (token1 as any as TestERC20).getAddress()
    );

    return { nft, pluginFactory, token0: token0 as any as TestERC20, token1: token1 as any as TestERC20, poolAddress };
  };

  async function getPlugin(pluginFactory: MockMsgSenderPluginFactory, poolAddress: string) {
    const pluginAddress = await pluginFactory.pluginByPool(poolAddress);
    return ethers.getContractAt('MockMsgSenderPlugin', pluginAddress) as any as Promise<MockMsgSenderPlugin>;
  }

  async function mintParams(token0: TestERC20, token1: TestERC20, recipient: string) {
    return {
      token0: await token0.getAddress(),
      token1: await token1.getAddress(),
      deployer: ZERO_ADDRESS,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      recipient,
      amount0Desired: 1_000_000,
      amount1Desired: 1_000_000,
      amount0Min: 0,
      amount1Min: 0,
      deadline: FAR_FUTURE_DEADLINE,
    };
  }

  it('msgSender() is zero when no call is in progress', async () => {
    const { nft } = await loadFixture(fixture);
    expect(await nft.msgSender()).to.eq(ZeroAddress);
  });

  it('reports the real caller to a permissioned-pool plugin during mint, and clears it afterwards', async () => {
    const { nft, pluginFactory, token0, token1, poolAddress } = await loadFixture(fixture);
    const plugin = await getPlugin(pluginFactory, poolAddress);

    expect(await plugin.lastModifyPositionSender()).to.eq(ZeroAddress);

    await nft.mint(await mintParams(token0, token1, wallet.address));

    expect(await plugin.lastModifyPositionSender()).to.eq(wallet.address);
    expect(await nft.msgSender()).to.eq(ZeroAddress);
  });

  it('reports the connected signer, not the NFPM itself, as the real caller', async () => {
    const { nft, pluginFactory, token0, token1, poolAddress } = await loadFixture(fixture);
    const plugin = await getPlugin(pluginFactory, poolAddress);

    await nft.connect(other).mint(await mintParams(token0, token1, other.address));

    const nftAddress = await nft.getAddress();
    const reportedSender = await plugin.lastModifyPositionSender();
    expect(reportedSender).to.eq(other.address);
    expect(reportedSender).to.not.eq(nftAddress);
  });

  it('reports the real caller through increaseLiquidity as well', async () => {
    const { nft, pluginFactory, token0, token1, poolAddress } = await loadFixture(fixture);
    const plugin = await getPlugin(pluginFactory, poolAddress);

    await nft.mint(await mintParams(token0, token1, wallet.address));
    const tokenId = 1;

    await nft.connect(other).increaseLiquidity({
      tokenId,
      amount0Desired: 100,
      amount1Desired: 100,
      amount0Min: 0,
      amount1Min: 0,
      deadline: FAR_FUTURE_DEADLINE,
    });

    expect(await plugin.lastModifyPositionSender()).to.eq(other.address);
  });

  it('preserves the real caller through multicall', async () => {
    const { nft, pluginFactory, token0, token1, poolAddress } = await loadFixture(fixture);
    const plugin = await getPlugin(pluginFactory, poolAddress);

    const mintData = nft.interface.encodeFunctionData('mint', [await mintParams(token0, token1, other.address)]);

    await nft.connect(other).multicall([mintData]);

    expect(await plugin.lastModifyPositionSender()).to.eq(other.address);
  });
});
