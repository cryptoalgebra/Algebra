import bn from 'bignumber.js'
import { BigNumber, BigNumberish, constants, Contract, ContractTransaction, utils, Wallet } from 'ethers'
import { TestAlgebraCallee } from '../../typechain/test/TestAlgebraCallee'
import { TestAlgebraRouter } from '../../typechain/test/TestAlgebraRouter'
import { MockTimeAlgebraPool } from '../../typechain/test/MockTimeAlgebraPool'
import { TestERC20 } from '../../typechain/test/TestERC20'

export const MaxUint128 = BigNumber.from(2).pow(128).sub(1)

export const getMinTick = (tickSpacing: number) => Math.ceil(-887272 / tickSpacing) * tickSpacing
export const getMaxTick = (tickSpacing: number) => Math.floor(887272 / tickSpacing) * tickSpacing

export const getMaxLiquidityPerTick = (tickSpacing: number) =>
  BigNumber.from(2)
    .pow(128)
    .sub(1)
    .div((getMaxTick(tickSpacing) - getMinTick(tickSpacing)) / tickSpacing + 1)

export const MIN_SQRT_RATIO = BigNumber.from('4295128739')
export const MAX_SQRT_RATIO = BigNumber.from('1461446703485210103287273052203988822378723970342')

export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 60,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 60,
}

export function expandTo18Decimals(n: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}

export function getCreate2Address(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  bytecode: string
): string {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA]
  const constructorArgumentsEncoded = utils.defaultAbiCoder.encode(
    ['address', 'address'],
    [token0, token1]
  )
  const create2Inputs = [
    '0xff',
    factoryAddress,
    // salt
    utils.keccak256(constructorArgumentsEncoded),
    // init code. bytecode + constructor arguments
    utils.keccak256(bytecode),
  ]
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`
  return utils.getAddress(`0x${utils.keccak256(sanitizedInputs).slice(-40)}`)
}

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

// returns the sqrt price as a 64x96
export function encodePriceSqrt(reserve1: BigNumberish, reserve0: BigNumberish): BigNumber {
  return BigNumber.from(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  )
}

export function getPositionKey(address: string, bottomTick: number, topTick: number, pool: MockTimeAlgebraPool): Promise<string> {
  return pool.getKeyForPosition(address, bottomTick, topTick);
}

export type SwapFunction = (
  amount: BigNumberish,
  to: Wallet | string,
  limitSqrtPrice?: BigNumberish
) => Promise<ContractTransaction>
export type SwapToPriceFunction = (price: BigNumberish, to: Wallet | string) => Promise<ContractTransaction>
export type FlashFunction = (
  amount0: BigNumberish,
  amount1: BigNumberish,
  to: Wallet | string,
  pay0?: BigNumberish,
  pay1?: BigNumberish
) => Promise<ContractTransaction>
export type MintFunction = (
  recipient: string,
  bottomTick: BigNumberish,
  topTick: BigNumberish,
  liquidity: BigNumberish
) => Promise<ContractTransaction>
export interface PoolFunctions {
  swapToLowerPrice: SwapToPriceFunction
  swapToHigherPrice: SwapToPriceFunction
  swapExact0For1: SwapFunction
  swapExact0For1SupportingFee: SwapFunction
  swap0ForExact1: SwapFunction
  swapExact1For0: SwapFunction
  swapExact1For0SupportingFee: SwapFunction
  swap1ForExact0: SwapFunction
  flash: FlashFunction
  mint: MintFunction
}
export function createPoolFunctions({
  swapTarget,
  token0,
  token1,
  pool,
}: {
  swapTarget: TestAlgebraCallee
  token0: TestERC20
  token1: TestERC20
  pool: MockTimeAlgebraPool
}): PoolFunctions {
  async function swapToSqrtPrice(
    inputToken: Contract,
    targetPrice: BigNumberish,
    to: Wallet | string
  ): Promise<ContractTransaction> {
    const method = inputToken === token0 ? swapTarget.swapToLowerSqrtPrice : swapTarget.swapToHigherSqrtPrice

    await inputToken.approve(swapTarget.address, constants.MaxUint256)

    const toAddress = typeof to === 'string' ? to : to.address

    return method(pool.address, targetPrice, toAddress)
  }

  async function swap(
    inputToken: Contract,
    [amountIn, amountOut]: [BigNumberish, BigNumberish],
    to: Wallet | string,
    limitSqrtPrice?: BigNumberish,
    supportingFee?: boolean
  ): Promise<ContractTransaction> {
    const exactInput = amountOut === 0

    const method =
      inputToken === token0
        ? exactInput
          ? supportingFee ? swapTarget.swapExact0For1SupportingFee : swapTarget.swapExact0For1
          : swapTarget.swap0ForExact1
        : exactInput
        ? supportingFee ? swapTarget.swapExact1For0SupportingFee : swapTarget.swapExact1For0
        : swapTarget.swap1ForExact0

    if (typeof limitSqrtPrice === 'undefined') {
      if (inputToken === token0) {
        limitSqrtPrice = MIN_SQRT_RATIO.add(1)
      } else {
        limitSqrtPrice = MAX_SQRT_RATIO.sub(1)
      }
    }
    await inputToken.approve(swapTarget.address, constants.MaxUint256)

    const toAddress = typeof to === 'string' ? to : to.address

    return method(pool.address, exactInput ? amountIn : amountOut, toAddress, limitSqrtPrice)
  }
  

  const swapToLowerPrice: SwapToPriceFunction = (price, to) => {
    return swapToSqrtPrice(token0, price, to)
  }

  const swapToHigherPrice: SwapToPriceFunction = (price, to) => {
    return swapToSqrtPrice(token1, price, to)
  }

  const swapExact0For1: SwapFunction = (amount, to, limitSqrtPrice) => {
    return swap(token0, [amount, 0], to, limitSqrtPrice)
  }

  const swapExact0For1SupportingFee: SwapFunction = (amount, to, limitSqrtPrice) => {
    return swap(token0, [amount, 0], to, limitSqrtPrice, true)
  }

  const swap0ForExact1: SwapFunction = (amount, to, limitSqrtPrice) => {
    return swap(token0, [0, amount], to, limitSqrtPrice)
  }

  const swapExact1For0: SwapFunction = (amount, to, limitSqrtPrice) => {
    return swap(token1, [amount, 0], to, limitSqrtPrice)
  }

  const swapExact1For0SupportingFee: SwapFunction = (amount, to, limitSqrtPrice) => {
    return swap(token1, [amount, 0], to, limitSqrtPrice, true)
  }

  const swap1ForExact0: SwapFunction = (amount, to, limitSqrtPrice) => {
    return swap(token1, [0, amount], to, limitSqrtPrice)
  }

  const mint: MintFunction = async (recipient, bottomTick, topTick, liquidity) => {
    await token0.approve(swapTarget.address, constants.MaxUint256)
    await token1.approve(swapTarget.address, constants.MaxUint256)
    return swapTarget.mint(pool.address, recipient, bottomTick, topTick, liquidity)
  }

  const flash: FlashFunction = async (amount0, amount1, to, pay0?: BigNumberish, pay1?: BigNumberish) => {
    const fee = (await pool.globalState()).fee
    if (typeof pay0 === 'undefined') {
      pay0 = BigNumber.from(amount0)
        .mul(fee)
        .add(1e6 - 1)
        .div(1e6)
        .add(amount0)
    }
    if (typeof pay1 === 'undefined') {
      pay1 = BigNumber.from(amount1)
        .mul(fee)
        .add(1e6 - 1)
        .div(1e6)
        .add(amount1)
    }
    return swapTarget.flash(pool.address, typeof to === 'string' ? to : to.address, amount0, amount1, pay0, pay1)
  }

  return {
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
  }
}

export interface MultiPoolFunctions {
  swapForExact0Multi: SwapFunction
  swapForExact1Multi: SwapFunction
}

export function createMultiPoolFunctions({
  inputToken,
  swapTarget,
  poolInput,
  poolOutput,
}: {
  inputToken: TestERC20
  swapTarget: TestAlgebraRouter
  poolInput: MockTimeAlgebraPool
  poolOutput: MockTimeAlgebraPool
}): MultiPoolFunctions {
  async function swapForExact0Multi(amountOut: BigNumberish, to: Wallet | string): Promise<ContractTransaction> {
    const method = swapTarget.swapForExact0Multi
    await inputToken.approve(swapTarget.address, constants.MaxUint256)
    const toAddress = typeof to === 'string' ? to : to.address
    return method(toAddress, poolInput.address, poolOutput.address, amountOut)
  }

  async function swapForExact1Multi(amountOut: BigNumberish, to: Wallet | string): Promise<ContractTransaction> {
    const method = swapTarget.swapForExact1Multi
    await inputToken.approve(swapTarget.address, constants.MaxUint256)
    const toAddress = typeof to === 'string' ? to : to.address
    return method(toAddress, poolInput.address, poolOutput.address, amountOut)
  }

  return {
    swapForExact0Multi,
    swapForExact1Multi,
  }
}
