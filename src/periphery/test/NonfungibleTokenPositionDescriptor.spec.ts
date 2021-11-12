import { constants, Wallet } from 'ethers'
import { waffle, ethers } from 'hardhat'
import { expect } from './shared/expect'
import { Fixture } from 'ethereum-waffle'
import { NonfungibleTokenPositionDescriptor, MockTimeNonfungiblePositionManager, TestERC20 } from '../typechain'
import completeFixture from './shared/completeFixture'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { getMaxTick, getMinTick } from './shared/ticks'
import { sortedTokens } from './shared/tokenSort'
import { extractJSONFromURI } from './shared/extractJSONFromURI'

const DAI = '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const USDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
const WETH = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
const WBTC = '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6'

describe('NonfungibleTokenPositionDescriptor', () => {
  let wallets: Wallet[]

  const nftPositionDescriptorCompleteFixture: Fixture<{
    nftPositionDescriptor: NonfungibleTokenPositionDescriptor
    tokens: [TestERC20, TestERC20, TestERC20]
    nft: MockTimeNonfungiblePositionManager
  }> = async (wallets, provider) => {
    const { factory, nft, router, nftDescriptor } = await completeFixture(wallets, provider)
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    const tokens: [TestERC20, TestERC20, TestERC20] = [
      (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20, // do not use maxu256 to avoid overflowing
      (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
      (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
    ]
    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    return {
      nftPositionDescriptor: nftDescriptor,
      tokens,
      nft,
    }
  }

  let nftPositionDescriptor: NonfungibleTokenPositionDescriptor
  let tokens: [TestERC20, TestERC20, TestERC20]
  let nft: MockTimeNonfungiblePositionManager
  let wnative: TestERC20

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    wallets = await (ethers as any).getSigners()

    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ tokens, nft, nftPositionDescriptor } = await loadFixture(nftPositionDescriptorCompleteFixture))
    const tokenFactory = await ethers.getContractFactory('TestERC20')
    wnative = tokenFactory.attach(await nftPositionDescriptor.WNativeToken()) as TestERC20
  })

  describe('#tokenRatioPriority', () => {
    it('returns -100 for WNativeToken', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(wnative.address, 1)).to.eq(-100)
    })

    it('returns 200 for USDC', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(USDC, 1)).to.eq(300)
    })

    it('returns 100 for DAI', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(DAI, 1)).to.eq(100)
    })

    it('returns  150 for USDT', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(USDT, 1)).to.eq(200)
    })

    it('returns -200 for WETH', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(WETH, 1)).to.eq(-200)
    })

    it('returns -250 for WBTC', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(WBTC, 1)).to.eq(-300)
    })

    it('returns 0 for any non-ratioPriority token', async () => {
      expect(await nftPositionDescriptor.tokenRatioPriority(tokens[0].address, 1)).to.eq(0)
    })
  })

  describe('#flipRatio', () => {
    it('returns false if neither token has priority ordering', async () => {
      expect(await nftPositionDescriptor.flipRatio(tokens[0].address, tokens[2].address, 1)).to.eq(false)
    })

    it('returns true if both tokens are numerators but token0 has a higher priority ordering', async () => {
      expect(await nftPositionDescriptor.flipRatio(USDC, DAI, 1)).to.eq(true)
    })

    it('returns true if both tokens are denominators but token1 has lower priority ordering', async () => {
      expect(await nftPositionDescriptor.flipRatio(wnative.address, WBTC, 1)).to.eq(true)
    })

    it('returns true if token0 is a numerator and token1 is a denominator', async () => {
      expect(await nftPositionDescriptor.flipRatio(DAI, WBTC, 1)).to.eq(true)
    })

    it('returns false if token1 is a numerator and token0 is a denominator', async () => {
      expect(await nftPositionDescriptor.flipRatio(WBTC, DAI, 1)).to.eq(false)
    })
  })

  describe('#tokenURI', () => {
    it('displays Native as token symbol for WNativeToken token', async () => {
      const [token0, token1] = sortedTokens(wnative, tokens[1])
      await nft.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        encodePriceSqrt(1, 1)
      )
      await wnative.approve(nft.address, 100)
      await tokens[1].approve(nft.address, 100)
      await nft.mint({
        token0: token0.address,
        token1: token1.address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })

      const metadata = extractJSONFromURI(await nft.tokenURI(1))
      expect(metadata.name).to.match(/(\sETH\/TEST|TEST\/ETH)/)
      expect(metadata.description).to.match(/(TEST-ETH|\sETH-TEST)/)
      expect(metadata.description).to.match(/(\nETH\sAddress)/)
    })

    it('displays returned token symbols when neither token is WNativeToken ', async () => {
      const [token0, token1] = sortedTokens(tokens[2], tokens[1])
      await nft.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        encodePriceSqrt(1, 1)
      )
      await tokens[1].approve(nft.address, 100)
      await tokens[2].approve(nft.address, 100)
      await nft.mint({
        token0: token0.address,
        token1: token1.address,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })

      const metadata = extractJSONFromURI(await nft.tokenURI(1))
      expect(metadata.name).to.match(/TEST\/TEST/)
      expect(metadata.description).to.match(/TEST-TEST/)
    })
  })
})
