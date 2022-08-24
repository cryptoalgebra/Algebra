import { Decimal } from 'decimal.js'
import { BigNumber, BigNumberish, ContractTransaction, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { MockTimeAlgebraPool } from '../typechain/test/MockTimeAlgebraPool'
import { TestERC20 } from '../typechain/test/TestERC20'

import { TestAlgebraCallee } from '../typechain/test/TestAlgebraCallee'
import { expect } from './shared/expect'
import { poolFixture } from './shared/fixtures'
import { formatPrice, formatTokenAmount } from './shared/format'
import {
  createPoolFunctions,
  encodePriceSqrt,
  expandTo18Decimals,
  FeeAmount,
  getMaxTick,
  getMinTick,
  MAX_SQRT_RATIO,
  MaxUint128,
  MIN_SQRT_RATIO,
  TICK_SPACINGS,
} from './shared/utilities'

Decimal.config({ toExpNeg: -500, toExpPos: 500 })

const { constants } = ethers

interface BaseSwapTestCase {
  zeroToOne: boolean
  sqrtPriceLimit?: BigNumber
}
interface SwapExact0For1TestCase extends BaseSwapTestCase {
  zeroToOne: true
  exactOut: false
  amount0: BigNumberish
  sqrtPriceLimit?: BigNumber
  comissionOnTransaction: boolean
}
interface SwapExact1For0TestCase extends BaseSwapTestCase {
  zeroToOne: false
  exactOut: false
  amount1: BigNumberish
  sqrtPriceLimit?: BigNumber
  comissionOnTransaction: boolean
}
interface Swap0ForExact1TestCase extends BaseSwapTestCase {
  zeroToOne: true
  exactOut: true
  amount1: BigNumberish
  sqrtPriceLimit?: BigNumber
}
interface Swap1ForExact0TestCase extends BaseSwapTestCase {
  zeroToOne: false
  exactOut: true
  amount0: BigNumberish
  sqrtPriceLimit?: BigNumber
}
interface SwapToHigherPrice extends BaseSwapTestCase {
  zeroToOne: false
  sqrtPriceLimit: BigNumber
}
interface SwapToLowerPrice extends BaseSwapTestCase {
  zeroToOne: true
  sqrtPriceLimit: BigNumber
}
type SwapTestCase =
  | SwapExact0For1TestCase
  | Swap0ForExact1TestCase
  | SwapExact1For0TestCase
  | Swap1ForExact0TestCase
  | SwapToHigherPrice
  | SwapToLowerPrice

function swapCaseToDescription(testCase: SwapTestCase): string {
  const priceClause = testCase?.sqrtPriceLimit ? ` to price ${formatPrice(testCase.sqrtPriceLimit)}` : ''
  if ('exactOut' in testCase) {
    if (testCase.exactOut) {
      if (testCase.zeroToOne) {
        return `swap token0 for exactly ${formatTokenAmount(testCase.amount1)} token1${priceClause}`
      } else {
        return `swap token1 for exactly ${formatTokenAmount(testCase.amount0)} token0${priceClause}`
      }
    } else {
      let title = '';
      if (testCase.comissionOnTransaction) {
        title = "Token with comission "
      }
      if (testCase.zeroToOne) {
        return `${title}swap exactly ${formatTokenAmount(testCase.amount0)} token0 for token1${priceClause}`
      } else {
        return `${title}swap exactly ${formatTokenAmount(testCase.amount1)} token1 for token0${priceClause}`
      }
    }
  } else {
    if (testCase.zeroToOne) {
      return `swap token0 for token1${priceClause}`
    } else {
      return `swap token1 for token0${priceClause}`
    }
  }
}

type PoolFunctions = ReturnType<typeof createPoolFunctions>

// can't use address zero because the ERC20 token does not allow it
const SWAP_RECIPIENT_ADDRESS = constants.AddressZero.slice(0, -1) + '1'
const POSITION_PROCEEDS_OUTPUT_ADDRESS = constants.AddressZero.slice(0, -1) + '2'

async function executeSwap(
  pool: MockTimeAlgebraPool,
  testCase: SwapTestCase,
  poolFunctions: PoolFunctions
): Promise<ContractTransaction> {
  let swap: ContractTransaction
  if ('exactOut' in testCase) {
    if (testCase.exactOut) {
      if (testCase.zeroToOne) {
        swap = await poolFunctions.swap0ForExact1(testCase.amount1, SWAP_RECIPIENT_ADDRESS, testCase.sqrtPriceLimit)
      } else {
        swap = await poolFunctions.swap1ForExact0(testCase.amount0, SWAP_RECIPIENT_ADDRESS, testCase.sqrtPriceLimit)
      }
    } else {
      if (testCase.zeroToOne) {
        if (testCase.comissionOnTransaction) {
          swap = await poolFunctions.swapExact0For1SupportingFee(testCase.amount0, SWAP_RECIPIENT_ADDRESS, testCase.sqrtPriceLimit)
        } else {
          swap = await poolFunctions.swapExact0For1(testCase.amount0, SWAP_RECIPIENT_ADDRESS, testCase.sqrtPriceLimit)
        }
      } else {
        if (testCase.comissionOnTransaction) {
          swap = await poolFunctions.swapExact1For0SupportingFee(testCase.amount1, SWAP_RECIPIENT_ADDRESS, testCase.sqrtPriceLimit)
        } else {
          swap = await poolFunctions.swapExact1For0(testCase.amount1, SWAP_RECIPIENT_ADDRESS, testCase.sqrtPriceLimit)
        }
      }
    }
  } else {
    if (testCase.zeroToOne) {
      swap = await poolFunctions.swapToLowerPrice(testCase.sqrtPriceLimit, SWAP_RECIPIENT_ADDRESS)
    } else {
      swap = await poolFunctions.swapToHigherPrice(testCase.sqrtPriceLimit, SWAP_RECIPIENT_ADDRESS)
    }
  }
  return swap
}

const DEFAULT_POOL_SWAP_TESTS: SwapTestCase[] = [
  // swap large amounts in/out
  {
    zeroToOne: true,
    exactOut: false,
    amount0: expandTo18Decimals(1),
    comissionOnTransaction: false
  },
  {
    zeroToOne: true,
    exactOut: false,
    amount0: expandTo18Decimals(1),
    comissionOnTransaction: true
  },
  {
    zeroToOne: false,
    exactOut: false,
    amount1: expandTo18Decimals(1),
    comissionOnTransaction: false
  },
  {
    zeroToOne: false,
    exactOut: false,
    amount1: expandTo18Decimals(1),
    comissionOnTransaction: true
  },
  {
    zeroToOne: true,
    exactOut: true,
    amount1: expandTo18Decimals(1),
  },
  {
    zeroToOne: false,
    exactOut: true,
    amount0: expandTo18Decimals(1),
  },
  // swap large amounts in/out with a price limit
  {
    zeroToOne: true,
    exactOut: false,
    amount0: expandTo18Decimals(1),
    sqrtPriceLimit: encodePriceSqrt(50, 100),
  },
  {
    zeroToOne: false,
    exactOut: false,
    amount1: expandTo18Decimals(1),
    sqrtPriceLimit: encodePriceSqrt(200, 100),
  },
  {
    zeroToOne: true,
    exactOut: true,
    amount1: expandTo18Decimals(1),
    sqrtPriceLimit: encodePriceSqrt(50, 100),
  },
  {
    zeroToOne: false,
    exactOut: true,
    amount0: expandTo18Decimals(1),
    sqrtPriceLimit: encodePriceSqrt(200, 100),
  },
  // swap small amounts in/out
  {
    zeroToOne: true,
    exactOut: false,
    amount0: 1000,
    comissionOnTransaction: false
  },
  {
    zeroToOne: true,
    exactOut: false,
    amount0: 1000,
    comissionOnTransaction: true
  },
  {
    zeroToOne: false,
    exactOut: false,
    amount1: 1000,
    comissionOnTransaction: false
  },
  {
    zeroToOne: false,
    exactOut: false,
    amount1: 1000,
    comissionOnTransaction: true
  },
  {
    zeroToOne: true,
    exactOut: true,
    amount1: 1000,
  },
  {
    zeroToOne: false,
    exactOut: true,
    amount0: 1000,
  },
  // swap arbitrary input to price
  {
    sqrtPriceLimit: encodePriceSqrt(5, 2),
    zeroToOne: false,
  },
  {
    sqrtPriceLimit: encodePriceSqrt(2, 5),
    zeroToOne: true,
  },
  {
    sqrtPriceLimit: encodePriceSqrt(5, 2),
    zeroToOne: true,
  },
  {
    sqrtPriceLimit: encodePriceSqrt(2, 5),
    zeroToOne: false,
  },
]

interface Position {
  bottomTick: number
  topTick: number
  liquidity: BigNumberish
}

interface PoolTestCase {
  description: string
  feeAmount: number
  tickSpacing: number
  startingPrice: BigNumber
  positions: Position[]
  swapTests?: SwapTestCase[]
}

const TEST_POOLS: PoolTestCase[] = [
  {
    description: '1:1 price, 2e18 max range liquidity',
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        bottomTick: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        topTick: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: '10:1 price, 2e18 max range liquidity',
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(10, 1),
    positions: [
      {
        bottomTick: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        topTick: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: '1:10 price, 2e18 max range liquidity',
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 10),
    positions: [
      {
        bottomTick: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        topTick: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: '1:1 price, 0 liquidity, all liquidity around current price',
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        bottomTick: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        topTick: -TICK_SPACINGS[FeeAmount.MEDIUM],
        liquidity: expandTo18Decimals(2),
      },
      {
        bottomTick: TICK_SPACINGS[FeeAmount.MEDIUM],
        topTick: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: '1:1 price, additional liquidity around current price',
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        bottomTick: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        topTick: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
      {
        bottomTick: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        topTick: -TICK_SPACINGS[FeeAmount.MEDIUM],
        liquidity: expandTo18Decimals(2),
      },
      {
        bottomTick: TICK_SPACINGS[FeeAmount.MEDIUM],
        topTick: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: 'large liquidity around current price (stable swap)',
    feeAmount: FeeAmount.LOW,
    tickSpacing: TICK_SPACINGS[FeeAmount.LOW],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        bottomTick: -TICK_SPACINGS[FeeAmount.LOW],
        topTick: TICK_SPACINGS[FeeAmount.LOW],
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: 'token0 liquidity only',
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        bottomTick: 0,
        topTick: 2000 * TICK_SPACINGS[FeeAmount.MEDIUM],
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: 'token1 liquidity only',
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        bottomTick: -2000 * TICK_SPACINGS[FeeAmount.MEDIUM],
        topTick: 0,
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: 'close to max price',
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(BigNumber.from(2).pow(127), 1),
    positions: [
      {
        bottomTick: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        topTick: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: 'close to min price',
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, BigNumber.from(2).pow(127)),
    positions: [
      {
        bottomTick: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        topTick: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: 'max full range liquidity at 1:1 price with default fee',
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        bottomTick: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        topTick: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: BigNumber.from("11505743598341114571880798222544994"),
      },
    ],
  },
  {
    description: 'initialized at the max ratio',
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: MAX_SQRT_RATIO.sub(1),
    positions: [
      {
        bottomTick: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        topTick: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: 'initialized at the min ratio',
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: MIN_SQRT_RATIO,
    positions: [
      {
        bottomTick: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        topTick: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
]

describe('AlgebraPool swap tests', () => {
  let wallet: Wallet, other: Wallet


  before('create fixture loader', async () => {
    ;[wallet, other] = await (ethers as any).getSigners()
  })

  for (const poolCase of TEST_POOLS) {
    describe(poolCase.description, () => {
      const setupPool = async (isDefl : boolean, zeroToOne : boolean) => {
        const { createPool, token0, token1, swapTargetCallee: swapTarget } = await loadFixture(poolFixture);
        const pool = await createPool(poolCase.feeAmount)
        const poolFunctions = createPoolFunctions({ swapTarget, token0, token1, pool })
        await pool.initialize(poolCase.startingPrice)
        // mint all positions
        if (isDefl) {
          if (zeroToOne)
            await token0.setDefl();
          else
            await token1.setDefl();
        }

        let _positions = [];
        for (const position of poolCase.positions) {
          let _position = {...position}
          let tx = await poolFunctions.mint(wallet.address, position.bottomTick, position.topTick, position.liquidity)
          if (isDefl) {
            let receipt = await tx.wait();
            if (!receipt.events) continue;

            for (let ev of receipt.events) {
              if (ev.event == 'MintResult') {
                if (ev.args) {
                  _position.liquidity = ev.args[2];
                }
                break;
              }
            }
          }
          _positions.push(_position);
        }

        const [poolBalance0, poolBalance1] = await Promise.all([
          token0.balanceOf(pool.address),
          token1.balanceOf(pool.address),
        ])

        return { token0, token1, pool, poolFunctions, poolBalance0, poolBalance1, swapTarget, _positions }
    }

      let token0: TestERC20
      let token1: TestERC20

      let poolBalance0: BigNumber
      let poolBalance1: BigNumber

      let pool: MockTimeAlgebraPool
      let swapTarget: TestAlgebraCallee
      let poolFunctions: PoolFunctions

      let _positions: Position[];

      afterEach('check can burn positions', async () => {
        for (const { liquidity, topTick, bottomTick } of _positions) {
          await pool.burn(bottomTick, topTick, liquidity)
          await pool.collect(POSITION_PROCEEDS_OUTPUT_ADDRESS, bottomTick, topTick, MaxUint128, MaxUint128)
        }
      })

      for (const testCase of poolCase.swapTests ?? DEFAULT_POOL_SWAP_TESTS) {
        it(swapCaseToDescription(testCase), async () => {

          let withComission = 'comissionOnTransaction' in testCase && testCase.comissionOnTransaction;
          ;({ token0, token1, pool, poolFunctions, poolBalance0, poolBalance1, swapTarget, _positions } = await 
            setupPool(withComission, testCase.zeroToOne)
          )

          const globalState = await pool.globalState()

          const tx = executeSwap(pool, testCase, poolFunctions)
          try {
            await tx
          } catch (error: any) {
            expect({
              swapError: error.message,
              poolBalance0: poolBalance0.toString(),
              poolBalance1: poolBalance1.toString(),
              poolPriceBefore: formatPrice(globalState.price),
              tickBefore: globalState.tick,
            }).to.matchSnapshot('swap error')
            return
          }
          const [
            poolBalance0After,
            poolBalance1After,
            globalStateAfter,
            liquidityAfter,
            totalFeeGrowth0Token,
            totalFeeGrowth1Token,
          ] = await Promise.all([
            token0.balanceOf(pool.address),
            token1.balanceOf(pool.address),
            pool.globalState(),
            pool.liquidity(),
            pool.totalFeeGrowth0Token(),
            pool.totalFeeGrowth1Token(),
          ])
          const poolBalance0Delta = poolBalance0After.sub(poolBalance0)
          const poolBalance1Delta = poolBalance1After.sub(poolBalance1)

          // check all the events were emitted corresponding to balance changes
          
          if (!withComission) {
            if (poolBalance0Delta.eq(0)) await expect(tx).to.not.emit(token0, 'Transfer')
            else if (poolBalance0Delta.lt(0))
              await expect(tx)
                .to.emit(token0, 'Transfer')
                .withArgs(pool.address, SWAP_RECIPIENT_ADDRESS, poolBalance0Delta.mul(-1))
            else await expect(tx).to.emit(token0, 'Transfer').withArgs(wallet.address, pool.address, poolBalance0Delta)

            if (poolBalance1Delta.eq(0)) await expect(tx).to.not.emit(token1, 'Transfer')
            else if (poolBalance1Delta.lt(0))
              await expect(tx)
                .to.emit(token1, 'Transfer')
                .withArgs(pool.address, SWAP_RECIPIENT_ADDRESS, poolBalance1Delta.mul(-1))
            else await expect(tx).to.emit(token1, 'Transfer').withArgs(wallet.address, pool.address, poolBalance1Delta)
          }

          // check that the swap event was emitted too
          await expect(tx)
            .to.emit(pool, 'Swap')
            .withArgs(
              swapTarget.address,
              SWAP_RECIPIENT_ADDRESS,
              poolBalance0Delta,
              poolBalance1Delta,
              globalStateAfter.price,
              liquidityAfter,
              globalStateAfter.tick
            )

          const executionPrice = new Decimal(poolBalance1Delta.toString()).div(poolBalance0Delta.toString()).mul(-1)

          expect({
            amount0Before: poolBalance0.toString(),
            amount1Before: poolBalance1.toString(),
            amount0Delta: poolBalance0Delta.toString(),
            amount1Delta: poolBalance1Delta.toString(),
            totalFeeGrowth0TokenDelta: totalFeeGrowth0Token.toString(),
            totalFeeGrowth1TokenDelta: totalFeeGrowth1Token.toString(),
            tickBefore: globalState.tick,
            poolPriceBefore: formatPrice(globalState.price),
            tickAfter: globalStateAfter.tick,
            poolPriceAfter: formatPrice(globalStateAfter.price),
            executionPrice: executionPrice.toPrecision(5),
          }).to.matchSnapshot('balances')
        })
      }
    })
  }
})
