import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from '@cryptoalgebra/core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json'
import {
  abi as TEST_CALLEE_ABI,
  bytecode as TEST_CALLEE_BYTECODE,
} from '@cryptoalgebra/core/artifacts/contracts/test/TestAlgebraCallee.sol/TestAlgebraCallee.json'
import {
  abi as POOL_DEPLOYER_ABI,
  bytecode as POOL_DEPLOYER_BYTECODE,
} from '@cryptoalgebra/core/artifacts/contracts/test/MockTimeAlgebraPoolDeployer.sol/MockTimeAlgebraPoolDeployer.json'
import {
  abi as POOL_ABI,
  bytecode as POOL_BYTECODE,
} from '@cryptoalgebra/core/artifacts/contracts/test/MockTimeAlgebraPool.sol/MockTimeAlgebraPool.json'

import { ethers } from 'hardhat'
import { BigNumber } from 'ethers'
import { MockTimeAlgebraPoolDeployer, TestAlgebraCallee, MockTimeAlgebraPool, AlgebraFactory } from '@cryptoalgebra/core/typechain'

import {TestERC20} from '../../typechain'

interface TokensFixture {
  token0: TestERC20
  token1: TestERC20
}

async function tokensFixture(): Promise<TokensFixture> {
  const tokenFactory = await ethers.getContractFactory('TestERC20')
  const tokenA = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20
  const tokenB = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20

  const [token0, token1] = [tokenA, tokenB].sort((tokenA, tokenB) =>
    tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? -1 : 1
  )

  return { token0, token1 }
}

interface MockPoolDeployerFixture extends TokensFixture {
  poolDeployer: MockTimeAlgebraPoolDeployer;
  swapTargetCallee: TestAlgebraCallee;
  factory: AlgebraFactory
  createPool(
    firstToken?: TestERC20,
    secondToken?: TestERC20
  ): Promise<MockTimeAlgebraPool>
}
export const algebraPoolDeployerMockFixture: () => Promise<MockPoolDeployerFixture> = async () => {
  
  const [deployer] = await ethers.getSigners();

  const { token0, token1 } = await tokensFixture();

  // precompute
  const poolDeployerAddress = ethers.utils.getContractAddress({
    from: deployer.address, 
    nonce: (await deployer.getTransactionCount()) + 1
  })

  const factoryFactory = await ethers.getContractFactory(FACTORY_ABI,  FACTORY_BYTECODE);
  const factory = (await factoryFactory.deploy(poolDeployerAddress)) as AlgebraFactory
  await factory.deployed();

  const poolDeployerFactory = await ethers.getContractFactory(POOL_DEPLOYER_ABI,  POOL_DEPLOYER_BYTECODE);
  const poolDeployerContract = await poolDeployerFactory.deploy();
  await poolDeployerContract.deployed();
  const poolDeployer = (poolDeployerContract) as MockTimeAlgebraPoolDeployer;

  const calleeContractFactory = await ethers.getContractFactory(TEST_CALLEE_ABI,  TEST_CALLEE_BYTECODE);
  const swapTargetCallee = (await calleeContractFactory.deploy()) as TestAlgebraCallee;

  const MockTimeAlgebraPoolFactory = await ethers.getContractFactory(POOL_ABI,  POOL_BYTECODE);

  return { poolDeployer, swapTargetCallee, token0, token1, factory,     
    createPool: async (firstToken = token0, secondToken = token1) => {
    const tx = await poolDeployer.deployMock(
      factory.address,
      ethers.constants.AddressZero,
      firstToken.address,
      secondToken.address
    )
      
    const receipt = await tx.wait()
    const sortedTokens = (BigInt(firstToken.address) < BigInt(secondToken.address)) ? [firstToken.address, secondToken.address] : [secondToken.address, firstToken.address]; 
    const poolAddress = await poolDeployer.computeAddress(sortedTokens[0], sortedTokens[1]);
    return MockTimeAlgebraPoolFactory.attach(poolAddress) as MockTimeAlgebraPool;
  } };
}