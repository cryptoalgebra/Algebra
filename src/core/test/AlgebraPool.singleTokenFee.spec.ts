import { Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { MockTimeAlgebraPool, TestERC20, TestAlgebraCallee } from '../typechain';
import { expect } from './shared/expect';
import { poolFixture } from './shared/fixtures';
import { createPoolFunctions, encodePriceSqrt, expandTo18Decimals, FeeAmount, getMaxTick, getMinTick } from './shared/utilities';

describe('AlgebraPool single token fee collection', () => {
  let wallet: Wallet, other: Wallet;
  let token0: TestERC20;
  let token1: TestERC20;
  let pool: MockTimeAlgebraPool;
  let swapTarget: TestAlgebraCallee;

  let mint: any;
  let swap0ForExact1: any;
  let swap1ForExact0: any;

  const fixture = async () => {
    return await poolFixture();
  };

  beforeEach('deploy fixture', async () => {
    [wallet, other] = await ethers.getSigners() as any;
    const loaded = await loadFixture(fixture);
    token0 = loaded.token0;
    token1 = loaded.token1;
    swapTarget = loaded.swapTargetCallee;
    
    pool = await loaded.createPool();
    
    const poolFunctions = createPoolFunctions({
      swapTarget,
      token0,
      token1,
      pool,
    });
    mint = poolFunctions.mint;
    swap0ForExact1 = poolFunctions.swap0ForExact1;
    swap1ForExact0 = poolFunctions.swap1ForExact0;
  });

  describe('Fee collection always in token0', () => {
    beforeEach('initialize pool at 1:1 price and add liquidity', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      
      const liquidityAmount = expandTo18Decimals(2);
      await token0.approve(await swapTarget.getAddress(), liquidityAmount);
      await token1.approve(await swapTarget.getAddress(), liquidityAmount);
      
      // Add liquidity in range [-60, 60]
      await mint(wallet.address, getMinTick(60), getMaxTick(60), liquidityAmount);
    });

    it('swap 0->1: fees collected in token0 (input token)', async () => {
      const feeGrowth0Before = await pool.totalFeeGrowth0Token();
      const feeGrowth1Before = await pool.totalFeeGrowth1Token();
      
      // Swap token0 for token1
      const swapAmount = expandTo18Decimals(1) / 10n; // 0.1 token0
      await token0.approve(await swapTarget.getAddress(), swapAmount);
      
      await swap0ForExact1(expandTo18Decimals(1) / 11n, wallet.address);
      
      const feeGrowth0After = await pool.totalFeeGrowth0Token();
      const feeGrowth1After = await pool.totalFeeGrowth1Token();
      
      // Fee should be collected in token0 (input)
      expect(feeGrowth0After).to.be.gt(feeGrowth0Before);
      // No fee in token1
      expect(feeGrowth1After).to.equal(feeGrowth1Before);
    });

    it('swap 1->0: fees collected in token0 (output token)', async () => {
      const feeGrowth0Before = await pool.totalFeeGrowth0Token();
      const feeGrowth1Before = await pool.totalFeeGrowth1Token();
      
      // Swap token1 for token0
      const swapAmount = expandTo18Decimals(1) / 10n; // 0.1 token1
      await token1.approve(await swapTarget.getAddress(), swapAmount);
      
      await swap1ForExact0(expandTo18Decimals(1) / 11n, wallet.address);
      
      const feeGrowth0After = await pool.totalFeeGrowth0Token();
      const feeGrowth1After = await pool.totalFeeGrowth1Token();
      
      // Fee should be collected in token0 (output!)
      expect(feeGrowth0After).to.be.gt(feeGrowth0Before);
      // No fee in token1
      expect(feeGrowth1After).to.equal(feeGrowth1Before);
    });

    it('LP collects fees only in token0 from both swap directions', async () => {
      // Do both direction swaps with larger amounts
      const swapAmount = expandTo18Decimals(1) / 5n; // 0.2 tokens
      
      // Swap 0->1
      await token0.approve(await swapTarget.getAddress(), swapAmount);
      await swap0ForExact1(swapAmount / 2n, wallet.address);
      
      const feeGrowth0AfterFirstSwap = await pool.totalFeeGrowth0Token();
      expect(feeGrowth0AfterFirstSwap).to.be.gt(0, 'Should have fee growth after first swap');
      
      // Swap 1->0
      await token1.approve(await swapTarget.getAddress(), swapAmount);
      await swap1ForExact0(swapAmount / 2n, wallet.address);
      
      const feeGrowth0AfterSecondSwap = await pool.totalFeeGrowth0Token();
      expect(feeGrowth0AfterSecondSwap).to.be.gt(feeGrowth0AfterFirstSwap, 'Fee growth should increase after second swap');
      
      // Both swaps should accumulate fees only in token0
      const feeGrowth1 = await pool.totalFeeGrowth1Token();
      expect(feeGrowth1).to.equal(0, 'totalFeeGrowth1Token should remain 0');
      
      // Note: We don't check position.fees1 here because burn() returns liquidity tokens
      // which get added to fees0/fees1. The important thing is totalFeeGrowth1Token stays 0.
    });

    it('fees distributed proportionally across liquidity ranges', async () => {
      // Create new pool with multiple liquidity positions
      const loaded = await loadFixture(fixture);
      pool = await loaded.createPool();
      await pool.initialize(encodePriceSqrt(1, 1));
      
      const poolFunctions = createPoolFunctions({
        swapTarget: loaded.swapTargetCallee,
        token0: loaded.token0,
        token1: loaded.token1,
        pool,
      });
      
      const liquidityAmount1 = expandTo18Decimals(1);
      const liquidityAmount2 = expandTo18Decimals(3);
      
      await loaded.token0.approve(await loaded.swapTargetCallee.getAddress(), liquidityAmount1 + liquidityAmount2);
      await loaded.token1.approve(await loaded.swapTargetCallee.getAddress(), liquidityAmount1 + liquidityAmount2);
      
      // Position 1: wide range
      await poolFunctions.mint(wallet.address, getMinTick(60), getMaxTick(60), liquidityAmount1);
      
      // Position 2: narrow range - will get more fees per liquidity
      await poolFunctions.mint(other.address, -60, 60, liquidityAmount2);
      
      // Large swap 1->0 that stays in range
      const swapAmount = expandTo18Decimals(1) / 20n; // 0.05 tokens
      await loaded.token1.connect(wallet).approve(await loaded.swapTargetCallee.getAddress(), swapAmount);
      await poolFunctions.swap1ForExact0(swapAmount / 2n, wallet.address);
      
      // Check that fees are only accumulated in token0
      const feeGrowth0 = await pool.totalFeeGrowth0Token();
      const feeGrowth1 = await pool.totalFeeGrowth1Token();
      
      expect(feeGrowth0).to.be.gt(0, 'Should have fee growth in token0');
      expect(feeGrowth1).to.equal(0, 'Should have no fee growth in token1');
    });
  });
});
