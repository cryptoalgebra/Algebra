import { constants } from 'ethers'
import { TestContext, LoadFixtureFunction } from './types'
import { TestERC20 } from '../typechain'
import { IAlgebraPool } from "algebra/typechain";
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

let loadFixture: LoadFixtureFunction

describe('AlgebraFarming', async ()=> {
  const wallets = provider.getWallets()
  const Time = createTimeMachine(provider)
  const actors = new ActorFixture(wallets, provider)
  const e20h = new ERC20Helper()

  before('create fixture loader', async () => {
    loadFixture = createFixtureLoader(wallets, provider)
  })

  describe('there are three LPs in the same range', async () => {
    let context: AlgebraFixtureType
    let ALGB: TestERC20
    let tokens: [TestERC20, TestERC20, TestERC20, TestERC20]
    let ALGBPool : IAlgebraPool

    beforeEach('load fixture', async () => {
      context = await loadFixture(algebraFixture)
      ALGB = context.tokens[2]
      tokens = context.tokens

      ALGBPool = poolFactory.attach(context.pool12) as IAlgebraPool
      ALGBPool.setCommunityFee(25,25)
    })

    it('community fee is transferred', async()=>{

    })
  })
})