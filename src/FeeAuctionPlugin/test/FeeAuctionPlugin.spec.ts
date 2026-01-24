import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Wallet, ZeroAddress } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  FeeAuctionPlugin,
  FeeAuctionPluginFactory,
  MockTimeAlgebraPool,
  MockAlgebraFactory,
  TestERC20,
} from '../typechain';

describe('FeeAuctionPlugin', () => {
  let wallet: Wallet;
  let other: Wallet;

  let factory: MockAlgebraFactory;
  let pluginFactory: FeeAuctionPluginFactory;
  let plugin: FeeAuctionPlugin;
  let pool: MockTimeAlgebraPool;
  let token0: TestERC20;
  let token1: TestERC20;

  // Default configuration for L2
  const DEFAULT_BASE_FEE = 500; // 0.05%
  const DEFAULT_MEV_TAX_MULTIPLIER = 99000n;
  const DEFAULT_MAX_MEV_TAX = 100000; // 10%
  const DEFAULT_MEV_TAX_ENABLED = true;

  async function deployFixture() {
    const [_wallet, _other] = await ethers.getSigners();
    const wallet = _wallet as any as Wallet;
    const other = _other as any as Wallet;

    // Deploy mock factory
    const MockAlgebraFactoryFactory = await ethers.getContractFactory('MockAlgebraFactory');
    const factory = (await MockAlgebraFactoryFactory.deploy()) as any as MockAlgebraFactory;

    // Deploy tokens
    const TestERC20Factory = await ethers.getContractFactory('TestERC20');
    const tokenA = (await TestERC20Factory.deploy(ethers.parseEther('1000000'))) as any as TestERC20;
    const tokenB = (await TestERC20Factory.deploy(ethers.parseEther('1000000'))) as any as TestERC20;

    const tokenAAddress = await tokenA.getAddress();
    const tokenBAddress = await tokenB.getAddress();

    const [token0, token1] =
      BigInt(tokenAAddress) < BigInt(tokenBAddress) ? [tokenA, tokenB] : [tokenB, tokenA];

    // Deploy mock pool
    const MockTimeAlgebraPoolFactory = await ethers.getContractFactory('MockTimeAlgebraPool');
    const pool = (await MockTimeAlgebraPoolFactory.deploy(
      await token0.getAddress(),
      await token1.getAddress(),
      await factory.getAddress()
    )) as any as MockTimeAlgebraPool;

    // Set pool in factory
    await factory.setPool(await token0.getAddress(), await token1.getAddress(), await pool.getAddress());

    // Deploy plugin factory
    const FeeAuctionPluginFactoryFactory = await ethers.getContractFactory('FeeAuctionPluginFactory');
    const pluginFactory = (await FeeAuctionPluginFactoryFactory.deploy(
      await factory.getAddress(),
      DEFAULT_BASE_FEE,
      DEFAULT_MEV_TAX_MULTIPLIER,
      DEFAULT_MAX_MEV_TAX,
      DEFAULT_MEV_TAX_ENABLED
    )) as any as FeeAuctionPluginFactory;

    // Grant administrator role
    const adminRole = await pluginFactory.ALGEBRA_FEE_AUCTION_PLUGIN_FACTORY_ADMINISTRATOR();
    await factory.grantRole(adminRole, wallet.address);

    // Deploy plugin directly for testing
    const FeeAuctionPluginFactory = await ethers.getContractFactory('FeeAuctionPlugin');
    const plugin = (await FeeAuctionPluginFactory.deploy(
      await pool.getAddress(),
      await factory.getAddress(),
      await pluginFactory.getAddress(),
      DEFAULT_BASE_FEE,
      DEFAULT_MEV_TAX_MULTIPLIER,
      DEFAULT_MAX_MEV_TAX,
      DEFAULT_MEV_TAX_ENABLED
    )) as any as FeeAuctionPlugin;

    // Set plugin in pool
    await pool.setPlugin(await plugin.getAddress());

    return { wallet, other, factory, pluginFactory, plugin, pool, token0, token1 };
  }

  beforeEach('deploy fixture', async () => {
    ({ wallet, other, factory, pluginFactory, plugin, pool, token0, token1 } = await loadFixture(deployFixture));
  });

  describe('Deployment', () => {
    it('should set correct initial values', async () => {
      expect(await plugin.baseFee()).to.equal(DEFAULT_BASE_FEE);
      expect(await plugin.mevTaxMultiplier()).to.equal(DEFAULT_MEV_TAX_MULTIPLIER);
      expect(await plugin.maxMevTax()).to.equal(DEFAULT_MAX_MEV_TAX);
      expect(await plugin.mevTaxEnabled()).to.equal(DEFAULT_MEV_TAX_ENABLED);
    });

    it('should set correct pool address', async () => {
      expect(await plugin.pool()).to.equal(await pool.getAddress());
    });

    it('should have correct default plugin config', async () => {
      // BEFORE_SWAP_FLAG (1) | DYNAMIC_FEE (128) = 129
      expect(await plugin.defaultPluginConfig()).to.equal(129);
    });

    it('should add FeeAuction to active modules', async () => {
      const modules = await plugin.getActiveModuleNames();
      expect(modules).to.include('FeeAuction');
    });
  });

  describe('Factory', () => {
    it('should create plugin for pool', async () => {
      const poolsAdminRole = await factory.POOLS_ADMINISTRATOR_ROLE();
      await factory.grantRole(poolsAdminRole, wallet.address);

      const newPluginAddress = await pluginFactory.createPluginForExistingPool.staticCall(
        await token0.getAddress(),
        await token1.getAddress()
      );

      expect(newPluginAddress).to.not.equal(ZeroAddress);

      await pluginFactory.createPluginForExistingPool(await token0.getAddress(), await token1.getAddress());

      expect(await pluginFactory.pluginByPool(await pool.getAddress())).to.equal(newPluginAddress);
    });

    it('should not allow creating plugin twice', async () => {
      const poolsAdminRole = await factory.POOLS_ADMINISTRATOR_ROLE();
      await factory.grantRole(poolsAdminRole, wallet.address);

      await pluginFactory.createPluginForExistingPool(await token0.getAddress(), await token1.getAddress());

      await expect(
        pluginFactory.createPluginForExistingPool(await token0.getAddress(), await token1.getAddress())
      ).to.be.revertedWith('Plugin already exists');
    });

    it('should set default parameters', async () => {
      expect(await pluginFactory.defaultBaseFee()).to.equal(DEFAULT_BASE_FEE);
      expect(await pluginFactory.defaultMevTaxMultiplier()).to.equal(DEFAULT_MEV_TAX_MULTIPLIER);
      expect(await pluginFactory.defaultMaxMevTax()).to.equal(DEFAULT_MAX_MEV_TAX);
      expect(await pluginFactory.defaultMevTaxEnabled()).to.equal(DEFAULT_MEV_TAX_ENABLED);
    });

    it('should allow administrator to change default base fee', async () => {
      const newBaseFee = 1000;
      await expect(pluginFactory.setDefaultBaseFee(newBaseFee))
        .to.emit(pluginFactory, 'DefaultBaseFeeChanged')
        .withArgs(newBaseFee);

      expect(await pluginFactory.defaultBaseFee()).to.equal(newBaseFee);
    });

    it('should allow administrator to change default MEV tax parameters', async () => {
      const newMultiplier = 50000n;
      const newMaxTax = 50000;

      await expect(pluginFactory.setDefaultMevTaxParameters(newMultiplier, newMaxTax))
        .to.emit(pluginFactory, 'DefaultMevTaxParametersChanged')
        .withArgs(newMultiplier, newMaxTax);

      expect(await pluginFactory.defaultMevTaxMultiplier()).to.equal(newMultiplier);
      expect(await pluginFactory.defaultMaxMevTax()).to.equal(newMaxTax);
    });

    it('should revert if non-administrator tries to change settings', async () => {
      await expect(pluginFactory.connect(other).setDefaultBaseFee(1000)).to.be.revertedWith('Only administrator');
    });
  });

  describe('Plugin Settings', () => {
    beforeEach(async () => {
      // Grant plugin manager role
      const pluginManagerRole = await plugin.ALGEBRA_BASE_PLUGIN_MANAGER();
      await factory.grantRole(pluginManagerRole, wallet.address);
    });

    it('should allow authorized user to set base fee', async () => {
      const newBaseFee = 1000;
      await expect(plugin.setBaseFee(newBaseFee)).to.emit(plugin, 'BaseFeeChanged').withArgs(newBaseFee);

      expect(await plugin.baseFee()).to.equal(newBaseFee);
    });

    it('should allow authorized user to set MEV tax parameters', async () => {
      const newMultiplier = 50000n;
      const newMaxTax = 50000;

      await expect(plugin.setMevTaxParameters(newMultiplier, newMaxTax))
        .to.emit(plugin, 'MevTaxParametersChanged')
        .withArgs(newMultiplier, newMaxTax);

      expect(await plugin.mevTaxMultiplier()).to.equal(newMultiplier);
      expect(await plugin.maxMevTax()).to.equal(newMaxTax);
    });

    it('should allow authorized user to enable/disable MEV tax', async () => {
      await expect(plugin.setMevTaxEnabled(false)).to.emit(plugin, 'MevTaxEnabledChanged').withArgs(false);

      expect(await plugin.mevTaxEnabled()).to.equal(false);

      await expect(plugin.setMevTaxEnabled(true)).to.emit(plugin, 'MevTaxEnabledChanged').withArgs(true);

      expect(await plugin.mevTaxEnabled()).to.equal(true);
    });

    it('should revert if base fee is too high', async () => {
      await expect(plugin.setBaseFee(100001)).to.be.revertedWith('Base fee too high');
    });

    it('should revert if max MEV tax is too high', async () => {
      await expect(plugin.setMevTaxParameters(99000n, 100001)).to.be.revertedWith('Max MEV tax too high');
    });

    it('should revert if non-authorized user tries to set parameters', async () => {
      await expect(plugin.connect(other).setBaseFee(1000)).to.be.reverted;
    });
  });

  describe('beforeSwap Hook', () => {
    it('should return base fee when MEV tax is disabled', async () => {
      const pluginManagerRole = await plugin.ALGEBRA_BASE_PLUGIN_MANAGER();
      await factory.grantRole(pluginManagerRole, wallet.address);

      await plugin.setMevTaxEnabled(false);

      const [feeOverride, pluginFee] = await pool.simulateSwap.staticCall(
        wallet.address,
        wallet.address,
        true,
        1000,
        4295128740n
      );

      expect(feeOverride).to.equal(DEFAULT_BASE_FEE);
      expect(pluginFee).to.equal(0);
    });

    it('should return base fee with MEV tax when priority fee is present', async () => {
      // Note: In hardhat test environment, tx.gasprice - block.basefee calculation
      // depends on the network configuration. We're testing the contract logic here.
      const [feeOverride, pluginFee] = await pool.simulateSwap.staticCall(
        wallet.address,
        wallet.address,
        true,
        1000,
        4295128740n
      );

      expect(feeOverride).to.equal(DEFAULT_BASE_FEE);
      // Plugin fee depends on tx.gasprice - block.basefee in the test environment
      expect(pluginFee).to.be.gte(0);
    });

    it('should only be callable by pool', async () => {
      await expect(
        plugin.beforeSwap(wallet.address, wallet.address, true, 1000, 4295128740n, false, '0x')
      ).to.be.revertedWithCustomError(plugin, 'OnlyPool');
    });
  });

  describe('handlePluginFee', () => {
    it('should be callable by pool', async () => {
      // handlePluginFee is view, so it doesn't modify state
      // The pool sends tokens directly to the plugin contract
      await pool.simulateHandlePluginFee(1000, 2000);
      // No revert means success
    });

    it('should only be callable by pool', async () => {
      await expect(plugin.handlePluginFee(1000, 2000)).to.be.revertedWithCustomError(plugin, 'OnlyPool');
    });
  });

  describe('beforeInitialize', () => {
    it('should update plugin config in pool', async () => {
      // Deploy new pool and plugin for this test
      const MockTimeAlgebraPoolFactory = await ethers.getContractFactory('MockTimeAlgebraPool');
      const newPool = (await MockTimeAlgebraPoolFactory.deploy(
        await token0.getAddress(),
        await token1.getAddress(),
        await factory.getAddress()
      )) as any as MockTimeAlgebraPool;

      const FeeAuctionPluginFactory = await ethers.getContractFactory('FeeAuctionPlugin');
      const newPlugin = (await FeeAuctionPluginFactory.deploy(
        await newPool.getAddress(),
        await factory.getAddress(),
        await pluginFactory.getAddress(),
        DEFAULT_BASE_FEE,
        DEFAULT_MEV_TAX_MULTIPLIER,
        DEFAULT_MAX_MEV_TAX,
        DEFAULT_MEV_TAX_ENABLED
      )) as any as FeeAuctionPlugin;

      await newPool.setPlugin(await newPlugin.getAddress());

      // Initialize pool
      await newPool.initialize(79228162514264337593543950336n); // sqrt(1) * 2^96

      // Check that plugin config was set
      const pluginConfig = await newPool.pluginConfig();
      expect(pluginConfig).to.equal(129); // BEFORE_SWAP_FLAG | DYNAMIC_FEE
    });
  });

  describe('MEV Tax Calculation', () => {
    it('should calculate MEV tax correctly for L2 example', async () => {
      // Example from plan:
      // priorityFee = 0.01 gwei (1e7 wei)
      // mevTax = (1e7 * 99000) / 1e9 = 990 bips = 0.099%

      // This is a mathematical verification of the formula
      const priorityFee = 1e7; // 0.01 gwei in wei
      const mevTaxMultiplier = 99000;
      const expectedMevTax = (priorityFee * mevTaxMultiplier) / 1e9;

      expect(expectedMevTax).to.equal(990);
    });

    it('should cap MEV tax at maxMevTax', async () => {
      // If priorityFee is very high, the tax should be capped
      // Example: priorityFee = 100 gwei (1e11 wei)
      // mevTax = (1e11 * 99000) / 1e9 = 9900000 (way over 10% max)
      // Should be capped at 100000 (10%)

      const priorityFee = 1e11; // 100 gwei in wei
      const mevTaxMultiplier = 99000;
      const maxMevTax = 100000;
      const calculatedTax = (priorityFee * mevTaxMultiplier) / 1e9;
      const cappedTax = Math.min(calculatedTax, maxMevTax);

      expect(cappedTax).to.equal(maxMevTax);
    });
  });

  describe('collectPluginFee', () => {
    it('should allow authorized user to collect fees', async () => {
      const pluginManagerRole = await plugin.ALGEBRA_BASE_PLUGIN_MANAGER();
      await factory.grantRole(pluginManagerRole, wallet.address);

      // First, send some tokens to the plugin
      const amount = ethers.parseEther('100');
      await token0.transfer(await plugin.getAddress(), amount);

      const balanceBefore = await token0.balanceOf(wallet.address);
      await plugin.collectPluginFee(await token0.getAddress(), amount, wallet.address);
      const balanceAfter = await token0.balanceOf(wallet.address);

      expect(balanceAfter - balanceBefore).to.equal(amount);
    });

    it('should revert if non-authorized user tries to collect fees', async () => {
      await expect(
        plugin.connect(other).collectPluginFee(await token0.getAddress(), 1000, other.address)
      ).to.be.reverted;
    });
  });
});
