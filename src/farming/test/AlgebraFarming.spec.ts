import { constants } from 'ethers'
import { TestContext, LoadFixtureFunction } from './types'
import { TestERC20 } from '../typechain'
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
import { createFixtureLoader, provider } from './shared/provider'
import { ActorFixture } from './shared/actors'
import { Fixture } from 'ethereum-waffle'
import { HelperTypes } from './helpers/types'
import { Wallet } from '@ethersproject/wallet'

import './matchers/beWithin'

let loadFixture: LoadFixtureFunction

describe('AlgebraFarming', async ()=>{
    const wallets = provider.getWallets()
    const Time = createTimeMachine(provider)
    const actors = new ActorFixture(wallets, provider)
    const e20h = new ERC20Helper()

    before('create fixture loader', async () => {
        loadFixture = createFixtureLoader(wallets, provider)
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

		const scenario: Fixture<TestSubject> = async (_wallets, _provider) => {

			const context = await algebraFixture(_wallets, _provider)

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
			await Time.set(startTime + 1)

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

				await Time.setAndMine(createIncentiveResult.endTime + 1)

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
				const unfarms = await Promise.all(
					subject.farms.map(({ lp, tokenId }) =>
						helpers.unfarmCollectBurnFlow({
							lp,
							tokenId,
							createIncentiveResult,
						})
					)
				)

				const rewardsEarned = bnSum(unfarms.map((o) => o.balance))
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
				await Time.set(createIncentiveResult.startTime + duration / 2)

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

				await Time.set(createIncentiveResult.endTime + 1)

				const trader = actors.traderUser0()
				await helpers.makeTickGoFlow({
					trader,
					direction: 'up',
					desiredValue: 20,
				})

				const unfarms = await Promise.all(
					farms.map(({ lp, tokenId }) =>
						helpers.unfarmCollectBurnFlow({
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
				const rewardsEarned = bnSum(unfarms.map((s) => s.balance))
				// @ts-ignore
				expect(rewardsEarned).be.gte(totalReward.mul(BN(9999)).div(BN(10000)))
				// const { amountReturnedToCreator } = await helpers.endIncentiveFlow({
				// 	createIncentiveResult,
				// })
			})
		})
	})

	describe('Price out of farmd range', async ()=> {
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

		const scenario: Fixture<TestSubject> = async (_wallet, _provider) => {
			const context = await algebraFixture(_wallet,_provider)
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(_wallet, _provider), _provider)

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
		    await Time.set(createIncentiveResult.startTime + 1)

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

		    await Time.set(createIncentiveResult.startTime + duration / 2)

			const rewardInfo1 = await context.farming.connect(actors.lpUser0()).getRewardInfo(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
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
				    refundee: createIncentiveResult.refundee
			    },
			    3
		    )

		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 480,
			})

		    await Time.set(createIncentiveResult.endTime + 1)

			await context.farming.connect(actors.lpUser0()).unfarmToken(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
			    },
			    2
			);

			await context.farming.connect(actors.lpUser1()).unfarmToken(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
			    },
			    3
			);

			const reward1 = BN(await context.farming.rewards(context.rewardToken.address,actors.lpUser0().address))
			const reward2 = BN(await context.farming.rewards(context.rewardToken.address, actors.lpUser1().address))

			const reward3 = BN(await context.farming.rewards(context.bonusRewardToken.address,actors.lpUser0().address))
			const reward4 = BN(await context.farming.rewards(context.bonusRewardToken.address,actors.lpUser1().address))

			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))
			expect(BigNumber.from(reward2.add(reward1))).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))

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

		const scenario: Fixture<TestSubject> = async (_wallet, _provider) => {
			const context = await algebraFixture(_wallet,_provider)
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(_wallet, _provider), _provider)

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

		    await Time.set(createIncentiveResult.startTime + 1)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 241,
			})



		    await Time.set(createIncentiveResult.startTime + duration / 2)



		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 300,
			})



		    await Time.set(createIncentiveResult.endTime + 1)

		    await context.farming.connect(actors.lpUser0()).unfarmToken(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
			    },
			    2
			);
			await context.farming.connect(actors.lpUser1()).unfarmToken(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
			    },
			    3
			);


			const reward1 = await context.farming.rewards(context.rewardToken.address,actors.lpUser0().address)
			const reward2 = await context.farming.rewards(context.rewardToken.address, actors.lpUser1().address)


			const reward3 = await context.farming.rewards(context.bonusRewardToken.address,actors.lpUser0().address)
			const reward4 = await context.farming.rewards(context.bonusRewardToken.address,actors.lpUser1().address)


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

		const scenario: Fixture<TestSubject> = async (_wallet, _provider) => {
			const context = await algebraFixture(_wallet,_provider)
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(_wallet, _provider), _provider)

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

		    await Time.set(createIncentiveResult.startTime + 1)

		    const trader = actors.traderUser0()
		    // await helpers.makeTickGoFlow({
			// 	trader,
			// 	direction: 'up',
			// 	desiredValue: midpoint + 10,
			// })



		    await Time.set(createIncentiveResult.startTime + duration / 2)


		    await Time.set(createIncentiveResult.endTime + 1)

		    await context.farming.connect(actors.lpUser0()).unfarmToken(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
			    },
			    2
			);
			await context.farming.connect(actors.lpUser1()).unfarmToken(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
			    },
			    3
			);


			const reward1 = await context.farming.rewards(context.rewardToken.address,actors.lpUser0().address)
			const reward2 = await context.farming.rewards(context.rewardToken.address, actors.lpUser1().address)

			const reward3 = await context.farming.rewards(context.bonusRewardToken.address,actors.lpUser0().address)
			const reward4 = await context.farming.rewards(context.bonusRewardToken.address,actors.lpUser1().address)

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

		const scenario: Fixture<TestSubject> = async (_wallet, _provider) => {
			const context = await algebraFixture(_wallet,_provider)
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(_wallet, _provider), _provider)

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

		    await Time.set(createIncentiveResult.startTime + 20)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 480,
			})


		    await Time.set(createIncentiveResult.startTime + duration / 2)

		    await helpers.makeTickGoFlow({
				trader,
				direction: 'down',
				desiredValue: midpoint + 480,
			})


		    await Time.set(createIncentiveResult.endTime + 1)

			await context.farming.connect(actors.lpUser0()).unfarmToken(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
			    },
			    2
			);

			await context.farming.connect(actors.lpUser1()).unfarmToken(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
			    },
			    3
			);


			const reward1 = await context.farming.rewards(context.rewardToken.address,actors.lpUser0().address)
			const reward2 = await context.farming.rewards(context.rewardToken.address, actors.lpUser1().address)


			const reward3 = await context.farming.rewards(context.bonusRewardToken.address,actors.lpUser0().address)
			const reward4 = await context.farming.rewards(context.bonusRewardToken.address,actors.lpUser1().address)

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

        const scenario: Fixture<TestSubject> = async (_wallets, _provider) => {
			const context = await algebraFixture(_wallets, _provider)
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(_wallets, _provider), _provider)

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

		    await Time.set(createIncentiveResult.startTime + 1)

		    const trader = actors.traderUser0()
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 10,
			})


		    await Time.set(createIncentiveResult.startTime + duration / 4)

		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 300,
			})


		    await Time.set(createIncentiveResult.endTime + 1)

			await context.farming.connect(actors.lpUser0()).unfarmToken(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
			    },
			    1
			);
			await context.farming.connect(actors.lpUser1()).unfarmToken(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
			    },
			    2
			);

			const reward1 = await context.farming.rewards(context.rewardToken.address,actors.lpUser0().address)
			const reward2 = await context.farming.rewards(context.rewardToken.address, actors.lpUser1().address)


			const reward3 = await context.farming.rewards(context.bonusRewardToken.address,actors.lpUser0().address)
			const reward4 = await context.farming.rewards(context.bonusRewardToken.address,actors.lpUser1().address)


			expect(reward2.add(reward1)).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))

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


		const totalReward = BNe18(3_000)
		const bonusReward = BNe18(4_000)
		const duration = days(1)

		const scenario: Fixture<TestSubject> = async (_wallet, _provider) => {
			const context = await algebraFixture(_wallet,_provider)
			const helpers = HelperCommands.fromTestContext(context, new ActorFixture(_wallet, _provider), _provider)

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

		    await Time.set(epoch + 1)

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

		    await Time.set(createIncentiveResult.startTime + duration / 2)

			
			const rewardInfo1 = await context.farming.connect(actors.lpUser0()).getRewardInfo(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
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
				    refundee: createIncentiveResult.refundee
			    },
			    3
		    )
		    await helpers.makeTickGoFlow({
				trader,
				direction: 'up',
				desiredValue: midpoint + 480,
			})



		    await Time.set(createIncentiveResult.endTime + 1)
			
			await context.farming.connect(actors.lpUser0()).unfarmToken(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
			    },
			    2
			);
			await context.farming.connect(actors.lpUser1()).unfarmToken(
			    {
				    rewardToken: context.rewardToken.address,
				    bonusRewardToken: context.bonusRewardToken.address,
				    pool: context.poolObj.address,
				    startTime: createIncentiveResult.startTime,
				    endTime: createIncentiveResult.endTime,
				    refundee: createIncentiveResult.refundee
			    },
			    3
			);

			const reward1 = await context.farming.rewards(context.rewardToken.address,actors.lpUser0().address)
			const reward2 = await context.farming.rewards(context.rewardToken.address, actors.lpUser1().address)

			const reward3 = await context.farming.rewards(context.bonusRewardToken.address,actors.lpUser0().address)
			const reward4 = await context.farming.rewards(context.bonusRewardToken.address,actors.lpUser1().address)

			expect(reward2.add(reward1)).to.beWithin(BN('2999999999999999999990'), BN('3000000000000000000000'))
			expect(reward3.add(reward4)).to.beWithin(BN('3999999999999999999990'), BN('4000000000000000000000'))


	    }).timeout(60000)
	})


})