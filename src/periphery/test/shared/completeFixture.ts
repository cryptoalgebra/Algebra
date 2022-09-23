import { ethers } from 'hardhat'
import { v3RouterFixture } from './externalFixtures'
import { constants, Wallet } from 'ethers'
import {
  IWNativeToken,
  MockTimeNonfungiblePositionManager,
  MockTimeSwapRouter,
  NonfungibleTokenPositionDescriptor,
  TestERC20,
  IAlgebraFactory
} from '../../typechain'

const completeFixture: () => Promise<{
  wnative: IWNativeToken
  factory: IAlgebraFactory
  router: MockTimeSwapRouter
  nft: MockTimeNonfungiblePositionManager
  nftDescriptor: NonfungibleTokenPositionDescriptor
  tokens: [TestERC20, TestERC20, TestERC20]
}> = async () => {
  const { wnative, factory, router } = await v3RouterFixture()
  const tokenFactory = await ethers.getContractFactory('TestERC20')
  const factoryOwner = await factory.owner()
  const tokens: [TestERC20, TestERC20, TestERC20] = [
    (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20, // do not use maxu256 to avoid overflowing
    (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
    (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
  ]

  const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptor')
  const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy()
  const positionDescriptorFactory = await ethers.getContractFactory('NonfungibleTokenPositionDescriptor', {
    libraries: {
      NFTDescriptor: nftDescriptorLibrary.address,
    },
  })
  const ProxyFactory = await ethers.getContractFactory("TransparentUpgradeableProxy")

  const nftDescriptor = (await positionDescriptorFactory.deploy(
    tokens[0].address
  )) as NonfungibleTokenPositionDescriptor
  const proxy = await ProxyFactory.deploy(nftDescriptor.address, "0xDeaD1F5aF792afc125812E875A891b038f888258", "0x");
  const nftDescriptorProxied = (await positionDescriptorFactory.attach(proxy.address)) as NonfungibleTokenPositionDescriptor;
  const positionManagerFactory = await ethers.getContractFactory('MockTimeNonfungiblePositionManager')
  const nft = (await positionManagerFactory.deploy(
    factory.address,
    wnative.address,
    nftDescriptorProxied.address,
      await factory.poolDeployer()
  )) as MockTimeNonfungiblePositionManager

  tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

  return {
    wnative,
    factory,
    router,
    tokens,
    nft,
    nftDescriptor: nftDescriptorProxied
  }
}

export default completeFixture
