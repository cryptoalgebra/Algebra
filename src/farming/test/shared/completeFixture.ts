import { ethers } from 'hardhat';
import { v3RouterFixture } from './externalFixtures';
import { MaxUint256 } from 'ethers';
import {
  IWNativeToken,
  MockTimeNonfungiblePositionManager,
  MockTimeSwapRouter,
  NonfungibleTokenPositionDescriptor,
  TestERC20,
  IAlgebraFactory,
} from '@cryptoalgebra/integral-periphery/typechain';

type Fixture<T> = () => Promise<T>;

type TestERC20WithAddress = TestERC20 & { address: string | undefined };

const completeFixture: Fixture<{
  wnative: IWNativeToken;
  factory: IAlgebraFactory;
  router: MockTimeSwapRouter;
  nft: MockTimeNonfungiblePositionManager;
  nftDescriptor: NonfungibleTokenPositionDescriptor;
  tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
}> = async () => {
  const { wnative, factory, router } = await v3RouterFixture();
  const tokenFactory = await ethers.getContractFactory('TestERC20');
  const tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress] = [
    (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20WithAddress, // do not use maxu256 to avoid overflowing
    (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20WithAddress,
    (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20WithAddress,
  ];

  tokens[0].address = await tokens[0].getAddress();
  tokens[1].address = await tokens[1].getAddress();
  tokens[2].address = await tokens[2].getAddress();

  tokens.sort((tokenA: TestERC20WithAddress, tokenB: TestERC20WithAddress) => {
    if (!tokenA.address || !tokenB.address) return 0;
    return tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? -1 : 1;
  });

  const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptor');
  const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy();
  const positionDescriptorFactory = await ethers.getContractFactory('NonfungibleTokenPositionDescriptor', {
    libraries: {
      NFTDescriptor: await nftDescriptorLibrary.getAddress(),
    },
  });
  const nftDescriptor = (await positionDescriptorFactory.deploy(await tokens[0].getAddress)) as any as NonfungibleTokenPositionDescriptor;

  const positionManagerFactory = await ethers.getContractFactory('MockTimeNonfungiblePositionManager');
  const nft = (await positionManagerFactory.deploy(
    factory,
    wnative,
    nftDescriptor,
    await factory.poolDeployer()
  )) as any as MockTimeNonfungiblePositionManager;

  return {
    wnative,
    factory,
    router,
    tokens,
    nft,
    nftDescriptor,
  };
};

export default completeFixture;
