import { ethers } from 'hardhat';
import { getCreateAddress } from 'ethers';
import {
  MockTimeAlgebraPool,
  TestERC20,
  AlgebraFactory,
  AlgebraCommunityVault,
  TestAlgebraCallee,
  TestAlgebraRouter,
  MockTimeAlgebraPoolDeployer,
  AlgebraPoolDeployer,
} from '../../typechain';

type Fixture<T> = () => Promise<T>;
interface FactoryFixture {
  factory: AlgebraFactory;
  vault: AlgebraCommunityVault;
}
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

async function factoryFixture(): Promise<FactoryFixture> {
  const [deployer] = await ethers.getSigners();
  // precompute
  const poolDeployerAddress = getCreateAddress({
    from: deployer.address,
    nonce: (await ethers.provider.getTransactionCount(deployer.address)) + 1,
  });

  const factoryFactory = await ethers.getContractFactory('AlgebraFactory');
  const factory = (await factoryFactory.deploy(poolDeployerAddress)) as any as AlgebraFactory;

  const poolDeployerFactory = await ethers.getContractFactory('AlgebraPoolDeployer');
  const poolDeployer = (await poolDeployerFactory.deploy(factory)) as any as AlgebraPoolDeployer;

  const vaultFactory = await ethers.getContractFactory('AlgebraCommunityVault');
  const vault = (await vaultFactory.deploy(factory, deployer.address)) as any as AlgebraCommunityVault;

  const vaultFactoryStubFactory = await ethers.getContractFactory('AlgebraVaultFactoryStub');
  const vaultFactoryStub = await vaultFactoryStubFactory.deploy(vault);

  await factory.setVaultFactory(vaultFactoryStub);
  return { factory, vault };
}
interface TokensFixture {
  token0: TestERC20;
  token1: TestERC20;
  token2: TestERC20;
}

async function tokensFixture(): Promise<TokensFixture> {
  const tokenFactory = await ethers.getContractFactory('TestERC20');
  const tokenA = (await tokenFactory.deploy(2n ** 255n)) as any as TestERC20 & { address_: string };
  const tokenB = (await tokenFactory.deploy(2n ** 255n)) as any as TestERC20 & { address_: string };
  const tokenC = (await tokenFactory.deploy(2n ** 255n)) as any as TestERC20 & { address_: string };

  tokenA.address_ = await tokenA.getAddress();
  tokenB.address_ = await tokenB.getAddress();
  tokenC.address_ = await tokenC.getAddress();

  const [token0, token1, token2] = [tokenA, tokenB, tokenC].sort((tokenA, tokenB) =>
    tokenA.address_.toLowerCase() < tokenB.address_.toLowerCase() ? -1 : 1
  );

  return { token0, token1, token2 };
}

type TokensAndFactoryFixture = FactoryFixture & TokensFixture;

interface PoolFixture extends TokensAndFactoryFixture {
  swapTargetCallee: TestAlgebraCallee;
  swapTargetRouter: TestAlgebraRouter;
  createPool(firstToken?: TestERC20, secondToken?: TestERC20): Promise<MockTimeAlgebraPool>;
}

// Monday, October 5, 2020 9:00:00 AM GMT-05:00
export const TEST_POOL_START_TIME = 1601906400;
export const TEST_POOL_DAY_BEFORE_START = 1601906400 - 24 * 60 * 60;

export const poolFixture: Fixture<PoolFixture> = async function (): Promise<PoolFixture> {
  const { factory, vault } = await factoryFixture();
  const { token0, token1, token2 } = await tokensFixture();
  //const { dataStorage } = await dataStorageFixture();

  const MockTimeAlgebraPoolDeployerFactory = await ethers.getContractFactory('MockTimeAlgebraPoolDeployer');
  const MockTimeAlgebraPoolFactory = await ethers.getContractFactory('MockTimeAlgebraPool');

  const calleeContractFactory = await ethers.getContractFactory('TestAlgebraCallee');
  const routerContractFactory = await ethers.getContractFactory('TestAlgebraRouter');

  const swapTargetCallee = (await calleeContractFactory.deploy()) as any as TestAlgebraCallee;
  const swapTargetRouter = (await routerContractFactory.deploy()) as any as TestAlgebraRouter;

  return {
    token0,
    token1,
    token2,
    factory,
    vault,
    swapTargetCallee,
    swapTargetRouter,
    createPool: async (firstToken = token0, secondToken = token1) => {
      const mockTimePoolDeployer =
        (await MockTimeAlgebraPoolDeployerFactory.deploy()) as any as MockTimeAlgebraPoolDeployer;
      await mockTimePoolDeployer.deployMock(factory, firstToken, secondToken);

      const firstAddress = await firstToken.getAddress();
      const secondAddress = await secondToken.getAddress();
      const sortedTokens =
        BigInt(firstAddress) < BigInt(secondAddress) ? [firstAddress, secondAddress] : [secondAddress, firstAddress];
      const poolAddress = await mockTimePoolDeployer.computeAddress(sortedTokens[0], sortedTokens[1]);
      return MockTimeAlgebraPoolFactory.attach(poolAddress) as any as MockTimeAlgebraPool;
    },
  };
};
