import { constants, Contract, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import {
  IUniswapV2Pair,
  IAlgebraFactory,
  IWNativeToken,
  MockTimeNonfungiblePositionManager,
  TestERC20,
  V3Migrator,
} from '../typechain'
import completeFixture from './shared/completeFixture'
import { v2FactoryFixture } from './shared/externalFixtures'

import { abi as PAIR_V2_ABI } from '@uniswap/v2-core/build/UniswapV2Pair.json'
import { expect } from 'chai'
import { FeeAmount } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import snapshotGasCost from './shared/snapshotGasCost'
import { sortedTokens } from './shared/tokenSort'
import { getMaxTick, getMinTick } from './shared/ticks'

describe('V3Migrator', () => {
  let wallet: Wallet

  const migratorFixture: () => Promise<{
    factoryV2: Contract
    factoryV3: IAlgebraFactory
    token: TestERC20
    wnative: IWNativeToken
    nft: MockTimeNonfungiblePositionManager
    migrator: V3Migrator
  }> = async () => {
    const { factory, tokens, nft, wnative } = await completeFixture()

    const { factory: factoryV2 } = await v2FactoryFixture()

    const token = tokens[0]
    await token.approve(factoryV2.address, constants.MaxUint256)
    await wnative.deposit({ value: 10000 })
    await wnative.approve(nft.address, constants.MaxUint256)

    // deploy the migrator
    const migrator = (await (await ethers.getContractFactory('V3Migrator')).deploy(
      factory.address,
      wnative.address,
      nft.address,
      await factory.poolDeployer()
    )) as V3Migrator

    return {
      factoryV2,
      factoryV3: factory,
      token,
      wnative,
      nft,
      migrator,
    }
  }

  let factoryV2: Contract
  let factoryV3: IAlgebraFactory
  let token: TestERC20
  let wnative: IWNativeToken
  let nft: MockTimeNonfungiblePositionManager
  let migrator: V3Migrator
  let pair: IUniswapV2Pair


  before('create fixture loader', async () => {
    const wallets = await (ethers as any).getSigners()
    wallet = wallets[0]
  })

  beforeEach('load fixture', async () => {
    ;({ factoryV2, factoryV3, token, wnative, nft, migrator } = await loadFixture(migratorFixture))
  })

  afterEach('ensure allowances are cleared', async () => {
    const allowanceToken = await token.allowance(migrator.address, nft.address)
    const allowanceWNativeToken = await wnative.allowance(migrator.address, nft.address)
    expect(allowanceToken).to.be.eq(0)
    expect(allowanceWNativeToken).to.be.eq(0)
  })

  afterEach('ensure balances are cleared', async () => {
    const balanceToken = await token.balanceOf(migrator.address)
    const balanceWNativeToken = await wnative.balanceOf(migrator.address)
    expect(balanceToken).to.be.eq(0)
    expect(balanceWNativeToken).to.be.eq(0)
  })

  afterEach('ensure eth balance is cleared', async () => {
    const balanceNative = await ethers.provider.getBalance(migrator.address)
    expect(balanceNative).to.be.eq(0)
  })

  describe('#migrate', () => {
    let tokenLower: boolean

    const expectedLiquidity = 10000 - 1000

    beforeEach(() => {
      tokenLower = token.address.toLowerCase() < wnative.address.toLowerCase()
    })

    beforeEach('add V2 liquidity', async () => {
      await factoryV2.createPair(token.address, wnative.address)

      const pairAddress = await factoryV2.getPair(token.address, wnative.address)

      pair = new ethers.Contract(pairAddress, PAIR_V2_ABI, wallet) as IUniswapV2Pair

      await token.transfer(pair.address, 10000)
      await wnative.transfer(pair.address, 10000)

      await pair.mint(wallet.address)

      expect(await pair.balanceOf(wallet.address)).to.be.eq(expectedLiquidity)
    })

    it('fails if v3 pool is not initialized', async () => {
      await pair.approve(migrator.address, expectedLiquidity)
      await expect(
        migrator.migrate({
          pair: pair.address,
          liquidityToMigrate: expectedLiquidity,
          percentageToMigrate: 100,
          token0: tokenLower ? token.address : wnative.address,
          token1: tokenLower ? wnative.address : token.address,
          tickLower: -1,
          tickUpper: 1,
          amount0Min: 9000,
          amount1Min: 9000,
          recipient: wallet.address,
          deadline: 1,
          refundAsNative: false,
        })
      ).to.be.reverted
    })

    it('works once v3 pool is initialized', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        encodePriceSqrt(1, 1)
      )

      await pair.approve(migrator.address, expectedLiquidity)
      await migrator.migrate({
        pair: pair.address,
        liquidityToMigrate: expectedLiquidity,
        percentageToMigrate: 100,
        token0: tokenLower ? token.address : wnative.address,
        token1: tokenLower ? wnative.address : token.address,
        tickLower: getMinTick(60),
        tickUpper: getMaxTick(60),
        amount0Min: 9000,
        amount1Min: 9000,
        recipient: wallet.address,
        deadline: 1,
        refundAsNative: false,
      })

      const position = await nft.positions(1)
      expect(position.liquidity).to.be.eq(9000)

      const poolAddress = await factoryV3.poolByPair(token.address, wnative.address)
      expect(await token.balanceOf(poolAddress)).to.be.eq(9000)
      expect(await wnative.balanceOf(poolAddress)).to.be.eq(9000)
    })

    it('works for partial', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        encodePriceSqrt(1, 1)
      )

      const tokenBalanceBefore = await token.balanceOf(wallet.address)
      const wnativeBalanceBefore = await wnative.balanceOf(wallet.address)

      await pair.approve(migrator.address, expectedLiquidity)
      await migrator.migrate({
        pair: pair.address,
        liquidityToMigrate: expectedLiquidity,
        percentageToMigrate: 50,
        token0: tokenLower ? token.address : wnative.address,
        token1: tokenLower ? wnative.address : token.address,
        tickLower: getMinTick(60),
        tickUpper: getMaxTick(60),
        amount0Min: 4500,
        amount1Min: 4500,
        recipient: wallet.address,
        deadline: 1,
        refundAsNative: false,
      })

      const tokenBalanceAfter = await token.balanceOf(wallet.address)
      const wnativeBalanceAfter = await wnative.balanceOf(wallet.address)

      expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(4500)
      expect(wnativeBalanceAfter.sub(wnativeBalanceBefore)).to.be.eq(4500)

      const position = await nft.positions(1)
      expect(position.liquidity).to.be.eq(4500)

      const poolAddress = await factoryV3.poolByPair(token.address, wnative.address)
      expect(await token.balanceOf(poolAddress)).to.be.eq(4500)
      expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500)
    })

    it('double the price', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        encodePriceSqrt(2, 1)
      )

      const tokenBalanceBefore = await token.balanceOf(wallet.address)
      const wnativeBalanceBefore = await wnative.balanceOf(wallet.address)

      await pair.approve(migrator.address, expectedLiquidity)
      await migrator.migrate({
        pair: pair.address,
        liquidityToMigrate: expectedLiquidity,
        percentageToMigrate: 100,
        token0: tokenLower ? token.address : wnative.address,
        token1: tokenLower ? wnative.address : token.address,
        tickLower: getMinTick(60),
        tickUpper: getMaxTick(60),
        amount0Min: 4500,
        amount1Min: 8999,
        recipient: wallet.address,
        deadline: 1,
        refundAsNative: false,
      })

      const tokenBalanceAfter = await token.balanceOf(wallet.address)
      const wnativeBalanceAfter = await wnative.balanceOf(wallet.address)

      const position = await nft.positions(1)
      expect(position.liquidity).to.be.eq(6363)

      const poolAddress = await factoryV3.poolByPair(token.address, wnative.address)
      if (token.address.toLowerCase() < wnative.address.toLowerCase()) {
        expect(await token.balanceOf(poolAddress)).to.be.eq(4500)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(4500)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(8999)
        expect(wnativeBalanceAfter.sub(wnativeBalanceBefore)).to.be.eq(1)
      } else {
        expect(await token.balanceOf(poolAddress)).to.be.eq(8999)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(1)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500)
        expect(wnativeBalanceAfter.sub(wnativeBalanceBefore)).to.be.eq(4500)
      }
    })

    it('half the price', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        encodePriceSqrt(1, 2)
      )

      const tokenBalanceBefore = await token.balanceOf(wallet.address)
      const wnativeBalanceBefore = await wnative.balanceOf(wallet.address)

      await pair.approve(migrator.address, expectedLiquidity)
      await migrator.migrate({
        pair: pair.address,
        liquidityToMigrate: expectedLiquidity,
        percentageToMigrate: 100,
        token0: tokenLower ? token.address : wnative.address,
        token1: tokenLower ? wnative.address : token.address,
        tickLower: getMinTick(60),
        tickUpper: getMaxTick(60),
        amount0Min: 8999,
        amount1Min: 4500,
        recipient: wallet.address,
        deadline: 1,
        refundAsNative: false,
      })

      const tokenBalanceAfter = await token.balanceOf(wallet.address)
      const wnativeBalanceAfter = await wnative.balanceOf(wallet.address)

      const position = await nft.positions(1)
      expect(position.liquidity).to.be.eq(6363)

      const poolAddress = await factoryV3.poolByPair(token.address, wnative.address)
      if (token.address.toLowerCase() < wnative.address.toLowerCase()) {
        expect(await token.balanceOf(poolAddress)).to.be.eq(8999)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(1)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500)
        expect(wnativeBalanceAfter.sub(wnativeBalanceBefore)).to.be.eq(4500)
      } else {
        expect(await token.balanceOf(poolAddress)).to.be.eq(4500)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(4500)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(8999)
        expect(wnativeBalanceAfter.sub(wnativeBalanceBefore)).to.be.eq(1)
      }
    })

    it('double the price - as Native', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        encodePriceSqrt(2, 1)
      )

      const tokenBalanceBefore = await token.balanceOf(wallet.address)

      await pair.approve(migrator.address, expectedLiquidity)
      await expect(
        migrator.migrate({
          pair: pair.address,
          liquidityToMigrate: expectedLiquidity,
          percentageToMigrate: 100,
          token0: tokenLower ? token.address : wnative.address,
          token1: tokenLower ? wnative.address : token.address,
          tickLower: getMinTick(60),
          tickUpper: getMaxTick(60),
          amount0Min: 4500,
          amount1Min: 8999,
          recipient: wallet.address,
          deadline: 1,
          refundAsNative: true,
        })
      )
        .to.emit(wnative, 'Withdrawal')
        .withArgs(migrator.address, tokenLower ? 1 : 4500)

      const tokenBalanceAfter = await token.balanceOf(wallet.address)

      const position = await nft.positions(1)
      expect(position.liquidity).to.be.eq(6363)

      const poolAddress = await factoryV3.poolByPair(token.address, wnative.address)
      if (tokenLower) {
        expect(await token.balanceOf(poolAddress)).to.be.eq(4500)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(4500)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(8999)
      } else {
        expect(await token.balanceOf(poolAddress)).to.be.eq(8999)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(1)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500)
      }
    })

    it('half the price - as Native', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        encodePriceSqrt(1, 2)
      )

      const tokenBalanceBefore = await token.balanceOf(wallet.address)

      await pair.approve(migrator.address, expectedLiquidity)
      await expect(
        migrator.migrate({
          pair: pair.address,
          liquidityToMigrate: expectedLiquidity,
          percentageToMigrate: 100,
          token0: tokenLower ? token.address : wnative.address,
          token1: tokenLower ? wnative.address : token.address,
          tickLower: getMinTick(60),
          tickUpper: getMaxTick(60),
          amount0Min: 8999,
          amount1Min: 4500,
          recipient: wallet.address,
          deadline: 1,
          refundAsNative: true,
        })
      )
        .to.emit(wnative, 'Withdrawal')
        .withArgs(migrator.address, tokenLower ? 4500 : 1)

      const tokenBalanceAfter = await token.balanceOf(wallet.address)

      const position = await nft.positions(1)
      expect(position.liquidity).to.be.eq(6363)

      const poolAddress = await factoryV3.poolByPair(token.address, wnative.address)
      if (tokenLower) {
        expect(await token.balanceOf(poolAddress)).to.be.eq(8999)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(1)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500)
      } else {
        expect(await token.balanceOf(poolAddress)).to.be.eq(4500)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(4500)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(8999)
      }
    })

    it('gas [ @skip-on-coverage ]', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        encodePriceSqrt(1, 1)
      )

      await pair.approve(migrator.address, expectedLiquidity)
      await snapshotGasCost(
        migrator.migrate({
          pair: pair.address,
          liquidityToMigrate: expectedLiquidity,
          percentageToMigrate: 100,
          token0: tokenLower ? token.address : wnative.address,
          token1: tokenLower ? wnative.address : token.address,
          tickLower: getMinTick(60),
          tickUpper: getMaxTick(60),
          amount0Min: 9000,
          amount1Min: 9000,
          recipient: wallet.address,
          deadline: 1,
          refundAsNative: false,
        })
      )
    })
  })
})
