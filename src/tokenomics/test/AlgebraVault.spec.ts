import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { constants } from 'ethers'
import { AlgebraVault } from '../typechain'
import { IAlgebraPool } from "algebra/typechain";
import { TestERC20 } from '../typechain'
import { ethers } from 'hardhat'
import {
	BigNumber,
	blockTimestamp,
	BN,
	getMaxTick,
	getMinTick,
	algebraFixture,
  AlgebraFixtureType,
  MaxUint256, 
  encodePath,
  poolFactory
} from './shared'
import { expect } from 'chai'



describe('AlgebraVault', function() {
  let wallets: any;
  before(async () => {
    wallets = await ethers.getSigners();
  })

  describe('main', async () => {
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
      await ALGBPool.connect(wallets[0]).setCommunityFee(250,250)

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
      await vault.connect(wallets[2]).swapToALGB(
        tokens[1].address,
        encodePath([tokens[1].address, ALGB.address]),
        0,
        '0'
      )
      expect(await ALGB.balanceOf(vault.address)).to.be.gt(BN(0))
      expect(await tokens[1].balanceOf(vault.address)).to.be.lte(BN(1))

      const ALGBBalance = await ALGB.balanceOf(vault.address)
      await vault.connect(wallets[2]).transferALGB(1000000)
      expect(await ALGB.balanceOf(stakingAddress)).to.be.eq(ALGBBalance)
    })

    it('transfer percentage works', async()=>{
      await vault.setRelayer(wallets[2].address)
      await vault.connect(wallets[2]).swapToALGB(
        tokens[1].address,
        encodePath([tokens[1].address, ALGB.address]),
        0,
        '0'
      )
      expect(await ALGB.balanceOf(vault.address)).to.be.gt(BN(0))
      expect(await tokens[1].balanceOf(vault.address)).to.be.lte(BN(1))

      const ALGBBalance = await ALGB.balanceOf(vault.address)
      await vault.connect(wallets[2]).transferALGB(800000)
      const stakingBalanceFirst = await ALGB.balanceOf(stakingAddress)
      expect(stakingBalanceFirst).to.be.eq((Number(ALGBBalance) * 0.8).toFixed(0))
      expect(await vault.accumulatedALGB()).to.be.eq((Number(ALGBBalance) * 0.2).toFixed(0))

      const amount = BigNumber.from('1000')
      await ALGB.transfer(vault.address, amount)
      await vault.connect(wallets[2]).transferALGB(800000)
      expect(await ALGB.balanceOf(stakingAddress)).to.be.eq(+stakingBalanceFirst + +(Number(amount) * 0.8)
        .toFixed(0))
    })

    it('possible to change staking address', async()=>{
      await vault.setRelayer(wallets[2].address)
      await vault.connect(wallets[2]).swapToALGB(
        tokens[1].address,
        encodePath([tokens[1].address, ALGB.address]),
        0,
        '0'
      )
      expect(await ALGB.balanceOf(vault.address)).to.be.gt(BN(0))
      expect(await tokens[1].balanceOf(vault.address)).to.be.lte(BN(1))

      await vault.setStakingAddress(wallets[2].address)

      const ALGBBalance = await ALGB.balanceOf(vault.address)
      await vault.connect(wallets[2]).transferALGB(1000000)
      expect(await ALGB.balanceOf(wallets[2].address)).to.be.eq(ALGBBalance)
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
      await vault.connect(wallets[2]).transferALGB(1000000)
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
        await vault.connect(wallets[2]).swapToALGB(
          tokens[1].address,
          encodePath([tokens[1].address, ALGB.address]),
          0,
          '228'
        )
        expect(await ALGB.balanceOf(vault.address)).to.be.gt(BN(0))
        expect(await tokens[1].balanceOf(vault.address)).to.be.lte(BN(1))

        const ALGBBalance = await ALGB.balanceOf(vault.address)
        await vault.connect(wallets[2]).transferALGB(1000000)
        expect(await ALGB.balanceOf(stakingAddress)).to.be.eq(ALGBBalance)
      })
    })

  })
})