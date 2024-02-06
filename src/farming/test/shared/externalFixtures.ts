import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json';
import {
  abi as POOL_DEPLOYER_ABI,
  bytecode as POOL_DEPLOYER_BYTECODE,
} from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraPoolDeployer.sol/AlgebraPoolDeployer.json';
import { ethers } from 'hardhat';
import { IAlgebraFactory, IWNativeToken, MockTimeSwapRouter } from '@cryptoalgebra/integral-periphery/typechain';
import {
  abi as SWAPROUTER_ABI,
  bytecode as SWAPROUTER_BYTECODE,
} from '@cryptoalgebra/integral-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';
import {
  abi as PLUGIN_FACTORY_ABI,
  bytecode as PLUGIN_FACTORY_BYTECODE,
} from '@cryptoalgebra/integral-base-plugin/artifacts/contracts/BasePluginV1Factory.sol/BasePluginV1Factory.json';
import {
  abi as WNATIVE_ABI,
  bytecode as WNATIVE_BYTECODE,
} from '@cryptoalgebra/integral-periphery/artifacts/contracts/interfaces/external/IWNativeToken.sol/IWNativeToken.json';

//import WNativeToken from '../contracts/WNativeToken.json'
import { getCreateAddress } from 'ethers';

export const vaultAddress = '0x1d8b6fA722230153BE08C4Fa4Aa4B4c7cd01A95a';

const wnativeFixture: () => Promise<{ wnative: IWNativeToken }> = async () => {
  const wnativeFactory = await ethers.getContractFactory(WNATIVE_ABI, WNATIVE_BYTECODE);
  const wnative = (await wnativeFactory.deploy()) as any as IWNativeToken;

  return { wnative };
};

const v3CoreFactoryFixture: () => Promise<IAlgebraFactory> = async () => {
  const [deployer] = await ethers.getSigners();
  // precompute
  const poolDeployerAddress = getCreateAddress({
    from: deployer.address,
    nonce: (await ethers.provider.getTransactionCount(deployer.address)) + 1,
  });

  const v3FactoryFactory = await ethers.getContractFactory(FACTORY_ABI, FACTORY_BYTECODE);
  const _factory = (await v3FactoryFactory.deploy(poolDeployerAddress)) as any as IAlgebraFactory;

  const poolDeployerFactory = await ethers.getContractFactory(POOL_DEPLOYER_ABI, POOL_DEPLOYER_BYTECODE);
  const poolDeployer = await poolDeployerFactory.deploy(_factory);

  const pluginContractFactory = await ethers.getContractFactory(PLUGIN_FACTORY_ABI, PLUGIN_FACTORY_BYTECODE);
  const pluginFactory = await pluginContractFactory.deploy(_factory);

  await _factory.setDefaultPluginFactory(pluginFactory);

  return _factory;
};

export const v3RouterFixture: () => Promise<{
  wnative: IWNativeToken;
  factory: IAlgebraFactory;
  router: MockTimeSwapRouter;
}> = async () => {
  const { wnative } = await wnativeFixture();
  const factory = await v3CoreFactoryFixture();
  const routerFactory = await ethers.getContractFactory(SWAPROUTER_ABI, SWAPROUTER_BYTECODE);
  const router = (await routerFactory.deploy(factory, wnative, await factory.poolDeployer())) as any as MockTimeSwapRouter;

  return { factory, wnative, router };
};
