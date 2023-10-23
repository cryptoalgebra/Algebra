import { ethers } from 'hardhat';
import { v3RouterFixture } from './externalFixtures';
import { MaxUint256 } from 'ethers';
import { tokenAddresses, tokenRatioSortOrder } from './constants';
import {
  IWNativeToken,
  MockTimeNonfungiblePositionManager,
  MockTimeSwapRouter,
  NonfungibleTokenPositionDescriptor,
  TestERC20,
  IAlgebraFactory,
} from '../../typechain';

type TestERC20WithAddress = TestERC20 & { address_: string | undefined };

type TokenRatioSortData = {
  tokenAddress: string | TestERC20;
  tokenRatioSortOrder: bigint;
};

const DEFAULT_TOKENS_RATIONS_DATA: TokenRatioSortData[] = [
  {
    tokenAddress: tokenAddresses.USDC,
    tokenRatioSortOrder: tokenRatioSortOrder.NUMERATOR_MOST,
  },
  {
    tokenAddress: tokenAddresses.USDT,
    tokenRatioSortOrder: tokenRatioSortOrder.NUMERATOR_MORE,
  },
  {
    tokenAddress: tokenAddresses.DAI,
    tokenRatioSortOrder: tokenRatioSortOrder.NUMERATOR,
  },
  {
    tokenAddress: tokenAddresses.WETH,
    tokenRatioSortOrder: tokenRatioSortOrder.DENOMINATOR_MORE,
  },
  {
    tokenAddress: tokenAddresses.WBTC,
    tokenRatioSortOrder: tokenRatioSortOrder.DENOMINATOR_MOST,
  },
];

const completeFixture: () => Promise<{
  wnative: IWNativeToken;
  factory: IAlgebraFactory;
  router: MockTimeSwapRouter;
  nft: MockTimeNonfungiblePositionManager;
  nftDescriptor: NonfungibleTokenPositionDescriptor;
  tokens: [TestERC20, TestERC20, TestERC20];
}> = async () => {
  const { wnative, factory, router } = await v3RouterFixture();
  const tokenFactory = await ethers.getContractFactory('TestERC20');
  const factoryOwner = await factory.owner();
  const tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress] = [
    (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20WithAddress, // do not use maxu256 to avoid overflowing
    (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20WithAddress,
    (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20WithAddress,
  ];

  tokens[0].address_ = await tokens[0].getAddress();
  tokens[1].address_ = await tokens[1].getAddress();
  tokens[2].address_ = await tokens[2].getAddress();

  tokens.sort((tokenA: TestERC20WithAddress, tokenB: TestERC20WithAddress) => {
    if (!tokenA.address_ || !tokenB.address_) return 0;
    return tokenA.address_.toLowerCase() < tokenB.address_.toLowerCase() ? -1 : 1;
  });

  const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptor');
  const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy();
  const positionDescriptorFactory = await ethers.getContractFactory('NonfungibleTokenPositionDescriptor', {
    libraries: {
      NFTDescriptor: await nftDescriptorLibrary.getAddress(),
    },
  });
  const ProxyFactory = await ethers.getContractFactory('TransparentUpgradeableProxy');

  const nftDescriptor = (await positionDescriptorFactory.deploy(
    tokens[0],
    'MATIC',
    DEFAULT_TOKENS_RATIONS_DATA
  )) as any as NonfungibleTokenPositionDescriptor;
  const proxy = await ProxyFactory.deploy(nftDescriptor, '0xDeaD1F5aF792afc125812E875A891b038f888258', '0x');

  const nftDescriptorProxied = positionDescriptorFactory.attach(proxy) as any as NonfungibleTokenPositionDescriptor;
  const positionManagerFactory = await ethers.getContractFactory('MockTimeNonfungiblePositionManager');
  const nft = (await positionManagerFactory.deploy(
    factory,
    wnative,
    nftDescriptorProxied,
    await factory.poolDeployer()
  )) as any as MockTimeNonfungiblePositionManager;

  return {
    wnative,
    factory,
    router,
    tokens,
    nft,
    nftDescriptor: nftDescriptorProxied,
  };
};

export default completeFixture;
