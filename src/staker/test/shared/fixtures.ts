import { Fixture } from 'ethereum-waffle'
import { constants } from 'ethers'
import { ethers, waffle } from 'hardhat'

import AlgebraPool from 'algebra/artifacts/contracts/AlgebraPool.sol/AlgebraPool.json'
import AlgebraFactoryJson from 'algebra/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json'
import AlgebraPoolDeployerJson from 'algebra/artifacts/contracts/AlgebraPoolDeployer.sol/AlgebraPoolDeployer.json'
import VirtualPoolDeployerJson from '../../artifacts/contracts/VirtualPoolDeployer.sol/VirtualPoolDeployer.json'
import NFTDescriptorJson from 'algebra-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json'
import NonfungiblePositionManagerJson from 'algebra-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import NonfungibleTokenPositionDescriptor from 'algebra-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json'
import SwapRouter from 'algebra-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import WNativeToken from './external/WNativeToken.json'
import { linkLibraries } from './linkLibraries'
import { ISwapRouter } from '../../types/ISwapRouter'
import { IWNativeToken } from '../../types/IWNativeToken'
import {
  AlgebraStaker,
  TestERC20,
  IVirtualPoolDeployer,
  INonfungiblePositionManager,
  IAlgebraFactory,
  IAlgebraPoolDeployer,
  IAlgebraPool,
  TestIncentiveId,
} from '../../typechain'
import { NFTDescriptor } from '../../types/NFTDescriptor'
import { FeeAmount, BigNumber, encodePriceSqrt, MAX_GAS_LIMIT } from '../shared'
import { ActorFixture } from './actors'

type WNativeTokenFixture = { wnative: IWNativeToken }

export const wnativeFixture: Fixture<WNativeTokenFixture> = async ([wallet]) => {
  const wnative = (await waffle.deployContract(wallet, {
    bytecode: WNativeToken.bytecode,
    abi: WNativeToken.abi,
  })) as IWNativeToken

  return { wnative }
}

const v3CoreDeployerFixture: Fixture<IAlgebraPoolDeployer> = async ([wallet]) => {
  return ((await waffle.deployContract(wallet, {
    bytecode: AlgebraPoolDeployerJson.bytecode,
    abi: AlgebraPoolDeployerJson.abi,
  })) as unknown) as IAlgebraPoolDeployer
}

const v3CoreFactoryFixture: Fixture<[IAlgebraFactory,IAlgebraPoolDeployer]> = async ([wallet], provider) => {
  const deployer = await v3CoreDeployerFixture([wallet], provider)
  const factory = ((await waffle.deployContract(wallet, {
    bytecode: AlgebraFactoryJson.bytecode,
    abi: AlgebraFactoryJson.abi,
  }, [deployer.address])) as unknown) as IAlgebraFactory

  await deployer.setFactory(factory.address)

  return [factory, deployer]
}



export const v3RouterFixture: Fixture<{
  wnative: IWNativeToken
  factory: IAlgebraFactory
  deployer: IAlgebraPoolDeployer
  router: ISwapRouter
}> = async ([wallet], provider) => {
  const { wnative } = await wnativeFixture([wallet], provider)
  const [factory,deployer] = await v3CoreFactoryFixture([wallet], provider)
  const router = ((await waffle.deployContract(
    wallet,
    {
      bytecode: SwapRouter.bytecode,
      abi: SwapRouter.abi,
    },
    [factory.address, wnative.address, deployer.address]
  )) as unknown) as ISwapRouter

  return { factory, wnative, deployer, router }
}

const nftDescriptorLibraryFixture: Fixture<NFTDescriptor> = async ([wallet]) => {
  return (await waffle.deployContract(wallet, {
    bytecode: NFTDescriptorJson.bytecode,
    abi: NFTDescriptorJson.abi,
  })) as NFTDescriptor
}

const VirtualPoolDeployerFixture: Fixture<IVirtualPoolDeployer> = async ([wallet]) => {
  return ((await waffle.deployContract(wallet, {
    bytecode: VirtualPoolDeployerJson.bytecode,
    abi: VirtualPoolDeployerJson.abi,
  })) as unknown) as IVirtualPoolDeployer
}

type AlgebraFactoryFixture = {
  wnative: IWNativeToken
  factory: IAlgebraFactory
  deployer: IAlgebraPoolDeployer
  router: ISwapRouter
  nft: INonfungiblePositionManager
  tokens: [TestERC20, TestERC20, TestERC20,TestERC20]
}

export const algebraFactoryFixture: Fixture<AlgebraFactoryFixture> = async (wallets, provider) => {
  const { wnative, factory, deployer, router } = await v3RouterFixture(wallets, provider)
  const tokenFactory = await ethers.getContractFactory('TestERC20')
  const tokens = (await Promise.all([
    tokenFactory.deploy(constants.MaxUint256.div(2)), // do not use maxu256 to avoid overflowing
    tokenFactory.deploy(constants.MaxUint256.div(2)),
    tokenFactory.deploy(constants.MaxUint256.div(2)),
    tokenFactory.deploy(constants.MaxUint256.div(2)),
  ])) as [TestERC20, TestERC20, TestERC20,TestERC20]

  const nftDescriptorLibrary = await nftDescriptorLibraryFixture(wallets, provider)

  const linkedBytecode = linkLibraries(
    {
      bytecode: NonfungibleTokenPositionDescriptor.bytecode,
      linkReferences: {
        'NFTDescriptor.sol': {
          NFTDescriptor: [
            {
              length: 20,
              start: 1248,
            },
          ],
        },
      },
    },
    {
      NFTDescriptor: nftDescriptorLibrary.address,
    }
  )

  const positionDescriptor = await waffle.deployContract(
    wallets[0],
    {
      bytecode: linkedBytecode,
      abi: NonfungibleTokenPositionDescriptor.abi,
    },
    [tokens[0].address]
  )

  const nftFactory = new ethers.ContractFactory(
    NonfungiblePositionManagerJson.abi,
    NonfungiblePositionManagerJson.bytecode,
    wallets[0]
  )
  const nft = (await nftFactory.deploy(
    factory.address,
    wnative.address,
    positionDescriptor.address,
    deployer.address
  )) as INonfungiblePositionManager

  tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

  return {
    wnative,
    factory,
    deployer,
    router,
    tokens,
    nft,
  }
}

export const mintPosition = async (
  nft: INonfungiblePositionManager,
  mintParams: {
    token0: string
    token1: string
    fee: FeeAmount
    tickLower: number
    tickUpper: number
    recipient: string
    amount0Desired: any
    amount1Desired: any
    amount0Min: number
    amount1Min: number
    deadline: number
  }
): Promise<string> => {
  const transferFilter = nft.filters.Transfer(null, null, null)
  const transferTopic = nft.interface.getEventTopic('Transfer')

  let tokenId: BigNumber | undefined

  const receipt = await (
    await nft.mint(
      {
        token0: mintParams.token0,
        token1: mintParams.token1,
        tickLower: mintParams.tickLower,
        tickUpper: mintParams.tickUpper,
        recipient: mintParams.recipient,
        amount0Desired: mintParams.amount0Desired,
        amount1Desired: mintParams.amount1Desired,
        amount0Min: mintParams.amount0Min,
        amount1Min: mintParams.amount1Min,
        deadline: mintParams.deadline,
      },
      {
        gasLimit: MAX_GAS_LIMIT,
      }
    )
  ).wait()

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i]
    if (log.address === nft.address && log.topics.includes(transferTopic)) {
      // for some reason log.data is 0x so this hack just re-fetches it
      const events = await nft.queryFilter(transferFilter, log.blockHash)
      if (events.length === 1) {
        tokenId = events[0].args?.tokenId
      }
      break
    }
  }

  if (tokenId === undefined) {
    throw 'could not find tokenId after mint'
  } else {
    return tokenId.toString()
  }
}

export type AlgebraFixtureType = {
  deployer: IAlgebraPoolDeployer
  fee: FeeAmount
  nft: INonfungiblePositionManager
  pool01: string
  pool12: string
  factory: IAlgebraFactory
  poolObj: IAlgebraPool
  router: ISwapRouter
  vdeployer: IVirtualPoolDeployer
  staker: AlgebraStaker
  testIncentiveId: TestIncentiveId
  tokens: [TestERC20, TestERC20, TestERC20, TestERC20]
  token0: TestERC20
  token1: TestERC20
  rewardToken: TestERC20
  bonusRewardToken: TestERC20
}
export const algebraFixture: Fixture<AlgebraFixtureType> = async (wallets, provider) => {
  const { tokens, nft, factory, deployer, router } = await algebraFactoryFixture(wallets, provider)
  const vdeployer = await VirtualPoolDeployerFixture(wallets, provider)
  const signer = new ActorFixture(wallets, provider).stakerDeployer()
  const stakerFactory = await ethers.getContractFactory('AlgebraStaker', signer)
  const staker = (await stakerFactory.deploy(deployer.address, nft.address, vdeployer.address, 2 ** 32, 2 ** 32)) as AlgebraStaker

  await factory.setStakerAddress(staker.address)
  await vdeployer.setFactory(staker.address) 
  const testIncentiveIdFactory = await ethers.getContractFactory('TestIncentiveId', signer)
  const testIncentiveId = (await testIncentiveIdFactory.deploy()) as TestIncentiveId

  for (const token of tokens) {
    await token.approve(nft.address, constants.MaxUint256)
  }

  const fee = FeeAmount.MEDIUM
  await nft.createAndInitializePoolIfNecessary(tokens[0].address ,tokens[1].address, encodePriceSqrt(1, 1))

  await nft.createAndInitializePoolIfNecessary(tokens[1].address, tokens[2].address, encodePriceSqrt(1, 1))

  const pool01 = await factory.poolByPair(tokens[0].address, tokens[1].address)

  const pool12 = await factory.poolByPair(tokens[1].address, tokens[2].address)

  const poolObj = poolFactory.attach(pool01) as IAlgebraPool

  return {
    nft,
    router,
    tokens,
    staker,
    testIncentiveId,
    deployer,
    factory,
    pool01,
    pool12,
    fee,
    poolObj,
    token0: tokens[0],
    token1: tokens[1],
    rewardToken: tokens[2],
    bonusRewardToken: tokens[1],
    vdeployer
  }
}

export const poolFactory = new ethers.ContractFactory(AlgebraPool.abi, AlgebraPool.bytecode)
