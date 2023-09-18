import { Wallet, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { expect } from './shared/expect';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { limitOrderPluginFixture } from './shared/fixtures';
import { encodePriceSqrt, expandTo18Decimals} from './shared/utilities';

import { LimitOrderPlugin, BasePluginV1Factory, TestERC20 } from '../typechain';

import snapshotGasCost from './shared/snapshotGasCost';
import { AlgebraPool, TestAlgebraCallee } from '@cryptoalgebra/core/typechain';

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
    await pool.setTickSpacing(1);

    await token0.approve(await loPlugin.getAddress(), 2n**255n);
    await token1.approve(await loPlugin.getAddress(), 2n**255n);
  });

  describe('#Place', async () => {

    it('place lo', async () => {
        await loPlugin.place(poolKey, -60, false, 10n**8n);
    });

  });

  describe('#Close', async () => {

    it('close lo', async () => {
        await loPlugin.place(poolKey, -60, false, 10n**8n);
        await token0.approve(swapTarget, 2n**255n);

        await swapTarget.swapToLowerSqrtPrice(pool, encodePriceSqrt(99,100), wallet);

        let balanceBefore = await token0.balanceOf(other);
        await loPlugin.withdraw(1, other);
        let balanceAfter =  await token0.balanceOf(other);
        await expect(balanceAfter - balanceBefore).to.be.eq(5014n)
    });
  })

  
});
