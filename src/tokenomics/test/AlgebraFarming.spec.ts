import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { TestContext } from './types'
import { AlgebraEternalFarming, TestERC20 } from '../typechain'
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
	log,
	days,
	ratioE18,
	bnSum,
	getCurrentTick,
	BNe,
	mintPosition, MaxUint256, maxGas, encodePath,
} from './shared'
import { createTimeMachine } from './shared/time'
import { ERC20Helper, HelperCommands, incentiveResultToFarmAdapter } from './helpers'
import { provider } from './shared/provider'
import { ActorFixture } from './shared/actors'
import { HelperTypes } from './helpers/types'
import { Wallet } from 'ethers'

import './matchers/beWithin';
const LIMIT_FARMING = true;
const ETERNAL_FARMING = false;

describe('AlgebraFarming', () => {
    let wallets: Wallet[];
    const Time = createTimeMachine(provider)
    let actors: ActorFixture;
    const e20h = new ERC20Helper()

	before(async () => {
		wallets = await (ethers.getSigners() as any) as Wallet[];
		actors = new ActorFixture(wallets, provider)
	})
	describe('minimal position width', async () => {
		type TestSubject = {
			createIncentiveResult: HelperTypes.CreateIncentive.Result
			helpers: HelperCommands
			context: TestContext
		}
		let subject: TestSubject

		const ticksToFarm: [number, number] = [
			getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
			getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
		]
		const amountsToFarm: [BigNumber, BigNumber] = [BigNumber.from(100000), BNe18(10)]


		const totalReward = BNe18(2_000_000)
		const bonusReward = BNe18(4_000)
		const duration = days(40)

		const scenario: () => Promise<TestSubject> = async () => {
			const context = await algebraFixture()
			const wallets = (await ethers.getSigners() as any) as Wallet[];
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider)

			const epoch = await blockTimestamp()
			const startTime = epoch + 100
			const endTime = startTime + duration

			const createIncentiveResult = await helpers.createIncentiveFlow({
				startTime,
				endTime,
				rewardToken: context.rewardToken,
				bonusRewardToken: context.bonusRewardToken,
				minimalPositionWidth: 10000,
				poolAddress: context.pool01,
				totalReward,
				bonusReward
			})
			return {
				context,
				helpers,
				createIncentiveResult
			}
		}

		beforeEach('load Fixture', async () =>{
			subject = await loadFixture(scenario);
		})

		it('cannot enter with too narrow position', async () => {
			const {context, helpers, createIncentiveResult} = subject;

			const lpUser3 = actors.traderUser2()

			// The non-staking user will deposit 25x the liquidity as the others
			const balanceDeposited = amountsToFarm[0]

			// Someone starts staking
			await e20h.ensureBalancesAndApprovals(
				lpUser3,
				[context.token0, context.token1],
				balanceDeposited,
				context.nft.address
			)

			const tokenId = await mintPosition(context.nft.connect(lpUser3), {
				token0: context.token0.address,
				token1: context.token1.address,
				fee: FeeAmount.MEDIUM,
				tickLower: ticksToFarm[0],
				tickUpper: ticksToFarm[0] + TICK_SPACINGS[FeeAmount.MEDIUM],
				recipient: lpUser3.address,
				amount0Desired: 0,
				amount1Desired: balanceDeposited,
				amount0Min: 0,
				amount1Min: 0,
				deadline: (await blockTimestamp()) + 10000,
			})

			await context.nft.connect(lpUser3).approve(context.farmingCenter.address, tokenId);
			await context.nft
			.connect(lpUser3)
				['safeTransferFrom(address,address,uint256)'](lpUser3.address, context.farmingCenter.address, tokenId);
			

			await expect(context.farmingCenter
			.connect(lpUser3)
			.enterFarming(incentiveResultToFarmAdapter(createIncentiveResult), tokenId, 0, LIMIT_FARMING)).to.be.revertedWith('position too narrow')
		})

		it('too wide range cannot be used as minimal allowed', async () => {
			const {context, helpers} = subject;

			const lpUser3 = actors.traderUser2()

			// The non-staking user will deposit 25x the liquidity as the others
			const balanceDeposited = amountsToFarm[0]

			// Someone starts staking
			await e20h.ensureBalancesAndApprovals(
				lpUser3,
				[context.token0, context.token1],
				balanceDeposited,
				context.nft.address
			)

			const tokenId = await mintPosition(context.nft.connect(lpUser3), {
				token0: context.token0.address,
				token1: context.token1.address,
				fee: FeeAmount.MEDIUM,
				tickLower: ticksToFarm[0],
				tickUpper: ticksToFarm[0] + TICK_SPACINGS[FeeAmount.MEDIUM],
				recipient: lpUser3.address,
				amount0Desired: 0,
				amount1Desired: balanceDeposited,
				amount0Min: 0,
				amount1Min: 0,
				deadline: (await blockTimestamp()) + 10000,
			})

			await context.nft.connect(lpUser3).approve(context.farmingCenter.address, tokenId);
			await context.nft
			.connect(lpUser3)
				['safeTransferFrom(address,address,uint256)'](lpUser3.address, context.farmingCenter.address, tokenId);
			
			const epoch = await blockTimestamp()
			const startTime = epoch + 100
			const endTime = startTime + duration

			let incentiveCreator = actors.incentiveCreator();

			await context.rewardToken.transfer(incentiveCreator.address, totalReward)
			await context.bonusRewardToken.transfer(incentiveCreator.address, bonusReward)
			await context.rewardToken.connect(incentiveCreator).approve(context.eternalFarming.address, totalReward)
      		await context.bonusRewardToken.connect(incentiveCreator).approve(context.eternalFarming.address, bonusReward)

			await expect((context.eternalFarming as AlgebraEternalFarming).connect(incentiveCreator).createEternalFarming(
				{
				  pool: context.pool01,
				  rewardToken: context.rewardToken.address,
				  bonusRewardToken: context.bonusRewardToken.address,
				  startTime,
				  endTime
				  
				},
				{ 
				  reward: totalReward,
				  bonusReward: bonusReward,
				  rewardRate:  10,
				  bonusRewardRate:  10,
				  minimalPositionWidth: (2**23 - 1) + (2**23 - 1),
				  multiplierToken: context.rewardToken.address
				},
				{
				  tokenAmountForTier1: 0,
				  tokenAmountForTier2: 0,
				  tokenAmountForTier3: 0,
				  tier1Multiplier: 10000,
				  tier2Multiplier: 10000,
				  tier3Multiplier: 10000,
				},
				
			  )).to.be.revertedWith('minimalPositionWidth too wide');

			  await expect((context.eternalFarming as AlgebraEternalFarming).connect(incentiveCreator).createEternalFarming(
				{
				  pool: context.pool01,
				  rewardToken: context.rewardToken.address,
				  bonusRewardToken: context.bonusRewardToken.address,
				  startTime,
				  endTime
				  
				},
				{ 
				  reward: totalReward,
				  bonusReward: bonusReward,
				  rewardRate:  10,
				  bonusRewardRate:  10,
				  minimalPositionWidth: (887272 - 887272 % 60) * 2,
				  multiplierToken: context.rewardToken.address
				},
				{
				  tokenAmountForTier1: 0,
				  tokenAmountForTier2: 0,
				  tokenAmountForTier3: 0,
				  tier1Multiplier: 10000,
				  tier2Multiplier: 10000,
				  tier3Multiplier: 10000,
				},
				
			  )).to.be.not.reverted;

		})

		it('max range can be used as minimal allowed', async () => {
			const {context, helpers} = subject;

			const lpUser3 = actors.traderUser2()

			// The non-staking user will deposit 25x the liquidity as the others
			const balanceDeposited = amountsToFarm[0]

			// Someone starts staking
			await e20h.ensureBalancesAndApprovals(
				lpUser3,
				[context.token0, context.token1],
				balanceDeposited.mul(2),
				context.nft.address
			)

			const tokenId = await mintPosition(context.nft.connect(lpUser3), {
				token0: context.token0.address,
				token1: context.token1.address,
				fee: FeeAmount.MEDIUM,
				tickLower: ticksToFarm[0],
				tickUpper: ticksToFarm[0] + TICK_SPACINGS[FeeAmount.MEDIUM],
				recipient: lpUser3.address,
				amount0Desired: 0,
				amount1Desired: balanceDeposited,
				amount0Min: 0,
				amount1Min: 0,
				deadline: (await blockTimestamp()) + 10000,
			})

			const tokenIdCorrect = await mintPosition(context.nft.connect(lpUser3), {
				token0: context.token0.address,
				token1: context.token1.address,
				fee: FeeAmount.MEDIUM,
				tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
				tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
				recipient: lpUser3.address,
				amount0Desired: balanceDeposited,
				amount1Desired: balanceDeposited,
				amount0Min: 0,
				amount1Min: 0,
				deadline: (await blockTimestamp()) + 10000,
			})

			await context.nft.connect(lpUser3).approve(context.farmingCenter.address, tokenId);
			await context.nft.connect(lpUser3).approve(context.farmingCenter.address, tokenIdCorrect);
			await context.nft
			.connect(lpUser3)
				['safeTransferFrom(address,address,uint256)'](lpUser3.address, context.farmingCenter.address, tokenId);
			await context.nft
			.connect(lpUser3)
				['safeTransferFrom(address,address,uint256)'](lpUser3.address, context.farmingCenter.address, tokenIdCorrect);
			
			const epoch = await blockTimestamp()
			const startTime = epoch + 100
			const endTime = startTime + duration
			const createIncentiveResult = await helpers.createIncentiveFlow({
				startTime,
				endTime,
				rewardToken: context.rewardToken,
				bonusRewardToken: context.bonusRewardToken,
				minimalPositionWidth: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]) - getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
				poolAddress: context.pool01,
				totalReward,
				bonusReward,
				eternal: true
			})

			await expect(context.farmingCenter
			.connect(lpUser3)
			.enterFarming(incentiveResultToFarmAdapter(createIncentiveResult), tokenId, 0, ETERNAL_FARMING)).to.be.revertedWith('position too narrow')

			await expect(context.farmingCenter
				.connect(lpUser3)
				.enterFarming(incentiveResultToFarmAdapter(createIncentiveResult), tokenIdCorrect, 0, ETERNAL_FARMING)).to.be.not.reverted;
		})

	})

	describe('there are three LPs in the same range', async () => {
		type TestSubject = {
			farms: Array<HelperTypes.MintDepositFarm.Result>
			createIncentiveResult: HelperTypes.CreateIncentive.Result
			helpers: HelperCommands
			context: TestContext
		}
		let subject: TestSubject

		const totalReward = BNe18(3_000)
		const bonusReward = BNe18(4_000)
		const duration = days(1)
		const ticksToFarm: [number, number] = [
			getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
			getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
		]
		const amountsToFarm: [BigNumber, BigNumber] = [BNe18(1), BNe18(1)]
		
		const scenario: () => Promise<TestSubject> = async () => {
	
			const context = await algebraFixture()
			
			const epoch = await blockTimestamp()

			const {
				tokens: [token0, token1, rewardToken, bonusRewardToken],
			} = context
			const helpers = HelperCommands.fromTestContext(context, actors, provider)

			const tokensToFarm: [TestERC20, TestERC20] = [token0, token1]

			const startTime = epoch + 1_000
			const endTime = startTime + duration
			
			const createIncentiveResult = await helpers.createIncentiveFlow({
				startTime,
				endTime,
				rewardToken,
				bonusRewardToken,
				poolAddress: context.pool01,
				totalReward,
				bonusReward
			})

			const params = {
				tokensToFarm,
				amountsToFarm,
				createIncentiveResult,
				ticks: ticksToFarm,
			}

			const farms = await Promise.all(
				actors.lpUsers().map((lp) =>
					helpers.mintDepositFarmFlow({
						...params,
						lp,
					})
				)
			)
			await time.setNextBlockTimestamp(startTime + 1)

			const trader = actors.traderUser0()
			await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: 10,
			})

			return {
				context,
				farms,
				helpers,
				createIncentiveResult,
			}
		}

		beforeEach('load fixture', async () => {

			subject = await loadFixture(scenario)

		})

		describe('who all farm the entire time ', () => {
			it('allows them all to withdraw at the end', async () => {

				const { helpers, createIncentiveResult } = subject

				await time.increaseTo(createIncentiveResult.endTime + 1)

				const trader = actors.traderUser0()
				await helpers.makeTickGoFlow({
					trader,
					direction: 'up',
					desiredValue: 20,
				})

				// Sanity check: make sure we go past the incentive end time.
				expect(await blockTimestamp(), 'test setup: must be run after start time').to.be.gte(
					createIncentiveResult.endTime
				)

				// Everyone pulls their liquidity at the same time
				const exitFarmings = await Promise.all(
					subject.farms.map(({ lp, tokenId }) =>
						helpers.exitFarmingCollectBurnFlow({
							lp,
							tokenId,
							createIncentiveResult,
						})
					)
				)

				const rewardsEarned = bnSum(exitFarmings.map((o) => o.balance))
				log.debug('Total rewards ', rewardsEarned.toString())

				// const { amountReturnedToCreator } = await helpers.endIncentiveFlow({
				// 	createIncentiveResult,
				// })
				expect(rewardsEarned).to.be.gte(totalReward.mul(BN(9999)).div(BN(10000)))
			})
		})

		describe('who all farm the entire time ', () => {
			it('allows them all to withdraw at the end', async () => {
				const { helpers, createIncentiveResult } = subject

				await time.increaseTo(createIncentiveResult.endTime + 1)

				const trader = actors.traderUser0()
				await helpers.makeTickGoFlow({
					trader,
					direction: 'up',
					desiredValue: 20,
				})
				
				// Sanity check: make sure we go past the incentive end time.
				expect(await blockTimestamp(), 'test setup: must be run after start time').to.be.gte(
					createIncentiveResult.endTime
				)

				// Everyone pulls their liquidity at the same time
				const exitFarmings = await Promise.all(
					subject.farms.map(({ lp, tokenId }) =>
						helpers.exitFarmingCollectBurnFlow({
							lp,
							tokenId,
							createIncentiveResult,
						})
					)
				)

				const rewardsEarned = bnSum(exitFarmings.map((o) => o.balance))
				log.debug('Total rewards ', rewardsEarned.toString())

				// const { amountReturnedToCreator } = await helpers.endIncentiveFlow({
				// 	createIncentiveResult,
				// })
				expect(rewardsEarned).to.be.gte(totalReward.mul(BN(9999)).div(BN(10000)))
			})
		})

		describe('when another LP adds liquidity but does not farm', () => {
			it('does not change the rewards', async () => {
				const { helpers, createIncentiveResult, context, farms } = subject

				// Go halfway through
				await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 2)

				const lpUser3 = actors.traderUser2()

				// The non-staking user will deposit 25x the liquidity as the others
				const balanceDeposited = amountsToFarm[0]

				// Someone starts staking
				await e20h.ensureBalancesAndApprovals(
					lpUser3,
					[context.token0, context.token1],
					balanceDeposited,
					context.nft.address
				)

				await mintPosition(context.nft.connect(lpUser3), {
					token0: context.token0.address,
					token1: context.token1.address,
					fee: FeeAmount.MEDIUM,
					tickLower: ticksToFarm[0],
					tickUpper: ticksToFarm[1],
					recipient: lpUser3.address,
					amount0Desired: balanceDeposited,
					amount1Desired: balanceDeposited,
					amount0Min: 0,
					amount1Min: 0,
					deadline: (await blockTimestamp()) + 1000,
				})

				await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)

				const trader = actors.traderUser0()
				await helpers.makeTickGoFlow({
					trader,
					direction: 'up',
					desiredValue: 20,
				})

				const exitFarmings = await Promise.all(
					farms.map(({ lp, tokenId }) =>
						helpers.exitFarmingCollectBurnFlow({
							lp,
							tokenId,
							createIncentiveResult,
						})
					)
				)

				/***
				 * The reward distributed to LPs should be:
				 *
				 * totalReward: is 3_000e18
				 *
				 * Incentive Start -> Halfway Through:
				 * 3 LPs, all staking the same amount. Each LP gets roughly (totalReward/2) * (1/3)
				 */
				const firstHalfRewards = totalReward.div(BN('2'))

				/***
				 * Halfway Through -> Incentive End:
				 * 4 LPs, all providing the same liquidity. Only 3 LPs are staking, so they should
				 * each get 1/4 the liquidity for that time. So That's 1/4 * 1/2 * 3_000e18 per farmd LP.
				 * */
				const secondHalfRewards = totalReward.div(BN('2')).mul('3').div('4')
				const rewardsEarned = bnSum(exitFarmings.map((s) => s.balance))
				// @ts-ignore
				expect(rewardsEarned).be.gte(totalReward.mul(BN(9999)).div(BN(10000)))
				// const { amountReturnedToCreator } = await helpers.endIncentiveFlow({
				// 	createIncentiveResult,
				// })
			})
		})
	})
	
	describe('Swap before startTime', async ()=> {
		type TestSubject = {
			createIncentiveResult: HelperTypes.CreateIncentive.Result
			helpers: HelperCommands
			context: TestContext
		}
		let subject: TestSubject

		const ticksToFarm: [number, number] = [
			getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
			getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
		]
		const amountsToFarm: [BigNumber, BigNumber] = [BNe18(10), BNe18(10)]


		const totalReward = BNe18(2_000_000)
		const bonusReward = BNe18(4_000)
		const duration = days(40)

		const scenario: () => Promise<TestSubject> = async () => {
			const context = await algebraFixture()
			const wallets = (await ethers.getSigners() as any) as Wallet[];
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider)

			const epoch = await blockTimestamp()
			const startTime = epoch + 100
			const endTime = startTime + duration

			const createIncentiveResult = await helpers.createIncentiveFlow({
				startTime,
				endTime,
				rewardToken: context.rewardToken,
				bonusRewardToken: context.bonusRewardToken,
				poolAddress: context.pool01,
				totalReward,
				bonusReward
			})
			return {
				context,
				helpers,
				createIncentiveResult
			}
		}

		beforeEach('load Fixture', async () =>{
			subject = await loadFixture(scenario)
		})

		it('rewards calc properly', async () => {
			const { helpers, context, createIncentiveResult } = subject
			type Position = {
				lp: Wallet
				amounts: [BigNumber, BigNumber]
				ticks: [number, number]
			}

			let midpoint = await getCurrentTick(context.poolObj.connect(actors.lpUser0()))

			const lpUser3 = actors.traderUser2()

			// The non-staking user will deposit 25x the liquidity as the others
			const balanceDeposited = amountsToFarm[0]

			// Someone starts staking
			await e20h.ensureBalancesAndApprovals(
				lpUser3,
				[context.token0, context.token1],
				balanceDeposited,
				context.nft.address
			)

			await mintPosition(context.nft.connect(lpUser3), {
				token0: context.token0.address,
				token1: context.token1.address,
				fee: FeeAmount.MEDIUM,
				tickLower: ticksToFarm[0],
				tickUpper: ticksToFarm[1],
				recipient: lpUser3.address,
				amount0Desired: balanceDeposited,
				amount1Desired: balanceDeposited,
				amount0Min: 0,
				amount1Min: 0,
				deadline: (await blockTimestamp()) + 1000,
			})



		    const positions: Array<Position> = [
				{
					lp: actors.lpUser0(),
					amounts: [BN('252473' + '0'.repeat(13)), BN('552446' + '0'.repeat(13))],
					ticks: [120, 240],
				},
				{
					lp: actors.lpUser1(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [120, 480],
				}
			]

		    const tokensToFarm: [TestERC20, TestERC20] = [context.tokens[0], context.tokens[1]]

			const farms = await Promise.all(
				positions.map((p) =>
					helpers.mintDepositFarmFlow({
						lp: p.lp,
						tokensToFarm,
						ticks: p.ticks,
						amountsToFarm: p.amounts,
						createIncentiveResult,
					})
				)
			)

			const epoch = await blockTimestamp()

			await time.increaseTo(epoch + 1)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 10,
			})


			const [tok0Address, tok1Address] = await Promise.all([
		      context.poolObj.connect(actors.traderUser0()).token0(),
		      context.poolObj.connect(actors.traderUser0()).token1(),
		    ])
			const path = encodePath([tok1Address, tok0Address])

			await context.router.connect(actors.traderUser0()).exactInput(
		        {
		          recipient: actors.traderUser0().address,
		          deadline: MaxUint256,
		          path,
		          amountIn: BNe18(1).div(10),
		          amountOutMinimum: 0,
		        },
		        maxGas
	        )

			await context.router.connect(actors.traderUser0()).exactInput(
		        {
		          recipient: actors.traderUser0().address,
		          deadline: MaxUint256,
		          path,
		          amountIn: BNe18(1).div(10),
		          amountOutMinimum: 0,
		        },
		        maxGas
	        )

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 2)

			
			const rewardInfo1 = await context.farming.connect(actors.lpUser0()).getRewardInfo(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    2
		    )

		    const rewardInfo2 = await context.farming.connect(actors.lpUser0()).getRewardInfo(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    3
		    )
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 480,
			})

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + 3 *duration / 4)

		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 100,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + 5 *duration / 6)

		     await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 30,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)
			
			await context.farmingCenter.connect(actors.lpUser0()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },		
			    2,
				LIMIT_FARMING
			);
			await context.farmingCenter.connect(actors.lpUser1()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    3,
				LIMIT_FARMING
			);

			const reward1 = await context.farming.rewards(actors.lpUser0().address, context.rewardToken.address)
			const reward2 = await context.farming.rewards(actors.lpUser1().address, context.rewardToken.address)

			const reward3 = await context.farming.rewards(actors.lpUser0().address, context.bonusRewardToken.address)
			const reward4 = await context.farming.rewards(actors.lpUser1().address, context.bonusRewardToken.address)



			expect(reward2.add(reward1)).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))


	    }).timeout(60000)
	})

	describe('Price out of farmed range', async ()=> {
		type TestSubject = {
			createIncentiveResult: HelperTypes.CreateIncentive.Result
			helpers: HelperCommands
			context: TestContext
		}
		let subject: TestSubject

		const ticksToFarm: [number, number] = [
			getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
			getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
		]
		const amountsToFarm: [BigNumber, BigNumber] = [BNe18(10), BNe18(10)]


		const totalReward = BNe18(3_000)
		const bonusReward = BNe18(4_000)
		const duration = days(1)

		const scenario: () => Promise<TestSubject> = async () => {
			const context = await algebraFixture()
			const wallets = (await ethers.getSigners() as any) as Wallet[];
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider)

			const epoch = await blockTimestamp()
			const startTime = epoch + 100
			const endTime = startTime + duration

			const createIncentiveResult = await helpers.createIncentiveFlow({
				startTime,
				endTime,
				rewardToken: context.rewardToken,
				bonusRewardToken: context.bonusRewardToken,
				poolAddress: context.pool01,
				totalReward,
				bonusReward
			})
			return {
				context,
				helpers,
				createIncentiveResult
			}
		}

		beforeEach('load Fixture', async () =>{
			subject = await loadFixture(scenario)
		})

		it('rewards calc properly', async () => {
			const { helpers, context, createIncentiveResult } = subject
			type Position = {
				lp: Wallet
				amounts: [BigNumber, BigNumber]
				ticks: [number, number]
			}

			let midpoint = await getCurrentTick(context.poolObj.connect(actors.lpUser0()))

			const lpUser3 = actors.traderUser2()

			// The non-staking user will deposit 25x the liquidity as the others
			const balanceDeposited = amountsToFarm[0]

			// Someone starts staking
			await e20h.ensureBalancesAndApprovals(
				lpUser3,
				[context.token0, context.token1],
				balanceDeposited,
				context.nft.address
			)

			await mintPosition(context.nft.connect(lpUser3), {
				token0: context.token0.address,
				token1: context.token1.address,
				fee: FeeAmount.MEDIUM,
				tickLower: ticksToFarm[0],
				tickUpper: ticksToFarm[1],
				recipient: lpUser3.address,
				amount0Desired: balanceDeposited,
				amount1Desired: balanceDeposited,
				amount0Min: 0,
				amount1Min: 0,
				deadline: (await blockTimestamp()) + 1000,
			})
			
		    const positions: Array<Position> = [
				{
					lp: actors.lpUser0(),
					amounts: [BN('252473' + '0'.repeat(13)), BN('552446' + '0'.repeat(13))],
					ticks: [120, 240],
				},
				{
					lp: actors.lpUser1(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [120, 480],
				},

			]

		    const tokensToFarm: [TestERC20, TestERC20] = [context.tokens[0], context.tokens[1]]

			const farms = await Promise.all(
				await positions.map((p) =>
					helpers.mintDepositFarmFlow({
						lp: p.lp,
						tokensToFarm,
						ticks: p.ticks,
						amountsToFarm: p.amounts,
						createIncentiveResult,
					})
				)
			)

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + 1)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlowWithSmallSteps({
				trader,
				direction: 'down',
				desiredValue: -20,
			})

			const [tok0Address, tok1Address] = await Promise.all([
		      context.poolObj.connect(actors.traderUser0()).token0(),
		      context.poolObj.connect(actors.traderUser0()).token1(),
		    ])
			const path = encodePath([tok1Address, tok0Address])
			await context.router.connect(actors.traderUser0()).exactInput(
		        {
		          recipient: actors.traderUser0().address,
		          deadline: MaxUint256,
		          path,
		          amountIn: BNe18(1).div(10000),
		          amountOutMinimum: 0,
		        },
		        maxGas
	        )
			await context.router.connect(actors.traderUser0()).exactInput(
		        {
		          recipient: actors.traderUser0().address,
		          deadline: MaxUint256,
		          path,
		          amountIn: BNe18(1).div(10000),
		          amountOutMinimum: 0,
		        },
		        maxGas
	        )

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 2)
		    await helpers.makeTickGoFlowWithSmallSteps({
				trader,
				direction: 'down',
				desiredValue: -50,
			})

		    await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)

			let liquidityOfFirstPosition = await (await context.nft.connect(actors.lpUser0()).positions(2)).liquidity
			let liquidityOfSecondPosition = await (await context.nft.connect(actors.lpUser1()).positions(3)).liquidity

			let position0 = await (await context.nft.connect(actors.lpUser0()).positions(2))
			let position1 = await (await context.nft.connect(actors.lpUser1()).positions(3))



			await context.farmingCenter.connect(actors.lpUser0()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    2,
				LIMIT_FARMING
			);

			await context.farmingCenter.connect(actors.lpUser1()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    3,
				LIMIT_FARMING
			);

			const reward1 = BN(await context.farming.rewards(actors.lpUser0().address, context.rewardToken.address))
			const reward2 = BN(await context.farming.rewards(actors.lpUser1().address, context.rewardToken.address))

			const reward3 = BN(await context.farming.rewards(actors.lpUser0().address, context.bonusRewardToken.address))
			const reward4 = BN(await context.farming.rewards(actors.lpUser1().address, context.bonusRewardToken.address))

			let liquidity = liquidityOfFirstPosition.mul(BN(10000)).div(liquidityOfSecondPosition)
			let reward = reward1.mul(BN(10000)).div(reward2)
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))
			expect(BigNumber.from(reward2.add(reward1))).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(liquidity).to.eq(reward)


	    }).timeout(60000)
	})

	describe('first swap move price out of first position range ', async ()=> {
		type TestSubject = {
			createIncentiveResult: HelperTypes.CreateIncentive.Result
			helpers: HelperCommands
			context: TestContext
		}
		let subject: TestSubject

		const ticksToFarm: [number, number] = [
			getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
			getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
		]
		const amountsToFarm: [BigNumber, BigNumber] = [BNe18(1), BNe18(1)]


		const totalReward = BNe18(3_000)
		const bonusReward = BNe18(4_000)
		const duration = days(1)

		const scenario: () => Promise<TestSubject> = async () => {
			const context = await algebraFixture()
			const wallets = (await ethers.getSigners() as any) as Wallet[];
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider)

			const epoch = await blockTimestamp()
			const startTime = epoch + 100
			const endTime = startTime + duration

			const createIncentiveResult = await helpers.createIncentiveFlow({
				startTime,
				endTime,
				rewardToken: context.rewardToken,
				bonusRewardToken: context.bonusRewardToken,
				poolAddress: context.pool01,
				totalReward,
				bonusReward
			})
			return {
				context,
				helpers,
				createIncentiveResult
			}
		}

		beforeEach('load Fixture', async () =>{
			subject = await loadFixture(scenario)
		})

		it('rewards calc properly', async () => {
			const { helpers, context, createIncentiveResult } = subject
			type Position = {
				lp: Wallet
				amounts: [BigNumber, BigNumber]
				ticks: [number, number]
			}

			let midpoint = await getCurrentTick(context.poolObj.connect(actors.lpUser0()))

			const lpUser3 = actors.traderUser2()

				// The non-staking user will deposit 25x the liquidity as the others
				const balanceDeposited = amountsToFarm[0]

				// Someone starts staking
				await e20h.ensureBalancesAndApprovals(
					lpUser3,
					[context.token0, context.token1],
					balanceDeposited,
					context.nft.address
				)

				await mintPosition(context.nft.connect(lpUser3), {
					token0: context.token0.address,
					token1: context.token1.address,
					fee: FeeAmount.MEDIUM,
					tickLower: ticksToFarm[0],
					tickUpper: ticksToFarm[1],
					recipient: lpUser3.address,
					amount0Desired: balanceDeposited,
					amount1Desired: balanceDeposited,
					amount0Min: 0,
					amount1Min: 0,
					deadline: (await blockTimestamp()) + 1000,
				})

		    const positions: Array<Position> = [
				{
					lp: actors.lpUser0(),
					amounts: [BN('252473' + '0'.repeat(13)), BN('552446' + '0'.repeat(13))],
					ticks: [-240, 240],
				},
				{
					lp: actors.lpUser1(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [-480, 480],
				}
			]

		    const tokensToFarm: [TestERC20, TestERC20] = [context.tokens[0], context.tokens[1]]

			const farms = await Promise.all(
				positions.map((p) =>
					helpers.mintDepositFarmFlow({
						lp: p.lp,
						tokensToFarm,
						ticks: p.ticks,
						amountsToFarm: p.amounts,
						createIncentiveResult,
					})
				)
			)

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + 1)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 241,
			})



		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 2)

		

		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 300,
			})



		    await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)

		    await context.farmingCenter.connect(actors.lpUser0()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    2,
				LIMIT_FARMING
			);
			await context.farmingCenter.connect(actors.lpUser1()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    3,
				LIMIT_FARMING
			);


			const reward1 = await context.farming.rewards(actors.lpUser0().address, context.rewardToken.address)
			const reward2 = await context.farming.rewards(actors.lpUser1().address, context.rewardToken.address)


			const reward3 = await context.farming.rewards(actors.lpUser0().address, context.bonusRewardToken.address)
			const reward4 = await context.farming.rewards(actors.lpUser1().address, context.bonusRewardToken.address)


			expect(reward2.add(reward1)).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))


	    }).timeout(60000)
	})

	describe('Swap after incentive end only', async ()=> {
		type TestSubject = {
			createIncentiveResult: HelperTypes.CreateIncentive.Result
			helpers: HelperCommands
			context: TestContext
		}
		let subject: TestSubject

		const ticksToFarm: [number, number] = [
			getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
			getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
		]
		const amountsToFarm: [BigNumber, BigNumber] = [BNe18(1), BNe18(1)]


		const totalReward = BNe18(3_000)
		const bonusReward = BNe18(4_000)
		const duration = days(1)

		const scenario: () => Promise<TestSubject> = async () => {
			const context = await algebraFixture()
			const wallets = (await ethers.getSigners() as any) as Wallet[];
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider)

			const epoch = await blockTimestamp()
			const startTime = epoch + 100
			const endTime = startTime + duration

			const createIncentiveResult = await helpers.createIncentiveFlow({
				startTime,
				endTime,
				rewardToken: context.rewardToken,
				bonusRewardToken: context.bonusRewardToken,
				poolAddress: context.pool01,
				totalReward,
				bonusReward
			})
			return {
				context,
				helpers,
				createIncentiveResult
			}
		}

		beforeEach('load Fixture', async () =>{
			subject = await loadFixture(scenario)
		})

		it('rewards calc properly', async () => {
			const { helpers, context, createIncentiveResult } = subject
			type Position = {
				lp: Wallet
				amounts: [BigNumber, BigNumber]
				ticks: [number, number]
			}

			let midpoint = await getCurrentTick(context.poolObj.connect(actors.lpUser0()))

			const lpUser3 = actors.traderUser2()

				// The non-staking user will deposit 25x the liquidity as the others
				const balanceDeposited = amountsToFarm[0]

				// Someone starts staking
				await e20h.ensureBalancesAndApprovals(
					lpUser3,
					[context.token0, context.token1],
					balanceDeposited,
					context.nft.address
				)

				await mintPosition(context.nft.connect(lpUser3), {
					token0: context.token0.address,
					token1: context.token1.address,
					fee: FeeAmount.MEDIUM,
					tickLower: ticksToFarm[0],
					tickUpper: ticksToFarm[1],
					recipient: lpUser3.address,
					amount0Desired: balanceDeposited,
					amount1Desired: balanceDeposited,
					amount0Min: 0,
					amount1Min: 0,
					deadline: (await blockTimestamp()) + 1000,
				})

		    const positions: Array<Position> = [
				{
					lp: actors.lpUser0(),
					amounts: [BN('252473' + '0'.repeat(13)), BN('552446' + '0'.repeat(13))],
					ticks: [-240, 240],
				},
				{
					lp: actors.lpUser1(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [-480, 480],
				}
			]

		    const tokensToFarm: [TestERC20, TestERC20] = [context.tokens[0], context.tokens[1]]

			const farms = await Promise.all(
				positions.map((p) =>
					helpers.mintDepositFarmFlow({
						lp: p.lp,
						tokensToFarm,
						ticks: p.ticks,
						amountsToFarm: p.amounts,
						createIncentiveResult,
					})
				)
			)

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + 1)

		    const trader = actors.traderUser0()
		    // await helpers.makeTickGoFlow({
			// 	trader,
			// 	direction: 'up',
			// 	desiredValue: midpoint + 10,
			// })



		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 2)


		    await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)

		    await context.farmingCenter.connect(actors.lpUser0()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    2,
				LIMIT_FARMING
			);
			await context.farmingCenter.connect(actors.lpUser1()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    3,
				LIMIT_FARMING
			);


			const reward1 = await context.farming.rewards(actors.lpUser0().address, context.rewardToken.address)
			const reward2 = await context.farming.rewards(actors.lpUser1().address, context.rewardToken.address)

			const reward3 = await context.farming.rewards(actors.lpUser0().address, context.bonusRewardToken.address)
			const reward4 = await context.farming.rewards(actors.lpUser1().address, context.bonusRewardToken.address)



			expect(reward2.add(reward1)).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))


	    }).timeout(60000)
	})


	describe('Price out of range after first swap', async ()=> {
		type TestSubject = {
			createIncentiveResult: HelperTypes.CreateIncentive.Result
			helpers: HelperCommands
			context: TestContext
		}
		let subject: TestSubject

		const ticksToFarm: [number, number] = [
			getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
			getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
		]
		const amountsToFarm: [BigNumber, BigNumber] = [BNe18(100), BNe18(100)]


		const totalReward = BNe18(3_000)
		const bonusReward = BNe18(4_000)
		const duration = days(1)

		const scenario: () => Promise<TestSubject> = async () => {
			const context = await algebraFixture()
			const wallets = (await ethers.getSigners() as any) as Wallet[];
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider)

			const epoch = await blockTimestamp()
			const startTime = epoch + 100
			const endTime = startTime + duration

			const createIncentiveResult = await helpers.createIncentiveFlow({
				startTime,
				endTime,
				rewardToken: context.rewardToken,
				bonusRewardToken: context.bonusRewardToken,
				poolAddress: context.pool01,
				totalReward,
				bonusReward
			})
			return {
				context,
				helpers,
				createIncentiveResult
			}
		}

		beforeEach('load Fixture', async () =>{
			subject = await loadFixture(scenario)
		})

		it('rewards calc properly', async () => {
			const { helpers, context, createIncentiveResult } = subject
			type Position = {
				lp: Wallet
				amounts: [BigNumber, BigNumber]
				ticks: [number, number]
			}

			let midpoint = await getCurrentTick(context.poolObj.connect(actors.lpUser0()))

			const lpUser3 = actors.traderUser2()

				// The non-staking user will deposit 25x the liquidity as the others
				const balanceDeposited = amountsToFarm[0]

				
				await e20h.ensureBalancesAndApprovals(
					lpUser3,
					[context.token0, context.token1],
					balanceDeposited,
					context.nft.address
				)

				await mintPosition(context.nft.connect(lpUser3), {
					token0: context.token0.address,
					token1: context.token1.address,
					fee: FeeAmount.MEDIUM,
					tickLower: ticksToFarm[0],
					tickUpper: ticksToFarm[1],
					recipient: lpUser3.address,
					amount0Desired: balanceDeposited,
					amount1Desired: balanceDeposited,
					amount0Min: 0,
					amount1Min: 0,
					deadline: (await blockTimestamp()) + 1000,
				})

		    const positions: Array<Position> = [
				{
					lp: actors.lpUser0(),
					amounts: [BN('252473' + '0'.repeat(13)), BN('552446' + '0'.repeat(13))],
					ticks: [-240, 240],
				},
				{
					lp: actors.lpUser1(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [-480, 480],
				}
			]


		    const tokensToFarm: [TestERC20, TestERC20] = [context.tokens[0], context.tokens[1]]

			const farms = await Promise.all(
				positions.map((p) =>
					helpers.mintDepositFarmFlow({
						lp: p.lp,
						tokensToFarm,
						ticks: p.ticks,
						amountsToFarm: p.amounts,
						createIncentiveResult,
					})
				)
			)

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + 20)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 480,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 2)

		    await helpers.makeTickGoFlow({
				trader,
				direction: 'down',
				desiredValue: midpoint + 480,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)

			await context.farmingCenter.connect(actors.lpUser0()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    2,
				LIMIT_FARMING
			);

			await context.farmingCenter.connect(actors.lpUser1()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    3,
				LIMIT_FARMING
			);


			const reward1 = await context.farming.rewards(actors.lpUser0().address, context.rewardToken.address)
			const reward2 = await context.farming.rewards(actors.lpUser1().address, context.rewardToken.address)


			const reward3 = await context.farming.rewards(actors.lpUser0().address, context.bonusRewardToken.address)
			const reward4 = await context.farming.rewards(actors.lpUser1().address, context.bonusRewardToken.address)



			expect(reward2.add(reward1)).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))


	    }).timeout(60000)
	})

    describe('Two farmings one range inside another', async ()=>{
        type TestSubject = {
            createIncentiveResult: HelperTypes.CreateIncentive.Result
            helpers: HelperCommands
            context: TestContext
		}
		let subject: TestSubject

        const totalReward = BNe18(3_000)
        const bonusReward = BNe18(4_000)
		const duration = days(1)
		const baseAmount = BNe18(2)

        const scenario: () => Promise<TestSubject> = async () => {
			const context = await algebraFixture()
			const wallets = (await ethers.getSigners() as any) as Wallet[];
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider)

			const epoch = await blockTimestamp()
			const startTime = epoch + 30
			const endTime = startTime + duration

			const createIncentiveResult = await helpers.createIncentiveFlow({
				startTime,
				endTime,
				rewardToken: context.rewardToken,
				bonusRewardToken: context.bonusRewardToken,
				poolAddress: context.pool01,
				totalReward,
				bonusReward
			})
			return {
				context,
				helpers,
				createIncentiveResult,
			}
		}

		beforeEach('load fixture', async () => {
			subject = await loadFixture(scenario)
		})

	    it('rewards calc properly', async () => {
			const { helpers, context, createIncentiveResult } = subject
			type Position = {
				lp: Wallet
				amounts: [BigNumber, BigNumber]
				ticks: [number, number]
			}

			let midpoint = await getCurrentTick(context.poolObj.connect(actors.lpUser0()))

		    const positions: Array<Position> = [
				{
					lp: actors.lpUser0(),
					amounts: [BN('252473' + '0'.repeat(13)), BN('552446' + '0'.repeat(13))],
					ticks: [-240, 240],
				},
				{
					lp: actors.lpUser1(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [-480, 480],
				},
			]

		    const tokensToFarm: [TestERC20, TestERC20] = [context.tokens[0], context.tokens[1]]

			const farms = await Promise.all(
				positions.map((p) =>
					helpers.mintDepositFarmFlow({
						lp: p.lp,
						tokensToFarm,
						ticks: p.ticks,
						amountsToFarm: p.amounts,
						createIncentiveResult,
					})
				)
			)

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + 1)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 10,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 4)

		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 300,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)
			
			await context.farmingCenter.connect(actors.lpUser0()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    1,
				LIMIT_FARMING
			);
			await context.farmingCenter.connect(actors.lpUser1()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    2,
				LIMIT_FARMING
			);

			const reward1 = await context.farming.rewards(actors.lpUser0().address, context.rewardToken.address)
			const reward2 = await context.farming.rewards(actors.lpUser1().address, context.rewardToken.address)


			const reward3 = await context.farming.rewards(actors.lpUser0().address, context.bonusRewardToken.address)
			const reward4 = await context.farming.rewards(actors.lpUser1().address, context.bonusRewardToken.address)


			expect(reward2.add(reward1)).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))

	    })

	    it('exitFarming before startTime', async () => {
			const { helpers, context, createIncentiveResult } = subject
			type Position = {
				lp: Wallet
				amounts: [BigNumber, BigNumber]
				ticks: [number, number]
			}

			let midpoint = await getCurrentTick(context.poolObj.connect(actors.lpUser0()))

		    const positions: Array<Position> = [
				{
					lp: actors.lpUser0(),
					amounts: [BN('252473' + '0'.repeat(13)), BN('552446' + '0'.repeat(13))],
					ticks: [-240, 240],
				},
				{
					lp: actors.lpUser1(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [-480, 480],
				},
			]

		    const tokensToFarm: [TestERC20, TestERC20] = [context.tokens[0], context.tokens[1]]

			const farms = await Promise.all(
				positions.map((p) =>
					helpers.mintDepositFarmFlow({
						lp: p.lp,
						tokensToFarm,
						ticks: p.ticks,
						amountsToFarm: p.amounts,
						createIncentiveResult,
					})
				)
			)

			await context.farmingCenter.connect(actors.lpUser1()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    2,
				LIMIT_FARMING
			);

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + 1)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 10,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 4)

		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 300,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)

			await context.farmingCenter.connect(actors.lpUser0()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    1,
				LIMIT_FARMING
			);


			const reward1 = await context.farming.rewards(actors.lpUser0().address, context.rewardToken.address)
			const reward2 = await context.farming.rewards(actors.lpUser1().address, context.rewardToken.address)


			const reward3 = await context.farming.rewards(actors.lpUser0().address, context.bonusRewardToken.address)
			const reward4 = await context.farming.rewards(actors.lpUser1().address, context.bonusRewardToken.address)

			expect(reward2.add(reward1)).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))

	    })
    })

	describe('incentive without bonusReward', async ()=> {
		type TestSubject = {
			createIncentiveResult: HelperTypes.CreateIncentive.Result
			helpers: HelperCommands
			context: TestContext
		}
		let subject: TestSubject

		const ticksToFarm: [number, number] = [
			getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
			getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
		]
		const amountsToFarm: [BigNumber, BigNumber] = [BNe18(100), BNe18(100)]


		const totalReward = BNe18(3_000)
		const bonusReward = BNe18(0)
		const duration = days(1)

		const scenario: () => Promise<TestSubject> = async () => {
			const context = await algebraFixture()
			const wallets = (await ethers.getSigners() as any) as Wallet[];
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider)

			const epoch = await blockTimestamp()
			const startTime = epoch + 1000
			const endTime = startTime + duration

			const createIncentiveResult = await helpers.createIncentiveFlow({
				startTime,
				endTime,
				rewardToken: context.rewardToken,
				bonusRewardToken: context.bonusRewardToken,
				poolAddress: context.pool01,
				totalReward,
				bonusReward
			})
			return {
				context,
				helpers,
				createIncentiveResult
			}
		}

		beforeEach('load Fixture', async () =>{
			subject = await loadFixture(scenario)
		})

		it('rewards calc properly', async () => {
			const { helpers, context, createIncentiveResult } = subject
			type Position = {
				lp: Wallet
				amounts: [BigNumber, BigNumber]
				ticks: [number, number]
			}

			let midpoint = await getCurrentTick(context.poolObj.connect(actors.lpUser0()))

			const lpUser3 = actors.traderUser2()

				// The non-staking user will deposit 25x the liquidity as the others
				const balanceDeposited = amountsToFarm[0]

				
				await e20h.ensureBalancesAndApprovals(
					lpUser3,
					[context.token0, context.token1],
					balanceDeposited,
					context.nft.address
				)

				await mintPosition(context.nft.connect(lpUser3), {
					token0: context.token0.address,
					token1: context.token1.address,
					fee: FeeAmount.MEDIUM,
					tickLower: ticksToFarm[0],
					tickUpper: ticksToFarm[1],
					recipient: lpUser3.address,
					amount0Desired: balanceDeposited,
					amount1Desired: balanceDeposited,
					amount0Min: 0,
					amount1Min: 0,
					deadline: (await blockTimestamp()) + 1000,
				})

		    const positions: Array<Position> = [
				{
					lp: actors.lpUser0(),
					amounts: [BN('252473' + '0'.repeat(13)), BN('552446' + '0'.repeat(13))],
					ticks: [-240, 240],
				},
				{
					lp: actors.lpUser1(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [-480, 480],
				}
			]


		    const tokensToFarm: [TestERC20, TestERC20] = [context.tokens[0], context.tokens[1]]

			const farms = await Promise.all(
				positions.map((p) =>
					helpers.mintDepositFarmFlow({
						lp: p.lp,
						tokensToFarm,
						ticks: p.ticks,
						amountsToFarm: p.amounts,
						createIncentiveResult,
					})
				)
			)

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + 20)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 480,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 2)

		    await helpers.makeTickGoFlow({
				trader,
				direction: 'down',
				desiredValue: midpoint + 480,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)

			await context.farmingCenter.connect(actors.lpUser0()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    2,
				LIMIT_FARMING
			);

			await context.farmingCenter.connect(actors.lpUser1()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    3,
				LIMIT_FARMING
			);


			const reward1 = await context.farming.rewards(actors.lpUser0().address, context.rewardToken.address)
			const reward2 = await context.farming.rewards(actors.lpUser1().address, context.rewardToken.address)


			const reward3 = await context.farming.rewards(actors.lpUser0().address, context.bonusRewardToken.address)
			const reward4 = await context.farming.rewards(actors.lpUser1().address, context.bonusRewardToken.address)

			expect(reward2.add(reward1)).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))


	    }).timeout(60000)
	})

	describe('incentives with multiplier', async ()=>{
        type TestSubject = {
            createIncentiveResult: HelperTypes.CreateIncentive.Result
            helpers: HelperCommands
            context: TestContext
		}
		let subject: TestSubject

        const totalReward = BNe18(3_000)
        const bonusReward = BNe18(4_000)
		const duration = days(1)
		const baseAmount = BNe18(2)

        const scenario: () => Promise<TestSubject> = async () => {
			const context = await algebraFixture()
			const wallets = (await ethers.getSigners() as any) as Wallet[];
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider)

			const epoch = await blockTimestamp()
			const startTime = epoch + 1000
			const endTime = startTime + duration

			const createIncentiveResult = await helpers.createIncentiveWithMultiplierFlow({
				startTime,
				endTime,
				rewardToken: context.rewardToken,
				bonusRewardToken: context.bonusRewardToken,
				poolAddress: context.pool01,
				totalReward,
				bonusReward,
				tier1Multiplier: BN(10000),
				tier2Multiplier: BN(12000),
				tier3Multiplier: BN(15000),
				algbAmountForTier1: BN(1000),
				algbAmountForTier2: BN(2000),
				algbAmountForTier3: BN(4000)

			})
			return {
				context,
				helpers,
				createIncentiveResult,
			}
		}

		beforeEach('load fixture', async () => {
			subject = await loadFixture(scenario)
		})

	    it('same range and liquidity, multipliers: 0 and 50%', async () => {
			const { helpers, context, createIncentiveResult } = subject
			type Position = {
				lp: Wallet
				amounts: [BigNumber, BigNumber]
				ticks: [number, number]
				tokensLocked: BigNumber
			}

			let midpoint = await getCurrentTick(context.poolObj.connect(actors.lpUser0()))

		    const positions: Array<Position> = [
				{
					lp: actors.lpUser0(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [-480, 480],
					tokensLocked: BN(5000),
				},
				{
					lp: actors.lpUser1(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [-480, 480],
					tokensLocked: BN(0),
				},
			]

		    const tokensToFarm: [TestERC20, TestERC20] = [context.tokens[0], context.tokens[1]]

			const farms = await Promise.all(
				positions.map((p) =>
					helpers.mintDepositFarmFlow({
						lp: p.lp,
						tokensToFarm,
						ticks: p.ticks,
						amountsToFarm: p.amounts,
						createIncentiveResult,
						tokensLocked: p.tokensLocked
					})
				)
			)

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + 1)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 10,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 4)

		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 300,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)
			
			await context.farmingCenter.connect(actors.lpUser0()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    1,
				LIMIT_FARMING
			);
			await context.farmingCenter.connect(actors.lpUser1()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    2,
				LIMIT_FARMING
			);

			const reward1 = await context.farming.rewards(actors.lpUser0().address, context.rewardToken.address)
			const reward2 = await context.farming.rewards(actors.lpUser1().address, context.rewardToken.address)


			const reward3 = await context.farming.rewards(actors.lpUser0().address, context.bonusRewardToken.address)
			const reward4 = await context.farming.rewards(actors.lpUser1().address, context.bonusRewardToken.address)

			expect(reward2.add(reward1)).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))

	    }).timeout(60000)

		it('same range and liquidity, multipliers: 20 and 50%', async () => {
			const { helpers, context, createIncentiveResult } = subject
			type Position = {
				lp: Wallet
				amounts: [BigNumber, BigNumber]
				ticks: [number, number]
				tokensLocked: BigNumber
			}

			let midpoint = await getCurrentTick(context.poolObj.connect(actors.lpUser0()))

		    const positions: Array<Position> = [
				{
					lp: actors.lpUser0(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [-480, 480],
					tokensLocked: BN(5000),
				},
				{
					lp: actors.lpUser1(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [-480, 480],
					tokensLocked: BN(2000),
				},
			]

		    const tokensToFarm: [TestERC20, TestERC20] = [context.tokens[0], context.tokens[1]]

			const farms = await Promise.all(
				positions.map((p) =>
					helpers.mintDepositFarmFlow({
						lp: p.lp,
						tokensToFarm,
						ticks: p.ticks,
						amountsToFarm: p.amounts,
						createIncentiveResult,
						tokensLocked: p.tokensLocked
					})
				)
			)

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + 1)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 10,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 4)

		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 300,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)
			
			await context.farmingCenter.connect(actors.lpUser0()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    1,
				LIMIT_FARMING
			);
			await context.farmingCenter.connect(actors.lpUser1()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    2,
				LIMIT_FARMING
			);

			const reward1 = await context.farming.rewards(actors.lpUser0().address, context.rewardToken.address)
			const reward2 = await context.farming.rewards(actors.lpUser1().address, context.rewardToken.address)


			const reward3 = await context.farming.rewards(actors.lpUser0().address, context.bonusRewardToken.address)
			const reward4 = await context.farming.rewards(actors.lpUser1().address, context.bonusRewardToken.address)

			expect(reward2.add(reward1)).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))

	    }).timeout(60000)

		it('same range and liquidity, multipliers: 10 and 20%', async () => {
			const { helpers, context, createIncentiveResult } = subject
			type Position = {
				lp: Wallet
				amounts: [BigNumber, BigNumber]
				ticks: [number, number]
				tokensLocked: BigNumber
			}

			let midpoint = await getCurrentTick(context.poolObj.connect(actors.lpUser0()))

		    const positions: Array<Position> = [
				{
					lp: actors.lpUser0(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [-480, 480],
					tokensLocked: BN(1000),
				},
				{
					lp: actors.lpUser1(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [-480, 480],
					tokensLocked: BN(2000),
				},
			]

		    const tokensToFarm: [TestERC20, TestERC20] = [context.tokens[0], context.tokens[1]]

			const farms = await Promise.all(
				positions.map((p) =>
					helpers.mintDepositFarmFlow({
						lp: p.lp,
						tokensToFarm,
						ticks: p.ticks,
						amountsToFarm: p.amounts,
						createIncentiveResult,
						tokensLocked: p.tokensLocked
					})
				)
			)

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + 1)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 10,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 4)

		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 300,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)
			
			await context.farmingCenter.connect(actors.lpUser0()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    1,
				LIMIT_FARMING
			);
			await context.farmingCenter.connect(actors.lpUser1()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    2,
				LIMIT_FARMING
			);

			const reward1 = await context.farming.rewards(actors.lpUser0().address, context.rewardToken.address)
			const reward2 = await context.farming.rewards(actors.lpUser1().address, context.rewardToken.address)


			const reward3 = await context.farming.rewards(actors.lpUser0().address, context.bonusRewardToken.address)
			const reward4 = await context.farming.rewards(actors.lpUser1().address, context.bonusRewardToken.address)

			expect(reward2.add(reward1)).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))

	    }).timeout(60000)
    })

	describe('Eternal farming two farmings one range inside another', async ()=>{
        type TestSubject = {
            createIncentiveResult: HelperTypes.CreateIncentive.Result
            helpers: HelperCommands
            context: TestContext
		}
		let subject: TestSubject

        const totalReward = BNe18(3_000)
        const bonusReward = BNe18(4_000)
		const duration = days(1)

        const scenario: () => Promise<TestSubject> = async () => {
			const context = await algebraFixture()
			const wallets = (await ethers.getSigners() as any) as Wallet[];
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider)

			const epoch = await blockTimestamp()
			const startTime = epoch + 30
			const endTime = startTime + duration

			const createIncentiveResult = await helpers.createIncentiveFlow({
				startTime,
				endTime,
				rewardToken: context.rewardToken,
				bonusRewardToken: context.bonusRewardToken,
				poolAddress: context.pool01,
				totalReward,
				bonusReward,
				eternal: true,
				rewardRate: BigNumber.from('10'),
				bonusRewardRate: BigNumber.from('50')
			})
			return {
				context,
				helpers,
				createIncentiveResult,
			}
		}

		beforeEach('load fixture', async () => {
			subject = await loadFixture(scenario)
		})

	    it('rewards calc properly', async () => {
			const { helpers, context, createIncentiveResult } = subject
			type Position = {
				lp: Wallet
				amounts: [BigNumber, BigNumber]
				ticks: [number, number]
			}

			let midpoint = await getCurrentTick(context.poolObj.connect(actors.lpUser0()))

		    const positions: Array<Position> = [
				{
					lp: actors.lpUser0(),
					amounts: [BN('252473' + '0'.repeat(13)), BN('552446' + '0'.repeat(13))],
					ticks: [-240, 240],
				},
				{
					lp: actors.lpUser1(),
					amounts: [BN('441204' + '0'.repeat(13)), BN('799696' + '0'.repeat(13))],
					ticks: [-480, 480],
				},
			]

		    const tokensToFarm: [TestERC20, TestERC20] = [context.tokens[0], context.tokens[1]]

			const farms = await Promise.all(
				positions.map((p) =>
					helpers.mintDepositFarmFlow({
						lp: p.lp,
						tokensToFarm,
						ticks: p.ticks,
						amountsToFarm: p.amounts,
						createIncentiveResult,
						eternal: true
					})
				)
			)

		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + 1)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 10,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 4)

		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 300,
			})


		    await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)
			
			await context.farmingCenter.connect(actors.lpUser0()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    1,
				ETERNAL_FARMING
			);
			await context.farmingCenter.connect(actors.lpUser1()).exitFarming(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    
			    },
			    2,
				ETERNAL_FARMING
			);

			const reward1 = await context.eternalFarming.rewards(actors.lpUser0().address, context.rewardToken.address)
			const reward2 = await context.eternalFarming.rewards(actors.lpUser1().address, context.rewardToken.address)


			const reward3 = await context.eternalFarming.rewards(actors.lpUser0().address, context.bonusRewardToken.address)
			const reward4 = await context.eternalFarming.rewards(actors.lpUser1().address, context.bonusRewardToken.address)


			expect(reward2.add(reward1)).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))

	    })

    })

})