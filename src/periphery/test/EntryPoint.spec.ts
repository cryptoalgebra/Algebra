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
} from '../typechain';
import completeFixture from './shared/completeFixture';
import { expandTo18Decimals } from './shared/expandTo18Decimals';
import { expect } from './shared/expect';
import { encodePriceSqrt } from './shared/encodePriceSqrt';

import { abi as IAlgebraPoolABI } from '@cryptoalgebra/integral-core/artifacts/contracts/interfaces/IAlgebraPool.sol/IAlgebraPool.json';
import { ZERO_ADDRESS } from './shared/constants';

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
  let tokens: [TestERC20, TestERC20, TestERC20];
  let entryPoint: AlgebraCustomPoolEntryPoint;
  let customPoolDeployer: CustomPoolDeployerTest; 

  before('create fixture loader', async () => {
    wallets = await (ethers as any).getSigners();
    [wallet, other] = wallets;
  });

  beforeEach('load fixture', async () => {
    ({ factory, tokens } = await loadFixture(nftFixture));

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

    it('creates the pool with the plugin of the deployer and forwards both creation hooks to it', async () => {
      const plugin = wallets[2].address
      const deployerFactory = await ethers.getContractFactory('CustomPoolDeployerTest')
      const deployer = (await deployerFactory.deploy(entryPoint, plugin)) as any as CustomPoolDeployerTest
      const deployerAddress = await deployer.getAddress()
      const [token0, token1] = [await tokens[0].getAddress(), await tokens[1].getAddress()].sort((a, b) =>
        a.toLowerCase() < b.toLowerCase() ? -1 : 1
      )
      const data = "0x1234"

      const tx = await deployer.createCustomPool(deployer, wallet.address, tokens[0], tokens[1], data)
      const pool = await factory.customPoolByPair(deployer, tokens[0], tokens[1])

      await expect(tx).to.emit(factory, "CustomPool").withArgs(deployerAddress, token0, token1, pool)
      await expect(tx)
        .to.emit(deployer, "BeforeCreatePoolHook")
        .withArgs(pool, wallet.address, deployerAddress, token0, token1, data)
      await expect(tx).to.emit(deployer, "AfterCreatePoolHook").withArgs(plugin, pool, deployerAddress)
      expect(await new ethers.Contract(pool, IAlgebraPoolABI, wallet).plugin()).to.be.eq(plugin)
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
      // the config is uint16, so a flag above the first byte must get through
      const config = 65 | (1 << 8)
      await customPoolDeployer.setPluginConfig(customPoolAddress, config)
      await customPoolDeployer.setFee(customPoolAddress, 300)

      expect(await pool.tickSpacing()).to.be.eq(10)
      expect(await pool.plugin()).to.be.eq(entryPoint)
      expect((await pool.globalState()).lastFee).to.be.eq(300)
      expect((await pool.globalState()).pluginConfig).to.be.eq(config)
    });


    it('custom pool config cannot be changed by other deployer contracts', async () => {
      await customPoolDeployer.createCustomPool(customPoolDeployer, wallet.address, tokens[0], tokens[1], "0x")

      let customPoolAddress = await factory.customPoolByPair(customPoolDeployer, tokens[0], tokens[1])

      const pool = new ethers.Contract(customPoolAddress, IAlgebraPoolABI, wallet);
      await pool.initialize(encodePriceSqrt(1, 1))

      await factory.createPool(tokens[0], tokens[1], "0x")
      const standardPool = await factory.poolByPair(tokens[0], tokens[1])
      const otherDeployer = await (await ethers.getContractFactory('CustomPoolDeployerTest')).deploy(entryPoint, ZERO_ADDRESS)

      // the entry point is a pools administrator, so only its deployer check keeps other pools out of reach
      const cases: [string, any, string][] = [
        ['an EOA, the custom pool', entryPoint, customPoolAddress],
        ['another deployer contract, the custom pool', otherDeployer, customPoolAddress],
        ['the deployer, a standard pool of the same tokens', customPoolDeployer, standardPool],
      ]
      for (const [label, caller, target] of cases) {
        await expect(caller.setTickSpacing(target, 10), label).to.be.revertedWith("Only deployer")
        await expect(caller.setPlugin(target, entryPoint), label).to.be.revertedWith("Only deployer")
        await expect(caller.setPluginConfig(target, 193), label).to.be.revertedWith("Only deployer")
        await expect(caller.setFee(target, 300), label).to.be.revertedWith("Only deployer")
      }
    });

  });

  describe('guards', () => {
    it('cannot be deployed with a zero factory', async () => {
      const entryPointFactory = await ethers.getContractFactory('AlgebraCustomPoolEntryPoint');
      await expect(entryPointFactory.deploy(ZERO_ADDRESS)).to.be.revertedWithoutReason();
    });

    it('pool creation hooks can only be called by the factory', async () => {
      await expect(
        entryPoint.beforeCreatePoolHook(ZERO_ADDRESS, wallet.address, customPoolDeployer, tokens[0], tokens[1], '0x')
      ).to.be.revertedWith('Only factory');
      await expect(entryPoint.afterCreatePoolHook(ZERO_ADDRESS, ZERO_ADDRESS, customPoolDeployer)).to.be.revertedWith(
        'Only factory'
      );
    });
  });
});
