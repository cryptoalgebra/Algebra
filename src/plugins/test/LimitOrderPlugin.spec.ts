import { Wallet, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { expect } from './shared/expect';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { limitOrderPluginFixture } from './shared/fixtures';
import { encodePriceSqrt, expandTo18Decimals} from './shared/utilities';

import { LimitOrderPlugin, BasePluginV1Factory, TestERC20 } from '../typechain';

import snapshotGasCost from './shared/snapshotGasCost';
import { AlgebraPool, AlgebraPoolSwapTest__factory, TestAlgebraCallee } from '@cryptoalgebra/core/typechain';
import { token } from '../typechain/@openzeppelin/contracts';
import { exitProcess } from 'yargs';

describe('LimitOrders', () => {
  let wallet: Wallet, other: Wallet;

  let loPlugin: LimitOrderPlugin
  let pool: AlgebraPool; 
  let pluginFactory: BasePluginV1Factory; 
  let token0: TestERC20;
  let token1: TestERC20;
  let swapTarget: TestAlgebraCallee;
  let poolKey: {token0: string, token1: string};
 

  async function initializeAtZeroTick(_pool: AlgebraPool) {
    await _pool.initialize(encodePriceSqrt(1, 1));
  }

  before('prepare signers', async () => {
    [wallet, other] = await (ethers as any).getSigners();
  });

  beforeEach('deploy test limitOrderPlugin', async () => {
    ({ pluginFactory, loPlugin, token0, token1, pool, swapTarget } = await loadFixture(limitOrderPluginFixture));

    poolKey = {token0: await token0.getAddress(), token1: await token1.getAddress()}
    
    await initializeAtZeroTick(pool);

    await token0.approve(loPlugin, 2n**255n);
    await token1.approve(loPlugin, 2n**255n);

    await token0.approve(swapTarget, 2n**255n);
    await token1.approve(swapTarget, 2n**255n);


    await token0.connect(other).approve(loPlugin, 2n**255n);
    await token1.connect(other).approve(loPlugin, 2n**255n);

    await token0.transfer(other, 10n**10n)
    await token1.transfer(other, 10n**10n)

    await swapTarget.mint(pool, wallet, -600, 600, 10n**8n)
    await swapTarget.mint(pool, wallet, -300, 300, 10n**8n)
  });

  describe('#place', async () => {

    describe('works correct', async () => {

      it('place lo at negative tick', async () => {
          await loPlugin.place(poolKey, -60, false, 10n**8n);

          const {filled, tickLower, tickUpper, liquidityTotal, token0 : token0address,  token1 : token1address, token0Total, token1Total} = await loPlugin.epochInfos(1);

          expect(filled).to.be.eq(false);
          expect(tickLower).to.be.eq(-60);
          expect(tickUpper).to.be.eq(0);
          expect(liquidityTotal).to.be.eq(10n**8n);
          expect(token0address).to.be.eq(await token0.getAddress());
          expect(token1address).to.be.eq(await token1.getAddress());
          expect(token0Total).to.be.eq(1);
          expect(token1Total).to.be.eq(0);

          expect( await loPlugin.getEpochLiquidity(1, wallet)).to.be.eq(10n**8n);
      });

      it('place lo at positive tick', async () => {
        await loPlugin.place(poolKey, 60, true, 10n**8n);

        const {tickLower, tickUpper, liquidityTotal} = await loPlugin.epochInfos(1);

        expect(tickLower).to.be.eq(60);
        expect(tickUpper).to.be.eq(120);
        expect(liquidityTotal).to.be.eq(10n**8n);
      });

      it('create new lo at same tick', async () => {
        await loPlugin.place(poolKey, -60, false, 10n**8n);
        await loPlugin.connect(other).place(poolKey, -60, false, 10n**8n);

        const {tickLower, tickUpper, liquidityTotal} = await loPlugin.epochInfos(1);

        expect(tickLower).to.be.eq(-60);
        expect(tickUpper).to.be.eq(0);
        expect(liquidityTotal).to.be.eq(2n * 10n**8n);

        expect( await loPlugin.getEpochLiquidity(1, wallet)).to.be.eq(10n**8n);
        expect( await loPlugin.getEpochLiquidity(1, other)).to.be.eq(10n**8n);
      });

      it('gas [ @skip-on-coverage ]', async () => {
        await snapshotGasCost(loPlugin.place(poolKey, -60, false, 10n**8n));
      });

      it('gas second place at same tick [ @skip-on-coverage ]', async () => {
        await loPlugin.place(poolKey, -60, false, 10n**8n);
        await snapshotGasCost(loPlugin.place(poolKey, -60, false, 10n**8n));
      });

    });

    describe('reverts if', async () => {

      it('pass incorrect zeroToOne ', async () => {
        await expect(loPlugin.place(poolKey, -60, true, 10n**8n)).to.be.revertedWithCustomError(loPlugin,"CrossedRange()");
        await expect(loPlugin.place(poolKey, 60, false, 10n**8n)).to.be.revertedWithCustomError(loPlugin,"CrossedRange()");
      });

      it('try to place active pos', async () => {
        await swapTarget.swapToLowerSqrtPrice(pool, encodePriceSqrt(999,1000), wallet);
        await expect(loPlugin.place(poolKey, -60, false, 10n**8n)).to.be.revertedWithCustomError(loPlugin,"InRange()");
      });
      
      it('try to place 0 liquidity lo', async () => {
        await expect(loPlugin.place(poolKey, -60, false, 0)).to.be.revertedWithCustomError(loPlugin,"ZeroLiquidity()");
      });
    });

  });

  describe('#after swap', async () => {

    it('cross & close lo zeroToOne false', async () => {
        await loPlugin.place(poolKey, -60, false, 10n**8n);
        await swapTarget.swapToLowerSqrtPrice(pool, encodePriceSqrt(98,100), wallet);

        const {filled, liquidityTotal, token0Total, token1Total} = await loPlugin.epochInfos(1);

        expect(filled).to.be.eq(true);
        expect(liquidityTotal).to.be.eq(10n**8n);
        expect(token0Total).to.be.eq(300435);
        expect(token1Total).to.be.eq(0);

        expect(await loPlugin.getEpochLiquidity(1,wallet)).to.be.eq(10n**8n);
    });

    it('cross & close lo zeroToOne true', async () => {
      await loPlugin.place(poolKey, 60, true, 10n**8n);
      await swapTarget.swapToHigherSqrtPrice(pool, encodePriceSqrt(102,100), wallet);

      const {filled, liquidityTotal, token0Total, token1Total} = await loPlugin.epochInfos(1);

      expect(filled).to.be.eq(true);
      expect(liquidityTotal).to.be.eq(10n**8n);
      expect(token0Total).to.be.eq(0);
      expect(token1Total).to.be.eq(301338);

      expect(await loPlugin.getEpochLiquidity(1,wallet)).to.be.eq(10n**8n);
    });

    it('cross ticks without lo', async () => {
  
      await swapTarget.swapToLowerSqrtPrice(pool, encodePriceSqrt(98,100), wallet);

      expect(await loPlugin.tickLowerLasts(pool)).to.be.eq(-240)
    });

  })

  describe('#withdraw', async () => {

    it('withdraw filled lo', async () => {
        await loPlugin.place(poolKey, -60, false, 10n**8n);
        await swapTarget.swapToLowerSqrtPrice(pool, encodePriceSqrt(99,100), wallet);

        let balanceBefore = await token0.balanceOf(wallet);
        await loPlugin.withdraw(1, wallet);
        let balanceAfter =  await token0.balanceOf(wallet);
        expect(balanceAfter - balanceBefore).to.be.eq(300435)
    });

    it('distribution is correct', async () => {
      await loPlugin.place(poolKey, -60, false, 10n**8n);
      await loPlugin.connect(other).place(poolKey, -60, false, 10n**8n);

      await swapTarget.swapToLowerSqrtPrice(pool, encodePriceSqrt(99,100), wallet);

      let balanceBefore = await token0.balanceOf(other);
      await loPlugin.withdraw(1, other);
      let balanceAfter =  await token0.balanceOf(other);
      expect(balanceAfter - balanceBefore).to.be.eq(300435)
      const {liquidityTotal} = await loPlugin.epochInfos(1)
      expect(liquidityTotal).to.be.eq(10n ** 8n)
    });

    it('try to claim not filled lo', async () => {
      await loPlugin.place(poolKey, -60, false, 10n**8n);

      await expect(loPlugin.withdraw(1, other)).to.be.revertedWithCustomError(loPlugin,"NotFilled()")
    });
  })

  describe('#kill', async () => {

    it('works correct', async () => {
        await loPlugin.place(poolKey, -60, false, 10n**8n);

        let balanceBefore = await token1.balanceOf(other);
        await loPlugin.kill(poolKey, -60, 0, false, other);
        let balanceAfter =  await token1.balanceOf(other);
        await expect(balanceAfter - balanceBefore).to.be.eq(299535)
    });

    it('try to kill filled lo', async () => {
      await loPlugin.place(poolKey, -60, false, 10n**8n);
      await swapTarget.swapToLowerSqrtPrice(pool, encodePriceSqrt(99,100), wallet);

      await expect( loPlugin.kill(poolKey, -60, 0, false, wallet)).to.be.revertedWithCustomError(loPlugin,"ZeroLiquidity()")      
    });

  })

});
