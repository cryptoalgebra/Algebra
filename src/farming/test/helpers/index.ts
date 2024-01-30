import { Wallet, MaxUint256, Interface } from 'ethers';
import { blockTimestamp, BNe18, FeeAmount, getCurrentTick, maxGas, encodePath, arrayWrap, getMinTick, getMaxTick } from '../shared/index';
import _ from 'lodash';
import { TestERC20, INonfungiblePositionManager, AlgebraEternalFarming, IAlgebraPool, TestIncentiveId, FarmingCenter } from '../../typechain';
import abi from '../../artifacts/contracts/farmings/EternalVirtualPool.sol/EternalVirtualPool.json';
import { HelperTypes } from './types';
import { ActorFixture } from '../shared/actors';
import { mintPosition } from '../shared/fixtures';
import { ISwapRouter } from '@cryptoalgebra/integral-periphery/typechain';
import { ethers } from 'hardhat';
import { ContractParams } from '../../types/contractParams';
import { TestContext } from '../types';
import Decimal from 'decimal.js';

/***
 * HelperCommands is a utility that abstracts away lower-tier ethereum details
 * so that we can focus on core business logic.
 *
 * Each helper function should be a `HelperTypes.CommandFunction`
 */
export class HelperCommands {
  actors: ActorFixture;
  provider: any;
  eternalFarming: AlgebraEternalFarming;
  nft: INonfungiblePositionManager;
  router: ISwapRouter;
  pool: IAlgebraPool;
  testIncentiveId: TestIncentiveId;
  farmingCenter: FarmingCenter;

  DEFAULT_INCENTIVE_DURATION = 2_000;
  DEFAULT_CLAIM_DURATION = 1_000;
  DEFAULT_LP_AMOUNT = BNe18(10);
  DEFAULT_FEE_AMOUNT = FeeAmount.MEDIUM;

  constructor({
    provider,
    eternalFarming,
    nft,
    router,
    pool,
    actors,
    testIncentiveId,
    farmingCenter,
  }: {
    provider: any;
    eternalFarming: AlgebraEternalFarming;
    farmingCenter: FarmingCenter;
    nft: INonfungiblePositionManager;
    router: ISwapRouter;
    pool: IAlgebraPool;
    actors: ActorFixture;
    testIncentiveId: TestIncentiveId;
  }) {
    this.actors = actors;
    this.provider = provider;
    this.eternalFarming = eternalFarming;
    this.nft = nft;
    this.router = router;
    this.pool = pool;
    this.testIncentiveId = testIncentiveId;
    this.farmingCenter = farmingCenter;
  }

  static fromTestContext = (context: TestContext, actors: ActorFixture, provider: any): HelperCommands => {
    return new HelperCommands({
      actors,
      provider,
      nft: context.nft,
      router: context.router,
      eternalFarming: context.eternalFarming,
      pool: context.poolObj,
      testIncentiveId: context.testIncentiveId,
      farmingCenter: context.farmingCenter,
    });
  };

  /***
   * Creates a staking incentive owned by `incentiveCreator` for `totalReward` of `rewardToken`
   *
   * Side-Effects:
   *  Transfers `rewardToken` to `incentiveCreator` if they do not have sufficient balance.
   */
  createIncentiveFlow: HelperTypes.CreateIncentive.Command = async (params) => {
    const { nonce } = params;

    const incentiveCreator = this.actors.incentiveCreator();

    const bal = await params.rewardToken.balanceOf(incentiveCreator.address);
    const bonusBal = await params.bonusRewardToken.balanceOf(incentiveCreator.address);

    if (bal < params.totalReward) {
      await params.rewardToken.transfer(incentiveCreator.address, params.totalReward);
    }

    if (bonusBal < params.bonusReward) {
      await params.bonusRewardToken.transfer(incentiveCreator.address, params.bonusReward);
    }

    let txResult;
    let virtualPoolAddress;

    await params.rewardToken.connect(incentiveCreator).approve(this.eternalFarming, params.totalReward);
    await params.bonusRewardToken.connect(incentiveCreator).approve(this.eternalFarming, params.bonusReward);

    let pluginAddres = params.plugin;
    if (!pluginAddres) {
      const pool = (await ethers.getContractAt('IAlgebraPool', params.poolAddress)) as any as IAlgebraPool;
      pluginAddres = await pool.connect(incentiveCreator).plugin();
    }

    txResult = await (this.eternalFarming as AlgebraEternalFarming).connect(incentiveCreator).createEternalFarming(
      {
        pool: params.poolAddress,
        rewardToken: params.rewardToken,
        bonusRewardToken: params.bonusRewardToken,
        nonce,
      },
      {
        reward: params.totalReward,
        bonusReward: params.bonusReward,
        rewardRate: params.rewardRate || 10,
        bonusRewardRate: params.bonusRewardRate || 10,
        minimalPositionWidth: params.minimalPositionWidth || 0,
      },
      pluginAddres
    );
    // @ts-ignore
    virtualPoolAddress = (await txResult.wait(1)).logs[4].args['virtualPool'];

    return {
      ..._.pick(params, ['poolAddress', 'totalReward', 'bonusReward', 'rewardToken', 'bonusRewardToken']),
      nonce,

      virtualPool: new ethers.Contract(virtualPoolAddress, new Interface(abi.abi), this.actors.lpUser0()),
    };
  };

  /***
   * params.lp mints an NFT backed by a certain amount of `params.tokensToFarm`.
   *
   * Side-Effects:
   *  Funds `params.lp` with enough `params.tokensToFarm` if they do not have enough.
   *  Handles the ERC20 and ERC721 permits.
   */
  mintDepositFarmFlow: HelperTypes.MintDepositFarm.Command = async (params) => {
    // Make sure LP has enough balance
    const bal0 = await params.tokensToFarm[0].balanceOf(params.lp.address);
    if (bal0 < params.amountsToFarm[0])
      await params.tokensToFarm[0]
        // .connect(tokensOwner)
        .transfer(params.lp.address, params.amountsToFarm[0] * 2n);

    const bal1 = await params.tokensToFarm[1].balanceOf(params.lp.address);
    if (bal1 < params.amountsToFarm[1])
      await params.tokensToFarm[1]
        // .connect(tokensOwner)
        .transfer(params.lp.address, params.amountsToFarm[1]);

    // Make sure LP has authorized NFT to withdraw
    await params.tokensToFarm[0].connect(params.lp).approve(this.nft, params.amountsToFarm[0]);
    await params.tokensToFarm[1].connect(params.lp).approve(this.nft, params.amountsToFarm[1]);

    // The LP mints their NFT
    const tokenId = await mintPosition(this.nft.connect(params.lp), {
      token0: await params.tokensToFarm[0].getAddress(),
      token1: await params.tokensToFarm[1].getAddress(),
      fee: FeeAmount.MEDIUM,
      tickLower: params.ticks[0],
      tickUpper: params.ticks[1],
      recipient: params.lp.address,
      amount0Desired: params.amountsToFarm[0],
      amount1Desired: params.amountsToFarm[1],
      amount0Min: 0,
      amount1Min: 0,
      deadline: (await blockTimestamp()) + 1000,
    });

    // The LP approves and farms their NFT
    await this.nft.connect(params.lp).approveForFarming(tokenId, true, this.farmingCenter);

    await this.farmingCenter.connect(params.lp).enterFarming(await incentiveResultToFarmAdapter(params.createIncentiveResult), tokenId);

    const farmdAt = await blockTimestamp();

    return {
      tokenId,
      farmdAt,
      lp: params.lp,
    };
  };

  depositFlow: HelperTypes.Deposit.Command = async (params) => {
    await this.nft.connect(params.lp).approveForFarming(params.tokenId, true, this.farmingCenter);
  };

  mintFlow: HelperTypes.Mint.Command = async (params) => {
    const fee = params.fee || FeeAmount.MEDIUM;
    const e20h = new ERC20Helper();

    const amount0Desired = params.amounts ? params.amounts[0] : this.DEFAULT_LP_AMOUNT;

    await e20h.ensureBalancesAndApprovals(params.lp, params.tokens[0], amount0Desired, await this.nft.getAddress());

    const amount1Desired = params.amounts ? params.amounts[1] : this.DEFAULT_LP_AMOUNT;

    await e20h.ensureBalancesAndApprovals(params.lp, params.tokens[1], amount1Desired, await this.nft.getAddress());

    const tokenId = await mintPosition(this.nft.connect(params.lp), {
      token0: await params.tokens[0].getAddress(),
      token1: await params.tokens[1].getAddress(),
      fee,
      tickLower: params.tickLower || getMinTick(fee),
      tickUpper: params.tickUpper || getMaxTick(fee),
      recipient: params.lp.address,
      amount0Desired,
      amount1Desired,
      amount0Min: 0,
      amount1Min: 0,
      deadline: (await blockTimestamp()) + 1000,
    });

    return { tokenId, lp: params.lp };
  };

  exitFarmingCollectBurnFlow: HelperTypes.exitFarmingCollectBurn.Command = async (params) => {
    await this.farmingCenter.connect(params.lp).exitFarming(await incentiveResultToFarmAdapter(params.createIncentiveResult), params.tokenId, maxGas);

    const exitFarmingdAt = await blockTimestamp();

    await this.eternalFarming.connect(params.lp).claimReward(params.createIncentiveResult.rewardToken, params.lp.address, 0);

    await this.eternalFarming.connect(params.lp).claimReward(params.createIncentiveResult.bonusRewardToken, params.lp.address, 0);

    const { liquidity } = await this.nft.connect(params.lp).positions(params.tokenId);

    await this.nft.connect(params.lp).decreaseLiquidity(
      {
        tokenId: params.tokenId,
        liquidity,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      },
      maxGas
    );

    const { tokensOwed0, tokensOwed1 } = await this.nft.connect(params.lp).positions(params.tokenId);

    await this.nft.connect(params.lp).collect(
      {
        tokenId: params.tokenId,
        recipient: params.lp.address,
        amount0Max: tokensOwed0,
        amount1Max: tokensOwed1,
      },
      maxGas
    );

    await this.nft.connect(params.lp).burn(params.tokenId, maxGas);

    const balance = await params.createIncentiveResult.rewardToken.connect(params.lp).balanceOf(params.lp.address);
    const bonusBalance = await params.createIncentiveResult.bonusRewardToken.connect(params.lp).balanceOf(params.lp.address);

    return {
      balance,
      bonusBalance,
      exitFarmingdAt,
    };
  };

  // endIncentiveFlow: HelperTypes.EndIncentive.Command = async (params) => {
  //   const incentiveCreator = this.actors.incentiveCreator()
  //   const { rewardToken } = params.createIncentiveResult
  //
  //   const receipt = await (
  //     await this.tokenomics.connect(incentiveCreator).endIncentive(
  //       _.assign({}, _.pick(params.createIncentiveResult, ['startTime', 'endTime']), {
  //         rewardToken: rewardToken.address,
  //         pool: params.createIncentiveResult.poolAddress
  //       })
  //     )
  //   ).wait()
  //
  //   const transferFilter = rewardToken.filters.Transfer(this.tokenomics.address, incentiveCreator.address, null)
  //   const transferTopic = rewardToken.interface.getEventTopic('Transfer')
  //   const logItem = receipt.logs.find((log) => log.topics.includes(transferTopic))
  //   const events = await rewardToken.queryFilter(transferFilter, logItem?.blockHash)
  //   let amountTransferred: BigNumber
  //
  //   if (events.length === 1) {
  //     amountTransferred = events[0].args[2]
  //   } else {
  //     throw new Error('Could not find transfer event')
  //   }
  //
  //   return {
  //     amountReturnedToCreator: amountTransferred,
  //   }
  // }

  getIncentiveId: HelperTypes.GetIncentiveId.Command = async (params) => {
    return this.testIncentiveId.compute({
      rewardToken: params.rewardToken,
      bonusRewardToken: params.bonusRewardToken,
      pool: params.poolAddress,
      nonce: params.nonce,
    });
  };

  makeTickGoFlow: HelperTypes.MakeTickGo.Command = async (params) => {
    // await tok0.transfer(trader0.address, BNe18(2).mul(params.numberOfTrades))
    // await tok0
    //   .connect(trader0)
    //   .approve(router.address, BNe18(2).mul(params.numberOfTrades))

    const MAKE_TICK_GO_UP = params.direction === 'up';
    const actor = params.trader || this.actors.traderUser0();

    const isDone = (tick: number | undefined) => {
      if (!params.desiredValue) {
        return true;
      } else if (!tick) {
        return false;
      } else if (MAKE_TICK_GO_UP) {
        return tick > params.desiredValue;
      } else {
        return tick < params.desiredValue;
      }
    };

    const [tok0Address, tok1Address] = await Promise.all([this.pool.connect(actor).token0(), this.pool.connect(actor).token1()]);
    const erc20 = await ethers.getContractFactory('TestERC20');

    const tok0 = erc20.attach(tok0Address) as any as TestERC20;
    const tok1 = erc20.attach(tok1Address) as any as TestERC20;
    const doTrade = async () => {
      /** If we want to push price down, we need to increase tok0.
         If we want to push price up, we need to increase tok1 */

      const amountIn = BNe18(1);

      const erc20Helper = new ERC20Helper();
      await erc20Helper.ensureBalancesAndApprovals(actor, [tok0, tok1], amountIn, await this.router.getAddress());

      const path = encodePath(MAKE_TICK_GO_UP ? [tok1Address, tok0Address] : [tok0Address, tok1Address]);

      await this.router.connect(actor).exactInput(
        {
          recipient: actor.address,
          deadline: MaxUint256,
          path,
          amountIn: amountIn / 10n,
          amountOutMinimum: 0,
        },
        maxGas
      );
      let currTick = await getCurrentTick(this.pool.connect(actor));
      return currTick;
    };

    let currentTick = await doTrade();

    while (!isDone(currentTick)) {
      currentTick = await doTrade();
    }

    return { currentTick };
  };

  moveTickTo: HelperTypes.MakeTickGo.Command = async (params) => {
    Decimal.set({ toExpPos: 9_999_999, toExpNeg: -9_999_999, precision: 100 });

    const actor = params.trader || this.actors.traderUser0();

    const [tok0Address, tok1Address] = await Promise.all([this.pool.connect(actor).token0(), this.pool.connect(actor).token1()]);
    const erc20 = await ethers.getContractFactory('TestERC20');

    const tok0 = erc20.attach(tok0Address) as any as TestERC20;
    const tok1 = erc20.attach(tok1Address) as any as TestERC20;

    let currentTick = await getCurrentTick(this.pool.connect(actor));

    const targetTick = params.desiredValue;

    if (targetTick === undefined) throw new Error('No desired value');

    if (targetTick == currentTick) return { currentTick };

    const zto = targetTick < currentTick;

    const Q96 = new Decimal(2).pow(96);

    const priceAtTarget =
      BigInt(
        new Decimal(1.0001)
          .pow(new Decimal(Number(targetTick)).div(2))
          .mul(Q96)
          .round()
          .toString()
      ) + 100n;

    const erc20Helper = new ERC20Helper();
    const amountIn = (2n ** 128n - 1n) / 2n - 100n;
    await erc20Helper.ensureBalancesAndApprovals(actor, [tok0, tok1], amountIn, await this.router.getAddress());

    await this.router.connect(actor).exactInputSingle(
      {
        recipient: actor.address,
        deadline: MaxUint256,
        tokenIn: zto ? tok0Address : tok1Address,
        tokenOut: zto ? tok1Address : tok0Address,
        amountIn: 2n ** 128n - 1n,
        amountOutMinimum: 0,
        limitSqrtPrice: priceAtTarget,
      },
      maxGas
    );

    currentTick = await getCurrentTick(this.pool.connect(actor));

    return {
      currentTick,
    };
  };

  makeTickGoFlowWithSmallSteps: HelperTypes.MakeTickGo.Command = async (params) => {
    // await tok0.transfer(trader0.address, BNe18(2).mul(params.numberOfTrades))
    // await tok0
    //   .connect(trader0)
    //   .approve(router.address, BNe18(2).mul(params.numberOfTrades))

    const MAKE_TICK_GO_UP = params.direction === 'up';
    const actor = params.trader || this.actors.traderUser0();

    const isDone = (tick: number | undefined) => {
      if (!params.desiredValue) {
        return true;
      } else if (!tick) {
        return false;
      } else if (MAKE_TICK_GO_UP) {
        return tick > params.desiredValue;
      } else {
        return tick < params.desiredValue;
      }
    };

    const [tok0Address, tok1Address] = await Promise.all([this.pool.connect(actor).token0(), this.pool.connect(actor).token1()]);
    const erc20 = await ethers.getContractFactory('TestERC20');

    const tok0 = erc20.attach(tok0Address) as any as TestERC20;
    const tok1 = erc20.attach(tok1Address) as any as TestERC20;

    const doTrade = async () => {
      /** If we want to push price down, we need to increase tok0.
         If we want to push price up, we need to increase tok1 */

      const amountIn = 5n * 10n ** 16n;

      const erc20Helper = new ERC20Helper();
      await erc20Helper.ensureBalancesAndApprovals(actor, [tok0, tok1], amountIn, await this.router.getAddress());

      const path = encodePath(MAKE_TICK_GO_UP ? [tok1Address, tok0Address] : [tok0Address, tok1Address]);

      await this.router.connect(actor).exactInput(
        {
          recipient: actor.address,
          deadline: MaxUint256,
          path,
          amountIn: amountIn / 10n,
          amountOutMinimum: 0,
        },
        maxGas
      );
      let currTick = await getCurrentTick(this.pool.connect(actor));
      return currTick;
    };

    let currentTick = await doTrade();

    while (!isDone(currentTick)) {
      currentTick = await doTrade();
    }

    return { currentTick };
  };

  makeSwapGasCHeckFlow: HelperTypes.MakeSwapGasCheck.Command = async (params) => {
    // await tok0.transfer(trader0.address, BNe18(2).mul(params.numberOfTrades))
    // await tok0
    //   .connect(trader0)
    //   .approve(router.address, BNe18(2).mul(params.numberOfTrades))

    const MAKE_TICK_GO_UP = params.direction === 'up';
    const actor = params.trader || this.actors.traderUser0();

    const isDone = (tick: number | undefined) => {
      if (!params.desiredValue) {
        return true;
      } else if (!tick) {
        return false;
      } else if (MAKE_TICK_GO_UP) {
        return tick > params.desiredValue;
      } else {
        return tick < params.desiredValue;
      }
    };

    const [tok0Address, tok1Address] = await Promise.all([this.pool.connect(actor).token0(), this.pool.connect(actor).token1()]);
    const erc20 = await ethers.getContractFactory('TestERC20');

    const tok0 = erc20.attach(tok0Address) as any as TestERC20;
    const tok1 = erc20.attach(tok1Address) as any as TestERC20;

    /** If we want to push price down, we need to increase tok0.
    If we want to push price up, we need to increase tok1 */

    const amountIn = params.amountIn ? BNe18(params.amountIn) : BNe18(1);

    const erc20Helper = new ERC20Helper();
    await erc20Helper.ensureBalancesAndApprovals(actor, [tok0, tok1], amountIn, await this.router.getAddress());

    const path = encodePath(MAKE_TICK_GO_UP ? [tok1Address, tok0Address] : [tok0Address, tok1Address]);

    return this.router.connect(actor).exactInput(
      {
        recipient: actor.address,
        deadline: MaxUint256,
        path,
        amountIn: amountIn / 10n,
        amountOutMinimum: 0,
      },
      maxGas
    );
  };
}

export class ERC20Helper {
  ensureBalancesAndApprovals = async (actor: Wallet, tokens: TestERC20 | Array<TestERC20>, balance: bigint, spender?: string) => {
    for (let token of arrayWrap(tokens)) {
      await this.ensureBalance(actor, token, balance);
      if (spender) {
        await this.ensureApproval(actor, token, balance, spender);
      }
    }
  };

  ensureBalance = async (actor: Wallet, token: TestERC20, balance: bigint) => {
    const currentBalance = await token.balanceOf(actor.address);
    if (currentBalance < balance) {
      await token
        // .connect(this.actors.tokensOwner())
        .transfer(actor.address, balance - currentBalance);
    }

    // if (spender) {
    //   await this.ensureApproval(actor, token, balance, spender)
    // }

    return await token.balanceOf(actor.address);
  };

  ensureApproval = async (actor: Wallet, token: TestERC20, balance: bigint, spender: string) => {
    const currentAllowance = await token.allowance(actor.address, spender);
    if (currentAllowance < balance) {
      await token.connect(actor).approve(spender, balance);
    }
  };
}

type IncentiveAdapterFunc = (params: HelperTypes.CreateIncentive.Result) => Promise<ContractParams.IncentiveKey>;

export const incentiveResultToFarmAdapter: IncentiveAdapterFunc = async (params: any) => ({
  rewardToken: await params.rewardToken.getAddress(),
  bonusRewardToken: await params.bonusRewardToken.getAddress(),
  pool: params.poolAddress,
  nonce: params.nonce,
});
