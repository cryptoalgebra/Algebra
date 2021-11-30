import { constants } from 'ethers'
import { TestContext, LoadFixtureFunction } from './types'
import { AlgebraVault } from '../typechain'
import { IAlgebraPool } from "algebra/typechain";
import { TestERC20 } from 'algebra/typechain'
import { ethers } from 'hardhat'
import {
	BigNumber,
	blockTimestamp,
	BN,
	BNe18,
	expect,
	FeeAmount,
	getMaxTick,
	getMinTick,
	TICK_SPACINGS,
	algebraFixture,
  AlgebraFixtureType,
	log,
	days,
	ratioE18,
	bnSum,
	getCurrentTick,
	BNe,
	mintPosition, MaxUint256, maxGas, encodePath,
  poolFactory
} from './shared'
import { createTimeMachine } from './shared/time'
import { ERC20Helper, HelperCommands, incentiveResultToFarmAdapter } from './helpers'
import { createFixtureLoader, provider } from './shared/provider'
import { ActorFixture } from './shared/actors'
import { Fixture } from 'ethereum-waffle'
import { HelperTypes } from './helpers/types'
import { Wallet } from '@ethersproject/wallet'

import './matchers/beWithin'
import {round} from "lodash";

let loadFixture: LoadFixtureFunction

describe('AlgebraVault', async ()=> {
  const wallets = provider.getWallets()

  before('create fixture loader', async () => {
    loadFixture = createFixtureLoader(wallets, provider)
  })

  describe('there are three LPs in the same range', async () => {
    let context: AlgebraFixtureType
    let ALGB: TestERC20
    let tokens: [TestERC20, TestERC20, TestERC20, TestERC20]
    let ALGBPool : IAlgebraPool
    let vault: AlgebraVault
    const stakingAddress = '0x000000000000000000000000000000000000dEaD'

    beforeEach('load fixture', async () => {
      context = await loadFixture(algebraFixture)
      ALGB = context.tokens[2]
      tokens = context.tokens

      const vaultFactory = await ethers.getContractFactory('AlgebraVault')
      vault = await vaultFactory.deploy(
        ALGB.address,
        stakingAddress,
        context.router.address
      ) as AlgebraVault

      await context.nft.connect(wallets[0]).mint(
        {
          token0: tokens[1].address,
          token1: ALGB.address,
          tickLower:getMinTick(60),
          tickUpper:getMaxTick(60),
          amount0Desired: '1000000000000000',
          amount1Desired: '1000000000000000',
          amount0Min: '0',
          amount1Min: '0',
          recipient: wallets[0].address,
          deadline: (await blockTimestamp()) + 1000
        },
        {gasLimit:'9000000'}

      )

      await context.factory.setVaultAddress(vault.address)

      ALGBPool = poolFactory.attach(context.pool12) as IAlgebraPool
      await ALGBPool.connect(wallets[0]).setCommunityFee(25,25)

      await ALGB.connect(wallets[0]).approve(context.router.address, constants.MaxUint256)
      await tokens[1].connect(wallets[0]).approve(context.router.address, constants.MaxUint256)

      expect(await ALGB.balanceOf(vault.address)).to.be.eq(BN(0))

      await context.router.connect(wallets[0]).exactInputSingle(
        {
          tokenIn:ALGB.address,
          tokenOut:tokens[1].address,
          recipient: wallets[1].address,
          deadline: MaxUint256,
          amountIn: '100000000',
          amountOutMinimum: 0,
          limitSqrtPrice: 0
        },
        {gasLimit: '7000000'}
      )

      await context.router.connect(wallets[0]).exactInputSingle(
        {
          tokenIn:tokens[1].address,
          tokenOut:ALGB.address,
          recipient: wallets[1].address,
          deadline: MaxUint256,
          amountIn: '100000000',
          amountOutMinimum: 0,
          limitSqrtPrice: 0
        },
        {gasLimit: '7000000'}
      )
      expect(await ALGB.balanceOf(stakingAddress)).to.be.eq(BN(0))
    })

    it('community fee is transferred', async()=>{
      expect(await ALGB.balanceOf(vault.address)).to.be.gt(BN(0))
      expect(await tokens[1].balanceOf(vault.address)).to.be.gt(BN(0))
    })

    it('possible to swap to ALGB', async () =>{
      await vault.setRelayer(wallets[2].address)
      console.log(await tokens[1].balanceOf(vault.address))
      await vault.connect(wallets[2]).swapToALGB(
        tokens[1].address,
        encodePath([tokens[1].address, ALGB.address]),
        0,
        '0'
      )
      expect(await ALGB.balanceOf(stakingAddress)).to.be.gt(BN(0))
      expect(await tokens[1].balanceOf(vault.address)).to.be.eq(BN(0))
    })

    it('cannot be called by not a relayer', async ()=>{
      await expect(vault.connect(wallets[2]).swapToALGB(
        tokens[1].address,
        encodePath([tokens[1].address, ALGB.address]),
        0,
        '0'
      )).to.be.revertedWith('only relayer or owner can call this')
    })

    it('can transfer ALGB directly', async()=>{
      await vault.setRelayer(wallets[2].address)
      const ALGBBalance = await ALGB.balanceOf(vault.address)
      await vault.connect(wallets[2]).transferALGB()
      expect(await ALGB.balanceOf(stakingAddress)).to.be.eq(ALGBBalance)
    })

    describe('Fee on transfer tokens', ()=>{
      beforeEach('turn on fee', async ()=>{
        await tokens[1].setDefl()
      })
      it('wont work with fee on transfer without flag', async ()=>{
        await expect(vault.swapToALGB(
          tokens[1].address,
          encodePath([tokens[1].address, ALGB.address]),
          0,
          '0'
        )).to.be.revertedWith('IIA')
      })

      it('should work with fee on trasfer', async ()=>{
        await vault.setRelayer(wallets[2].address)
        expect(vault.connect(wallets[2]).swapToALGB(
          tokens[1].address,
          encodePath([tokens[1].address, ALGB.address]),
          0,
          '228'
        ))
        expect(await ALGB.balanceOf(stakingAddress)).to.be.gt(BN(0))
      })
    })

  })
})