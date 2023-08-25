import { ethers } from 'hardhat';
import { v3RouterFixture } from './externalFixtures';
import { MaxUint256, Wallet } from 'ethers';
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
}

const polygonTokenAddresses = {
  'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  'WETH': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  'WBTC': '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6'
}

const tokenRatioSortOrder = {
  'NUMERATOR_MOST': 300n,
  'NUMERATOR_MORE': 200n,
  'NUMERATOR': 100n,
  'DENOMINATOR_MOST': -300n,
  'DENOMINATOR_MORE': -200n,
  'DENOMINATOR': -100n
}

const DEFAULT_TOKENS_RATIONS_DATA: TokenRatioSortData[] = [
  {
    tokenAddress: polygonTokenAddresses.USDC,
    tokenRatioSortOrder:  tokenRatioSortOrder.NUMERATOR_MOST
  },
  {
    tokenAddress: polygonTokenAddresses.USDT,
    tokenRatioSortOrder:  tokenRatioSortOrder.NUMERATOR_MORE
  },
  {
    tokenAddress: polygonTokenAddresses.DAI,
    tokenRatioSortOrder:  tokenRatioSortOrder.NUMERATOR
  },
  {
    tokenAddress: polygonTokenAddresses.WETH,
    tokenRatioSortOrder:  tokenRatioSortOrder.DENOMINATOR_MORE
  },
  {
    tokenAddress: polygonTokenAddresses.WBTC,
    tokenRatioSortOrder:  tokenRatioSortOrder.DENOMINATOR_MOST
  },
]

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
    tokens[0], 'MATIC', DEFAULT_TOKENS_RATIONS_DATA
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
