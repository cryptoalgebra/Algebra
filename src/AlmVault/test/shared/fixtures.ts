import {
  IAlgebraFactory,
  IAlgebraPoolDeployer,
  MockPluginFactory,
  INonfungiblePositionManager,
  ISwapRouter,
  IAccessControl,
  IAlgebraEternalFarming,
  AlgebraVaultFactory,
  UV3Math,
  TestERC20,
  TestOracle,
  IFarmingCenter,
  AlgebraVaultDepositGuard,
} from "../../types";
import {
  abi as ALGEBRA_FACTORY_ABI,
  bytecode as ALGEBRA_FACTORY_BYTECODE,
} from "@cryptoalgebra/integral-core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json";
import {
  abi as ALGEBRA_POOL_DEPLOYER_ABI,
  bytecode as ALGEBRA_POOL_DEPLOYER_BYTECODE,
} from "@cryptoalgebra/integral-core/artifacts/contracts/AlgebraPoolDeployer.sol/AlgebraPoolDeployer.json";
import {
  abi as FARMING_CENTER_ABI,
  bytecode as FARMING_CENTER_BYTECODE,
} from "@cryptoalgebra/integral-farming/artifacts/contracts/FarmingCenter.sol/FarmingCenter.json";
import {
  abi as ETERNAL_FARMING_ABI,
  bytecode as ETERNAL_FARMING_BYTECODE,
} from "@cryptoalgebra/integral-farming/artifacts/contracts/farmings/AlgebraEternalFarming.sol/AlgebraEternalFarming.json";
import {
  abi as NON_FUNGIBLE_POSITION_MANAGER_ABI,
  bytecode as NON_FUNGIBLE_POSITION_MANAGER_BYTECODE,
} from "@cryptoalgebra/integral-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json";
import {
  abi as SWAP_ROUTER_ABI,
  bytecode as SWAP_ROUTER_BYTECODE,
} from "@cryptoalgebra/integral-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json";
import { ethers } from "hardhat";
import { getCreateAddress } from "ethers";

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const hreEthers: any = ethers as any;

type Fixture<T> = () => Promise<T>;

interface AlgebraFixture {
  factory: IAlgebraFactory;
  router: ISwapRouter;
  nft: INonfungiblePositionManager;
  pluginFactory: MockPluginFactory;
  oracle: TestOracle;
  poolDeployer: IAlgebraPoolDeployer;
}

async function algebraFixture(): Promise<AlgebraFixture> {
  const [deployer] = await hreEthers.getSigners();

  // precompute
  const poolDeployerAddress = getCreateAddress({
    from: await deployer.getAddress(),
  nonce: (await hreEthers.provider.getTransactionCount(await deployer.getAddress())) + 1,
  });

  // const factoryFactory = await ethers.getContractFactory('AlgebraFactory');
  const factoryFactory = new ethers.ContractFactory(
    ALGEBRA_FACTORY_ABI,
    ALGEBRA_FACTORY_BYTECODE,
    deployer
  );

  const factory_c = await factoryFactory.deploy(poolDeployerAddress);
  await factory_c.waitForDeployment();

  const factory = factory_c as unknown as IAlgebraFactory;

  const poolDeployerFactory = new ethers.ContractFactory(
    ALGEBRA_POOL_DEPLOYER_ABI,
    ALGEBRA_POOL_DEPLOYER_BYTECODE,
    deployer
  );

  const poolDeployer_c = await poolDeployerFactory.deploy(
    await factory_c.getAddress()
  );
  await poolDeployer_c.waitForDeployment();
  const poolDeployer = poolDeployer_c as unknown as IAlgebraPoolDeployer;

  // const pluginFactoryFactory = await ethers.getContractFactory("BasePluginV1Factory");
  // const pluginFactory = (await pluginFactoryFactory.deploy(factory.address)) as IBasePluginV1Factory;

  const pluginFactoryFactory = await ethers.getContractFactory("MockPluginFactory");
  const pluginFactory = (await pluginFactoryFactory.deploy()) as unknown as MockPluginFactory;

  await factory.setDefaultPluginFactory(await pluginFactory.getAddress());

  const tokenFactory = await ethers.getContractFactory("TestERC20");
  const WETH = (await tokenFactory.deploy(2n ** 255n)) as unknown as TestERC20; // TODO: change to real WETH

  const routerFactory = new ethers.ContractFactory(
    SWAP_ROUTER_ABI,
    SWAP_ROUTER_BYTECODE,
    deployer
  );
  const router = (await routerFactory.deploy(
    await factory_c.getAddress(),
    await WETH.getAddress(),
    await poolDeployer_c.getAddress()
  )) as unknown as ISwapRouter;

  const nftFactory = new ethers.ContractFactory(
    NON_FUNGIBLE_POSITION_MANAGER_ABI,
    NON_FUNGIBLE_POSITION_MANAGER_BYTECODE,
    deployer
  );
  const nft = (await nftFactory.deploy(
    await factory_c.getAddress(),
    await WETH.getAddress(),
    NULL_ADDRESS,
    await poolDeployer_c.getAddress()
  )) as unknown as INonfungiblePositionManager;

  const uV3MathFactory = await ethers.getContractFactory("UV3Math");
  const uV3Math = (await uV3MathFactory.deploy()) as unknown as UV3Math;
  const oracleFactory = await ethers.getContractFactory("TestOracle", {
    libraries: {
      UV3Math: await uV3Math.getAddress(),
    },
  });
  const oracle = (await oracleFactory.deploy()) as unknown as TestOracle;

  return { factory, router, nft, pluginFactory, oracle, poolDeployer };
}

interface TokensFixture {
  token0: TestERC20;
  token1: TestERC20;
  token2: TestERC20;
  token3: TestERC20;
}

async function tokensFixture(): Promise<TokensFixture> {
  const tokenFactory = await hreEthers.getContractFactory("TestERC20");
  const tokenA = (await tokenFactory.deploy(2n ** 255n)) as unknown as TestERC20;
  const tokenB = (await tokenFactory.deploy(2n ** 255n)) as unknown as TestERC20;
  const tokenC = (await tokenFactory.deploy(2n ** 255n)) as unknown as TestERC20;
  const tokenD = (await tokenFactory.deploy(2n ** 255n)) as unknown as TestERC20;

  const tokens = [tokenA, tokenB, tokenC, tokenD];
  const tokensWithAddr = await Promise.all(
    tokens.map(async (t) => ({ t, addr: (await (t as any).getAddress()).toLowerCase() }))
  );
  tokensWithAddr.sort((a, b) => (a.addr < b.addr ? -1 : 1));
  const [token0, token1, token2, token3] = tokensWithAddr.map((x) => x.t);

  return { token0, token1, token2, token3 };
}

interface AlgebraVaultFactoryFixture {
  algebraVaultFactory: AlgebraVaultFactory;
  algebraEternalFarming: IAlgebraEternalFarming;
  farmingCenter: IFarmingCenter;
  depositGuard: AlgebraVaultDepositGuard;
  depositGuardToken1: AlgebraVaultDepositGuard;
}

async function algebraVaultFactoryFixture(
  factory: IAlgebraFactory,
  poolDeployer: IAlgebraPoolDeployer,
  nft: INonfungiblePositionManager,
  token0: TestERC20,
  token1: TestERC20
): Promise<AlgebraVaultFactoryFixture> {
  const [deployer] = await hreEthers.getSigners();

  const uV3MathFactory = await ethers.getContractFactory("UV3Math");
  const uV3Math = (await uV3MathFactory.deploy()) as UV3Math;

  const eternalFarmingFactory = new hreEthers.ContractFactory(
    ETERNAL_FARMING_ABI,
    ETERNAL_FARMING_BYTECODE,
    deployer
  );
  const algebraEternalFarming_c = await eternalFarmingFactory.deploy(
    await (poolDeployer as any).getAddress(),
    await (nft as any).getAddress()
  );
  await algebraEternalFarming_c.waitForDeployment();
  const algebraEternalFarming = algebraEternalFarming_c as unknown as IAlgebraEternalFarming;

  const farmingCenterFactory = new hreEthers.ContractFactory(
    FARMING_CENTER_ABI,
    FARMING_CENTER_BYTECODE,
    deployer
  );
  const farmingCenter_c = await farmingCenterFactory.deploy(
    await (algebraEternalFarming as any).getAddress(),
    await (nft as any).getAddress()
  );
  await farmingCenter_c.waitForDeployment();
  const farmingCenter = farmingCenter_c as unknown as IFarmingCenter;

  await (nft as any).setFarmingCenter(await (farmingCenter as any).getAddress());

  await (algebraEternalFarming as any).setFarmingCenterAddress(await (farmingCenter as any).getAddress());

  const incentiveMakerRole = await algebraEternalFarming.INCENTIVE_MAKER_ROLE();

  await (factory as any as IAccessControl).grantRole(
    incentiveMakerRole,
    await deployer.getAddress()
  );

  const algebraVaultDeployer = await hreEthers.getContractFactory(
    "AlgebraVaultDeployer",
    {
      libraries: {
        UV3Math: await (uV3Math as any).getAddress(),
      },
    }
  );
  const libAlgebraVaultDeployer = await algebraVaultDeployer.deploy();

  const farmingRewardsDistributorDeployer = await hreEthers.getContractFactory(
    "FarmingRewardsDistributorDeployer"
  );
  const libFarmingRewardsDistributorDeployer = await farmingRewardsDistributorDeployer.deploy();

  const algebraVaultFactoryFactory = await ethers.getContractFactory(
    "AlgebraVaultFactory",
    {
      libraries: {
          AlgebraVaultDeployer: await (libAlgebraVaultDeployer as any).getAddress(),
          FarmingRewardsDistributorDeployer: await (libFarmingRewardsDistributorDeployer as any).getAddress(),
        },
    }
  );

    const algebraVaultFactory_c = (await algebraVaultFactoryFactory.deploy(
      await (factory as any).getAddress(),
      NULL_ADDRESS,
      await (algebraEternalFarming as any).getAddress(),
      await (nft as any).getAddress(),
      "VEL"
    ));
    await algebraVaultFactory_c.waitForDeployment();
    const algebraVaultFactory = algebraVaultFactory_c as unknown as AlgebraVaultFactory;

  const depositGuardFactory = await ethers.getContractFactory(
    "AlgebraVaultDepositGuard"
  );
    const depositGuard = (await depositGuardFactory.deploy(
      await (algebraVaultFactory as any).getAddress(),
      await (token0 as any).getAddress()
    )) as unknown as AlgebraVaultDepositGuard;
    const depositGuardToken1 = (await depositGuardFactory.deploy(
      await (algebraVaultFactory as any).getAddress(),
      await (token1 as any).getAddress()
    )) as unknown as AlgebraVaultDepositGuard;

  return {
    algebraVaultFactory,
    algebraEternalFarming,
    farmingCenter,
    depositGuard,
    depositGuardToken1,
  };
}

type AlgebraVaultTestFixture = AlgebraFixture &
  TokensFixture &
  AlgebraVaultFactoryFixture;

export const algebraVaultTestFixture: Fixture<AlgebraVaultTestFixture> =
  async function (): Promise<AlgebraVaultTestFixture> {
    const { factory, router, nft, pluginFactory, oracle, poolDeployer } =
      await algebraFixture();
    const { token0, token1, token2, token3 } = await tokensFixture();
    const {
      algebraVaultFactory,
      algebraEternalFarming,
      farmingCenter,
      depositGuard,
      depositGuardToken1,
    } = await algebraVaultFactoryFixture(factory, poolDeployer, nft, token0, token1);

    return {
      token0,
      token1,
      token2,
      token3,
      factory,
      router,
      nft,
      pluginFactory,
      oracle,
      poolDeployer,
      algebraVaultFactory,
      algebraEternalFarming,
      farmingCenter,
      depositGuard,
      depositGuardToken1,
    };
  };
