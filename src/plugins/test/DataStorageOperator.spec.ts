import { BigNumber, BigNumberish, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import checkTimepointEquals from './shared/checkTimepointEquals'
import { expect } from './shared/expect'
import { TEST_POOL_START_TIME, pluginFixture } from './shared/fixtures'
import snapshotGasCost from './shared/snapshotGasCost'

import { MockFactory, MockPool, MockTimeDataStorageOperator, TestERC20, MockTimeDSFactory } from "../typechain";

describe('DataStorageOperator', () => {
  let wallet: Wallet, other: Wallet

  let plugin: MockTimeDataStorageOperator; // modified plugin
  let mockPool: MockPool; // mock of AlgebraPool
  let mockFactory: MockFactory; // mock of AlgebraFactory
  let mockPluginFactory: MockTimeDSFactory; // modified plugin factory

  before('prepare signers', async () => {
    ;[wallet, other] = await (ethers as any).getSigners()
  })

  beforeEach('deploy test dataStorage', async () => {
    ;({ 
      plugin, 
      mockPool, 
      mockFactory, 
      mockPluginFactory
    } = await loadFixture(pluginFixture));
  })

  // plain tests for hooks functionality
  describe('#Hooks', () => {
  })

  describe('#VolatilityOracle', () => {
    it.skip('initializes timepoints slot', async () => {
      /*await pool.initialize(encodePriceSqrt(1, 1))
      checkTimepointEquals(await dsOperator.timepoints(0), {
        initialized: true,
        blockTimestamp: TEST_POOL_START_TIME,
        tickCumulative: 0,
      })*/
    })
    
    describe.skip('#getTimepoints', () => {
      /*
      beforeEach(() => initializeAtZeroTick(pool))
  
      // zero tick
      it('current tick accumulator increases by tick over time', async () => {
        let {
          tickCumulatives: [tickCumulative],
        } = await dsOperator.getTimepoints([0])
        expect(tickCumulative).to.eq(0)
        await pool.advanceTime(10)
        ;({
          tickCumulatives: [tickCumulative],
        } = await dsOperator.getTimepoints([0]))
        expect(tickCumulative).to.eq(0)
      })
  
      it('current tick accumulator after single swap', async () => {
        // moves to tick -1
        await swapExact0For1(1000, wallet.address)
        await pool.advanceTime(4)
        let {
          tickCumulatives: [tickCumulative],
        } = await dsOperator.getTimepoints([0])
        expect(tickCumulative).to.eq(-4)
      })
  
      it('current tick accumulator after swaps', async () => {
        await swapExact0For1(expandTo18Decimals(1).div(2), wallet.address);
        expect((await pool.globalState()).tick).to.eq(-4463);
        await pool.advanceTime(4);
        await swapExact1For0(expandTo18Decimals(1).div(4), wallet.address);
        expect((await pool.globalState()).tick).to.eq(-1560);
        let {
          tickCumulatives: [tickCumulative0],
        } = await dsOperator.getTimepoints([0])
        expect(tickCumulative0).to.eq(-17852);
        await pool.advanceTime(60 * 5);
        await swapExact0For1(100, wallet.address);
        let {
          tickCumulatives: [tickCumulative1],
        } = await dsOperator.getTimepoints([0]);
        expect(tickCumulative1).to.eq(-485852);
      })
      */
    })

    it.skip('writes an timepoint', async () => {
      /*checkTimepointEquals(await dsOperator.timepoints(0), {
        tickCumulative: 0,
        blockTimestamp: TEST_POOL_START_TIME,
        initialized: true,
      })
      await pool.advanceTime(1)
      await mint(wallet.address, minTick, maxTick, 100)
      checkTimepointEquals(await dsOperator.timepoints(1), {
        tickCumulative: -23028,
        blockTimestamp: TEST_POOL_START_TIME + 1,
        initialized: true,
      })
      expect(await pool.secondsPerLiquidityCumulative()).to.be.eq('107650226801941937191829992860413859');
      */
    })

    it.skip('does not write an timepoint', async () => {
      /*checkTimepointEquals(await dsOperator.timepoints(0), {
        tickCumulative: 0,
        blockTimestamp: TEST_POOL_START_TIME,
        initialized: true,
      })
      await pool.advanceTime(1)
      await mint(wallet.address, -240, 0, 100)
      checkTimepointEquals(await dsOperator.timepoints(0), {
        tickCumulative: 0,
        blockTimestamp: TEST_POOL_START_TIME,
        initialized: true,
      })*/
    })
  })

  describe('#DynamicFeeManager', () => {
    describe.skip('#adaptiveFee', function() {
      /*
      this.timeout(0);
      const liquidity = expandTo18Decimals(1000);
      const DAY = 60*60*24;
      beforeEach('initialize pool', async () => {
        await initializeAtZeroTick(pool)
      })
  
      async function trade(count: number, proportion: number, amount: BigNumberish, pause: number) {
        let vol0 = BigNumber.from(0);
        let vol1 = BigNumber.from(0);
        for (let i = 0; i < count; i++) {
            if (i % proportion == 0 ) {
              let b0 = await token0.balanceOf(wallet.address);
              await swapExact1For0(amount, wallet.address);
              vol0 = vol0.add((await token0.balanceOf(wallet.address)).sub(b0));
              vol1 = vol1.add(amount);
              await pool.advanceTime(pause);
            } else {
              let b1 = await token1.balanceOf(wallet.address);
              await swapExact0For1(amount, wallet.address);
              vol1 = vol1.add((await token1.balanceOf(wallet.address)).sub(b1));
              vol0 = vol0.add(amount);
              await pool.advanceTime(pause);
            }
        }
        //console.log('Vol0: ', vol0.div(BigNumber.from(10).pow(18)).toString());
        //console.log('Vol1: ', vol1.div(BigNumber.from(10).pow(18)).toString());
      }
  
      async function tradeStable(count: number, proportion: number, amount: number, pause: number) {
        let ticks = [];
        for (let i = 0; i < count; i++) {
            if (i % proportion == 0 ) {
              await swapExact1For0(expandTo18Decimals(amount*5), wallet.address);
              await swapToLowerPrice(encodePriceSqrt(1, 1), wallet.address);
              await swapExact1For0(expandTo18Decimals(amount/2), wallet.address);
              await pool.advanceTime(pause);
            } else {
              await swapToLowerPrice(encodePriceSqrt(1, 1), wallet.address);
              await pool.advanceTime(pause);
            }
            ticks.push((await pool.globalState()).tick);
        }
        console.log(ticks)
      }
  
      async function getStatistics(time: number) {
        let now = await dsOperator.getTimepoints([BigNumber.from(0)]);
        let then = await dsOperator.getTimepoints([BigNumber.from(time)]);
        return [now.volatilityCumulatives[0].sub(then.volatilityCumulatives[0]).div(BigNumber.from(DAY)),
        time]
      }
  
      it('doesnt change at 0 volume', async () => {
        let fee1 = (await pool.globalState()).fee;
        await mint(wallet.address, -6000, 6000, liquidity)
        let fee2 = (await pool.globalState()).fee;
        await pool.advanceTime(DAY + 600);
        await mint(wallet.address, -6000, 6000, 1)
        let fee3 = (await pool.globalState()).fee;
        expect(fee3).to.be.equal(fee2);
        expect(fee3).to.be.equal(fee1);
      })
  
      const AMOUNT = 500000000
      it('single huge step after day', async () => {
        pool = await createPoolWrapped()
        await pool.initialize(encodePriceSqrt(1, 1))
        await mint(wallet.address, -24000, 24000, liquidity.mul(BigNumber.from(1000000000)))
  
        await pool.advanceTime(DAY)
        await swapExact0For1(BigNumber.from(1000), wallet.address);
        await pool.advanceTime(60)
        await swapExact1For0(liquidity.mul(BigNumber.from(AMOUNT)), wallet.address);
        await pool.advanceTime(60)
        await swapExact0For1(BigNumber.from(100), wallet.address);
        await pool.advanceTime(60)
        await swapExact0For1(BigNumber.from(100), wallet.address);
        let fee3 = (await pool.globalState()).fee;
        expect(fee3).to.be.equal(3000);
  
        let stats = [];
        for (let i = 0; i < 25; i++) {
          await swapExact0For1(BigNumber.from(100), wallet.address);
          const avgVolatility = await pool.getAverageVolatility();
          let fee = (await pool.globalState()).fee;
          stats.push(`Fee: ${fee}, Avg_volat: ${avgVolatility.toString()} `);
          await pool.advanceTime(60*60)
        }
        expect(stats).to.matchSnapshot('fee stats after step');
      })
  
      it('single huge step after initialization', async () => {
        pool = await createPoolWrapped()
        await pool.initialize(encodePriceSqrt(1, 1))
        await mint(wallet.address, -24000, 24000, liquidity.mul(BigNumber.from(1000000000)))
  
        await pool.advanceTime(60)
        await swapExact0For1(BigNumber.from(1000), wallet.address);
        await pool.advanceTime(60)
        await swapExact1For0(liquidity.mul(BigNumber.from(AMOUNT)), wallet.address);
        await pool.advanceTime(60)
        await swapExact0For1(BigNumber.from(100), wallet.address);
        await pool.advanceTime(60)
        await swapExact0For1(BigNumber.from(100), wallet.address);
        let fee3 = (await pool.globalState()).fee;
        expect(fee3).to.be.equal(15000);
  
        let stats = [];
        for (let i = 0; i < 25; i++) {
          await swapExact0For1(BigNumber.from(100), wallet.address);
          const avgVolatility = await pool.getAverageVolatility();
          let fee = (await pool.globalState()).fee;
          stats.push(`Fee: ${fee}, Avg_volat: ${avgVolatility.toString()} `);
          await pool.advanceTime(60*60)
        }
        expect(stats).to.matchSnapshot('fee stats after step');
      })
  
      it('single huge spike after day', async () => {
        pool = await createPoolWrapped()
        await pool.initialize(encodePriceSqrt(1, 1))
        await mint(wallet.address, -24000, 24000, liquidity.mul(BigNumber.from(1000000000)))
        await pool.advanceTime(DAY)
        await pool.advanceTime(60)
        await swapExact0For1(BigNumber.from(1000), wallet.address);
        await pool.advanceTime(60)
        await swapExact1For0(liquidity.mul(BigNumber.from(AMOUNT)), wallet.address);
        await pool.advanceTime(60)
        await swapExact0For1(BigNumber.from(100), wallet.address);
        await pool.advanceTime(60)
        await swapExact0For1(BigNumber.from(100), wallet.address);
        let fee3 = (await pool.globalState()).fee;
        expect(fee3).to.be.equal(3000);
  
        await swapToLowerPrice(encodePriceSqrt(1, 1), wallet.address);
        await pool.advanceTime(60);
  
        let stats = [];
        for (let i = 0; i < 25; i++) {
          await swapExact0For1(BigNumber.from(100), wallet.address);
          let avgVolatility = await pool.getAverageVolatility();
          let fee = (await pool.globalState()).fee;
          stats.push(`Fee: ${fee}, Avg_volat: ${avgVolatility.toString()} `);
          await pool.advanceTime(60*60)
        }
        expect(stats).to.matchSnapshot('fee stats after spike');
      })
  
      it('single huge spike after initialization', async () => {
        pool = await createPoolWrapped()
        await pool.initialize(encodePriceSqrt(1, 1))
        await mint(wallet.address, -24000, 24000, liquidity.mul(BigNumber.from(1000000000)))
  
        await pool.advanceTime(60)
        await swapExact0For1(BigNumber.from(1000), wallet.address);
        await pool.advanceTime(60)
        await swapExact1For0(liquidity.mul(BigNumber.from(AMOUNT)), wallet.address);
        await pool.advanceTime(60)
        await swapExact0For1(BigNumber.from(100), wallet.address);
        await pool.advanceTime(60)
        await swapExact0For1(BigNumber.from(100), wallet.address);
        let fee3 = (await pool.globalState()).fee;
        expect(fee3).to.be.equal(15000);
  
        await swapToLowerPrice(encodePriceSqrt(1, 1), wallet.address);
        await pool.advanceTime(60);
  
        let stats = [];
        for (let i = 0; i < 25; i++) {
          await swapExact0For1(BigNumber.from(100), wallet.address);
          let avgVolatility = await pool.getAverageVolatility();
          let fee = (await pool.globalState()).fee;
          stats.push(`Fee: ${fee}, Avg_volat: ${avgVolatility.toString()} `);
          await pool.advanceTime(60*60)
        }
        expect(stats).to.matchSnapshot('fee stats after spike');
      })
  
      xit('changes', async () => {
        let fee1 = (await pool.globalState()).fee;
        let tick0 = (await pool.globalState()).tick;
        await mint(wallet.address, -6000, 6000, liquidity)
        let fee2 = (await pool.globalState()).fee;
        await pool.advanceTime(DAY + 600);
        await tradeStable(240, 2, 10, 30);
        let fee3 = (await pool.globalState()).fee;
        console.log(fee1, fee2, fee3);
        let tick1 = (await pool.globalState()).tick;
        let stats = await getStatistics(DAY);
        console.log('Tick:', tick1 - tick0)
        console.log('Volt:', stats[0].toString())
        console.log('Volm:', BigNumber.from(stats[1]).div(BigNumber.from(10).pow(18)).toString())
        console.log(DAY)
      })
      */
    })
  })

  describe('#FarmingPlugin', () => {
    describe('virtual pool tests', () => {
      /* let virtualPoolMock: MockTimeVirtualPool;
   
       beforeEach('deploy virtualPoolMock', async () => {
         await factory.setFarmingAddress(wallet.address);
         const virtualPoolMockFactory = await ethers.getContractFactory('MockTimeVirtualPool');
         virtualPoolMock = (await virtualPoolMockFactory.deploy()) as MockTimeVirtualPool;
       })
   
       it('set incentive works', async() => {
         await pool.setIncentive(virtualPoolMock.address);
         expect(await pool.activeIncentive()).to.be.eq(virtualPoolMock.address);    
       })
   
       it('set incentive works only for Factory.farmingAddress', async() => {
         await factory.setFarmingAddress(ethers.constants.AddressZero);
         await expect(pool.setIncentive(virtualPoolMock.address)).to.be.reverted;  
       })
   
       it('swap with active incentive', async() => {
         await pool.setIncentive(virtualPoolMock.address);
         await pool.initialize(encodePriceSqrt(1, 1));
         await mint(wallet.address, -120, 120, 1);
         await mint(wallet.address, minTick, maxTick, 1);
         await swapToLowerPrice(encodePriceSqrt(1, 2), wallet.address);
   
         expect(await pool.activeIncentive()).to.be.eq(virtualPoolMock.address);
   
         const tick = (await pool.globalState()).tick;
         expect(await virtualPoolMock.currentTick()).to.be.eq(tick);
         expect(await virtualPoolMock.timestamp()).to.be.gt(0);
       })
   
       it('swap with finished incentive', async() => {
         await virtualPoolMock.setIsExist(false);
         await pool.setIncentive(virtualPoolMock.address);
         await pool.initialize(encodePriceSqrt(1, 1));
         await mint(wallet.address, -120, 120, 1);
         await mint(wallet.address, minTick, maxTick, 1);
         expect(await pool.activeIncentive()).to.be.eq(virtualPoolMock.address);    
   
         await swapToLowerPrice(encodePriceSqrt(1, 2), wallet.address);
   
         expect(await pool.activeIncentive()).to.be.eq(ethers.constants.AddressZero);
         expect(await virtualPoolMock.currentTick()).to.be.eq(0);
         expect(await virtualPoolMock.timestamp()).to.be.eq(0);
       })
   
       it('swap with not started yet incentive', async() => {
         await virtualPoolMock.setIsStarted(false);
         await pool.setIncentive(virtualPoolMock.address);
         await pool.initialize(encodePriceSqrt(1, 1));
         await mint(wallet.address, -120, 120, 1);
         await mint(wallet.address, minTick, maxTick, 1);
         expect(await pool.activeIncentive()).to.be.eq(virtualPoolMock.address);    
   
         await swapToLowerPrice(encodePriceSqrt(1, 2), wallet.address);
   
         const tick = (await pool.globalState()).tick;
         expect(await pool.activeIncentive()).to.be.eq(virtualPoolMock.address);
         expect(await virtualPoolMock.currentTick()).to.be.eq(tick);
         expect(await virtualPoolMock.timestamp()).to.be.eq(0); 
       }) */
     })
  })
})
