import { ethers } from 'hardhat'
import { BigNumber, Wallet } from 'ethers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { algebraFixture, mintPosition, AlgebraFixtureType } from '../shared/fixtures'
import {
  expect,
  getMaxTick,
  getMinTick,
  FeeAmount,
  TICK_SPACINGS,
  blockTimestamp,
  BNe18,
  ActorFixture,
  makeTimestamps,
  ZERO_ADDRESS,
} from '../shared'
import { provider } from '../shared/provider'
import { HelperCommands, ERC20Helper} from '../helpers'
import { ContractParams } from '../../types/contractParams'
import { HelperTypes } from '../helpers/types'

const LIMIT_FARMING = true;
const ETERNAL_FARMING = false;

describe('unit/FarmingCenterVault', () => {
  let actors: ActorFixture;
  let lpUser0: Wallet
  let incentiveCreator: Wallet
  const amountDesired = BNe18(10)
  const amountLocked = BigNumber.from(1000)
  const totalReward = BNe18(100)
  const bonusReward = BNe18(100)
  const erc20Helper = new ERC20Helper()
  let helpers: HelperCommands
  let context: AlgebraFixtureType
  let timestamps: ContractParams.Timestamps
  let eternalTimestamps: ContractParams.Timestamps
  let tokenId: string

  before(async () => {
    const wallets = (await ethers.getSigners() as any) as Wallet[];
    actors = new ActorFixture(wallets, provider)
    lpUser0 = actors.lpUser0();
    incentiveCreator = actors.incentiveCreator();
  })

  beforeEach('create fixture loader', async () => {
    context = await loadFixture(algebraFixture)
    helpers = HelperCommands.fromTestContext(context, actors, provider)
  })

  describe('#enter/exit farming', () => {
    
    let incentiveId: string
    let eternalFarmingId: string
    let incentiveArgs: HelperTypes.CreateIncentive.Args
    let eternalFarmingArgs: HelperTypes.CreateIncentive.Args

    beforeEach(async () => {
      
      /** We will be doing a lot of time-testing here, so leave some room between
        and when the incentive starts */
      timestamps = makeTimestamps(1_000 + (await blockTimestamp()))
      eternalTimestamps = makeTimestamps(1_001 + (await blockTimestamp()))

      await erc20Helper.ensureBalancesAndApprovals(
        lpUser0,
        [context.token0, context.token1],
        amountDesired,
        context.nft.address
      )

      tokenId = await mintPosition(context.nft.connect(lpUser0), {
        token0: context.token0.address,
        token1: context.token1.address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      })

      await context.nft
        .connect(lpUser0)
        ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farmingCenter.address, tokenId)

      incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.poolObj.address,
        ...timestamps,
      }

      eternalFarmingArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.poolObj.address,
        ...eternalTimestamps,
        eternal: true,
        rewardRate: BigNumber.from('10'),
        bonusRewardRate: BigNumber.from('50')
      }

      await erc20Helper.ensureBalancesAndApprovals(
        lpUser0,
        context.rewardToken,
        amountDesired.mul(BigNumber.from(2)),
        context.nft.address
      )

      incentiveId = await helpers.getIncentiveId(await helpers.createIncentiveWithMultiplierFlow(incentiveArgs))

      eternalFarmingId = await helpers.getIncentiveId(await helpers.createIncentiveWithMultiplierFlow(eternalFarmingArgs))


    })

    describe('fails if', () => {

      it('you are trying to call lockTokens', async () => {
        
        await expect(context.farmingCenterVault.connect(lpUser0).lockTokens(tokenId, incentiveId, 0)).to.revertedWith(
          'onlyFarming'
        )
      })

      it('you are trying to call setFarmingAddress from notOwner', async () => {
        
        await expect(context.farmingCenterVault.connect(lpUser0).setFarmingCenter(ZERO_ADDRESS)).to.revertedWith(
          'onlyOwner'
        )
      })

      it('you are trying to call setFarmingAddress after intialize', async () => {
        
        await expect(context.farmingCenterVault.connect(actors.farmingDeployer()).setFarmingCenter(ZERO_ADDRESS)).to.revertedWith(
          'Already initialized'
        )
      })

      it('you are trying to call claimTokens', async () => {
        
        await expect(context.farmingCenterVault.connect(lpUser0).claimTokens(ZERO_ADDRESS,lpUser0.address,tokenId, incentiveId)).to.revertedWith(
          'onlyFarming'
        )
      })
      
    })

    describe('limit farming', () => {

      let vaultBalanceBeforeEnter: BigNumber

      beforeEach('enter limit farming', async () => {

        vaultBalanceBeforeEnter = await context.rewardToken.balanceOf(context.farmingCenterVault.address)

        await erc20Helper.ensureBalancesAndApprovals(
            lpUser0,
            context.rewardToken,
            amountLocked,
            context.farmingCenter.address
          )
        
        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...timestamps,
          },
          tokenId,
          amountLocked,
          LIMIT_FARMING
        )

      })

      it('locked tokens were sent to vault', async () => {
        let vaultBalanceAfterEnter = await context.rewardToken.balanceOf(context.farmingCenterVault.address)
        expect(vaultBalanceAfterEnter.sub(vaultBalanceBeforeEnter)).to.eq(amountLocked)
      })

      it('locked tokens were returned to user', async () => {
        let vaultBalanceBeforeExit = await context.rewardToken.balanceOf(context.farmingCenterVault.address)
        let userBalanceBeforeExit = await context.rewardToken.balanceOf(lpUser0.address)

        await context.farmingCenter.connect(lpUser0).exitFarming(
          {
            
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...timestamps,
          },
          tokenId,
          LIMIT_FARMING
        )

        let vaultBalanceAfterExit = await context.rewardToken.balanceOf(context.farmingCenterVault.address)
        let userBalanceAfterExit = await context.rewardToken.balanceOf(lpUser0.address)

        expect(vaultBalanceBeforeExit.sub(vaultBalanceAfterExit)).to.eq(amountLocked)
        expect(userBalanceAfterExit.sub(userBalanceBeforeExit)).to.eq(amountLocked)

      })

      it('is balances correct returns value after enter', async () => {
        let balance = await context.farmingCenterVault.balances(tokenId, incentiveId)

        expect(balance).to.eq(amountLocked)
      })

      it('is balances correct returns value after exit', async () => {
        
        await context.farmingCenter.connect(lpUser0).exitFarming(
          {
            
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...timestamps,
          },
          tokenId,
          LIMIT_FARMING
        )

        let balance = await context.farmingCenterVault.balances(tokenId, incentiveId)

        expect(balance).to.eq(BigNumber.from(0))
      })

    })

    describe('eternal farming', () => {

        let vaultBalanceBeforeEnter: BigNumber

        beforeEach('enter eternal farming', async () => {
  
          vaultBalanceBeforeEnter = await context.rewardToken.balanceOf(context.farmingCenterVault.address)
  
          await erc20Helper.ensureBalancesAndApprovals(
              lpUser0,
              context.rewardToken,
              amountLocked,
              context.farmingCenter.address
            )
  

          await context.farmingCenter.connect(lpUser0).enterFarming(
            {
              
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...eternalTimestamps,
            },
            tokenId,
            amountLocked,
            ETERNAL_FARMING
          )
  
        })
  
        it('locked tokens were sent to vault', async () => {
          let vaultBalanceAfterEnter = await context.rewardToken.balanceOf(context.farmingCenterVault.address) 
          expect(vaultBalanceAfterEnter.sub(vaultBalanceBeforeEnter)).to.eq(amountLocked)
        })
  
        it('locked tokens were returned to user', async () => {
          let vaultBalanceBeforeExit = await context.rewardToken.balanceOf(context.farmingCenterVault.address)
          let userBalanceBeforeExit = await context.rewardToken.balanceOf(lpUser0.address)
  
          await context.farmingCenter.connect(lpUser0).exitFarming(
            {
              
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...eternalTimestamps,
            },
            tokenId,
            ETERNAL_FARMING
          )
  
          let vaultBalanceAfterExit = await context.rewardToken.balanceOf(context.farmingCenterVault.address)
          let userBalanceAfterExit = await context.rewardToken.balanceOf(lpUser0.address)
  
          expect(vaultBalanceBeforeExit.sub(vaultBalanceAfterExit)).to.eq(amountLocked)
          expect(userBalanceAfterExit.sub(userBalanceBeforeExit)).to.eq(amountLocked)
  
        })
  
        it('is balances correct returns value after enter', async () => {
          let balance = await context.farmingCenterVault.balances(tokenId, eternalFarmingId)
  
          expect(balance).to.eq(amountLocked)
        })
  
        it('is balances correct returns value after exit', async () => {

          await context.farmingCenter.connect(lpUser0).exitFarming(
              {
                
                pool: context.pool01,
                rewardToken: context.rewardToken.address,
                bonusRewardToken: context.bonusRewardToken.address,
                ...eternalTimestamps,
              },
              tokenId,
              ETERNAL_FARMING
            )

          let balance = await context.farmingCenterVault.balances(tokenId, eternalFarmingId)
  
          expect(balance).to.eq(BigNumber.from(0))
        })
  })

  describe('limit and eternal at the same time', async () => {
    
    let vaultBalanceBeforeEnter: BigNumber

      beforeEach('enter limit farming', async () => {

        vaultBalanceBeforeEnter = await context.rewardToken.balanceOf(context.farmingCenterVault.address)

        await erc20Helper.ensureBalancesAndApprovals(
            lpUser0,
            context.rewardToken,
            amountLocked.mul(BigNumber.from(2)),
            context.farmingCenter.address
          )

        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...timestamps,
          },
          tokenId,
          amountLocked,
          LIMIT_FARMING
        )

        await context.farmingCenter.connect(lpUser0).enterFarming(
            {
              
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...eternalTimestamps,
            },
            tokenId,
            amountLocked,
            ETERNAL_FARMING
          )

      })

      it('locked tokens were sent to vault', async () => {
        let vaultBalanceAfterEnter = await context.rewardToken.balanceOf(context.farmingCenterVault.address) 
        expect(vaultBalanceAfterEnter.sub(vaultBalanceBeforeEnter)).to.eq(amountLocked.mul(BigNumber.from(2)))
      })

      it('locked tokens were returned to user', async () => {
        let vaultBalanceBeforeExit = await context.rewardToken.balanceOf(context.farmingCenterVault.address)
        let userBalanceBeforeExit = await context.rewardToken.balanceOf(lpUser0.address)

        await context.farmingCenter.connect(lpUser0).exitFarming(
          {
            
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...timestamps,
          },
          tokenId,
          LIMIT_FARMING
        )



        await context.farmingCenter.connect(lpUser0).exitFarming(
          {
            
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...eternalTimestamps,
          },
          tokenId,
          ETERNAL_FARMING
        )

        let vaultBalanceAfterExit = await context.rewardToken.balanceOf(context.farmingCenterVault.address)
        let userBalanceAfterExit = await context.rewardToken.balanceOf(lpUser0.address)
        
        expect(vaultBalanceBeforeExit.sub(vaultBalanceAfterExit)).to.eq(amountLocked.mul(BigNumber.from(2)))
        expect(userBalanceAfterExit.sub(userBalanceBeforeExit)).to.eq(amountLocked.mul(BigNumber.from(2)))

      })

      it('is balances correct returns value after enter', async () => {
        let limitBalance = await context.farmingCenterVault.balances(tokenId, incentiveId)
        let eternalBalance = await context.farmingCenterVault.balances(tokenId, incentiveId)
        expect(limitBalance).to.eq(amountLocked)
        expect(eternalBalance).to.eq(amountLocked)
      })

      it('is balances correct returns value after exit', async () => {


        await context.farmingCenter.connect(lpUser0).exitFarming(
          {
            
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...timestamps,
          },
          tokenId,
          LIMIT_FARMING
        )



        await context.farmingCenter.connect(lpUser0).exitFarming(
          {
            
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...eternalTimestamps,
          },
          tokenId,
          ETERNAL_FARMING
        )

        let balance = await context.farmingCenterVault.balances(tokenId, incentiveId)

        expect(balance).to.eq(BigNumber.from(0))
      })
  })


  })
})
