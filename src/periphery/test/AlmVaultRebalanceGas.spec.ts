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

    const vaultFactory = await ethers.getContractFactory('MockAlmVault');
    const vault = await vaultFactory.deploy(nft);

    const token0Addr = await tokens[0].getAddress();
    const token1Addr = await tokens[1].getAddress();

    await vault.initialize(token0Addr, token1Addr);

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

    // Mint a full-range "background" position from wallet to ensure pool has deep
    // liquidity for swaps and price stays stable across rebalance tests
    await nft.mint({
      token0: token0Addr,
      token1: token1Addr,
      deployer: ZERO_ADDRESS,
      tickLower: getMinTick(TICK_SPACING),
      tickUpper: getMaxTick(TICK_SPACING),
      amount0Desired: expandTo18Decimals(10_000),
      amount1Desired: expandTo18Decimals(10_000),
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

  /** Helper: create initial base + limit positions via first rebalance */
  async function setupInitialPositions() {
    // first rebalance creates positions from scratch (basePositionId == 0 → skip dismantle, just mint)
    await vault.rebalance(
      getMinTick(TICK_SPACING),
      getMaxTick(TICK_SPACING),
      -TICK_SPACING * 100,
      -TICK_SPACING * 10
    );
  }

  /** Helper: push swaps through the pool to accrue fees */
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

  // ================================================
  // FIRST REBALANCE (no prior positions → just mints)
  // ================================================

  describe('first rebalance (no prior positions)', () => {
    it('gas: wide base + narrow limit [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        vault.rebalance(
          getMinTick(TICK_SPACING),
          getMaxTick(TICK_SPACING),
          -TICK_SPACING * 100,
          -TICK_SPACING * 10
        )
      );
    });

    it('gas: two narrow ranges [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        vault.rebalance(
          -TICK_SPACING * 10,
          TICK_SPACING * 10,
          TICK_SPACING * 10,
          TICK_SPACING * 100
        )
      );
    });
  });

  // ================================================
  // FULL REBALANCE (dismantle + remint)
  // ================================================

  describe('full rebalance (dismantle + remint)', () => {
    beforeEach('create initial positions', async () => {
      await setupInitialPositions();
    });

    it('gas: rebalance with no fees accrued [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        vault.rebalance(
          -TICK_SPACING * 50,
          TICK_SPACING * 50,
          TICK_SPACING * 10,
          TICK_SPACING * 30
        )
      );
    });

    it('gas: rebalance after swaps (fees accrued) [ @skip-on-coverage ]', async () => {
      await generateFees();
      
      await snapshotGasCost(
        vault.rebalance(
          -TICK_SPACING * 50,
          TICK_SPACING * 5000,
          TICK_SPACING * 10,
          TICK_SPACING * 3000
        )
      );
    });

    it('gas: rebalance to same ticks (re-enter same range) [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        vault.rebalance(
          getMinTick(TICK_SPACING),
          getMaxTick(TICK_SPACING),
          -TICK_SPACING * 100,
          -TICK_SPACING * 10
        )
      );
    });
  });

  // ================================================
  // SINGLE POSITION REBALANCE
  // ================================================

  describe('single position rebalance', () => {
    beforeEach('create initial positions', async () => {
      await setupInitialPositions();
    });

    it('gas: single rebalance, no fees [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        vault.rebalanceSingle(
          -TICK_SPACING * 20,
          TICK_SPACING * 20
        )
      );
    });

    it('gas: single rebalance after swaps [ @skip-on-coverage ]', async () => {
      await generateFees();

      await snapshotGasCost(
        vault.rebalanceSingle(
          -TICK_SPACING * 20,
          TICK_SPACING * 20
        )
      );
    });
  });

  // ================================================
  // REPEATED REBALANCE CYCLES
  // ================================================

  describe('repeated rebalance cycles', () => {
    it('gas: second full rebalance after swaps [ @skip-on-coverage ]', async () => {
      await setupInitialPositions();

      // First rebalance
      await vault.rebalance(
        -TICK_SPACING * 50,
        TICK_SPACING * 50,
        TICK_SPACING * 10,
        TICK_SPACING * 100
      );

      await generateFees();

      // Measure second rebalance
      await snapshotGasCost(
        vault.rebalance(
          -TICK_SPACING * 30,
          TICK_SPACING * 30,
          -TICK_SPACING * 100,
          -TICK_SPACING * 10
        )
      );
    });

    it('gas: third full rebalance [ @skip-on-coverage ]', async () => {
      await setupInitialPositions();

      await vault.rebalance(
        -TICK_SPACING * 50,
        TICK_SPACING * 50,
        TICK_SPACING * 10,
        TICK_SPACING * 100
      );

      await generateFees();

      await vault.rebalance(
        -TICK_SPACING * 30,
        TICK_SPACING * 30,
        -TICK_SPACING * 100,
        -TICK_SPACING * 10
      );

      await generateFees(expandTo18Decimals(500));

    });
  });
});
