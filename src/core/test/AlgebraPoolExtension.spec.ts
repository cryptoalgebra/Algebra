import { ethers } from 'hardhat';
import { Wallet, ZeroHash } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from './shared/expect';
import { poolFixture } from './shared/fixtures';
import { encodePriceSqrt, expandTo18Decimals, getMinTick, getMaxTick, createPoolFunctions, MintFunction } from './shared/utilities';
import { MockTimeAlgebraPool, AlgebraFactory, TestERC20, TestAlgebraCallee, AlgebraPoolExtension } from '../typechain';

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

describe('AlgebraPoolExtension', () => {
  let wallet: Wallet;
  let pool: MockTimeAlgebraPool;
  let factory: AlgebraFactory;
  let token0: TestERC20;
  let token1: TestERC20;
  let swapTarget: TestAlgebraCallee;
  let mint: MintFunction;
  let createPoolWrapped: ThenArg<ReturnType<typeof poolFixture>>['createPool'];

  beforeEach('deploy fixture', async () => {
    [wallet] = await (ethers as any).getSigners();
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
    it('pool has an algebraPoolExtension with code', async () => {
      // a delegatecall to an address without code succeeds and does nothing, so non-zero is not enough
      const extensionAddress = await pool.algebraPoolExtension();
      expect(await ethers.provider.getCode(extensionAddress)).to.not.eq('0x');
    });
  });

  describe('extension stubs revert when called directly', () => {
    let extension: AlgebraPoolExtension;

    beforeEach(async () => {
      // Get the extension contract directly (from factory)
      const extensionAddress = await factory.poolExtension();
      extension = (await ethers.getContractAt('AlgebraPoolExtension', extensionAddress)) as any as AlgebraPoolExtension;
    });

    it('initialize succeeds', async () => {
      await expect(extension.initialize(encodePriceSqrt(1, 1))).to.not.be.reverted;
    });

    it('swap reverts', async () => {
      await expect(extension.swap(wallet.address, true, 100, 0n, '0x')).to.be.revertedWithCustomError(
        extension,
        'notAllowed'
      );
    });

    it('mint reverts', async () => {
      await expect(extension.mint(wallet.address, wallet.address, -100, 100, 1000, '0x')).to.be.revertedWithCustomError(
        extension,
        'notAllowed'
      );
    });

    it('burn reverts', async () => {
      await expect(extension.burn(-100, 100, 0, '0x')).to.be.revertedWithCustomError(extension, 'notAllowed');
    });

    it('collect reverts', async () => {
      await expect(extension.collect(wallet.address, -100, 100, 0, 0)).to.be.revertedWithCustomError(
        extension,
        'notAllowed'
      );
    });

    it('flash reverts', async () => {
      await expect(extension.flash(wallet.address, 0, 0, '0x')).to.be.revertedWithCustomError(extension, 'notAllowed');
    });

    it('sync reverts', async () => {
      await expect(extension.sync()).to.be.revertedWithCustomError(extension, 'notAllowed');
    });

    it('skim reverts', async () => {
      await expect(extension.skim()).to.be.revertedWithCustomError(extension, 'notAllowed');
    });

    it('claimCommunityFee reverts', async () => {
      await expect(extension.claimCommunityFee()).to.be.revertedWithCustomError(extension, 'notAllowed');
    });

    it('swapWithPaymentInAdvance reverts', async () => {
      await expect(
        extension.swapWithPaymentInAdvance(wallet.address, wallet.address, true, 100, 0n, '0x')
      ).to.be.revertedWithCustomError(extension, 'notAllowed');
    });

    it('getReserves reverts', async () => {
      await expect(extension.getReserves()).to.be.revertedWithCustomError(extension, 'notAllowed');
    });

    it('positions reverts', async () => {
      await expect(extension.positions(ZeroHash)).to.be.revertedWithCustomError(extension, 'notAllowed');
    });

    it('tickTreeRoot reverts', async () => {
      await expect(extension.tickTreeRoot()).to.be.revertedWithCustomError(extension, 'notAllowed');
    });

    it('tickTreeSecondLayer reverts', async () => {
      await expect(extension.tickTreeSecondLayer(0)).to.be.revertedWithCustomError(extension, 'notAllowed');
    });
  });
});
