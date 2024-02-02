import { ethers } from 'hardhat';
import { ContractTransactionReceipt, Wallet, MaxUint256, ZeroAddress } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from './shared/expect';

import { poolFixture } from './shared/fixtures';

import {
  expandTo18Decimals,
  FeeAmount,
  getPositionKey,
  getMaxTick,
  getMinTick,
  encodePriceSqrt,
  encodeCallback,
  createPoolFunctions,
  SwapFunction,
  MintFunction,
  FlashFunction,
  MaxUint128,
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
  SwapToPriceFunction,
  MAX_TICK,
  MIN_TICK,
} from './shared/utilities';

import {
  TestERC20,
  AlgebraFactory,
  MockTimeAlgebraPool,
  TestAlgebraSwapPay,
  TestAlgebraCallee,
  TestAlgebraReentrantCallee,
  MockPoolPlugin,
  TickMathTest,
  PriceMovementMathTest,
  IERC20Minimal,
} from '../typechain';

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

describe('AlgebraPool', () => {
  let wallet: Wallet, other: Wallet;

  let token0: TestERC20;
  let token1: TestERC20;
  let token2: TestERC20;

  let factory: AlgebraFactory;
  let pool: MockTimeAlgebraPool;

  let swapTarget: TestAlgebraCallee;

  let swapToLowerPrice: SwapToPriceFunction;
  let swapToHigherPrice: SwapToPriceFunction;
  let swapExact0For1SupportingFee: SwapFunction;
  let swapExact1For0SupportingFee: SwapFunction;
  let swapExact0For1: SwapFunction;
  let swap0ForExact1: SwapFunction;
  let swapExact1For0: SwapFunction;
  let swap1ForExact0: SwapFunction;

  let tickSpacing: number;

  let minTick: number;
  let maxTick: number;

  let mint: MintFunction;
  let flash: FlashFunction;

  let createPoolWrapped: ThenArg<ReturnType<typeof poolFixture>>['createPool'];

  let vaultAddress: string;

  beforeEach('deploy fixture', async () => {
    [wallet, other] = await (ethers as any).getSigners();
    let vault;
    let _createPool: ThenArg<ReturnType<typeof poolFixture>>['createPool'];
    ({
      token0,
      token1,
      token2,
      factory,
      vault,
      createPool: _createPool,
      swapTargetCallee: swapTarget,
    } = await loadFixture(poolFixture));
    vaultAddress = await vault.getAddress();
    createPoolWrapped = async () => {
      const pool = await _createPool();
      ({
        swapToLowerPrice,
        swapToHigherPrice,
        swapExact0For1,
        swapExact0For1SupportingFee,
        swap0ForExact1,
        swapExact1For0,
        swapExact1For0SupportingFee,
        swap1ForExact0,
        mint,
        flash,
      } = createPoolFunctions({
        token0,
        token1,
        swapTarget,
        pool,
      }));
      minTick = getMinTick(60);
      maxTick = getMaxTick(60);
      tickSpacing = 60;
      return pool;
    };
    pool = await createPoolWrapped();
  });

  it('constructor initializes immutables', async () => {
    expect(await pool.factory()).to.eq(await factory.getAddress());
    expect(await pool.token0()).to.eq(await token0.getAddress());
    expect(await pool.token1()).to.eq(await token1.getAddress());
    expect(await pool.maxLiquidityPerTick()).to.eq(BigInt('191757638537527648490752896198553'));
  });

  it('_blockTimestamp works', async () => {
    expect(await pool.checkBlockTimestamp()).to.be.eq(true);
  });

  it('isUnlocked', async () => {
    expect(await pool.isUnlocked()).to.be.true; // false checked inside of TestAlgebraReentrantCallee.sol
  });

  it('tickTreeRoot is clear', async () => {
    expect(await pool.tickTreeRoot()).to.be.eq(0);
  });

  describe('#initialize', () => {
    it('fails if already initialized', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await expect(pool.initialize(encodePriceSqrt(1, 1))).to.be.reverted;
    });
    it('fails if starting price is too low', async () => {
      await expect(pool.initialize(1)).to.be.revertedWithCustomError(pool, 'priceOutOfRange');
      await expect(pool.initialize(MIN_SQRT_RATIO - 1n)).to.be.revertedWithCustomError(pool, 'priceOutOfRange');
    });
    it('fails if starting price is too high', async () => {
      await expect(pool.initialize(MAX_SQRT_RATIO)).to.be.revertedWithCustomError(pool, 'priceOutOfRange');
      await expect(pool.initialize(2n ** 160n - 1n)).to.be.revertedWithCustomError(pool, 'priceOutOfRange');
    });
    it('fails if community fee nonzero without vault', async () => {
      const _factory = await ethers.getContractFactory('FaultyVaultFactoryStub');
      const faultyVaultFactory = await _factory.deploy(ZeroAddress);

      await factory.setDefaultCommunityFee(100);
      await factory.setVaultFactory(faultyVaultFactory);

      await expect(pool.initialize(MIN_SQRT_RATIO)).to.be.revertedWithCustomError(pool, 'invalidNewCommunityFee');
    });
    it('can be initialized at MIN_SQRT_RATIO', async () => {
      await pool.initialize(MIN_SQRT_RATIO);
      expect((await pool.globalState()).tick).to.eq(getMinTick(1));
    });
    it('can be initialized at MAX_SQRT_RATIO - 1', async () => {
      await pool.initialize(MAX_SQRT_RATIO - 1n);
      expect((await pool.globalState()).tick).to.eq(getMaxTick(1) - 1);
    });
    it('sets initial variables', async () => {
      const initPrice = encodePriceSqrt(1, 2);
      await pool.initialize(initPrice);

      const { price } = await pool.globalState();
      expect(price).to.eq(price);
      //expect(timepointIndex).to.eq(0) TODO check plugin
      expect((await pool.globalState()).tick).to.eq(-6932);
    });
    it('emits a Initialized event with the input tick', async () => {
      const price = encodePriceSqrt(1, 2);
      await expect(pool.initialize(price)).to.emit(pool, 'Initialize').withArgs(price, -6932);
    });
    it('emits configuration events', async () => {
      const price = encodePriceSqrt(1, 2);
      await expect(pool.initialize(price))
        .to.emit(pool, 'TickSpacing')
        .withArgs(tickSpacing)
        .to.emit(pool, 'CommunityFee')
        .withArgs(0);
    });
  });

  it('safelyGetStateOfAMM', async () => {
    await pool.initialize(encodePriceSqrt(1, 1));

    const state = await pool.safelyGetStateOfAMM();
    expect(state.sqrtPrice).to.eq(encodePriceSqrt(1, 1));
    expect(state.tick).to.eq(0);

    // revert case checked inside of TestAlgebraReentrantCallee.sol
  });

  describe('#mint', () => {
    it('fails if not initialized', async () => {
      await expect(mint(wallet.address, -tickSpacing, tickSpacing, 1)).to.be.revertedWithCustomError(
        pool,
        'notInitialized'
      );
      await expect(mint(wallet.address, getMinTick(1), getMaxTick(1), 100)).to.be.revertedWithCustomError(
        pool,
        'notInitialized'
      );
      await expect(mint(wallet.address, 0, getMaxTick(1), 100)).to.be.revertedWithCustomError(pool, 'notInitialized');
      await expect(mint(wallet.address, getMinTick(1), 0, 100)).to.be.revertedWithCustomError(pool, 'notInitialized');
      await expect(mint(wallet.address, getMaxTick(1) - 1, getMaxTick(1), 100)).to.be.revertedWithCustomError(
        pool,
        'notInitialized'
      );
      await expect(mint(wallet.address, getMinTick(1), getMinTick(1) + 1, 100)).to.be.revertedWithCustomError(
        pool,
        'notInitialized'
      );
    });
    describe('after initialization', () => {
      beforeEach('initialize the pool at price of 10:1', async () => {
        await pool.initialize(encodePriceSqrt(1, 10));
        await mint(wallet.address, minTick, maxTick, 3161);
      });

      describe('failure cases', () => {
        describe('underpayment', () => {
          let payer: TestAlgebraSwapPay;

          beforeEach(async () => {
            const factory = await ethers.getContractFactory('TestAlgebraSwapPay');
            payer = (await factory.deploy()) as any as TestAlgebraSwapPay;
            await token0.approve(payer, 2n ** 256n - 1n);
            await token1.approve(payer, 2n ** 256n - 1n);
          });

          it('fails if token0 paid 0', async () => {
            await expect(
              payer.mint(pool, wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 100, 0, 100)
            ).to.be.revertedWithCustomError(pool, 'zeroLiquidityActual');
            await expect(payer.mint(pool, wallet.address, -22980, 0, 10000, 0, 100)).to.be.revertedWithCustomError(
              pool,
              'zeroLiquidityActual'
            );
          });

          it('fails if token1 paid 0', async () => {
            await expect(
              payer.mint(pool, wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 100, 100, 0)
            ).to.be.revertedWithCustomError(pool, 'zeroLiquidityActual');
            await expect(
              payer.mint(
                pool,
                wallet.address,
                minTick + tickSpacing,
                Math.floor((-23028 - tickSpacing) / tickSpacing) * tickSpacing,
                10000,
                100,
                0
              )
            ).to.be.revertedWithCustomError(pool, 'zeroLiquidityActual');
          });

          it('fails if token0 hardly underpaid', async () => {
            await expect(
              payer.mint(
                pool,
                wallet.address,
                minTick + tickSpacing,
                maxTick - tickSpacing,
                100,
                1,
                expandTo18Decimals(100)
              )
            ).to.be.revertedWithCustomError(pool, 'zeroLiquidityActual');
          });

          it('fails if token1 hardly underpaid', async () => {
            await swapToHigherPrice(encodePriceSqrt(10, 1), wallet.address);
            await expect(
              payer.mint(
                pool,
                wallet.address,
                minTick + tickSpacing,
                maxTick - tickSpacing,
                100,
                expandTo18Decimals(100),
                1
              )
            ).to.be.revertedWithCustomError(pool, 'zeroLiquidityActual');
          });
        });

        it('fails if bottomTick greater than topTick', async () => {
          await expect(mint(wallet.address, 1, 0, 1)).to.be.revertedWithCustomError(pool, 'topTickLowerOrEqBottomTick');
        });
        it('fails if invalid tickspacing', async () => {
          await expect(mint(wallet.address, tickSpacing - 1, tickSpacing * 2 - 1, 1)).to.be.revertedWithCustomError(
            pool,
            'tickIsNotSpaced'
          );
          await expect(mint(wallet.address, -(tickSpacing - 1), 0, 1)).to.be.revertedWithCustomError(
            pool,
            'tickIsNotSpaced'
          );
          await expect(mint(wallet.address, 0, tickSpacing - 1, 1)).to.be.revertedWithCustomError(
            pool,
            'tickIsNotSpaced'
          );
        });
        it('fails if bottomTick less than min tick', async () => {
          await expect(mint(wallet.address, -887273, 0, 1)).to.be.revertedWithCustomError(
            pool,
            'bottomTickLowerThanMIN'
          );
        });
        it('fails if topTick greater than max tick', async () => {
          await expect(mint(wallet.address, 0, 887273, 1)).to.be.revertedWithCustomError(pool, 'topTickAboveMAX');
        });
        it('fails if amount exceeds the max', async () => {
          const maxLiquidityGross = await pool.maxLiquidityPerTick();
          await expect(
            mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, maxLiquidityGross + 1n)
          ).to.be.revertedWithCustomError(pool, 'liquidityOverflow');
          await expect(mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, maxLiquidityGross)).to.not.be
            .reverted;
        });

        it('fails if amount exceeds the max uint128', async () => {
          await expect(mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, MaxUint128)).to.be.reverted;
        });

        it('fails if amount exceeds the 2**127', async () => {
          await expect(mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 2n ** 127n)).to.be.reverted;
        });

        it('fails if total amount at tick exceeds the max', async () => {
          await mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 1000);

          const maxLiquidityGross = await pool.maxLiquidityPerTick();
          await expect(
            mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, maxLiquidityGross - 1000n + 1n)
          ).to.be.revertedWithCustomError(pool, 'liquidityOverflow');
          await expect(
            mint(wallet.address, minTick + tickSpacing * 2, maxTick - tickSpacing, maxLiquidityGross - 1000n + 1n)
          ).to.be.revertedWithCustomError(pool, 'liquidityOverflow');
          await expect(
            mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing * 2, maxLiquidityGross - 1000n + 1n)
          ).to.be.revertedWithCustomError(pool, 'liquidityOverflow');
          await expect(mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, maxLiquidityGross - 1000n)).to
            .not.be.reverted;
        });
        it('fails if amount is 0', async () => {
          await expect(
            mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 0)
          ).to.be.revertedWithCustomError(pool, 'zeroLiquidityDesired');
        });
      });

      describe('success cases', () => {
        afterEach('check reserves', async () => {
          const reserves = await pool.getReserves();
          const balances = [await token0.balanceOf(pool), await token1.balanceOf(pool)];

          expect(reserves[0]).to.be.eq(balances[0]);
          expect(reserves[1]).to.be.eq(balances[1]);
        });

        it('initial balances', async () => {
          expect(await token0.balanceOf(pool)).to.eq(9996);
          expect(await token1.balanceOf(pool)).to.eq(1000);
        });

        it('initial tick', async () => {
          expect((await pool.globalState()).tick).to.eq(-23028);
        });

        it('emits event', async () => {
          await expect(mint(wallet.address, 0, tickSpacing, expandTo18Decimals(1)))
            .to.emit(pool, 'Mint')
            .withArgs(
              await swapTarget.getAddress(),
              wallet.address,
              0,
              tickSpacing,
              expandTo18Decimals(1),
              '2995354955910781',
              0
            );
        });

        const hasRefund = async (_receipt: ContractTransactionReceipt | null, _token: IERC20Minimal, to: string) => {
          const tokenAddress = await _token.getAddress();
          if (!_receipt) return false;
          return _receipt.logs?.some((x) => {
            if (x.address != tokenAddress) return false;
            const decoded = _token.interface.parseLog({ topics: [...x.topics], data: x.data });
            if (!decoded) return false;

            return decoded.name == 'Transfer' && decoded.args && decoded.args[1] == to;
          });
        };

        it('refund if overpayment', async () => {
          const factory = await ethers.getContractFactory('TestAlgebraSwapPay');
          let payer = (await factory.deploy()) as any as TestAlgebraSwapPay;
          await token0.approve(payer, 2n ** 256n - 1n);
          await token1.approve(payer, 2n ** 256n - 1n);

          const receipt = await (
            await payer.mint(
              pool,
              wallet.address,
              minTick + tickSpacing,
              maxTick - tickSpacing,
              10,
              expandTo18Decimals(1000),
              expandTo18Decimals(1000)
            )
          ).wait();

          const hasRefund0 = await hasRefund(receipt, token0, wallet.address);
          const hasRefund1 = await hasRefund(receipt, token1, wallet.address);

          expect(hasRefund0).to.be.true;
          expect(hasRefund1).to.be.true;
        });

        it('do not refund if not overpaid', async () => {
          const factory = await ethers.getContractFactory('TestAlgebraSwapPay');
          let payer = (await factory.deploy()) as any as TestAlgebraSwapPay;
          await token0.approve(payer, 2n ** 256n - 1n);
          await token1.approve(payer, 2n ** 256n - 1n);

          const tx = await mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, expandTo18Decimals(1000));

          const receipt = await tx.wait();

          const hasRefund0 = await hasRefund(receipt, token0, wallet.address);
          const hasRefund1 = await hasRefund(receipt, token1, wallet.address);

          expect(hasRefund0).to.be.false;
          expect(hasRefund1).to.be.false;
        });

        describe('underpayment', () => {
          let payer: TestAlgebraSwapPay;
          // TODO improve tests, check liquiditys
          beforeEach(async () => {
            const factory = await ethers.getContractFactory('TestAlgebraSwapPay');
            payer = (await factory.deploy()) as any as TestAlgebraSwapPay;
            await token0.approve(payer, 2n ** 256n - 1n);
            await token1.approve(payer, 2n ** 256n - 1n);
          });

          it('handle underpayment in both tokens', async () => {
            await expect(
              payer.mint(pool, wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 1000000, 100, 100)
            ).to.not.be.reverted;
          });

          it('handle underpayment in both tokens, token0 less', async () => {
            await expect(
              payer.mint(pool, wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 1000000, 50, 100)
            ).to.not.be.reverted;
          });

          it('handle underpayment in both tokens, token1 less', async () => {
            await expect(
              payer.mint(pool, wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 1000000, 100, 50)
            ).to.not.be.reverted;
          });

          it('handle underpayment in token0', async () => {
            await expect(
              payer.mint(pool, wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 1000000, 100, 100000000)
            ).to.not.be.reverted;
          });

          it('handle underpayment in token1', async () => {
            await expect(
              payer.mint(pool, wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 1000000, 100000000, 100)
            ).to.not.be.reverted;
          });
        });

        describe('above current price', () => {
          it('transfers token0 only', async () => {
            const poolAddress = await pool.getAddress();
            await expect(mint(wallet.address, -22980, 0, 10000))
              .to.emit(token0, 'Transfer')
              .withArgs(wallet.address, poolAddress, 21549)
              .to.not.emit(token1, 'Transfer');
            expect(await token0.balanceOf(pool)).to.eq(9996 + 21549);
            expect(await token1.balanceOf(pool)).to.eq(1000);
          });

          it('max tick with max leverage', async () => {
            await mint(wallet.address, maxTick - tickSpacing, maxTick, 2n ** 102n);
            expect(await token0.balanceOf(pool)).to.eq(9996 + 828011525);
            expect(await token1.balanceOf(pool)).to.eq(1000);
          });

          it('works for max tick', async () => {
            await expect(mint(wallet.address, -22980, maxTick, 10000))
              .to.emit(token0, 'Transfer')
              .withArgs(wallet.address, await pool.getAddress(), 31549);
            expect(await token0.balanceOf(pool)).to.eq(9996 + 31549);
            expect(await token1.balanceOf(pool)).to.eq(1000);
          });

          it('removing works', async () => {
            await mint(wallet.address, -240, 0, 10000);
            await pool.burn(-240, 0, 10000, '0x');
            const { amount0, amount1 } = await pool.collect.staticCall(wallet.address, -240, 0, MaxUint128, MaxUint128);
            expect(amount0, 'amount0').to.eq(120);
            expect(amount1, 'amount1').to.eq(0);
          });

          it('removing works with min amounts', async () => {
            await mint(wallet.address, -240, 0, 10000);
            await pool.burn(-240, 0, 10000, '0x');
            const { amount0, amount1 } = await pool.collect.staticCall(wallet.address, -240, 0, 1, 1);
            expect(amount0, 'amount0').to.eq(1);
            expect(amount1, 'amount1').to.eq(0);
          });

          it('removing works after tickSpacing increase', async () => {
            await mint(wallet.address, -240, 0, 10000);
            await pool.setTickSpacing(100);
            await pool.burn(-240, 0, 10000, '0x');
            const { amount0, amount1 } = await pool.collect.staticCall(wallet.address, -240, 0, MaxUint128, MaxUint128);
            expect(amount0, 'amount0').to.eq(120);
            expect(amount1, 'amount1').to.eq(0);
          });

          it('removing works after tickSpacing decrease', async () => {
            await mint(wallet.address, -240, 0, 10000);
            await pool.setTickSpacing(1);
            await pool.burn(-240, 0, 10000, '0x');
            const { amount0, amount1 } = await pool.collect.staticCall(wallet.address, -240, 0, MaxUint128, MaxUint128);
            expect(amount0, 'amount0').to.eq(120);
            expect(amount1, 'amount1').to.eq(0);
          });

          it('adds liquidity to liquidityTotal', async () => {
            await mint(wallet.address, -240, 0, 100);
            expect((await pool.ticks(-240)).liquidityTotal).to.eq(100);
            expect((await pool.ticks(0)).liquidityTotal).to.eq(100);
            expect((await pool.ticks(tickSpacing)).liquidityTotal).to.eq(0);
            expect((await pool.ticks(tickSpacing * 2)).liquidityTotal).to.eq(0);
            await mint(wallet.address, -240, tickSpacing, 150);
            expect((await pool.ticks(-240)).liquidityTotal).to.eq(250);
            expect((await pool.ticks(0)).liquidityTotal).to.eq(100);
            expect((await pool.ticks(tickSpacing)).liquidityTotal).to.eq(150);
            expect((await pool.ticks(tickSpacing * 2)).liquidityTotal).to.eq(0);
            await mint(wallet.address, 0, tickSpacing * 2, 60);
            expect((await pool.ticks(-240)).liquidityTotal).to.eq(250);
            expect((await pool.ticks(0)).liquidityTotal).to.eq(160);
            expect((await pool.ticks(tickSpacing)).liquidityTotal).to.eq(150);
            expect((await pool.ticks(tickSpacing * 2)).liquidityTotal).to.eq(60);
          });

          it('removes liquidity from liquidityTotal', async () => {
            await mint(wallet.address, -240, 0, 100);
            await mint(wallet.address, -240, 0, 40);
            await pool.burn(-240, 0, 90, '0x');
            expect((await pool.ticks(-240)).liquidityTotal).to.eq(50);
            expect((await pool.ticks(0)).liquidityTotal).to.eq(50);
          });

          it('clears tick lower if last position is removed', async () => {
            await mint(wallet.address, -240, 0, 100);
            await pool.burn(-240, 0, 100, '0x');
            const { liquidityTotal, outerFeeGrowth0Token, outerFeeGrowth1Token } = await pool.ticks(-240);
            expect(liquidityTotal).to.eq(0);
            expect(outerFeeGrowth0Token).to.eq(0);
            expect(outerFeeGrowth1Token).to.eq(0);
          });

          it('clears tick upper if last position is removed', async () => {
            await mint(wallet.address, -240, 0, 100);
            await pool.burn(-240, 0, 100, '0x');
            const { liquidityTotal, outerFeeGrowth0Token, outerFeeGrowth1Token } = await pool.ticks(0);
            expect(liquidityTotal).to.eq(0);
            expect(outerFeeGrowth0Token).to.eq(0);
            expect(outerFeeGrowth1Token).to.eq(0);
          });
          it('only clears the tick that is not used at all', async () => {
            await mint(wallet.address, -240, 0, 100);
            await mint(wallet.address, -tickSpacing, 0, 250);
            await pool.burn(-240, 0, 100, '0x');

            let { liquidityTotal, outerFeeGrowth0Token, outerFeeGrowth1Token } = await pool.ticks(-240);
            expect(liquidityTotal).to.eq(0);
            expect(outerFeeGrowth0Token).to.eq(0);
            expect(outerFeeGrowth1Token).to.eq(0);
            ({ liquidityTotal, outerFeeGrowth0Token, outerFeeGrowth1Token } = await pool.ticks(-tickSpacing));
            expect(liquidityTotal).to.eq(250);
            expect(outerFeeGrowth0Token).to.eq(0);
            expect(outerFeeGrowth1Token).to.eq(0);
          });
        });

        describe('including current price', () => {
          it('price within range: transfers current price of both tokens', async () => {
            const poolAddress = await pool.getAddress();
            await expect(mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 100))
              .to.emit(token0, 'Transfer')
              .withArgs(wallet.address, poolAddress, 317)
              .to.emit(token1, 'Transfer')
              .withArgs(wallet.address, poolAddress, 32);
            expect(await token0.balanceOf(pool)).to.eq(9996 + 317);
            expect(await token1.balanceOf(pool)).to.eq(1000 + 32);
          });

          it('initializes lower tick', async () => {
            await mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 100);
            const { liquidityTotal } = await pool.ticks(minTick + tickSpacing);
            expect(liquidityTotal).to.eq(100);
          });

          it('initializes upper tick', async () => {
            await mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 100);
            const { liquidityTotal } = await pool.ticks(maxTick - tickSpacing);
            expect(liquidityTotal).to.eq(100);
          });

          it('works for min/max tick', async () => {
            const poolAddress = await pool.getAddress();
            await expect(mint(wallet.address, minTick, maxTick, 10000))
              .to.emit(token0, 'Transfer')
              .withArgs(wallet.address, poolAddress, 31623)
              .to.emit(token1, 'Transfer')
              .withArgs(wallet.address, poolAddress, 3163);
            expect(await token0.balanceOf(pool)).to.eq(9996 + 31623);
            expect(await token1.balanceOf(pool)).to.eq(1000 + 3163);
          });

          it('removing works', async () => {
            await mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 100);
            await pool.burn(minTick + tickSpacing, maxTick - tickSpacing, 100, '0x');
            const { amount0, amount1 } = await pool.collect.staticCall(
              wallet.address,
              minTick + tickSpacing,
              maxTick - tickSpacing,
              MaxUint128,
              MaxUint128
            );
            expect(amount0, 'amount0').to.eq(316);
            expect(amount1, 'amount1').to.eq(31);
          });
        });

        describe('below current price', () => {
          it('transfers token1 only', async () => {
            await expect(mint(wallet.address, -46080, -23040, 10000))
              .to.emit(token1, 'Transfer')
              .withArgs(wallet.address, await pool.getAddress(), 2162)
              .to.not.emit(token0, 'Transfer');
            expect(await token0.balanceOf(pool)).to.eq(9996);
            expect(await token1.balanceOf(pool)).to.eq(1000 + 2162);
          });

          it('min tick with max leverage', async () => {
            await mint(wallet.address, minTick, minTick + tickSpacing, 2n ** 102n);
            expect(await token0.balanceOf(pool)).to.eq(9996);
            expect(await token1.balanceOf(pool)).to.eq(1000 + 828011520);
          });

          it('works for min tick', async () => {
            await expect(mint(wallet.address, minTick, -23040, 10000))
              .to.emit(token1, 'Transfer')
              .withArgs(wallet.address, await pool.getAddress(), 3161);
            expect(await token0.balanceOf(pool)).to.eq(9996);
            expect(await token1.balanceOf(pool)).to.eq(1000 + 3161);
          });

          it('removing works', async () => {
            await mint(wallet.address, -46080, -46020, 10000);
            await pool.burn(-46080, -46020, 10000, '0x');
            const { amount0, amount1 } = await pool.collect.staticCall(
              wallet.address,
              -46080,
              -46020,
              MaxUint128,
              MaxUint128
            );
            expect(amount0, 'amount0').to.eq(0);
            expect(amount1, 'amount1').to.eq(3);
          });
        });
      });

      it('community fees accumulate as expected during swap', async () => {
        await pool.setCommunityFee(170);

        await mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, expandTo18Decimals(1));
        await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);
        await swapExact1For0(expandTo18Decimals(1) / 100n, wallet.address);

        expect((await token0.balanceOf(vaultAddress)).toString()).to.eq('8500000000000');
        const [, communityFeePending1] = await pool.getCommunityFeePending();
        expect(communityFeePending1.toString()).to.eq('850000000000');
      });

      it('positions are protected before community fee is turned on', async () => {
        await mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, expandTo18Decimals(1));
        await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);
        await swapExact1For0(expandTo18Decimals(1) / 100n, wallet.address);

        expect(Number((await token0.balanceOf(vaultAddress)).toString())).to.eq(0);
        expect(Number((await token1.balanceOf(vaultAddress)).toString())).to.eq(0);

        await pool.setCommunityFee(170);
        expect(Number((await token0.balanceOf(vaultAddress)).toString())).to.eq(0);
        expect(Number((await token1.balanceOf(vaultAddress)).toString())).to.eq(0);
      });

      it('poke is not happened on uninitialized position', async () => {
        await mint(other.address, minTick + tickSpacing, maxTick - tickSpacing, expandTo18Decimals(1));
        await swapExact0For1(expandTo18Decimals(1) / 10n, wallet.address);
        await swapExact1For0(expandTo18Decimals(1) / 100n, wallet.address);

        await expect(pool.burn(minTick + tickSpacing, maxTick - tickSpacing, 0, '0x')).to.be.not.reverted;
        let {
          liquidity: l0,
          innerFeeGrowth0Token: ifg0,
          innerFeeGrowth1Token: ifg1,
          fees1: f1,
          fees0: f0,
        } = await pool.positions(
          await pool.getKeyForPosition(wallet.address, minTick + tickSpacing, maxTick - tickSpacing)
        );

        expect(l0).to.eq(0);
        expect(f0, 'tokens owed 0 before np').to.eq(0);
        expect(f1, 'tokens owed 1 before np').to.eq(0);
        expect(ifg0).to.eq('0');
        expect(ifg1).to.eq('0');

        await mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, 1);
        let { liquidity, innerFeeGrowth0Token, innerFeeGrowth1Token, fees1, fees0 } = await pool.positions(
          await pool.getKeyForPosition(wallet.address, minTick + tickSpacing, maxTick - tickSpacing)
        );
        expect(liquidity).to.eq(1);
        expect(fees0, 'tokens owed 0 before').to.eq(0);
        expect(fees1, 'tokens owed 1 before').to.eq(0);
        expect(innerFeeGrowth0Token).to.eq('17014118346046869391540638517434263');
        expect(innerFeeGrowth1Token).to.eq('1701411834604686939154063851743426');

        await pool.burn(minTick + tickSpacing, maxTick - tickSpacing, 1, '0x');
        ({ liquidity, innerFeeGrowth0Token, innerFeeGrowth1Token, fees1, fees0 } = await pool.positions(
          await pool.getKeyForPosition(wallet.address, minTick + tickSpacing, maxTick - tickSpacing)
        ));
        expect(liquidity).to.eq(0);
        expect(innerFeeGrowth0Token).to.eq('17014118346046869391540638517434263');
        expect(innerFeeGrowth1Token).to.eq('1701411834604686939154063851743426');
        expect(fees0, 'tokens owed 0 after').to.eq(3);
        expect(fees1, 'tokens owed 1 after').to.eq(0);
      });
    });
  });

  describe('#burn', () => {
    beforeEach('initialize at zero tick', () => initializeAtZeroTick(pool));

    async function checkTickIsClear(tick: number) {
      const { liquidityTotal, outerFeeGrowth0Token, outerFeeGrowth1Token, liquidityDelta } = await pool.ticks(tick);
      expect(liquidityTotal).to.eq(0);
      expect(outerFeeGrowth0Token).to.eq(0);
      expect(outerFeeGrowth1Token).to.eq(0);
      expect(liquidityDelta).to.eq(0);
    }

    async function checkTickIsNotClear(tick: number) {
      const { liquidityTotal } = await pool.ticks(tick);
      expect(liquidityTotal).to.not.eq(0);
    }

    it('does not clear the position fee growth snapshot if no more liquidity', async () => {
      // some activity that would make the ticks non-zero
      await pool.advanceTime(10);
      await mint(other.address, minTick, maxTick, expandTo18Decimals(1));
      await swapExact0For1(expandTo18Decimals(1), wallet.address);
      await swapExact1For0(expandTo18Decimals(1), wallet.address);
      await pool.connect(other).burn(minTick, maxTick, expandTo18Decimals(1), '0x');
      const { liquidity, fees0, fees1, innerFeeGrowth0Token, innerFeeGrowth1Token } = await pool.positions(
        await pool.getKeyForPosition(other.address, minTick, maxTick)
      );
      expect(liquidity).to.eq(0);
      expect(fees0).to.not.eq(0);
      expect(fees1).to.not.eq(0);
      expect(innerFeeGrowth0Token).to.eq('56713727820156410577229101238628035');
      expect(innerFeeGrowth1Token).to.eq('56713727820156410577229101238628035');
    });

    it('clears the tick if its the last position using it', async () => {
      const bottomTick = minTick + tickSpacing;
      const topTick = maxTick - tickSpacing;
      // some activity that would make the ticks non-zero
      await pool.advanceTime(10);
      await mint(wallet.address, bottomTick, topTick, 1);
      await swapExact0For1(expandTo18Decimals(1), wallet.address);
      await pool.burn(bottomTick, topTick, 1, '0x');
      await checkTickIsClear(bottomTick);
      await checkTickIsClear(topTick);
    });

    it('clears the tick if its the last position using it after tickSpacing increase', async () => {
      const bottomTick = minTick + tickSpacing;
      const topTick = maxTick - tickSpacing;
      // some activity that would make the ticks non-zero
      await pool.advanceTime(10);
      await mint(wallet.address, bottomTick, topTick, 1);
      await swapExact0For1(expandTo18Decimals(1), wallet.address);
      await pool.setTickSpacing(200);
      await pool.burn(bottomTick, topTick, 1, '0x');
      await checkTickIsClear(bottomTick);
      await checkTickIsClear(topTick);
    });

    it('clears only the lower tick if upper is still used', async () => {
      const bottomTick = minTick + tickSpacing;
      const topTick = maxTick - tickSpacing;
      // some activity that would make the ticks non-zero
      await pool.advanceTime(10);
      await mint(wallet.address, bottomTick, topTick, 1);
      await mint(wallet.address, bottomTick + tickSpacing, topTick, 1);
      await swapExact0For1(expandTo18Decimals(1), wallet.address);
      await pool.burn(bottomTick, topTick, 1, '0x');
      await checkTickIsClear(bottomTick);
      await checkTickIsNotClear(topTick);
    });

    it('clears only the lower tick if upper is still used after tickSpacing decrease', async () => {
      const bottomTick = minTick + tickSpacing;
      const topTick = maxTick - tickSpacing;
      // some activity that would make the ticks non-zero
      await pool.advanceTime(10);
      await mint(wallet.address, bottomTick, topTick, 1);
      await mint(wallet.address, bottomTick + tickSpacing, topTick, 1);
      await pool.setTickSpacing(5);
      await swapExact0For1(expandTo18Decimals(1), wallet.address);
      await pool.burn(bottomTick, topTick, 1, '0x');
      await checkTickIsClear(bottomTick);
      await checkTickIsNotClear(topTick);
    });

    it('clears only the upper tick if lower is still used', async () => {
      const bottomTick = minTick + tickSpacing;
      const topTick = maxTick - tickSpacing;
      // some activity that would make the ticks non-zero
      await pool.advanceTime(10);
      await mint(wallet.address, bottomTick, topTick, 1);
      await mint(wallet.address, bottomTick, topTick - tickSpacing, 1);
      await swapExact0For1(expandTo18Decimals(1), wallet.address);
      await pool.burn(bottomTick, topTick, 1, '0x');
      await checkTickIsNotClear(bottomTick);
      await checkTickIsClear(topTick);
    });

    it('clears only the upper tick if lower is still used after tickSpacing increase', async () => {
      const bottomTick = minTick + tickSpacing;
      const topTick = maxTick - tickSpacing;
      // some activity that would make the ticks non-zero
      await pool.advanceTime(10);
      await mint(wallet.address, bottomTick, topTick, 1);
      await mint(wallet.address, bottomTick, topTick - tickSpacing, 1);
      await pool.setTickSpacing(100);
      await swapExact0For1(expandTo18Decimals(1), wallet.address);
      await pool.burn(bottomTick, topTick, 1, '0x');
      await checkTickIsNotClear(bottomTick);
      await checkTickIsClear(topTick);
    });

    it('fails when try to burn with incorrect ticks', async () => {
      const bottomTick = minTick + tickSpacing;
      const topTick = maxTick - tickSpacing;
      // some activity that would make the ticks non-zero
      await pool.advanceTime(10);
      await mint(wallet.address, bottomTick, topTick, 1);
      await swapExact0For1(expandTo18Decimals(1), wallet.address);
      await expect(pool.burn(topTick, bottomTick, 1, '0x')).to.be.revertedWithCustomError(
        pool,
        'topTickLowerOrEqBottomTick'
      );
    });

    it('fails when try to burn max uint128 value', async () => {
      const bottomTick = minTick + tickSpacing;
      const topTick = maxTick - tickSpacing;
      // some activity that would make the ticks non-zero
      await pool.advanceTime(10);
      await mint(wallet.address, bottomTick, topTick, 1);
      await swapExact0For1(expandTo18Decimals(1), wallet.address);
      await expect(pool.burn(bottomTick, topTick, 2n ** 128n - 1n, '0x')).to.be.revertedWithCustomError(
        pool,
        'arithmeticError'
      );
    });

    it('fails when try to burn max int128 + 1 value', async () => {
      const bottomTick = minTick + tickSpacing;
      const topTick = maxTick - tickSpacing;
      // some activity that would make the ticks non-zero
      await pool.advanceTime(10);
      await mint(wallet.address, bottomTick, topTick, 1);
      await swapExact0For1(expandTo18Decimals(1), wallet.address);
      await expect(pool.burn(bottomTick, topTick, 2n ** 127n, '0x')).to.be.revertedWithCustomError(
        pool,
        'arithmeticError'
      );
    });

    it('do not emit event after poke on empty position', async () => {
      const bottomTick = minTick + 2 * tickSpacing;
      const topTick = maxTick - 2 * tickSpacing;
      // some activity that would make the ticks non-zero
      await pool.advanceTime(10);
      await expect(pool.burn(bottomTick, topTick, 0, '0x')).to.not.emit(pool, 'Burn');
    });
  });

  // the combined amount of liquidity that the pool is initialized with (including the 1 minimum liquidity that is burned)
  const initializeLiquidityAmount = expandTo18Decimals(2);
  async function initializeAtZeroTick(pool: MockTimeAlgebraPool): Promise<void> {
    await pool.initialize(encodePriceSqrt(1, 1));
    const tickSpacing = Number(await pool.tickSpacing());
    const [min, max] = [getMinTick(tickSpacing), getMaxTick(tickSpacing)];
    await mint(wallet.address, min, max, initializeLiquidityAmount);
  }

  describe('miscellaneous mint tests', () => {
    beforeEach('initialize at zero tick', async () => {
      pool = await createPoolWrapped();
      await initializeAtZeroTick(pool);
    });

    it('mint to the right of the current price', async () => {
      const liquidityDelta = 1000;
      const bottomTick = tickSpacing;
      const topTick = tickSpacing * 2;

      const liquidityBefore = await pool.liquidity();

      const b0 = await token0.balanceOf(pool);
      const b1 = await token1.balanceOf(pool);

      await mint(wallet.address, bottomTick, topTick, liquidityDelta);

      const liquidityAfter = await pool.liquidity();
      expect(liquidityAfter).to.be.gte(liquidityBefore);

      expect((await token0.balanceOf(pool)) - b0).to.eq(3);
      expect((await token1.balanceOf(pool)) - b1).to.eq(0);
    });

    it('mint to the left of the current price', async () => {
      const liquidityDelta = 1000;
      const bottomTick = -tickSpacing * 2;
      const topTick = -tickSpacing;

      const liquidityBefore = await pool.liquidity();

      const b0 = await token0.balanceOf(pool);
      const b1 = await token1.balanceOf(pool);

      await mint(wallet.address, bottomTick, topTick, liquidityDelta);

      const liquidityAfter = await pool.liquidity();
      expect(liquidityAfter).to.be.gte(liquidityBefore);

      expect((await token0.balanceOf(pool)) - b0).to.eq(0);
      expect((await token1.balanceOf(pool)) - b1).to.eq(3);
    });

    it('mint within the current price', async () => {
      const liquidityDelta = 1000;
      const bottomTick = -tickSpacing;
      const topTick = tickSpacing;

      const liquidityBefore = await pool.liquidity();

      const b0 = await token0.balanceOf(pool);
      const b1 = await token1.balanceOf(pool);

      await mint(wallet.address, bottomTick, topTick, liquidityDelta);

      const liquidityAfter = await pool.liquidity();
      expect(liquidityAfter).to.be.gte(liquidityBefore);

      expect((await token0.balanceOf(pool)) - b0).to.eq(3);
      expect((await token1.balanceOf(pool)) - b1).to.eq(3);
    });

    it('cannot remove more than the entire position', async () => {
      const bottomTick = -tickSpacing;
      const topTick = tickSpacing;
      await mint(wallet.address, bottomTick, topTick, expandTo18Decimals(1000));
      await expect(pool.burn(bottomTick, topTick, expandTo18Decimals(1001), '0x')).to.be.revertedWithCustomError(
        pool,
        'liquiditySub'
      );
    });

    it('collect fees within the current price after swap', async () => {
      const liquidityDelta = expandTo18Decimals(100);
      const bottomTick = -tickSpacing * 100;
      const topTick = tickSpacing * 100;

      await mint(wallet.address, bottomTick, topTick, liquidityDelta);

      const liquidityBefore = await pool.liquidity();

      const amount0In = expandTo18Decimals(1);
      await swapExact0For1(amount0In, wallet.address);

      const liquidityAfter = await pool.liquidity();
      expect(liquidityAfter, 'k increases').to.be.gte(liquidityBefore);

      const token0BalanceBeforePool = await token0.balanceOf(pool);
      const token1BalanceBeforePool = await token1.balanceOf(pool);
      const token0BalanceBeforeWallet = await token0.balanceOf(wallet.address);
      const token1BalanceBeforeWallet = await token1.balanceOf(wallet.address);

      await pool.burn(bottomTick, topTick, 0, '0x');
      await pool.collect(wallet.address, bottomTick, topTick, MaxUint128, MaxUint128);

      await pool.burn(bottomTick, topTick, 0, '0x');
      const { amount0: fees0, amount1: fees1 } = await pool.collect.staticCall(
        wallet.address,
        bottomTick,
        topTick,
        MaxUint128,
        MaxUint128
      );
      expect(fees0).to.be.eq(0);
      expect(fees1).to.be.eq(0);

      const token0BalanceAfterWallet = await token0.balanceOf(wallet.address);
      const token1BalanceAfterWallet = await token1.balanceOf(wallet.address);
      const token0BalanceAfterPool = await token0.balanceOf(pool);
      const token1BalanceAfterPool = await token1.balanceOf(pool);

      expect(token0BalanceAfterWallet).to.be.gt(token0BalanceBeforeWallet);
      expect(token1BalanceAfterWallet).to.be.eq(token1BalanceBeforeWallet);

      expect(token0BalanceAfterPool).to.be.lt(token0BalanceBeforePool);
      expect(token1BalanceAfterPool).to.be.eq(token1BalanceBeforePool);
    });
  });

  describe('post-initialize at medium fee', () => {
    describe('k (implicit)', () => {
      it('returns 0 before initialization', async () => {
        expect(await pool.liquidity()).to.eq(0);
      });
      describe('post initialized', () => {
        beforeEach(() => initializeAtZeroTick(pool));

        it('returns initial liquidity', async () => {
          expect(await pool.liquidity()).to.eq(expandTo18Decimals(2));
        });
        it('returns in supply in range', async () => {
          await mint(wallet.address, -tickSpacing, tickSpacing, expandTo18Decimals(3));
          expect(await pool.liquidity()).to.eq(expandTo18Decimals(5));
        });
        it('excludes supply at tick above current tick', async () => {
          await mint(wallet.address, tickSpacing, tickSpacing * 2, expandTo18Decimals(3));
          expect(await pool.liquidity()).to.eq(expandTo18Decimals(2));
        });
        it('excludes supply at tick below current tick', async () => {
          await mint(wallet.address, -tickSpacing * 2, -tickSpacing, expandTo18Decimals(3));
          expect(await pool.liquidity()).to.eq(expandTo18Decimals(2));
        });
        it('updates correctly when exiting range', async () => {
          const kBefore = await pool.liquidity();
          expect(kBefore).to.be.eq(expandTo18Decimals(2));

          // add liquidity at and above current tick
          const liquidityDelta = expandTo18Decimals(1);
          const bottomTick = 0;
          const topTick = tickSpacing;
          await mint(wallet.address, bottomTick, topTick, liquidityDelta);

          // ensure virtual supply has increased appropriately
          const kAfter = await pool.liquidity();
          expect(kAfter).to.be.eq(expandTo18Decimals(3));

          // swap toward the left (just enough for the tick transition function to trigger)
          await swapExact0For1(1, wallet.address);
          const { tick } = await pool.globalState();
          expect(tick).to.be.eq(-1);

          const kAfterSwap = await pool.liquidity();
          expect(kAfterSwap).to.be.eq(expandTo18Decimals(2));
        });
        it('updates correctly when entering range', async () => {
          const kBefore = await pool.liquidity();
          expect(kBefore).to.be.eq(expandTo18Decimals(2));

          // add liquidity below the current tick
          const liquidityDelta = expandTo18Decimals(1);
          const bottomTick = -tickSpacing;
          const topTick = 0;
          await mint(wallet.address, bottomTick, topTick, liquidityDelta);

          // ensure virtual supply hasn't changed
          const kAfter = await pool.liquidity();
          expect(kAfter).to.be.eq(kBefore);

          // swap toward the left (just enough for the tick transition function to trigger)
          await swapExact0For1(1, wallet.address);
          const { tick } = await pool.globalState();
          expect(tick).to.be.eq(-1);

          const kAfterSwap = await pool.liquidity();
          expect(kAfterSwap).to.be.eq(expandTo18Decimals(3));
        });
      });
    });
  });

  describe('limit orders', () => {
    beforeEach('initialize at tick 0', () => initializeAtZeroTick(pool));

    it('limit selling 0 for 1 at tick 0 thru 1', async () => {
      const poolAddress = await pool.getAddress();
      await expect(mint(wallet.address, 0, 120, expandTo18Decimals(1)))
        .to.emit(token0, 'Transfer')
        .withArgs(wallet.address, poolAddress, '5981737760509663');
      // somebody takes the limit order
      await swapExact1For0(expandTo18Decimals(2), other.address);
      await expect(pool.burn(0, 120, expandTo18Decimals(1), '0x'))
        .to.emit(pool, 'Burn')
        .withArgs(wallet.address, 0, 120, expandTo18Decimals(1), 0, '6017734268818165')
        .to.not.emit(token0, 'Transfer')
        .to.not.emit(token1, 'Transfer');
      await expect(pool.collect(wallet.address, 0, 120, MaxUint128, MaxUint128))
        .to.emit(token1, 'Transfer')
        .withArgs(poolAddress, wallet.address, BigInt('6020744641138734'))
        .to.not.emit(token0, 'Transfer');
      expect((await pool.globalState()).tick).to.be.gte(120);
    });
    it('limit selling 1 for 0 at tick 0 thru -1', async () => {
      const poolAddress = await pool.getAddress();
      await expect(mint(wallet.address, -120, 0, expandTo18Decimals(1)))
        .to.emit(token1, 'Transfer')
        .withArgs(wallet.address, poolAddress, '5981737760509663');
      // somebody takes the limit order
      await swapExact0For1(expandTo18Decimals(2), other.address);
      await expect(pool.burn(-120, 0, expandTo18Decimals(1), '0x'))
        .to.emit(pool, 'Burn')
        .withArgs(wallet.address, -120, 0, expandTo18Decimals(1), '6017734268818165', 0)
        .to.not.emit(token0, 'Transfer')
        .to.not.emit(token1, 'Transfer');
      await expect(pool.collect(wallet.address, -120, 0, MaxUint128, MaxUint128))
        .to.emit(token0, 'Transfer')
        .withArgs(poolAddress, wallet.address, BigInt('6020744641138734'));
      expect((await pool.globalState()).tick).to.be.lt(-120);
    });

    describe('fee is on', () => {
      beforeEach(() => pool.setCommunityFee(170));
      it('limit selling 0 for 1 at tick 0 thru 1', async () => {
        const poolAddress = await pool.getAddress();
        await expect(mint(wallet.address, 0, 120, expandTo18Decimals(1)))
          .to.emit(token0, 'Transfer')
          .withArgs(wallet.address, poolAddress, '5981737760509663');
        // somebody takes the limit order
        await swapExact1For0(expandTo18Decimals(2), other.address);
        await expect(pool.burn(0, 120, expandTo18Decimals(1), '0x'))
          .to.emit(pool, 'Burn')
          .withArgs(wallet.address, 0, 120, expandTo18Decimals(1), 0, '6017734268818165')
          .to.not.emit(token0, 'Transfer')
          .to.not.emit(token1, 'Transfer');
        await expect(pool.collect(wallet.address, 0, 120, MaxUint128, MaxUint128))
          .to.emit(token1, 'Transfer')
          .withArgs(poolAddress, wallet.address, BigInt('6017734268818165') + 2498609026072n);
        expect((await pool.globalState()).tick).to.be.gte(120);
      });
      it('limit selling 1 for 0 at tick 0 thru -1', async () => {
        const poolAddress = await pool.getAddress();
        await expect(mint(wallet.address, -120, 0, expandTo18Decimals(1)))
          .to.emit(token1, 'Transfer')
          .withArgs(wallet.address, poolAddress, '5981737760509663');
        // somebody takes the limit order
        await swapExact0For1(expandTo18Decimals(2), other.address);
        await expect(pool.burn(-120, 0, expandTo18Decimals(1), '0x'))
          .to.emit(pool, 'Burn')
          .withArgs(wallet.address, -120, 0, expandTo18Decimals(1), '6017734268818165', 0)
          .to.not.emit(token0, 'Transfer')
          .to.not.emit(token1, 'Transfer');
        await expect(pool.collect(wallet.address, -120, 0, MaxUint128, MaxUint128))
          .to.emit(token0, 'Transfer')
          .withArgs(poolAddress, wallet.address, BigInt('6017734268818165') + 2498609026072n);
        expect((await pool.globalState()).tick).to.be.lt(-120);
      });
    });
  });

  describe('#swaps', () => {
    describe('#swap', async () => {
      it('fails if not initialized', async () => {
        await expect(swapToLowerPrice(encodePriceSqrt(1, 5), other.address)).to.be.revertedWithCustomError(
          pool,
          'notInitialized'
        );
      });
      describe('after initialization', () => {
        beforeEach('initialize the pool at price of 10:1', async () => {
          await pool.initialize(encodePriceSqrt(1, 10));
        });

        describe('swaps without liquidity', async () => {
          it('can swap to max tick', async () => {
            await swapExact1For0(1, wallet.address);
            const tick = (await pool.globalState()).tick;
            expect(tick).to.be.eq(MAX_TICK - 1);
          });

          it('can swap to min tick', async () => {
            await swapExact0For1(1, wallet.address);
            const tick = (await pool.globalState()).tick;
            expect(tick).to.be.eq(MIN_TICK);
          });

          it('can swap through whole price range', async () => {
            await swapExact0For1(1, wallet.address);
            let tick = (await pool.globalState()).tick;
            expect(tick).to.be.eq(MIN_TICK);
            await swapExact1For0(1, wallet.address);
            tick = (await pool.globalState()).tick;
            expect(tick).to.be.eq(MAX_TICK - 1);
            await swapExact0For1(1, wallet.address);
            tick = (await pool.globalState()).tick;
            expect(tick).to.be.eq(MIN_TICK);
          });

          it('can swap to lower price', async () => {
            await swapExact0For1(1, wallet.address, encodePriceSqrt(1, 1000));
            const price = (await pool.globalState()).price;
            expect(price).to.be.eq(encodePriceSqrt(1, 1000));
          });

          it('can swap to higher price', async () => {
            await swapExact1For0(1, wallet.address, encodePriceSqrt(1000, 1));
            const price = (await pool.globalState()).price;
            expect(price).to.be.eq(encodePriceSqrt(1000, 1));
          });
        });

        it('fails if required int256.min', async () => {
          await mint(wallet.address, minTick, maxTick, 3161);
          await expect(
            pool.swap(
              other.address,
              true,
              '-57896044618658097711785492504343953926634992332820282019728792003956564819968',
              0,
              '0x'
            )
          ).to.be.revertedWithCustomError(pool, 'invalidAmountRequired');
        });
      });
    });

    describe('#swapWithPaymentInAdvance', async () => {
      it('fails if not initialized', async () => {
        await expect(swapExact0For1SupportingFee(100, other.address)).to.be.revertedWithCustomError(
          pool,
          'notInitialized'
        );
      });
      describe('after initialization', () => {
        beforeEach('initialize the pool at price of 10:1', async () => {
          await pool.initialize(encodePriceSqrt(1, 10));
          await mint(wallet.address, minTick, maxTick, 3161);
        });

        it('fails if required negative amount', async () => {
          await expect(
            pool.swapWithPaymentInAdvance(other.address, other.address, true, '-1', 0, '0x')
          ).to.be.revertedWithCustomError(pool, 'invalidAmountRequired');
        });

        it('fails if required 0 amount', async () => {
          await expect(swapExact0For1SupportingFee(0, other.address)).to.be.revertedWithCustomError(
            pool,
            'insufficientInputAmount'
          );
        });

        it('fails if required uint128 max amount', async () => {
          await expect(swapExact0For1SupportingFee(2n ** 128n - 1n, other.address)).to.be.reverted;
        });

        it('fails if required int256 max amount', async () => {
          await expect(swapExact0For1SupportingFee(2n ** 255n - 1n, other.address)).to.be.reverted;
        });

        it('fails if required min256 amount', async () => {
          await expect(
            pool.swapWithPaymentInAdvance(
              other.address,
              other.address,
              true,
              '-57896044618658097711785492504343953926634992332820282019728792003956564819968',
              0,
              '0x'
            )
          ).to.be.revertedWithCustomError(pool, 'invalidAmountRequired');
        });

        it('pass correct amounts to callback', async () => {
          await expect(swapExact0For1SupportingFee(expandTo18Decimals(1), wallet.address))
            .to.emit(swapTarget, 'SwapCallback')
            .withArgs(expandTo18Decimals(1), 0);
          await expect(swapExact1For0SupportingFee(expandTo18Decimals(1), wallet.address))
            .to.emit(swapTarget, 'SwapCallback')
            .withArgs(0, expandTo18Decimals(1));
        });
      });
    });
  });

  describe('#collect', () => {
    beforeEach(async () => {
      pool = await createPoolWrapped();
      await pool.initialize(encodePriceSqrt(1, 1));
    });

    afterEach('check reserves', async () => {
      const reserves = await pool.getReserves();
      const balances = [await token0.balanceOf(pool), await token1.balanceOf(pool)];

      expect(reserves[0]).to.be.eq(balances[0]);
      expect(reserves[1]).to.be.eq(balances[1]);
    });

    it('works with multiple LPs', async () => {
      await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
      await mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, expandTo18Decimals(2));

      await swapExact0For1(expandTo18Decimals(1), wallet.address);
      // poke positions
      await pool.burn(minTick, maxTick, 0, '0x');
      await pool.burn(minTick + tickSpacing, maxTick - tickSpacing, 0, '0x');

      const { fees0: fees0Position0 } = await pool.positions(
        await getPositionKey(wallet.address, minTick, maxTick, pool)
      );
      const { fees0: fees0Position1 } = await pool.positions(
        await getPositionKey(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, pool)
      );

      expect(fees0Position0).to.be.eq('166666666666666');
      expect(fees0Position1).to.be.eq('333333333333333');
    });

    it('collect part of fees', async () => {
      await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));

      await swapExact0For1(expandTo18Decimals(1), wallet.address);

      await swapExact1For0(expandTo18Decimals(1), wallet.address);

      await pool.burn(minTick, maxTick, 0, '0x');

      const { fees0: fees0Position0before, fees1: fees0Position1before } = await pool.positions(
        await getPositionKey(wallet.address, minTick, maxTick, pool)
      );

      expect(fees0Position0before).to.eq('499999999999999');
      expect(fees0Position1before).to.eq('499999999999999');

      // collect the fees
      await pool.collect(wallet.address, minTick, maxTick, 1000, 1000);

      const { fees0: fees0Position0, fees1: fees0Position1 } = await pool.positions(
        await getPositionKey(wallet.address, minTick, maxTick, pool)
      );

      expect(fees0Position0).to.be.eq('499999999998999');
      expect(fees0Position1).to.be.eq('499999999998999');
    });

    it('emits event', async () => {
      await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));

      await swapExact0For1(expandTo18Decimals(1), wallet.address);

      await swapExact1For0(expandTo18Decimals(1), wallet.address);

      await pool.burn(minTick, maxTick, 0, '0x');

      await expect(pool.collect(wallet.address, minTick, maxTick, 1000, 1000))
        .to.emit(pool, 'Collect')
        .withArgs(wallet.address, wallet.address, minTick, maxTick, 1000, 1000);
    });

    it('do not emit event if 0 collected', async () => {
      await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));

      await expect(pool.collect(wallet.address, minTick, maxTick, 0, 0)).to.not.emit(pool, 'Collect');
    });

    it('works with multiple LPs after tickSpacing increase', async () => {
      await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
      await mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, expandTo18Decimals(2));

      await swapExact0For1(expandTo18Decimals(1), wallet.address);

      await pool.setTickSpacing(200);
      // poke positions
      await pool.burn(minTick, maxTick, 0, '0x');
      await pool.burn(minTick + tickSpacing, maxTick - tickSpacing, 0, '0x');

      const { fees0: fees0Position0 } = await pool.positions(
        await getPositionKey(wallet.address, minTick, maxTick, pool)
      );
      const { fees0: fees0Position1 } = await pool.positions(
        await getPositionKey(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, pool)
      );

      expect(fees0Position0).to.be.eq('166666666666666');
      expect(fees0Position1).to.be.eq('333333333333333');
    });

    it('works with multiple LPs after tickSpacing decrease', async () => {
      await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
      await mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, expandTo18Decimals(2));

      await pool.setTickSpacing(1);

      await swapExact0For1(expandTo18Decimals(1), wallet.address);

      // poke positions
      await pool.burn(minTick, maxTick, 0, '0x');
      await pool.burn(minTick + tickSpacing, maxTick - tickSpacing, 0, '0x');

      const { fees0: fees0Position0 } = await pool.positions(
        await getPositionKey(wallet.address, minTick, maxTick, pool)
      );
      const { fees0: fees0Position1 } = await pool.positions(
        await getPositionKey(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, pool)
      );

      expect(fees0Position0).to.be.eq('166666666666666');
      expect(fees0Position1).to.be.eq('333333333333333');
    });

    it('works with zero fee', async () => {
      await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
      await pool.setFee(0);
      await swap0ForExact1(expandTo18Decimals(1), other.address);
      await pool.burn(minTick, maxTick, 0, '0x');
      const { fees0: fee0, fees1: fee1 } = await pool.positions(
        await getPositionKey(wallet.address, minTick, maxTick, pool)
      );
      expect(fee0).to.be.eq(0);
      expect(fee1).to.be.eq(0);
    });

    it('works with uint16.max fee', async () => {
      let amount = expandTo18Decimals(1);
      await mint(wallet.address, minTick, maxTick, amount);
      await pool.setFee(65535);
      await swapExact1For0(amount, other.address);
      await pool.burn(minTick, maxTick, 0, '0x');
      const { fees0: fee0, fees1: fee1 } = await pool.positions(
        await getPositionKey(wallet.address, minTick, maxTick, pool)
      );
      expect(fee0).to.be.eq(0);
      expect(fee1).to.be.eq((amount * 65535n) / 1000000n - 1n);
    });

    describe('works across large increases', () => {
      beforeEach(async () => {
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
      });

      // type(uint128).max * 2**128 / 1e18
      // https://www.wolframalpha.com/input/?i=%282**128+-+1%29+*+2**128+%2F+1e18
      const magicNumber = BigInt('115792089237316195423570985008687907852929702298719625575994');

      it('works just before the cap binds', async () => {
        await pool.setTotalFeeGrowth0Token(magicNumber);
        await pool.burn(minTick, maxTick, 0, '0x');

        const { fees0, fees1 } = await pool.positions(await getPositionKey(wallet.address, minTick, maxTick, pool));

        expect(fees0).to.be.eq(MaxUint128 - 1n);
        expect(fees1).to.be.eq(0);
      });

      it('works just after the cap binds', async () => {
        await pool.setTotalFeeGrowth0Token(magicNumber + 1n);
        await pool.burn(minTick, maxTick, 0, '0x');

        const { fees0, fees1 } = await pool.positions(await getPositionKey(wallet.address, minTick, maxTick, pool));

        expect(fees0).to.be.eq(MaxUint128);
        expect(fees1).to.be.eq(0);
      });

      it('works well after the cap binds', async () => {
        await pool.setTotalFeeGrowth0Token(MaxUint256);
        await pool.burn(minTick, maxTick, 0, '0x');

        const { fees0, fees1 } = await pool.positions(await getPositionKey(wallet.address, minTick, maxTick, pool));

        expect(fees0).to.be.eq(MaxUint128);
        expect(fees1).to.be.eq(0);
      });
    });

    describe('works across overflow boundaries', () => {
      beforeEach(async () => {
        await pool.setTotalFeeGrowth0Token(MaxUint256);
        await pool.setTotalFeeGrowth1Token(MaxUint256);
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(10));
      });

      it('token0', async () => {
        await swapExact0For1(expandTo18Decimals(1), wallet.address);
        await pool.burn(minTick, maxTick, 0, '0x');
        const { amount0, amount1 } = await pool.collect.staticCall(
          wallet.address,
          minTick,
          maxTick,
          MaxUint128,
          MaxUint128
        );
        expect(amount0).to.be.eq('499999999999999');
        expect(amount1).to.be.eq(0);
      });

      it('unexpected donation', async () => {
        await token1.transfer(pool, expandTo18Decimals(1));
        await token0.transfer(pool, expandTo18Decimals(2));
        await pool.burn(minTick, maxTick, 0, '0x');
        const { amount0, amount1 } = await pool.collect.staticCall(
          wallet.address,
          minTick,
          maxTick,
          MaxUint128,
          MaxUint128
        );
        expect(amount0).to.be.eq('1999999999999999999');
        expect(amount1).to.be.eq('999999999999999999');
      });
      it('token0 with unexpected donation before burn', async () => {
        await swapExact0For1(expandTo18Decimals(1), wallet.address);
        await token0.transfer(pool, expandTo18Decimals(1));
        await pool.burn(minTick, maxTick, 0, '0x');
        const { amount0, amount1 } = await pool.collect.staticCall(
          wallet.address,
          minTick,
          maxTick,
          MaxUint128,
          MaxUint128
        );
        expect(amount0).to.be.eq('1000499999999999999');
        expect(amount1).to.be.eq(0);
      });
      it('token0 with unexpected donation before swap', async () => {
        await token0.transfer(pool, expandTo18Decimals(1));
        await swapExact0For1(expandTo18Decimals(1), wallet.address);
        await pool.burn(minTick, maxTick, 0, '0x');
        const { amount0, amount1 } = await pool.collect.staticCall(
          wallet.address,
          minTick,
          maxTick,
          MaxUint128,
          MaxUint128
        );
        expect(amount0).to.be.eq('1000499999999999999');
        expect(amount1).to.be.eq(0);
      });
      it('token1', async () => {
        await swapExact1For0(expandTo18Decimals(1), wallet.address);
        await pool.burn(minTick, maxTick, 0, '0x');
        const { amount0, amount1 } = await pool.collect.staticCall(
          wallet.address,
          minTick,
          maxTick,
          MaxUint128,
          MaxUint128
        );
        expect(amount0).to.be.eq(0);
        expect(amount1).to.be.eq('499999999999999');
      });
      it('token1 with unexpected donation before burn', async () => {
        await swapExact1For0(expandTo18Decimals(1), wallet.address);
        await token1.transfer(pool, expandTo18Decimals(1));
        await pool.burn(minTick, maxTick, 0, '0x');
        const { amount0, amount1 } = await pool.collect.staticCall(
          wallet.address,
          minTick,
          maxTick,
          MaxUint128,
          MaxUint128
        );
        expect(amount0).to.be.eq(0);
        expect(amount1).to.be.eq('1000499999999999999');
      });
      it('token1 with unexpected donation before swap', async () => {
        await token1.transfer(pool, expandTo18Decimals(1));
        await swapExact1For0(expandTo18Decimals(1), wallet.address);
        await pool.burn(minTick, maxTick, 0, '0x');
        const { amount0, amount1 } = await pool.collect.staticCall(
          wallet.address,
          minTick,
          maxTick,
          MaxUint128,
          MaxUint128
        );
        expect(amount0).to.be.eq(0);
        expect(amount1).to.be.eq('1000499999999999999');
      });
      it('token0 and token1', async () => {
        await swapExact0For1(expandTo18Decimals(1), wallet.address);
        await swapExact1For0(expandTo18Decimals(1), wallet.address);
        await pool.burn(minTick, maxTick, 0, '0x');
        const { amount0, amount1 } = await pool.collect.staticCall(
          wallet.address,
          minTick,
          maxTick,
          MaxUint128,
          MaxUint128
        );
        expect(amount0).to.be.eq('499999999999999');
        expect(amount1).to.be.eq('499999999999999');
      });
      it('token0 and token1 with unexpected donation before burn', async () => {
        await swapExact0For1(expandTo18Decimals(1), wallet.address);
        await swapExact1For0(expandTo18Decimals(1), wallet.address);
        await token1.transfer(pool, expandTo18Decimals(1));
        await token0.transfer(pool, expandTo18Decimals(2));
        await pool.burn(minTick, maxTick, 0, '0x');
        const { amount0, amount1 } = await pool.collect.staticCall(
          wallet.address,
          minTick,
          maxTick,
          MaxUint128,
          MaxUint128
        );
        expect(amount0).to.be.eq('2000499999999999999');
        expect(amount1).to.be.eq('1000499999999999999');
      });
      it('token0 and token1 with unexpected donation before swaps', async () => {
        await token1.transfer(pool, expandTo18Decimals(1));
        await token0.transfer(pool, expandTo18Decimals(2));
        await swapExact0For1(expandTo18Decimals(1), wallet.address);
        await swapExact1For0(expandTo18Decimals(1), wallet.address);
        await pool.burn(minTick, maxTick, 0, '0x');
        const { amount0, amount1 } = await pool.collect.staticCall(
          wallet.address,
          minTick,
          maxTick,
          MaxUint128,
          MaxUint128
        );
        expect(amount0).to.be.eq('2000499999999999999');
        expect(amount1).to.be.eq('1000499999999999999');
      });
    });
  });

  describe('#communityFee', () => {
    const liquidityAmount = expandTo18Decimals(1000);

    beforeEach(async () => {
      pool = await createPoolWrapped();
      await pool.initialize(encodePriceSqrt(1, 1));
      await mint(wallet.address, minTick, maxTick, liquidityAmount);
    });

    it('is initially set to 0', async () => {
      expect((await pool.globalState()).communityFee).to.eq(0);
    });

    it('can be changed by the owner', async () => {
      await pool.setCommunityFee(170);
      expect((await pool.globalState()).communityFee).to.eq(170);
    });

    it('cannot be changed out of bounds', async () => {
      await expect(pool.setCommunityFee(1001)).to.be.reverted;
    });

    it('cannot be changed by addresses that are not owner', async () => {
      await expect(pool.connect(other).setCommunityFee(170)).to.be.reverted;
    });

    async function swapAndGetFeesOwed({
      amount,
      zeroToOne,
      poke,
      supportingFee,
    }: {
      amount: bigint;
      zeroToOne: boolean;
      poke: boolean;
      supportingFee?: boolean;
    }) {
      if (supportingFee) {
        await (zeroToOne
          ? swapExact0For1SupportingFee(amount, wallet.address)
          : swapExact1For0SupportingFee(amount, wallet.address));
      } else {
        await (zeroToOne ? swapExact0For1(amount, wallet.address) : swapExact1For0(amount, wallet.address));
      }

      if (poke) await pool.burn(minTick, maxTick, 0, '0x');

      const { amount0: fees0, amount1: fees1 } = await pool.collect.staticCall(
        wallet.address,
        minTick,
        maxTick,
        MaxUint128,
        MaxUint128
      );

      expect(fees0, 'fees owed in token0 are greater than 0').to.be.gte(0);
      expect(fees1, 'fees owed in token1 are greater than 0').to.be.gte(0);

      return { token0Fees: fees0, token1Fees: fees1 };
    }

    it('position owner gets full fees when community fee is off', async () => {
      const { token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
      });

      // 6 bips * 1e18
      expect(token0Fees).to.eq('499999999999999');
      expect(token1Fees).to.eq(0);
    });

    it('swap fees accumulate as expected (0 for 1)', async () => {
      let token0Fees;
      let token1Fees;
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
      }));
      expect(token0Fees).to.eq('499999999999999');
      expect(token1Fees).to.eq(0);
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
      }));
      expect(token0Fees).to.eq('999999999999998');
      expect(token1Fees).to.eq(0);
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
      }));
      expect(token0Fees).to.eq('1499999999999997');
      expect(token1Fees).to.eq(0);
    });

    it('swap fees accumulate as expected (0 for 1), supporting fee on transfer', async () => {
      let token0Fees;
      let token1Fees;
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
        supportingFee: true,
      }));
      expect(token0Fees).to.eq('499999999999999');
      expect(token1Fees).to.eq(0);
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
        supportingFee: true,
      }));
      expect(token0Fees).to.eq('999999999999998');
      expect(token1Fees).to.eq(0);
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
        supportingFee: true,
      }));
      expect(token0Fees).to.eq('1499999999999997');
      expect(token1Fees).to.eq(0);
    });

    it('swap fees accumulate as expected (0 for 1), supporting fee on transfer community on', async () => {
      await pool.setCommunityFee(170);
      let token0Fees;
      let token1Fees;
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
        supportingFee: true,
      }));
      expect(token0Fees).to.eq('414999999999999');
      expect(token1Fees).to.eq(0);
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
        supportingFee: true,
      }));
      expect(token0Fees).to.eq('829999999999998');
      expect(token1Fees).to.eq(0);
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
        supportingFee: true,
      }));
      expect(token0Fees).to.eq('1244999999999997');
      expect(token1Fees).to.eq(0);
    });

    it('swap fees accumulate as expected (1 for 0)', async () => {
      let token0Fees;
      let token1Fees;
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: false,
        poke: true,
      }));
      expect(token0Fees).to.eq(0);
      expect(token1Fees).to.eq('499999999999999');
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: false,
        poke: true,
      }));
      expect(token0Fees).to.eq(0);
      expect(token1Fees).to.eq('999999999999998');
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: false,
        poke: true,
      }));
      expect(token0Fees).to.eq(0);
      expect(token1Fees).to.eq('1499999999999997');
    });

    it('swap fees accumulate as expected (1 for 0) supporting fee on transfer', async () => {
      let token0Fees;
      let token1Fees;
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: false,
        poke: true,
        supportingFee: true,
      }));
      expect(token0Fees).to.eq(0);
      expect(token1Fees).to.eq('499999999999999');
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: false,
        poke: true,
        supportingFee: true,
      }));
      expect(token0Fees).to.eq(0);
      expect(token1Fees).to.eq('999999999999998');
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: false,
        poke: true,
        supportingFee: true,
      }));
      expect(token0Fees).to.eq(0);
      expect(token1Fees).to.eq('1499999999999997');
    });

    it('swap fees accumulate as expected (1 for 0) supporting fee on transfer community on', async () => {
      await pool.setCommunityFee(170);
      let token0Fees;
      let token1Fees;
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: false,
        poke: true,
        supportingFee: true,
      }));
      expect(token0Fees).to.eq(0);
      expect(token1Fees).to.eq('414999999999999');
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: false,
        poke: true,
        supportingFee: true,
      }));
      expect(token0Fees).to.eq(0);
      expect(token1Fees).to.eq('829999999999998');
      ({ token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: false,
        poke: true,
        supportingFee: true,
      }));
      expect(token0Fees).to.eq(0);
      expect(token1Fees).to.eq('1244999999999997');
    });

    it('position owner gets partial fees when community fee is on', async () => {
      await pool.setCommunityFee(170);

      const { token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
      });

      expect(token0Fees).to.be.eq('414999999999999');
      expect(token1Fees).to.be.eq(0);
    });

    it('fees collected by lp after two swaps should be double one swap', async () => {
      await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
      });
      const { token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
      });

      // 1 bips * 2e18
      expect(token0Fees).to.eq('999999999999998');
      expect(token1Fees).to.eq(0);
    });

    it('fees collected after two swaps with fee turned on in middle are fees from last swap (not confiscatory)', async () => {
      await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: false,
      });

      await pool.setCommunityFee(170);

      const { token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
      });

      expect(token0Fees).to.eq('914999999999999');
      expect(token1Fees).to.eq(0);
    });

    it('fees collected by lp after two swaps with intermediate withdrawal', async () => {
      await pool.setCommunityFee(170);

      const { token0Fees, token1Fees } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: true,
      });

      expect(token0Fees).to.eq('414999999999999');
      expect(token1Fees).to.eq(0);

      // collect the fees
      await pool.collect(wallet.address, minTick, maxTick, MaxUint128, MaxUint128);

      const { token0Fees: token0FeesNext, token1Fees: token1FeesNext } = await swapAndGetFeesOwed({
        amount: expandTo18Decimals(1),
        zeroToOne: true,
        poke: false,
      });

      expect(token0FeesNext).to.eq(0);
      expect(token1FeesNext).to.eq(0);

      expect((await token0.balanceOf(vaultAddress)).toString()).to.eq('85000000000000');
      const [communityFeePending0] = await pool.getCommunityFeePending();
      expect(communityFeePending0).to.be.eq('85000000000000');
      expect(Number((await token1.balanceOf(vaultAddress)).toString())).to.eq(0);

      await pool.burn(minTick, maxTick, 0, '0x'); // poke to update fees
      await expect(pool.collect(wallet.address, minTick, maxTick, MaxUint128, MaxUint128))
        .to.emit(token0, 'Transfer')
        .withArgs(await pool.getAddress(), wallet.address, '414999999999999');
      expect((await token0.balanceOf(vaultAddress)).toString()).to.eq('85000000000000');

      const [communityFeePending0After] = await pool.getCommunityFeePending();
      expect(communityFeePending0After).to.be.eq('85000000000000');
      expect(Number((await token1.balanceOf(vaultAddress)).toString())).to.eq(0);
    });

    it('community fee pending increases after swap', async () => {
      await pool.setCommunityFee(170);
      await swapExact0For1(expandTo18Decimals(1), wallet.address);

      async function checkFees(cb: any, zto: boolean) {
        const pendingFeesBefore = await pool.getCommunityFeePending();
        await cb(expandTo18Decimals(1));
        const pendingFeesAfter = await pool.getCommunityFeePending();

        if (zto) {
          expect(pendingFeesAfter[0]).to.be.gt(pendingFeesBefore[0]);
          expect(pendingFeesAfter[1]).to.eq(pendingFeesBefore[1]);
        } else {
          expect(pendingFeesAfter[1]).to.be.gt(pendingFeesBefore[1]);
          expect(pendingFeesAfter[0]).to.eq(pendingFeesBefore[0]);
        }
      }

      await checkFees(async (amount: any) => swapExact0For1(amount, wallet.address), true);
      await checkFees(async (amount: any) => swapExact1For0(amount, wallet.address), false);
      await checkFees(async (amount: any) => swapExact0For1SupportingFee(amount, wallet.address), true);
      await checkFees(async (amount: any) => swapExact1For0SupportingFee(amount, wallet.address), false);
    });
  });

  describe('#tickSpacing', () => {
    beforeEach('deploy pool', async () => {
      pool = await createPoolWrapped();
    });
    describe('post initialize', () => {
      beforeEach('initialize pool', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
      });
      it('mint can only be called for multiples of 60', async () => {
        await expect(mint(wallet.address, -61, 0, 1)).to.be.reverted;
        await expect(mint(wallet.address, 0, 6, 1)).to.be.reverted;
      });
      it('mint can be called with multiples of 60', async () => {
        await mint(wallet.address, 60, 120, 1);
        await mint(wallet.address, -240, -180, 1);
      });
      it('mint after tickSpacing increase', async () => {
        await mint(wallet.address, 60, 120, 1);
        await pool.setTickSpacing(200);
        await mint(wallet.address, -2400, -1800, 1);
      });
      it('mint after tickSpacing decrease', async () => {
        await mint(wallet.address, 60, 120, 1);
        await pool.setTickSpacing(13);
        await mint(wallet.address, -260, -130, 1);
      });
      it('swapping across gaps works in 1 for 0 direction', async () => {
        const liquidityAmount = expandTo18Decimals(1) / 4n;
        await mint(wallet.address, 120000, 121200, liquidityAmount);
        await swapExact1For0(expandTo18Decimals(1), wallet.address);
        await expect(pool.burn(120000, 121200, liquidityAmount, '0x'))
          .to.emit(pool, 'Burn')
          .withArgs(wallet.address, 120000, 121200, liquidityAmount, '30012388425661', '999499999999999999')
          .to.not.emit(token0, 'Transfer')
          .to.not.emit(token1, 'Transfer');
        expect((await pool.globalState()).tick).to.eq(120197);
      });
      it('swapping across gaps works in 0 for 1 direction', async () => {
        const liquidityAmount = expandTo18Decimals(1) / 4n;
        await mint(wallet.address, -121200, -120000, liquidityAmount);
        await swapExact0For1(expandTo18Decimals(1), wallet.address);
        await expect(pool.burn(-121200, -120000, liquidityAmount, '0x'))
          .to.emit(pool, 'Burn')
          .withArgs(wallet.address, -121200, -120000, liquidityAmount, '999499999999999999', '30012388425661')
          .to.not.emit(token0, 'Transfer')
          .to.not.emit(token1, 'Transfer');
        expect((await pool.globalState()).tick).to.eq(-120198);
      });
    });
  });

  it('tickMath handles tick overflow', async () => {
    const sqrtTickMath = (await (await ethers.getContractFactory('TickMathTest')).deploy()) as any as TickMathTest;
    await expect(sqrtTickMath.getSqrtRatioAtTick(887273)).to.be.revertedWithCustomError(sqrtTickMath, 'tickOutOfRange');
    await expect(sqrtTickMath.getSqrtRatioAtTick(-887273)).to.be.revertedWithCustomError(
      sqrtTickMath,
      'tickOutOfRange'
    );
  });

  it('tick transition cannot run twice if zero for one swap ends at fractional price just below tick', async () => {
    pool = await createPoolWrapped();
    const sqrtTickMath = (await (await ethers.getContractFactory('TickMathTest')).deploy()) as any as TickMathTest;
    const PriceMovementMath = (await (
      await ethers.getContractFactory('PriceMovementMathTest')
    ).deploy()) as any as PriceMovementMathTest;
    const p0 = (await sqrtTickMath.getSqrtRatioAtTick(-24081)) + 1n;
    // initialize at a price of ~0.3 token1/token0
    // meaning if you swap in 2 token0, you should end up getting 0 token1
    await pool.initialize(p0);
    expect(await pool.liquidity(), 'current pool liquidity is 1').to.eq(0);
    expect((await pool.globalState()).tick, 'pool tick is -24081').to.eq(-24081);
    await pool.setTickSpacing(1);

    // add a bunch of liquidity around current price
    const liquidity = expandTo18Decimals(1000);
    await mint(wallet.address, -24082, -24080, liquidity);
    expect(await pool.liquidity(), 'current pool liquidity is now liquidity + 1').to.eq(liquidity);

    await mint(wallet.address, -24082, -24081, liquidity);
    expect(await pool.liquidity(), 'current pool liquidity is still liquidity + 1').to.eq(liquidity);

    // check the math works out to moving the price down 1, sending no amount out, and having some amount remaining
    {
      const { feeAmount, amountIn, amountOut, sqrtQ } = await PriceMovementMath.movePriceTowardsTarget(
        p0,
        p0 - 1n,
        liquidity,
        3,
        FeeAmount.MEDIUM
      );
      expect(sqrtQ, 'price moves').to.eq(p0 - 1n);
      expect(feeAmount, 'fee amount is 1').to.eq(1);
      expect(amountIn, 'amount in is 1').to.eq(1);
      expect(amountOut, 'zero amount out').to.eq(0);
    }

    // swap 2 amount in, should get 0 amount out
    await expect(swapExact0For1(3, wallet.address))
      .to.emit(token0, 'Transfer')
      .withArgs(wallet.address, await pool.getAddress(), 3)
      .to.not.emit(token1, 'Transfer');

    const { tick, price } = await pool.globalState();

    expect(tick, 'pool is at the next tick').to.eq(-24082);
    expect(price, 'pool price is still on the p0 boundary').to.eq(p0 - 1n);
    expect(await pool.liquidity(), 'pool has run tick transition and liquidity changed').to.eq(liquidity * 2n);
  });

  describe('#fee getter', async () => {
    it('works without plugin', async () => {
      await pool.setFee(150);
      expect(await pool.fee()).to.be.eq(150);
    });

    it('works with plugin', async () => {
      const MockPoolPluginFactory = await ethers.getContractFactory('MockPoolPlugin');
      const poolPlugin = (await MockPoolPluginFactory.deploy(await pool.getAddress())) as any as MockPoolPlugin;
      await pool.setPlugin(poolPlugin);
      await pool.setPluginConfig(255);

      expect(await pool.fee()).to.be.eq(220);
    });
  });

  describe('#flash', () => {
    it('fails if not initialized', async () => {
      await expect(flash(100, 200, other.address)).to.be.reverted;
      await expect(flash(100, 0, other.address)).to.be.reverted;
      await expect(flash(0, 200, other.address)).to.be.reverted;
    });
    it('fails if no liquidity and reserves', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await expect(flash(100, 200, other.address)).to.be.revertedWithCustomError(pool, 'transferFailed');
      await expect(flash(100, 0, other.address)).to.be.revertedWithCustomError(pool, 'transferFailed');
      await expect(flash(0, 200, other.address)).to.be.revertedWithCustomError(pool, 'transferFailed');
    });
    it('works with zero liquidity', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      const tickSpacing = await pool.tickSpacing();
      await mint(wallet.address, -tickSpacing, tickSpacing, initializeLiquidityAmount);
      await swapExact0For1(initializeLiquidityAmount * 10000n, wallet.address);
      expect(await pool.liquidity()).to.be.eq(0);
      await expect(flash(100, 0, other.address))
        .to.emit(token0, 'Transfer')
        .withArgs(await pool.getAddress(), other.address, 100);
      await expect(flash(100, 100, other.address)).to.be.revertedWithCustomError(pool, 'transferFailed');
    });

    it('flash overflows communityFee0', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await pool.setCommunityFee(1000);
      const MAX_PENDING_FEE = 2n ** 104n - 1n;

      await token0.approve(swapTarget, MaxUint256);
      await token1.approve(swapTarget, MaxUint256);

      await flash(0, 0, wallet.address, 1, 1);
      await flash(0, 0, wallet.address, MAX_PENDING_FEE, 0);
      await flash(0, 0, wallet.address, 1, 1);

      const [reserve0after, reserve1after] = await pool.getReserves();
      expect(reserve0after).to.eq(0);
      expect(reserve1after).to.eq(0);
    });

    it('flash overflows communityFee1', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await pool.setCommunityFee(1000);
      const MAX_PENDING_FEE = 2n ** 104n - 1n;

      await token0.approve(swapTarget, MaxUint256);
      await token1.approve(swapTarget, MaxUint256);

      await flash(0, 0, wallet.address, 1, 1);
      await flash(0, 0, wallet.address, 0, MAX_PENDING_FEE);
      await flash(0, 0, wallet.address, 1, 1);

      const [reserve0after, reserve1after] = await pool.getReserves();
      expect(reserve0after).to.eq(0);
      expect(reserve1after).to.eq(0);
    });

    describe('after liquidity added', () => {
      let balanceToken0: bigint;
      let balanceToken1: bigint;
      beforeEach('add some tokens', async () => {
        await initializeAtZeroTick(pool);
        [balanceToken0, balanceToken1] = await Promise.all([token0.balanceOf(pool), token1.balanceOf(pool)]);
      });

      describe('fee off', () => {
        it('emits an event', async () => {
          await expect(flash(1001, 2001, other.address))
            .to.emit(pool, 'Flash')
            .withArgs(await swapTarget.getAddress(), other.address, 1001, 2001, 1, 1);
        });

        it('emits an event', async () => {
          await expect(flash(1, 1, other.address))
            .to.emit(pool, 'Flash')
            .withArgs(await swapTarget.getAddress(), other.address, 1, 1, 1, 1);
        });

        it('transfers the amount0 to the recipient', async () => {
          await expect(flash(100, 200, other.address))
            .to.emit(token0, 'Transfer')
            .withArgs(await pool.getAddress(), other.address, 100);
        });
        it('transfers the amount1 to the recipient', async () => {
          await expect(flash(100, 200, other.address))
            .to.emit(token1, 'Transfer')
            .withArgs(await pool.getAddress(), other.address, 200);
        });
        it('can flash only token0', async () => {
          await expect(flash(101, 0, other.address))
            .to.emit(token0, 'Transfer')
            .withArgs(await pool.getAddress(), other.address, 101)
            .to.not.emit(token1, 'Transfer');
        });
        it('can flash only token1', async () => {
          await expect(flash(0, 102, other.address))
            .to.emit(token1, 'Transfer')
            .withArgs(await pool.getAddress(), other.address, 102)
            .to.not.emit(token0, 'Transfer');
        });
        it('can flash max uint128', async () => {
          await token0.transfer(pool.getAddress(), MaxUint128);
          await token1.transfer(pool.getAddress(), MaxUint128);
          await expect(flash(MaxUint128, MaxUint128, other.address))
            .to.emit(token1, 'Transfer')
            .withArgs(await pool.getAddress(), other.address, MaxUint128);
        });
        it('can flash entire token balance', async () => {
          await expect(flash(balanceToken0, balanceToken1, other.address))
            .to.emit(token0, 'Transfer')
            .withArgs(await pool.getAddress(), other.address, balanceToken0)
            .to.emit(token1, 'Transfer')
            .withArgs(await pool.getAddress(), other.address, balanceToken1);
        });
        it('no-op if both amounts are 0', async () => {
          await expect(flash(0, 0, other.address)).to.not.emit(token0, 'Transfer').to.not.emit(token1, 'Transfer');
        });
        it('fails if flash amount is greater than token balance', async () => {
          await expect(flash(balanceToken0 + 1n, balanceToken1, other.address)).to.be.reverted;
          await expect(flash(balanceToken0, balanceToken1 + 1n, other.address)).to.be.reverted;
        });
        it('calls the flash callback on the sender with correct fee amounts', async () => {
          await expect(flash(1001, 2002, other.address)).to.emit(swapTarget, 'FlashCallback').withArgs(1, 1);
        });
        it('increases the fee growth by the expected amount', async () => {
          await flash(1001, 2002, other.address);
          expect(await pool.totalFeeGrowth0Token()).to.eq(0);
          expect(await pool.totalFeeGrowth1Token()).to.eq(0);

          await pool.burn(minTick, maxTick, 0, '0x');
          expect(await pool.totalFeeGrowth0Token()).to.eq(2n ** 128n / expandTo18Decimals(2));
          expect(await pool.totalFeeGrowth1Token()).to.eq(2n ** 128n / expandTo18Decimals(2));
        });
        it('increases the fee growth by the expected amount after unexpected donation of token0', async () => {
          await token0.transfer(pool, expandTo18Decimals(2));
          await flash(1001, 2002, other.address);
          expect(await pool.totalFeeGrowth1Token()).to.eq(0);

          await pool.burn(minTick, maxTick, 0, '0x');
          expect(await pool.totalFeeGrowth0Token()).to.eq(
            ((expandTo18Decimals(2) + 1n) * 2n ** 128n) / expandTo18Decimals(2)
          );
          expect(await pool.totalFeeGrowth1Token()).to.eq(2n ** 128n / expandTo18Decimals(2));
        });
        it('increases the fee growth by the expected amount after unexpected donation of token1', async () => {
          await token1.transfer(pool, expandTo18Decimals(1));
          await flash(1001, 2002, other.address);
          expect(await pool.totalFeeGrowth0Token()).to.eq(0);

          await pool.burn(minTick, maxTick, 0, '0x');
          expect(await pool.totalFeeGrowth0Token()).to.eq(2n ** 128n / expandTo18Decimals(2));
          expect(await pool.totalFeeGrowth1Token()).to.eq(
            ((expandTo18Decimals(1) + 1n) * 2n ** 128n) / expandTo18Decimals(2)
          );
        });
        it('increases the fee growth by the expected amount after unexpected donation', async () => {
          await token0.transfer(pool, expandTo18Decimals(2));
          await token1.transfer(pool, expandTo18Decimals(1));
          await flash(1001, 2002, other.address);

          await pool.burn(minTick, maxTick, 0, '0x');
          expect(await pool.totalFeeGrowth0Token()).to.eq(
            ((expandTo18Decimals(2) + 1n) * 2n ** 128n) / expandTo18Decimals(2)
          );
          expect(await pool.totalFeeGrowth1Token()).to.eq(
            ((expandTo18Decimals(1) + 1n) * 2n ** 128n) / expandTo18Decimals(2)
          );
        });
        it('fails if original balance not returned in either token', async () => {
          await expect(flash(1000, 0, other.address, 999, 0)).to.be.reverted;
          await expect(flash(0, 1000, other.address, 0, 999)).to.be.reverted;
        });
        it('fails if underpays either token', async () => {
          await expect(flash(1000, 0, other.address, 1000, 0)).to.be.reverted;
          await expect(flash(0, 1000, other.address, 0, 1000)).to.be.reverted;
        });
        it('allows donating token0', async () => {
          await expect(flash(0, 0, ZeroAddress, 567, 0))
            .to.emit(token0, 'Transfer')
            .withArgs(wallet.address, await pool.getAddress(), 567)
            .to.not.emit(token1, 'Transfer');
          await pool.burn(minTick, maxTick, 0, '0x');
          expect(await pool.totalFeeGrowth0Token()).to.eq((567n * 2n ** 128n) / expandTo18Decimals(2));
        });
        it('allows donating token1', async () => {
          await expect(flash(0, 0, ZeroAddress, 0, 678))
            .to.emit(token1, 'Transfer')
            .withArgs(wallet.address, await pool.getAddress(), 678)
            .to.not.emit(token0, 'Transfer');
          await pool.burn(minTick, maxTick, 0, '0x');
          expect(await pool.totalFeeGrowth1Token()).to.eq((678n * 2n ** 128n) / expandTo18Decimals(2));
        });
        it('allows donating token0 and token1 together', async () => {
          await expect(flash(0, 0, ZeroAddress, 789, 1234))
            .to.emit(token0, 'Transfer')
            .withArgs(wallet.address, await pool.getAddress(), 789)
            .to.emit(token1, 'Transfer')
            .withArgs(wallet.address, await pool.getAddress(), 1234);

          await pool.burn(minTick, maxTick, 0, '0x');

          expect(await pool.totalFeeGrowth0Token()).to.eq((789n * 2n ** 128n) / expandTo18Decimals(2));
          expect(await pool.totalFeeGrowth1Token()).to.eq((1234n * 2n ** 128n) / expandTo18Decimals(2));
        });
      });

      describe('fee on', () => {
        beforeEach('turn community fee on', async () => {
          await pool.setCommunityFee(170);
        });

        it('emits an event', async () => {
          await expect(flash(1001, 2001, other.address))
            .to.emit(pool, 'Flash')
            .withArgs(await swapTarget.getAddress(), other.address, 1001, 2001, 1, 1);
        });

        it('increases the fee growth by the expected amount', async () => {
          await flash(20020, 16016 * 5, other.address);
          expect(await pool.totalFeeGrowth0Token()).to.eq(0);
          expect(await pool.totalFeeGrowth1Token()).to.eq(0);

          await pool.burn(minTick, maxTick, 0, '0x');

          expect(await pool.totalFeeGrowth0Token()).to.eq((3n * 2n ** 128n) / expandTo18Decimals(2));
          expect(await pool.totalFeeGrowth1Token()).to.eq((8n * 2n ** 128n) / expandTo18Decimals(2));

          expect(Number((await token0.balanceOf(vaultAddress)).toString())).to.eq(0);
          expect(Number((await token1.balanceOf(vaultAddress)).toString())).to.eq(1);
        });
        it('allows donating token0', async () => {
          await expect(flash(0, 0, ZeroAddress, 567, 0))
            .to.emit(token0, 'Transfer')
            .withArgs(wallet.address, await pool.getAddress(), 567)
            .to.not.emit(token1, 'Transfer');

          await pool.burn(minTick, maxTick, 0, '0x');

          const [communityFeePending0] = await pool.getCommunityFeePending();
          expect(Number(communityFeePending0.toString())).to.eq(0);
          expect(Number((await token0.balanceOf(vaultAddress)).toString())).to.eq(96);

          expect(await pool.totalFeeGrowth0Token()).to.eq((471n * 2n ** 128n) / expandTo18Decimals(2));
        });
        it('allows donating token1', async () => {
          await expect(flash(0, 0, ZeroAddress, 0, 678))
            .to.emit(token1, 'Transfer')
            .withArgs(wallet.address, await pool.getAddress(), 678)
            .to.not.emit(token0, 'Transfer');

          await pool.burn(minTick, maxTick, 0, '0x');

          const [, communityFeePending1] = await pool.getCommunityFeePending();
          expect(Number(communityFeePending1.toString())).to.eq(0);
          expect(Number((await token1.balanceOf(vaultAddress)).toString())).to.eq(115);

          expect(await pool.totalFeeGrowth1Token()).to.eq((563n * 2n ** 128n) / expandTo18Decimals(2));
        });
        it('allows donating token0 and token1 together', async () => {
          await expect(flash(0, 0, ZeroAddress, 789, 1234))
            .to.emit(token0, 'Transfer')
            .withArgs(wallet.address, await pool.getAddress(), 789)
            .to.emit(token1, 'Transfer')
            .withArgs(wallet.address, await pool.getAddress(), 1234);

          await pool.burn(minTick, maxTick, 0, '0x');

          const [communityFeePending0, communityFeePending1] = await pool.getCommunityFeePending();
          expect(Number(communityFeePending0.toString())).to.eq(0);
          expect(Number(communityFeePending1.toString())).to.eq(0);

          expect(Number((await token0.balanceOf(vaultAddress)).toString())).to.eq(134);
          expect(Number((await token1.balanceOf(vaultAddress)).toString())).to.eq(209);

          expect(await pool.totalFeeGrowth0Token()).to.eq((655n * 2n ** 128n) / expandTo18Decimals(2));
          expect(await pool.totalFeeGrowth1Token()).to.eq((1025n * 2n ** 128n) / expandTo18Decimals(2));
        });
      });
    });
  });

  describe('PermissionedActions', async () => {
    describe('#setCommunityFee', () => {
      beforeEach('initialize the pool', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
      });

      it('cannot be positive without vault', async () => {
        await pool.setCommunityVault(ZeroAddress);
        await expect(pool.setCommunityFee(1)).to.be.revertedWithCustomError(pool, 'invalidNewCommunityFee');
      });

      it('can only be called by factory owner', async () => {
        await expect(pool.connect(other).setCommunityFee(200)).to.be.reverted;
      });
      it('fails if fee is gt 100%', async () => {
        await expect(pool.setCommunityFee(1004)).to.be.reverted;
      });
      it('succeeds for fee 100%', async () => {
        await pool.setCommunityFee(1000);
        expect((await pool.globalState()).communityFee).to.eq(1000);
      });
      it('succeeds for fee 25%', async () => {
        await pool.setCommunityFee(250);
      });
      it('succeeds for fee of 10%', async () => {
        await pool.setCommunityFee(100);
      });
      it('sets community fee', async () => {
        await pool.setCommunityFee(140);
        expect((await pool.globalState()).communityFee).to.eq(140);
      });
      it('can change community fee', async () => {
        await pool.setCommunityFee(140);
        await pool.setCommunityFee(200);
        expect((await pool.globalState()).communityFee).to.eq(200);
      });
      it('can turn off community fee', async () => {
        await pool.setCommunityFee(250);
        await pool.setCommunityFee(0);
        expect((await pool.globalState()).communityFee).to.eq(0);
      });
      it('emits an event when turned on', async () => {
        await expect(pool.setCommunityFee(140)).to.be.emit(pool, 'CommunityFee').withArgs(140);
      });
      it('emits an event when turned off', async () => {
        await pool.setCommunityFee(140);
        await expect(pool.setCommunityFee(0)).to.be.emit(pool, 'CommunityFee').withArgs(0);
      });
      it('emits an event when changed', async () => {
        await pool.setCommunityFee(250);
        await expect(pool.setCommunityFee(170)).to.be.emit(pool, 'CommunityFee').withArgs(170);
      });
      it('fails if unchanged', async () => {
        await pool.setCommunityFee(200);
        await expect(pool.setCommunityFee(200)).to.be.revertedWithCustomError(pool, 'invalidNewCommunityFee');
      });
    });

    describe('#setCommunityVault', () => {
      beforeEach('initialize the pool', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
      });

      it('can only be called by factory owner', async () => {
        await expect(pool.connect(other).setCommunityVault(other.address)).to.be.reverted;
      });
      it('sets community vault', async () => {
        await pool.setCommunityVault(other.address);
        expect(await pool.communityVault()).to.eq(other.address);
      });
      it('can change community vault', async () => {
        await pool.setCommunityVault(other.address);
        await pool.setCommunityVault(wallet.address);
        expect(await pool.communityVault()).to.eq(wallet.address);
      });
      it('can set zero address with zero community fee', async () => {
        await pool.setCommunityVault(ZeroAddress);
        expect(await pool.communityVault()).to.eq(ZeroAddress);
      });
      it('can set zero address with nonzero community fee', async () => {
        await pool.setCommunityFee(200);
        await pool.setCommunityVault(ZeroAddress);
        expect(await pool.communityVault()).to.eq(ZeroAddress);
        expect((await pool.globalState()).communityFee).to.eq(0);
      });
      it('emits an event when changed', async () => {
        await expect(pool.setCommunityVault(other.address)).to.be.emit(pool, 'CommunityVault').withArgs(other.address);
      });
      it('emits an event when set to zero', async () => {
        await expect(pool.setCommunityVault(ZeroAddress)).to.be.emit(pool, 'CommunityVault').withArgs(ZeroAddress);
      });
      //it('fails if unchanged', async () => {
      //  await pool.setCommunityVault(other.address);
      //  await expect(pool.setCommunityVault(other.address)).to.be.revertedWithCustomError(pool, 'InvalidVault');
      //});
    });

    describe('#setTickSpacing', () => {
      beforeEach('initialize the pool', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
      });

      it('setTickspacing works', async () => {
        await expect(pool.setTickSpacing(100)).to.emit(pool, 'TickSpacing').withArgs(100);
        expect(await pool.tickSpacing()).to.eq(100);
      });
      it('setTickspacing can be called only by owner', async () => {
        await expect(pool.connect(other).setTickSpacing(100)).to.be.reverted;
      });
      it('can set max tickspacing', async () => {
        await expect(pool.setTickSpacing(500)).to.not.be.reverted;
      });
      it('cannot setTickSpacing as min int24', async () => {
        await expect(pool.setTickSpacing(-8388608)).to.be.revertedWithCustomError(pool, 'invalidNewTickSpacing');
      });
      it('cannot setTickSpacing gt 500 & lt 1', async () => {
        await expect(pool.setTickSpacing(600)).to.be.revertedWithCustomError(pool, 'invalidNewTickSpacing');
        await expect(pool.setTickSpacing(-20)).to.be.revertedWithCustomError(pool, 'invalidNewTickSpacing');
        await expect(pool.setTickSpacing(0)).to.be.revertedWithCustomError(pool, 'invalidNewTickSpacing');
      });
      it('cannot set same value', async () => {
        await expect(pool.setTickSpacing(60)).to.be.revertedWithCustomError(pool, 'invalidNewTickSpacing');
      });
    });

    describe('#plugin', () => {
      let poolPlugin: MockPoolPlugin;
      let callbackData: string;
      beforeEach('create plugin', async () => {
        const MockPoolPluginFactory = await ethers.getContractFactory('MockPoolPlugin');
        poolPlugin = (await MockPoolPluginFactory.deploy(pool)) as any as MockPoolPlugin;
        await pool.setPlugin(poolPlugin);
        await pool.setPluginConfig(255);
        callbackData = encodeCallback(wallet.address);
      });

      it('before initialize the hook is called', async () => {
        await expect(pool.initialize(encodePriceSqrt(1, 1)))
          .to.be.emit(poolPlugin, 'BeforeInitialize')
          .withArgs(wallet.address, encodePriceSqrt(1, 1));
      });

      it('after initialize the hook is called', async () => {
        await expect(pool.initialize(encodePriceSqrt(1, 1)))
          .to.be.emit(poolPlugin, 'AfterInitialize')
          .withArgs(wallet.address, encodePriceSqrt(1, 1), 0);
      });

      it('before mint the hook is called', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await expect(mint(wallet.address, minTick, maxTick, expandTo18Decimals(1)))
          .to.be.emit(poolPlugin, 'BeforeModifyPosition')
          .withArgs(
            await swapTarget.getAddress(),
            wallet.address,
            minTick,
            maxTick,
            expandTo18Decimals(1),
            callbackData
          );
      });

      it('after mint the hook is called', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await expect(mint(wallet.address, minTick, maxTick, expandTo18Decimals(1)))
          .to.be.emit(poolPlugin, 'AfterModifyPosition')
          .withArgs(
            await swapTarget.getAddress(),
            wallet.address,
            minTick,
            maxTick,
            expandTo18Decimals(1),
            expandTo18Decimals(1),
            expandTo18Decimals(1),
            callbackData
          );
      });

      it('before burn the hook is called', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await expect(pool.burn(minTick, maxTick, expandTo18Decimals(1), '0x'))
          .to.be.emit(poolPlugin, 'BeforeModifyPosition')
          .withArgs(wallet.address, wallet.address, minTick, maxTick, expandTo18Decimals(-1), '0x');
      });

      it('after burn the hook is called', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await expect(pool.burn(minTick, maxTick, expandTo18Decimals(1), '0x'))
          .to.be.emit(poolPlugin, 'AfterModifyPosition')
          .withArgs(
            wallet.address,
            wallet.address,
            minTick,
            maxTick,
            expandTo18Decimals(-1),
            expandTo18Decimals(1) - 1n,
            expandTo18Decimals(1) - 1n,
            '0x'
          );
      });

      it('before swap fee on transfer tokens the hook is called', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await expect(swapExact1For0SupportingFee(10000, wallet.address))
          .to.be.emit(poolPlugin, 'BeforeSwap')
          .withArgs(
            await swapTarget.getAddress(),
            wallet.address,
            false,
            10000,
            MAX_SQRT_RATIO - 1n,
            true,
            callbackData
          );
      });

      it('after swap fee on transfer tokens the hook is called', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await expect(swapExact1For0SupportingFee(10000, wallet.address))
          .to.be.emit(poolPlugin, 'AfterSwap')
          .withArgs(
            await swapTarget.getAddress(),
            wallet.address,
            false,
            10000,
            MAX_SQRT_RATIO - 1n,
            -9994,
            10000,
            callbackData
          );
      });

      it('before swap the hook is called', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await expect(swapExact0For1(10000, wallet.address))
          .to.be.emit(poolPlugin, 'BeforeSwap')
          .withArgs(
            await swapTarget.getAddress(),
            wallet.address,
            true,
            10000,
            MIN_SQRT_RATIO + 1n,
            false,
            callbackData
          );
      });

      it('after swap the hook is called', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await expect(swapExact0For1(10000, wallet.address))
          .to.be.emit(poolPlugin, 'AfterSwap')
          .withArgs(
            await swapTarget.getAddress(),
            wallet.address,
            true,
            10000,
            MIN_SQRT_RATIO + 1n,
            10000,
            -9994,
            callbackData
          );
      });

      it('before flash the hook is called', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        callbackData = encodeCallback(wallet.address, 101n, 201n);
        await expect(flash(100, 200, other.address))
          .to.be.emit(poolPlugin, 'BeforeFlash')
          .withArgs(await swapTarget.getAddress(), other.address, 100, 200, callbackData);
      });

      it('after flash the hook is called', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        callbackData = encodeCallback(wallet.address, 101n, 201n);
        await expect(flash(100, 200, other.address))
          .to.emit(poolPlugin, 'AfterFlash')
          .withArgs(await swapTarget.getAddress(), other.address, 100, 200, 1, 1, callbackData);
      });

      it('transaction reverted if plugin returns incorrect selector for beforeInitialized hook', async () => {
        await poolPlugin.setSelectorDisable(128);
        const selector = poolPlugin.interface.getFunction('beforeInitialize').selector;
        await expect(pool.initialize(encodePriceSqrt(1, 1)))
          .to.be.revertedWithCustomError(pool, 'invalidHookResponse')
          .withArgs(selector);
      });

      it('transaction reverted if plugin returns incorrect selector for afterInitialized hook', async () => {
        await poolPlugin.setSelectorDisable(64);
        const selector = poolPlugin.interface.getFunction('afterInitialize').selector;
        await expect(pool.initialize(encodePriceSqrt(1, 1)))
          .to.be.revertedWithCustomError(pool, 'invalidHookResponse')
          .withArgs(selector);
      });

      it('transaction reverted if plugin returns incorrect selector for beforeModifyPosition hook', async () => {
        await poolPlugin.setSelectorDisable(4);
        await pool.initialize(encodePriceSqrt(1, 1));
        const selector = poolPlugin.interface.getFunction('beforeModifyPosition').selector;
        await expect(mint(wallet.address, minTick, maxTick, expandTo18Decimals(1)))
          .to.be.revertedWithCustomError(pool, 'invalidHookResponse')
          .withArgs(selector);
      });

      it('transaction reverted if plugin returns incorrect selector for afterModifyPosition hook', async () => {
        await poolPlugin.setSelectorDisable(8);
        await pool.initialize(encodePriceSqrt(1, 1));
        const selector = poolPlugin.interface.getFunction('afterModifyPosition').selector;
        await expect(mint(wallet.address, minTick, maxTick, expandTo18Decimals(1)))
          .to.be.revertedWithCustomError(pool, 'invalidHookResponse')
          .withArgs(selector);
      });

      it('transaction reverted if plugin returns incorrect selector for beforeSwap hook', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await poolPlugin.setSelectorDisable(1);
        const selector = poolPlugin.interface.getFunction('beforeSwap').selector;
        await expect(swapExact0For1(10000, wallet.address))
          .to.be.revertedWithCustomError(pool, 'invalidHookResponse')
          .withArgs(selector);
      });

      it('transaction reverted if plugin returns incorrect selector for afterSwap hook', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await poolPlugin.setSelectorDisable(2);
        const selector = poolPlugin.interface.getFunction('afterSwap').selector;
        await expect(swapExact0For1(10000, wallet.address))
          .to.be.revertedWithCustomError(pool, 'invalidHookResponse')
          .withArgs(selector);
      });

      it('transaction reverted if plugin returns incorrect selector for beforeFlash hook', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await poolPlugin.setSelectorDisable(16);
        const selector = poolPlugin.interface.getFunction('beforeFlash').selector;
        await expect(flash(100, 200, other.address))
          .to.be.revertedWithCustomError(pool, 'invalidHookResponse')
          .withArgs(selector);
      });

      it('transaction reverted if plugin returns incorrect selector for afterFlash hook', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await poolPlugin.setSelectorDisable(32);
        const selector = poolPlugin.interface.getFunction('afterFlash').selector;
        await expect(flash(100, 200, other.address))
          .to.be.revertedWithCustomError(pool, 'invalidHookResponse')
          .withArgs(selector);
      });

      it('hooks are disabled after a config change', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await expect(flash(100, 200, other.address)).to.be.emit(poolPlugin, 'AfterFlash');
        await pool.setPluginConfig(223);
        await expect(flash(100, 200, other.address)).not.to.be.emit(poolPlugin, 'AfterFlash');
      });
    });

    describe('#setPlugin', () => {
      beforeEach('initialize the pool', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
      });
      it('can only be called by factory owner or administrator', async () => {
        await expect(pool.connect(other).setPlugin(other.address)).to.be.reverted;
      });
      it('emits an event when changed', async () => {
        await expect(pool.setPlugin(other.address)).to.be.emit(pool, 'Plugin').withArgs(other.address);
      });
    });

    describe('#setPluginConfig', () => {
      beforeEach('initialize the pool', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
      });
      it('cannot be called by usual user', async () => {
        await expect(pool.connect(other).setPluginConfig(1)).to.be.reverted;
      });
      it('can be called by plugin', async () => {
        await pool.setPlugin(other.address);
        await expect(pool.connect(other).setPluginConfig(1)).to.be.emit(pool, 'PluginConfig').withArgs(1);
      });
      it('reverts if admin sets non-zero pluginConfig in pool with zero plugin', async () => {
        await expect(pool.setPluginConfig(63)).to.be.revertedWithCustomError(pool, 'pluginIsNotConnected');
      });
      it('emits an event when changed', async () => {
        await pool.setPlugin(other.address);
        await expect(pool.setPluginConfig(1)).to.be.emit(pool, 'PluginConfig').withArgs(1);
      });
    });

    describe('#setFee', () => {
      let poolPlugin: MockPoolPlugin;

      beforeEach('create plugin', async () => {
        const MockPoolPluginFactory = await ethers.getContractFactory('MockPoolPlugin');
        poolPlugin = (await MockPoolPluginFactory.deploy(pool)) as any as MockPoolPlugin;
        await pool.setPlugin(poolPlugin);
        await pool.setPluginConfig(255);
      });

      it('if dynamic fee is off, owner can set fee in pool', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await pool.setPluginConfig(127);
        await expect(pool.setFee(20000)).to.emit(pool, 'Fee').withArgs(20000);
        const { lastFee } = await pool.globalState();
        expect(lastFee).to.eq(20000);

        const fee = await pool.fee();
        expect(lastFee).to.eq(fee);
      });

      it('if dynamic fee is off, plugin can not set fee in pool', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await pool.setPluginConfig(127);
        await expect(flash(100, 200, other.address)).to.be.revertedWithCustomError(pool, 'dynamicFeeDisabled');
      });

      it('only owner can set fee', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await pool.setPluginConfig(128);
        await expect(pool.connect(other).setFee(20000)).to.be.reverted;
      });

      it('if dynamic fee is on, owner can not set fee in pool', async () => {
        await pool.initialize(encodePriceSqrt(1, 1));
        await pool.setPluginConfig(128);
        await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
        await expect(pool.setFee(20000)).to.be.revertedWithCustomError(pool, 'dynamicFeeActive');
      });
    });
  });

  describe('#lock', () => {
    beforeEach('initialize the pool', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
    });

    it('cannot reenter from swap callback', async () => {
      const reentrant = (await (
        await ethers.getContractFactory('TestAlgebraReentrantCallee')
      ).deploy()) as any as TestAlgebraReentrantCallee;

      // the tests happen in solidity
      await expect(reentrant.swapToReenter(pool)).to.be.revertedWith('Unable to reenter');
    });
  });

  describe('fees and reserves overflow scenarios', async () => {
    it('up to max uint 128 - 1', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await mint(wallet.address, minTick, maxTick, 1);
      const [reserve0before, reserve1before] = await pool.getReserves();

      await flash(0, 0, wallet.address, MaxUint128 - 1n, MaxUint128 - 1n);

      await pool.burn(minTick, maxTick, 0, '0x');
      const [totalFeeGrowth0Token, totalFeeGrowth1Token] = await Promise.all([
        pool.totalFeeGrowth0Token(),
        pool.totalFeeGrowth1Token(),
      ]);
      // all 1s in first 128 bits
      expect(totalFeeGrowth0Token).to.eq((MaxUint128 << 128n) - (reserve0before << 128n));
      expect(totalFeeGrowth1Token).to.eq((MaxUint128 << 128n) - (reserve1before << 128n));
      const { amount0, amount1 } = await pool.collect.staticCall(
        wallet.address,
        minTick,
        maxTick,
        MaxUint128,
        MaxUint128
      );
      expect(amount0).to.eq(MaxUint128 - 1n);
      expect(amount1).to.eq(MaxUint128 - 1n);
    });

    it('both reserves overflow max uint 128', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await mint(wallet.address, minTick, maxTick, 1);
      const [reserve0before, reserve1before] = await pool.getReserves();

      await flash(0, 0, wallet.address, MaxUint128, MaxUint128);
      await flash(0, 0, wallet.address, 1, 1);

      await pool.burn(minTick, maxTick, 0, '0x');
      const [totalFeeGrowth0Token, totalFeeGrowth1Token] = await Promise.all([
        pool.totalFeeGrowth0Token(),
        pool.totalFeeGrowth1Token(),
      ]);
      // all 1s in first 128 bits
      expect(totalFeeGrowth0Token).to.eq((MaxUint128 << 128n) - (reserve0before << 128n));
      expect(totalFeeGrowth1Token).to.eq((MaxUint128 << 128n) - (reserve1before << 128n));
      const { amount0, amount1 } = await pool.collect.staticCall(
        wallet.address,
        minTick,
        maxTick,
        MaxUint128,
        MaxUint128
      );
      // fees burned
      expect(amount0).to.eq(MaxUint128 - 1n);
      expect(amount1).to.eq(MaxUint128 - 1n);
    });

    it('reserve0 overflow max uint 128', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await mint(wallet.address, minTick, maxTick, 1);
      const [reserve0before] = await pool.getReserves();

      await flash(0, 0, wallet.address, MaxUint128, 0);
      await flash(0, 0, wallet.address, 1, 0);

      await pool.burn(minTick, maxTick, 0, '0x');
      const [totalFeeGrowth0Token, totalFeeGrowth1Token] = await Promise.all([
        pool.totalFeeGrowth0Token(),
        pool.totalFeeGrowth1Token(),
      ]);
      // all 1s in first 128 bits
      expect(totalFeeGrowth0Token).to.eq((MaxUint128 << 128n) - (reserve0before << 128n));
      expect(totalFeeGrowth1Token).to.eq(0);
      const { amount0, amount1 } = await pool.collect.staticCall(
        wallet.address,
        minTick,
        maxTick,
        MaxUint128,
        MaxUint128
      );
      // fees burned
      expect(amount0).to.eq(MaxUint128 - 1n);
      expect(amount1).to.eq(0);
    });

    it('reserve1 overflow max uint 128', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await mint(wallet.address, minTick, maxTick, 1);
      const [, reserve1before] = await pool.getReserves();

      await flash(0, 0, wallet.address, 0, MaxUint128);
      await flash(0, 0, wallet.address, 0, 1);

      await pool.burn(minTick, maxTick, 0, '0x');
      const [totalFeeGrowth0Token, totalFeeGrowth1Token] = await Promise.all([
        pool.totalFeeGrowth0Token(),
        pool.totalFeeGrowth1Token(),
      ]);
      // all 1s in first 128 bits
      expect(totalFeeGrowth0Token).to.eq(0);
      expect(totalFeeGrowth1Token).to.eq((MaxUint128 << 128n) - (reserve1before << 128n));
      const { amount0, amount1 } = await pool.collect.staticCall(
        wallet.address,
        minTick,
        maxTick,
        MaxUint128,
        MaxUint128
      );
      // fees burned
      expect(amount0).to.eq(0);
      expect(amount1).to.eq(MaxUint128 - 1n);
    });

    it('overflow max uint 128 after poke burns fees owed to 0', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await mint(wallet.address, minTick, maxTick, 1);
      await flash(0, 0, wallet.address, MaxUint128, MaxUint128);
      await pool.burn(minTick, maxTick, 0, '0x');
      await flash(0, 0, wallet.address, 1, 1);
      await pool.burn(minTick, maxTick, 0, '0x');

      const { amount0, amount1 } = await pool.collect.staticCall(
        wallet.address,
        minTick,
        maxTick,
        MaxUint128,
        MaxUint128
      );
      // fees burned
      expect(amount0).to.eq(MaxUint128 - 1n);
      expect(amount1).to.eq(MaxUint128 - 1n);
    });

    it('two positions at the same snapshot', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await mint(wallet.address, minTick, maxTick, 1);
      await mint(other.address, minTick, maxTick, 1);
      const [reserve0before] = await pool.getReserves();
      await flash(0, 0, wallet.address, MaxUint128, 0);
      await flash(0, 0, wallet.address, MaxUint128, 0);
      await pool.burn(minTick, maxTick, 0, '0x');
      const totalFeeGrowth0Token = await pool.totalFeeGrowth0Token();
      expect(totalFeeGrowth0Token).to.eq(((MaxUint128 << 128n) - (reserve0before << 128n)) / 2n);
      await flash(0, 0, wallet.address, 2, 0);
      await pool.burn(minTick, maxTick, 0, '0x');
      await pool.connect(other).burn(minTick, maxTick, 0, '0x');
      let { amount0 } = await pool.collect.staticCall(wallet.address, minTick, maxTick, MaxUint128, MaxUint128);
      expect(amount0, 'amount0 of wallet').to.eq(MaxUint128 / 2n - 1n);
      ({ amount0 } = await pool
        .connect(other)
        .collect.staticCall(other.address, minTick, maxTick, MaxUint128, MaxUint128));
      expect(amount0, 'amount0 of other').to.eq(MaxUint128 / 2n - 1n);
    });

    it('two positions 1 wei of fees apart', async () => {
      await pool.initialize(encodePriceSqrt(1, 1));
      await mint(wallet.address, minTick, maxTick, 1);
      await flash(0, 0, wallet.address, 1, 0);
      await mint(other.address, minTick, maxTick, 1);
      const totalFeeGrowth0TokenBefore = await pool.totalFeeGrowth0Token();
      await flash(0, 0, wallet.address, MaxUint128, 0);
      await flash(0, 0, wallet.address, MaxUint128, 0);
      await pool.burn(minTick, maxTick, 0, '0x');
      const totalFeeGrowth0Token = await pool.totalFeeGrowth0Token();
      expect(totalFeeGrowth0Token).to.eq(totalFeeGrowth0TokenBefore + ((MaxUint128 - 3n) << 128n) / 2n);
      await flash(0, 0, wallet.address, 2, 0);
      await pool.burn(minTick, maxTick, 0, '0x');
      await pool.connect(other).burn(minTick, maxTick, 0, '0x');
      let { amount0 } = await pool.collect.staticCall(wallet.address, minTick, maxTick, MaxUint128, MaxUint128);
      expect(amount0, 'amount0 of wallet').to.eq(MaxUint128 / 2n);
      ({ amount0 } = await pool
        .connect(other)
        .collect.staticCall(other.address, minTick, maxTick, MaxUint128, MaxUint128));
      expect(amount0, 'amount0 of other').to.eq(MaxUint128 / 2n - 1n);
    });
  });

  describe('swap underpayment tests', () => {
    let underpay: TestAlgebraSwapPay;
    let poolAddress: string;
    beforeEach('deploy swap test', async () => {
      const underpayFactory = await ethers.getContractFactory('TestAlgebraSwapPay');
      underpay = (await underpayFactory.deploy()) as any as TestAlgebraSwapPay;
      await token0.approve(underpay, MaxUint256);
      await token1.approve(underpay, MaxUint256);
      await pool.initialize(encodePriceSqrt(1, 1));
      await mint(wallet.address, minTick, maxTick, expandTo18Decimals(1));
      poolAddress = await pool.getAddress();
    });
    it('swap 0 tokens', async () => {
      await expect(
        underpay.swap(pool, wallet.address, true, MIN_SQRT_RATIO + 1n, 0, 1, 0)
      ).to.be.revertedWithCustomError(pool, 'zeroAmountRequired');
    });

    it('underpay zero for one and exact in', async () => {
      await expect(
        underpay.swap(pool, wallet.address, true, MIN_SQRT_RATIO + 1n, 1000, 1, 0)
      ).to.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
    it('underpay hardly zero for one and exact in supporting fee on transfer', async () => {
      await expect(
        underpay.swapSupportingFee(pool, wallet.address, true, MIN_SQRT_RATIO + 1n, 1000, 0, 0)
      ).to.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
    it('underpay zero for one and exact in supporting fee on transfer', async () => {
      await expect(underpay.swapSupportingFee(pool, wallet.address, true, MIN_SQRT_RATIO + 1n, 1000, 900, 0)).to.be.not
        .reverted;
    });
    it('pay in the wrong token zero for one and exact in', async () => {
      await expect(
        underpay.swap(pool, wallet.address, true, MIN_SQRT_RATIO + 1n, 1000, 0, 2000)
      ).to.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
    it('overpay zero for one and exact in', async () => {
      await expect(
        underpay.swap(pool, wallet.address, true, MIN_SQRT_RATIO + 1n, 1000, 2000, 0)
      ).to.not.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
    it('underpay zero for one and exact out', async () => {
      await expect(
        underpay.swap(pool, wallet.address, true, MIN_SQRT_RATIO + 1n, -1000, 1, 0)
      ).to.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
    it('pay in the wrong token zero for one and exact out', async () => {
      await expect(
        underpay.swap(pool, wallet.address, true, MIN_SQRT_RATIO + 1n, -1000, 0, 2000)
      ).to.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
    it('overpay zero for one and exact out', async () => {
      await expect(
        underpay.swap(pool, wallet.address, true, MIN_SQRT_RATIO + 1n, -1000, 2000, 0)
      ).to.not.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
    it('underpay one for zero and exact in', async () => {
      await expect(
        underpay.swap(pool, wallet.address, false, MAX_SQRT_RATIO - 1n, 1000, 0, 1)
      ).to.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
    it('underpay hardly one for zero and exact in supporting fee on transfer', async () => {
      await expect(
        underpay.swapSupportingFee(pool, wallet.address, false, MAX_SQRT_RATIO - 1n, 1000, 0, 0)
      ).to.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
    it('underpay one for zero and exact in supporting fee on transfer', async () => {
      await expect(underpay.swapSupportingFee(pool, wallet.address, false, MAX_SQRT_RATIO - 1n, 1000, 0, 990)).to.be.not
        .reverted;
    });
    it('pay in the wrong token one for zero and exact in', async () => {
      await expect(
        underpay.swap(pool, wallet.address, false, MAX_SQRT_RATIO - 1n, 1000, 2000, 0)
      ).to.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
    it('overpay one for zero and exact in', async () => {
      await expect(
        underpay.swap(pool, wallet.address, false, MAX_SQRT_RATIO - 1n, 1000, 0, 2000)
      ).to.not.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
    it('underpay one for zero and exact out', async () => {
      await expect(
        underpay.swap(pool, wallet.address, false, MAX_SQRT_RATIO - 1n, -1000, 0, 1)
      ).to.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
    it('pay in the wrong token one for zero and exact out', async () => {
      await expect(
        underpay.swap(pool, wallet.address, false, MAX_SQRT_RATIO - 1n, -1000, 2000, 0)
      ).to.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
    it('overpay one for zero and exact out', async () => {
      await expect(
        underpay.swap(pool, wallet.address, false, MAX_SQRT_RATIO - 1n, -1000, 0, 2000)
      ).to.not.be.revertedWithCustomError(pool, 'insufficientInputAmount');
    });
  });
});
