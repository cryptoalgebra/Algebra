import { ethers } from 'hardhat';
import completeFixture from './completeFixture';
import {
  IWNativeToken,
  MockTimeNonfungiblePositionManager,
  NonfungibleTokenPositionDescriptor,
  TestERC20,
  IAlgebraFactory,
  SwapRouterL2,
  SwapRouter,
} from '../../typechain';

const completeFixtureCompressed: () => Promise<{
  wnative: IWNativeToken;
  factory: IAlgebraFactory;
  router: SwapRouter;
  routerL2: SwapRouterL2;
  nft: MockTimeNonfungiblePositionManager;
  nftDescriptor: NonfungibleTokenPositionDescriptor;
  tokens: [TestERC20, TestERC20, TestERC20];
}> = async () => {
  const { wnative, factory, router, tokens, nft, nftDescriptor } = await completeFixture();

  const routerCompressed = (await (
    await ethers.getContractFactory('SwapRouterL2')
  ).deploy(factory, wnative, await factory.poolDeployer())) as any as SwapRouterL2;

  return {
    wnative,
    factory,
    router,
    routerL2: routerCompressed,
    tokens,
    nft,
    nftDescriptor,
  };
};

export default completeFixtureCompressed;
