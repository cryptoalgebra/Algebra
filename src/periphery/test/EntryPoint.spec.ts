import {  Wallet, MaxUint256 } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  MockTimeNonfungiblePositionManager,
  TestERC20,
  IWNativeToken,
  IAlgebraFactory,
  IAccessControl,
  SwapRouter,
  AlgebraCustomPoolEntryPoint,
  CustomPoolDeployerTest,
  IAlgebraPool
} from '../typechain';
import completeFixture from './shared/completeFixture';
import { expandTo18Decimals } from './shared/expandTo18Decimals';
import { expect } from './shared/expect';
import { encodePriceSqrt } from './shared/encodePriceSqrt';

import { abi as IAlgebraPoolABI } from '@cryptoalgebra/integral-core/artifacts/contracts/interfaces/IAlgebraPool.sol/IAlgebraPool.json';
import { ZERO_ADDRESS } from './CallbackValidation.spec';

describe('CustomPoolEntryPoint', () => {
  let wallets: Wallet[];
  let wallet: Wallet, other: Wallet;

  const nftFixture: () => Promise<{
    nft: MockTimeNonfungiblePositionManager;
    factory: IAlgebraFactory;
    tokens: [TestERC20, TestERC20, TestERC20];
    wnative: IWNativeToken;
    router: SwapRouter;
  }> = async () => {
    const { wnative, factory, tokens, nft, router } = await completeFixture();

    // approve & fund wallets
    for (const token of tokens) {
      await token.approve(nft.getAddress(), MaxUint256);
      await token.connect(other).approve(nft.getAddress(), MaxUint256);
      await token.transfer(other.getAddress(), expandTo18Decimals(1_000_000));
    }

    return {
      nft,
      factory,
      tokens,
      wnative,
      router,
    };
  };

  let factory: IAlgebraFactory;
  let nft: MockTimeNonfungiblePositionManager;
  let tokens: [TestERC20, TestERC20, TestERC20];
  let wnative: IWNativeToken;
  let entryPoint: AlgebraCustomPoolEntryPoint;
  let customPoolDeployer: CustomPoolDeployerTest; 

  before('create fixture loader', async () => {
    wallets = await (ethers as any).getSigners();
    [wallet, other] = wallets;
  });

  beforeEach('load fixture', async () => {
    ({ nft, factory, tokens, wnative, } = await loadFixture(nftFixture));

    const entryPointFactory = await ethers.getContractFactory('AlgebraCustomPoolEntryPoint');
    entryPoint = (await entryPointFactory.deploy(factory)) as any as AlgebraCustomPoolEntryPoint;

    const customPoolDeployerFactory = await ethers.getContractFactory('CustomPoolDeployerTest');
    customPoolDeployer = (await customPoolDeployerFactory.deploy(await entryPoint.getAddress(), ZERO_ADDRESS)) as any as CustomPoolDeployerTest;

    let customPoolDeployerRole = await factory.CUSTOM_POOL_DEPLOYER()
    let poolAdministratorRole = await factory.POOLS_ADMINISTRATOR_ROLE()
    await (factory as any as IAccessControl).grantRole(customPoolDeployerRole, await entryPoint.getAddress());
    await (factory as any as IAccessControl).grantRole(poolAdministratorRole, await entryPoint.getAddress());

  });

  describe('create custom pool via entry point', () => {

    it('works correct', async () => {
      await expect(await customPoolDeployer.createCustomPool(customPoolDeployer, wallet.address, tokens[0], tokens[1], "0x")).to.be.emit(factory, "CustomPool")
    });

    it('can be created only from poolDeployer contract', async () => {
      await expect(entryPoint.createCustomPool(customPoolDeployer, wallet.address, tokens[0], tokens[1], "0x")).to.be.revertedWith("Only deployer")
    });

    it('pool configuration can be changed by customPoolDeployer contract', async () => {
      await customPoolDeployer.createCustomPool(customPoolDeployer, wallet.address, tokens[0], tokens[1], "0x")

      let customPoolAddress = await factory.customPoolByPair(customPoolDeployer, tokens[0], tokens[1])

      const pool = new ethers.Contract(customPoolAddress, IAlgebraPoolABI, wallet);
      await pool.initialize(encodePriceSqrt(1, 1))

      await customPoolDeployer.setTickSpacing(customPoolAddress, 10)
      await customPoolDeployer.setPlugin(customPoolAddress, entryPoint)
      await customPoolDeployer.setPluginConfig(customPoolAddress, 193)
      await customPoolDeployer.setFee(customPoolAddress, 300)

      expect(await pool.tickSpacing()).to.be.eq(10)
      expect(await pool.plugin()).to.be.eq(entryPoint)
      expect((await pool.globalState()).lastFee).to.be.eq(300)
      expect((await pool.globalState()).pluginConfig).to.be.eq(193)
    });


    it('custom pool config cannot be changed by other deployer contracts', async () => {
      await customPoolDeployer.createCustomPool(customPoolDeployer, wallet.address, tokens[0], tokens[1], "0x")

      let customPoolAddress = await factory.customPoolByPair(customPoolDeployer, tokens[0], tokens[1])

      const pool = new ethers.Contract(customPoolAddress, IAlgebraPoolABI, wallet);
      await pool.initialize(encodePriceSqrt(1, 1))

      await expect(entryPoint.setTickSpacing(customPoolAddress, 10)).to.be.revertedWith("Only deployer")
      await expect(entryPoint.setPlugin(customPoolAddress, entryPoint)).to.be.revertedWith("Only deployer")
      await expect(entryPoint.setPluginConfig(customPoolAddress, 193)).to.be.revertedWith("Only deployer")
      await expect(entryPoint.setFee(customPoolAddress, 300)).to.be.revertedWith("Only deployer")
    });

  });
});
