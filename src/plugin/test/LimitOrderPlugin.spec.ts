import { Wallet, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { expect } from './shared/expect';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ZERO_ADDRESS, limitOrderPluginFixture } from './shared/fixtures';
import { encodePriceSqrt, expandTo18Decimals} from './shared/utilities';

import { LimitOrderPlugin, BasePluginV1Factory, TestERC20, IWNativeToken, AlgebraBasePluginV1 } from '../typechain';

import snapshotGasCost from './shared/snapshotGasCost';
import { AlgebraPool, TestAlgebraCallee } from '@cryptoalgebra/integral-core/typechain';
import { token } from '../typechain/@openzeppelin/contracts';

describe('LimitOrders', () => {
  let wallet: Wallet, other: Wallet;

  let loPlugin: LimitOrderPlugin
  let pool: AlgebraPool; 
  let pool0Wnative: AlgebraPool;
  let poolWnative1: AlgebraPool;
  let pluginFactory: BasePluginV1Factory; 
  let token0: TestERC20;
  let token1: TestERC20;
  let wnative: IWNativeToken;
  let swapTarget: TestAlgebraCallee;
  let poolKey: {token0: string, token1: string};
  let poolKeyWnative: {token0: string, token1: string};
 

  async function initializeAtZeroTick(_pool: AlgebraPool) {
    await _pool.initialize(encodePriceSqrt(1, 1));
  }

  before('prepare signers', async () => {
    [wallet, other] = await (ethers as any).getSigners();
  });

  beforeEach('deploy test limitOrderPlugin', async () => {
    ({ pluginFactory, loPlugin, token0, token1, wnative, pool, pool0Wnative, poolWnative1, swapTarget } = await loadFixture(limitOrderPluginFixture));

    poolKey = {token0: await token0.getAddress(), token1: await token1.getAddress()}
    poolKeyWnative = {token0: await token0.getAddress(), token1: await wnative.getAddress()}
    
    await initializeAtZeroTick(pool);
    await initializeAtZeroTick(pool0Wnative);

    await token0.approve(loPlugin, 2n**255n);
    await token1.approve(loPlugin, 2n**255n);
    await wnative.approve(loPlugin, 2n**255n);

    await token0.approve(swapTarget, 2n**255n);
    await token1.approve(swapTarget, 2n**255n);
    await wnative.approve(swapTarget, 2n**255n);


    await token0.connect(other).approve(loPlugin, 2n**255n);
    await token1.connect(other).approve(loPlugin, 2n**255n);

    await token0.transfer(other, 10n**10n)
    await token1.transfer(other, 10n**10n)

    await swapTarget.mint(pool, wallet, -600, 600, 10n**8n)
    await swapTarget.mint(pool, wallet, -300, 300, 10n**8n)
    
  });

  it('initialize works correct', async () => {
      
    await initializeAtZeroTick(poolWnative1)

    await wnative.deposit({value:10n**8n});

    await swapTarget.mint(pool, poolWnative1, -600, 600, 10n**8n)
    await swapTarget.swapToLowerSqrtPrice(poolWnative1, encodePriceSqrt(1,2), wallet);

    const pluginContractFacroty = await ethers.getContractFactory('AlgebraBasePluginV1');
    let pluginAddress = await poolWnative1.plugin();
    let plugin = (pluginContractFacroty.attach(pluginAddress)) as any as AlgebraBasePluginV1;

    await plugin.setLimitOrderPlugin(loPlugin);
    await loPlugin.place({token0: await wnative.getAddress(), token1: await token1.getAddress()}, -60, true, 10n**8n);

    expect(await loPlugin.tickLowerLasts(poolWnative1)).to.be.eq(-6960)
  })

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

          await loPlugin.place(poolKey, 0, true, 10n**8n);
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

      it('place lo with wnative', async () => {
        await loPlugin.place(poolKeyWnative, -60, false, 10n**8n, {value: 299536});

        const {tickLower, tickUpper, liquidityTotal} = await loPlugin.epochInfos(1);

        expect(tickLower).to.be.eq(-60);
        expect(tickUpper).to.be.eq(0);
        expect(liquidityTotal).to.be.eq(10n**8n);
        expect(await wnative.balanceOf(pool0Wnative)).to.be.eq(299536)
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
      await loPlugin.place(poolKey, 0, true, 10n**8n);
      await swapTarget.swapToHigherSqrtPrice(pool, encodePriceSqrt(102,100), wallet);

      const {filled, liquidityTotal, token0Total, token1Total} = await loPlugin.epochInfos(1);

      expect(filled).to.be.eq(true);
      expect(liquidityTotal).to.be.eq(10n**8n);
      expect(token0Total).to.be.eq(0);
      expect(token1Total).to.be.eq(300435);

      expect(await loPlugin.getEpochLiquidity(1,wallet)).to.be.eq(10n**8n);
    });

    it('cross ticks without lo', async () => {
  
      await swapTarget.swapToLowerSqrtPrice(pool, encodePriceSqrt(98,100), wallet);

      expect(await loPlugin.tickLowerLasts(pool)).to.be.eq(-240)
    });

    it('reverts if msg sender is not plugin', async () => {

      await expect(loPlugin.afterSwap(ZERO_ADDRESS, false, 0)).to.be.revertedWithCustomError(loPlugin, "NotPlugin()")
      await expect(loPlugin.afterInitialize(ZERO_ADDRESS, 0)).to.be.revertedWithCustomError(loPlugin, "NotPlugin()")
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

    it('withdraw filled lo wnative', async () => {
      await loPlugin.place(poolKeyWnative, 60, true, 10n**8n);

      await wnative.deposit({value: 400000});
      await wnative.approve(swapTarget, 400000)

      await swapTarget.swapToHigherSqrtPrice(pool0Wnative, encodePriceSqrt(102,100), wallet);

      let {amount0, amount1} = await loPlugin.withdraw.staticCall(1, wallet);
      expect(amount0).to.be.eq(0);
      expect(amount1).to.be.eq(301338);
  });

    it('reverts if claim not filled lo', async () => {
      await loPlugin.place(poolKey, -60, false, 10n**8n);

      await expect(loPlugin.withdraw(1, other)).to.be.revertedWithCustomError(loPlugin,"NotFilled()")
    });

    it('reverts if withdraw other users limit order', async () => {
      await loPlugin.place(poolKey, -60, false, 10n**8n);
      await swapTarget.swapToLowerSqrtPrice(pool, encodePriceSqrt(99,100), wallet);

      await expect(loPlugin.connect(other).withdraw(1, other)).to.be.revertedWithCustomError(loPlugin,"ZeroLiquidity()")
    });
  })

  describe('#setTickSpacing', () => { 
    
    it('works correct', async () => {
      await loPlugin.setTickSpacing(pool, 120)

      expect(await loPlugin.tickSpacings(pool)).to.be.eq(120)
    });

    it('withdraw works correct after tickSpacing change', async () => {
      await loPlugin.setTickSpacing(pool, 120)

      await loPlugin.place(poolKey, -120, false, 10n**8n);
      await swapTarget.swapToLowerSqrtPrice(pool, encodePriceSqrt(98,100), wallet);

      let balanceBefore = await token0.balanceOf(wallet);
      await loPlugin.withdraw(1, wallet);
      let balanceAfter =  await token0.balanceOf(wallet);
      expect(balanceAfter - balanceBefore).to.be.eq(601773)
    });

    it('kill works correct after tickSpacing ', async () => {
      await loPlugin.setTickSpacing(pool, 120)

      await loPlugin.place(poolKey, -120, false, 10n**8n);

      let balanceBefore = await token1.balanceOf(wallet);
      await loPlugin.kill(poolKey, -120, 0, 10n**8n, false, wallet);
      let balanceAfter =  await token1.balanceOf(wallet);
      expect(balanceAfter - balanceBefore).to.be.eq(598173)
    });

    it('reverts if caller is not plugin manager', async () => {
      await expect(loPlugin.connect(other).setTickSpacing(pool, 120)).to.be.reverted
    });

  })

  describe('#kill', async () => {

    it('works correct', async () => {
        await loPlugin.place(poolKey, -60, false, 10n**8n);

        let balanceBefore = await token1.balanceOf(other);
        await loPlugin.kill(poolKey, -60, 0, 10n ** 8n, false, other);
        let balanceAfter =  await token1.balanceOf(other);
        await expect(balanceAfter - balanceBefore).to.be.eq(299535)
    });

    it('works correct wnative', async () => {
      await loPlugin.place(poolKeyWnative, -60, false, 10n**8n, {value: 299536});

      let {amount0, amount1} = await loPlugin.kill.staticCall(poolKeyWnative, -60, 0, 10n**8n, false, wallet);
      expect(amount0).to.be.eq(0);
      expect(amount1).to.be.eq(299535);
    });

    it('works correct for partial filled lo', async () => {
      await loPlugin.place(poolKey, -60, false, 10n**8n);
      await swapTarget.swapToLowerSqrtPrice(pool, encodePriceSqrt(995,1000), wallet);

      let balanceBefore1 = await token1.balanceOf(other);
      let balanceBefore0 = await token0.balanceOf(other);
      await loPlugin.kill(poolKey, -60, 0, 10n ** 8n, false, other);
      let balanceAfter1 =  await token1.balanceOf(other);
      let balanceAfter0 =  await token0.balanceOf(other);
      await expect(balanceAfter1 - balanceBefore1).to.be.eq(49222)   
      await expect(balanceAfter0 - balanceBefore0).to.be.eq(250941)   
    });


    it('reverts if kill filled lo', async () => {
      await loPlugin.place(poolKey, -60, false, 10n**8n);
      await swapTarget.swapToLowerSqrtPrice(pool, encodePriceSqrt(98,100), wallet);

      await expect(loPlugin.kill(poolKey, -60, 0, 10n ** 8n, false, wallet)).to.be.revertedWithCustomError(loPlugin,"InsufficientLiquidity()")      
    });

    it('reverts if kill 0 liquidity', async () => {
      await loPlugin.place(poolKey, -60, false, 10n**8n);
      await swapTarget.swapToLowerSqrtPrice(pool, encodePriceSqrt(98,100), wallet);


      await expect(loPlugin.kill(poolKey, -60, 0, 0, false, wallet)).to.be.revertedWithCustomError(loPlugin,"ZeroLiquidity()")      
    });

    it('partial kill', async () => {
      await loPlugin.place(poolKey, -60, false, 10n**8n);

      let balanceBefore = await token1.balanceOf(other);
      await loPlugin.kill(poolKey, -60, 0, 5n ** 8n, false, other);
      let balanceAfter =  await token1.balanceOf(other);
      await expect(balanceAfter - balanceBefore).to.be.eq(1170)   
    });

  })

});
