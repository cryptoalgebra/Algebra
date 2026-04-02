import { ethers } from 'hardhat';
import { Wallet, ZeroAddress } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from './shared/expect';
import { poolFixture } from './shared/fixtures';
import { encodePriceSqrt, expandTo18Decimals, getMinTick, getMaxTick, createPoolFunctions, MintFunction } from './shared/utilities';
import { MockTimeAlgebraPool, AlgebraFactory, TestERC20, TestAlgebraCallee, AlgebraPoolExtension } from '../typechain';

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

describe('AlgebraPoolExtension', () => {
  let wallet: Wallet, other: Wallet;
  let pool: MockTimeAlgebraPool;
  let factory: AlgebraFactory;
  let token0: TestERC20;
  let token1: TestERC20;
  let swapTarget: TestAlgebraCallee;
  let mint: MintFunction;
  let createPoolWrapped: ThenArg<ReturnType<typeof poolFixture>>['createPool'];

  beforeEach('deploy fixture', async () => {
    [wallet, other] = await (ethers as any).getSigners();
    let _createPool: ThenArg<ReturnType<typeof poolFixture>>['createPool'];
    ({
      token0,
      token1,
      factory,
      createPool: _createPool,
      swapTargetCallee: swapTarget,
    } = await loadFixture(poolFixture));

    createPoolWrapped = _createPool;
    pool = await createPoolWrapped();
    ({ mint } = createPoolFunctions({ token0, token1, swapTarget, pool }));

    await pool.initialize(encodePriceSqrt(1, 1));
    const minTick = getMinTick(60);
    const maxTick = getMaxTick(60);
    await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1000));
  });

  describe('extension deployment', () => {
    it('factory deploys poolExtension in constructor', async () => {
      const extensionAddress = await factory.poolExtension();
      expect(extensionAddress).to.not.eq(ZeroAddress);
    });

    it('pool has non-zero algebraPoolExtension', async () => {
      const extensionAddress = await pool.algebraPoolExtension();
      expect(extensionAddress).to.not.eq(ZeroAddress);
    });
  });

  describe('delegated setters modify pool storage', () => {
    it('setCommunityFee changes pool state', async () => {
      await pool.setCommunityFee(170);
      expect((await pool.globalState()).communityFee).to.eq(170);
    });

    it('setTickSpacing changes pool state', async () => {
      await pool.setTickSpacing(100);
      expect(await pool.tickSpacing()).to.eq(100);
    });

    it('setFee changes pool state', async () => {
      await pool.setFee(500);
      expect((await pool.globalState()).lastFee).to.eq(500);
    });

    it('setPlugin changes pool state', async () => {
      const pluginAddress = wallet.address;
      await pool.setPlugin(pluginAddress);
      expect(await pool.plugin()).to.eq(pluginAddress);
      // setPlugin also resets pluginConfig
      expect((await pool.globalState()).pluginConfig).to.eq(0);
    });
  });

  describe('delegated setters emit correct events', () => {
    it('setCommunityFee emits CommunityFee', async () => {
      await expect(pool.setCommunityFee(170)).to.emit(pool, 'CommunityFee').withArgs(170);
    });

    it('setTickSpacing emits TickSpacing', async () => {
      await expect(pool.setTickSpacing(100)).to.emit(pool, 'TickSpacing').withArgs(100);
    });

    it('setFee emits Fee', async () => {
      await expect(pool.setFee(500)).to.emit(pool, 'Fee').withArgs(500);
    });

    it('setPlugin emits Plugin', async () => {
      await expect(pool.setPlugin(wallet.address)).to.emit(pool, 'Plugin').withArgs(wallet.address);
    });
  });

  describe('permission checks through delegation', () => {
    it('setCommunityFee reverts for non-admin', async () => {
      await expect(pool.connect(other).setCommunityFee(170)).to.be.reverted;
    });

    it('setTickSpacing reverts for non-admin', async () => {
      await expect(pool.connect(other).setTickSpacing(100)).to.be.reverted;
    });

    it('setFee reverts for non-admin', async () => {
      await expect(pool.connect(other).setFee(500)).to.be.reverted;
    });

    it('setPlugin reverts for non-admin', async () => {
      await expect(pool.connect(other).setPlugin(wallet.address)).to.be.reverted;
    });

    it('setCommunityVault reverts for non-admin', async () => {
      await expect(pool.connect(other).setCommunityVault(wallet.address)).to.be.reverted;
    });

    it('setPluginConfig reverts for non-admin (no plugin)', async () => {
      await expect(pool.connect(other).setPluginConfig(1)).to.be.reverted;
    });
  });

  describe('extension stubs revert when called directly', () => {
    let extension: AlgebraPoolExtension;

    beforeEach(async () => {
      // Get the extension contract directly (from factory)
      const extensionAddress = await factory.poolExtension();
      extension = (await ethers.getContractAt('AlgebraPoolExtension', extensionAddress)) as any as AlgebraPoolExtension;
    });

    it('initialize reverts', async () => {
      await expect(extension.initialize(encodePriceSqrt(1, 1))).to.be.reverted;
    });

    it('swap reverts', async () => {
      await expect(extension.swap(wallet.address, true, 100, 0n, '0x')).to.be.reverted;
    });

    it('mint reverts', async () => {
      await expect(extension.mint(wallet.address, wallet.address, -100, 100, 1000, '0x')).to.be.reverted;
    });

    it('burn reverts', async () => {
      await expect(extension.burn(-100, 100, 0, '0x')).to.be.reverted;
    });

    it('collect reverts', async () => {
      await expect(extension.collect(wallet.address, -100, 100, 0, 0)).to.be.reverted;
    });

    it('flash reverts', async () => {
      await expect(extension.flash(wallet.address, 0, 0, '0x')).to.be.reverted;
    });

    it('sync reverts', async () => {
      await expect(extension.sync()).to.be.reverted;
    });

    it('skim reverts', async () => {
      await expect(extension.skim()).to.be.reverted;
    });
  });

  describe('validation logic through delegation', () => {
    it('setCommunityFee reverts for invalid value', async () => {
      await expect(pool.setCommunityFee(1001)).to.be.reverted;
    });

    it('setCommunityFee reverts for same value', async () => {
      await pool.setCommunityFee(170);
      await expect(pool.setCommunityFee(170)).to.be.reverted;
    });

    it('setTickSpacing reverts for zero', async () => {
      await expect(pool.setTickSpacing(0)).to.be.reverted;
    });

    it('setTickSpacing reverts for negative', async () => {
      await expect(pool.setTickSpacing(-1)).to.be.reverted;
    });

    it('setTickSpacing reverts for same value', async () => {
      await expect(pool.setTickSpacing(60)).to.be.reverted;
    });
  });
});
