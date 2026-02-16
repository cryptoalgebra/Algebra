import { Wallet, MaxUint256, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  MockTimeNonfungiblePositionManager,
  TestERC20,
  IAlgebraFactory,
  SwapRouter,
} from '../typechain';
import completeFixture from './shared/completeFixture';
import { FeeAmount, TICK_SPACINGS } from './shared/constants';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { expect } from './shared/expect';
import snapshotGasCost from './shared/snapshotGasCost';
import { getMaxTick, getMinTick } from './shared/ticks';
import { expandTo18Decimals } from './shared/expandTo18Decimals';
import { encodePath } from './shared/path';
import { ZERO_ADDRESS } from './CallbackValidation.spec';

describe('ALM Vault Rebalance Gas', () => {
  let wallet: Wallet;

  const TICK_SPACING = TICK_SPACINGS[FeeAmount.MEDIUM];

  const almFixture = async () => {
    const { factory, tokens, nft, router } = await completeFixture();

    const token0Addr = await tokens[0].getAddress();
    const token1Addr = await tokens[1].getAddress();

    const vaultFactory = await ethers.getContractFactory('MockAlmVault');
    const vault = await vaultFactory.deploy(nft, token0Addr, token1Addr);

    await nft.createAndInitializePoolIfNecessary(
      tokens[0],
      tokens[1],
      ZERO_ADDRESS,
      encodePriceSqrt(1, 1),
      '0x'
    );

    for (const token of [tokens[0], tokens[1]]) {
      await token.approve(nft.getAddress(), MaxUint256);
      await token.approve(router.getAddress(), MaxUint256);
      await token.transfer(await vault.getAddress(), expandTo18Decimals(100_000));
    }

    await nft.mint({
      token0: token0Addr,
      token1: token1Addr,
      deployer: ZERO_ADDRESS,
      tickLower: getMinTick(TICK_SPACING),
      tickUpper: getMaxTick(TICK_SPACING),
      amount0Desired: expandTo18Decimals(100_000),
      amount1Desired: expandTo18Decimals(100_000),
      amount0Min: 0,
      amount1Min: 0,
      recipient: wallet.address,
      deadline: 1,
    });

    return { factory, tokens, nft, router, vault };
  };

  let factory: IAlgebraFactory;
  let nft: MockTimeNonfungiblePositionManager;
  let tokens: [TestERC20, TestERC20, TestERC20];
  let router: SwapRouter;
  let vault: any;

  before('get wallets', async () => {
    [wallet] = await (ethers as any).getSigners();
  });

  beforeEach('load fixture', async () => {
    ({ factory, tokens, nft, router, vault } = await loadFixture(almFixture));
  });

  async function setupTwoPositions() {
    await vault.rebalance(-1800, 60, 60, 3600);
  }

  async function setupSinglePosition() {
    await vault.rebalanceSingle(-1800, 1800);
  }

  async function generateFees(amount: bigint = expandTo18Decimals(1000)) {
    await router.exactInput({
      recipient: wallet.address,
      deadline: 1,
      path: encodePath([
        await tokens[0].getAddress(),
        ZERO_ADDRESS,
        await tokens[1].getAddress(),
      ]),
      amountIn: amount,
      amountOutMinimum: 0,
    });

    await router.exactInput({
      recipient: wallet.address,
      deadline: 1,
      path: encodePath([
        await tokens[1].getAddress(),
        ZERO_ADDRESS,
        await tokens[0].getAddress(),
      ]),
      amountIn: amount / 2n,
      amountOutMinimum: 0,
    });
  }

  describe('first rebalance (no prior positions)', () => {
    it('gas: first rebalance, 2 pos (base + limit) [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        vault.rebalance(-1800, 60, 60, 3600)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.not.equal(0);
    });

    it('gas: first rebalance, 1 pos (rebalanceSingle) [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        vault.rebalanceSingle(-1800, 1800)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.equal(0);
    });
  });


  describe('rebalance 2 pos (dismantle + mint)', () => {
    beforeEach('create initial 2 positions', async () => {
      await setupTwoPositions();
    });

    it('gas: no fees [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        vault.rebalance(-1200, 60, 60, 1200)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.not.equal(0);
    });

    it('gas: same ticks [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        vault.rebalance(-1800, 60, 60, 3600)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.not.equal(0);
    });

    it('gas: after swaps [ @skip-on-coverage ]', async () => {
      await generateFees();

      await snapshotGasCost(
        vault.rebalance(-1200, 60, 60, 1200)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.not.equal(0);
    });
  });

  describe('rebalance 2 pos optimized (rebalanceMultiple)', () => {
    beforeEach('create initial 2 positions', async () => {
      await setupTwoPositions();
    });

    it('gas: no fees [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        vault.rebalanceOptimized(-1200, 60, 60, 1200)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.not.equal(0);
    });

    it('gas: after swaps [ @skip-on-coverage ]', async () => {
      await generateFees();

      await snapshotGasCost(
        vault.rebalanceOptimized(-1200, 60, 60, 1200)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.not.equal(0);
    });

    it('gas:  same ticks [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        vault.rebalanceOptimized(-1800, 60, 60, 3600)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.not.equal(0);
    });
  });

  describe('rebalance 1 pos (dismantle + mint)', () => {
    beforeEach('create initial 1 position', async () => {
      await setupSinglePosition();
    });

    it('gas: no fees [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        vault.rebalanceSingle(-1200, 1200)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.equal(0);
    });

    it('gas: after swaps [ @skip-on-coverage ]', async () => {
      await generateFees();

      await snapshotGasCost(
        vault.rebalanceSingle(-1200, 1200)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.equal(0);
    });
  });

  describe('rebalance 1 pos optimized (NFPM.rebalance)', () => {
    beforeEach('create initial 1 position', async () => {
      await setupSinglePosition();
    });

    it('gas: no fees [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        vault.rebalanceSingleOptimized(-1200, 1200)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.equal(0);
    });

    it('gas: after swaps [ @skip-on-coverage ]', async () => {
      await generateFees();

      await snapshotGasCost(
        vault.rebalanceSingleOptimized(-1200, 1200)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.equal(0);
    });
  });


  describe('repeated 2 pos rebalance (old)', () => {
    it('gas: second 2 pos rebalance, after swaps [ @skip-on-coverage ]', async () => {
      await setupTwoPositions();

      await vault.rebalance(-1200, 60, 60, 1200);

      await generateFees();

      await snapshotGasCost(
        vault.rebalance(-1800, 60, 60, 3600)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.not.equal(0);
    });

    it('gas: third 2 pos rebalance [ @skip-on-coverage ]', async () => {
      await setupTwoPositions();

      await vault.rebalance(-1200, 60, 60, 1200);
      await generateFees();

      await vault.rebalance(-1800, 60, 60, 3600);
      await generateFees(expandTo18Decimals(500));

      await snapshotGasCost(
        vault.rebalance(-1200, 60, 60, 1200)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.not.equal(0);
    });
  });

  describe('repeated 2 pos rebalance (optimized)', () => {
    it('gas: after swaps [ @skip-on-coverage ]', async () => {
      await setupTwoPositions();

      await vault.rebalance(-1200, 60, 60, 1200);

      await generateFees();

      await snapshotGasCost(
        vault.rebalanceOptimized(-1800, 60, 60, 3600)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.not.equal(0);
    });

    it('gas: 3th rebalance [ @skip-on-coverage ]', async () => {
      await setupTwoPositions();

      await vault.rebalance(-1200, 60, 60, 1200);
      await generateFees();

      await vault.rebalanceOptimized(-1800, 60, 60, 3600);
      await generateFees(expandTo18Decimals(500));

      await snapshotGasCost(
        vault.rebalanceOptimized(-1200, 60, 60, 1200)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.not.equal(0);
    });
  });

  describe('repeated 1 pos rebalance', () => {
    it('gas: after swaps [ @skip-on-coverage ]', async () => {
      await setupSinglePosition();

      await vault.rebalanceSingle(-1200, 1200);

      await generateFees();

      await snapshotGasCost(
        vault.rebalanceSingle(-1800, 1800)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.equal(0);
    });
  });

  describe('repeated 1 pos rebalance (optimized)', () => {
    it('gas: after swaps [ @skip-on-coverage ]', async () => {
      await setupSinglePosition();

      await vault.rebalanceSingle(-1200, 1200);

      await generateFees();

      await snapshotGasCost(
        vault.rebalanceSingleOptimized(-1800, 1800)
      );

      expect(await vault.basePositionId()).to.not.equal(0);
      expect(await vault.limitPositionId()).to.equal(0);
    });
  });
});
