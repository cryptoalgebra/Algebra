import { ethers } from 'hardhat';
import { Contract, Wallet, MaxUint256 } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { TestERC20, AlgebraEternalFarming, EternalVirtualPool, TestERC20Reentrant } from '../../typechain';
import { mintPosition, AlgebraFixtureType, algebraFixture } from '../shared/fixtures';
import {
  expect,
  getMaxTick,
  getMinTick,
  FeeAmount,
  TICK_SPACINGS,
  blockTimestamp,
  BN,
  BNe18,
  snapshotGasCost,
  ActorFixture,
  makeTimestamps,
  ZERO_ADDRESS,
  encodePriceSqrt,
} from '../shared';
import { provider } from '../shared/provider';
import { HelperCommands, ERC20Helper, incentiveResultToFarmAdapter } from '../helpers';
import { ContractParams } from '../../types/contractParams';
import { createTimeMachine } from '../shared/time';
import { HelperTypes } from '../helpers/types';

describe('unit/EternalFarms', () => {
  let actors: ActorFixture;
  let lpUser0: Wallet;
  let incentiveCreator: Wallet;
  const amountDesired = BNe18(10);
  const totalReward = 10000n;
  const erc20Helper = new ERC20Helper();
  const Time = createTimeMachine();
  let nonce = BN(0);
  let bonusReward = 200n;
  let helpers: HelperCommands;
  let context: AlgebraFixtureType;
  let timestamps: ContractParams.Timestamps;
  let tokenId: string;

  const detachIncentiveIndirectly = async (localNonce: any) => {
    await context.pluginFactory.setFarmingAddress(actors.algebraRootUser().address);

    const incentiveAddress = await context.pluginObj.connect(actors.algebraRootUser()).incentive();

    await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, await context.nft.getAddress());

    const _tokenId = await mintPosition(context.nft.connect(lpUser0), {
      token0: await context.token0.getAddress(),
      token1: await context.token1.getAddress(),
      fee: FeeAmount.MEDIUM,
      tickLower: -120,
      tickUpper: 120,
      recipient: lpUser0.address,
      amount0Desired: amountDesired,
      amount1Desired: amountDesired,
      amount0Min: 0,
      amount1Min: 0,
      deadline: (await blockTimestamp()) + 1000,
    });

    await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, await context.nft.getAddress());
    await helpers.mintFlow({
      lp: lpUser0,
      tokens: [context.token0, context.token1],
    });

    await context.nft.connect(lpUser0).approveForFarming(_tokenId, true, context.farmingCenter);
    await context.farmingCenter.connect(lpUser0).enterFarming(
      {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: localNonce,
      },
      _tokenId
    );

    await context.pluginObj.connect(actors.algebraRootUser()).setIncentive(ZERO_ADDRESS);

    const tick = (await context.poolObj.connect(actors.algebraRootUser()).globalState()).tick;

    await helpers.moveTickTo({ direction: 'down', desiredValue: Number(tick) - 130, trader: actors.farmingDeployer() });

    await context.pluginObj.connect(actors.algebraRootUser()).setIncentive(incentiveAddress);

    await helpers.moveTickTo({ direction: 'up', desiredValue: Number(tick) - 125, trader: actors.farmingDeployer() });

    await context.pluginFactory.setFarmingAddress(context.farmingCenter);

    const virtualPoolFactory = await ethers.getContractFactory('EternalVirtualPool');
    const deactivated = await (virtualPoolFactory.attach(incentiveAddress) as any as EternalVirtualPool).deactivated();
    expect(deactivated).to.be.true;
  };

  before(async () => {
    const wallets = (await ethers.getSigners()) as any as Wallet[];
    actors = new ActorFixture(wallets, provider);
    lpUser0 = actors.lpUser0();
    incentiveCreator = actors.incentiveCreator();
  });

  beforeEach('load fixture', async () => {
    context = await loadFixture(algebraFixture);
    helpers = HelperCommands.fromTestContext(context, actors, provider);
  });

  describe('#onlyFarmingCenter ', () => {
    const dummyKey = {
      rewardToken: ZERO_ADDRESS,
      bonusRewardToken: ZERO_ADDRESS,
      pool: ZERO_ADDRESS,
      nonce: 0,
    };

    it('reverts if not farmingCenter', async () => {
      expect(context.eternalFarming.connect(actors.farmingDeployer()).claimRewardFrom(context.rewardToken, lpUser0.address, lpUser0.address, 100)).to
        .be.revertedWithoutReason;

      expect(context.eternalFarming.connect(actors.farmingDeployer()).enterFarming(dummyKey, 1)).to.be.revertedWithoutReason;

      expect(context.eternalFarming.connect(actors.farmingDeployer()).exitFarming(dummyKey, 1, ZERO_ADDRESS)).to.be.revertedWithoutReason;

      expect(context.eternalFarming.connect(actors.farmingDeployer()).collectRewards(dummyKey, 1, ZERO_ADDRESS)).to.be.revertedWithoutReason;
    });
  });

  describe('#onlyIncentiveMaker', () => {
    const dummyKey = {
      rewardToken: ZERO_ADDRESS,
      bonusRewardToken: ZERO_ADDRESS,
      pool: ZERO_ADDRESS,
      nonce: 0,
    };

    it('reverts if not incentiveMaker', async () => {
      expect(
        context.eternalFarming.connect(actors.farmingDeployer()).createEternalFarming(
          dummyKey,
          {
            reward: 100,
            bonusReward: 100,
            rewardRate: 100,
            bonusRewardRate: 100,
            minimalPositionWidth: 100,
          },
          await context.poolObj.connect(incentiveCreator).plugin()
        )
      ).to.be.revertedWithoutReason;

      expect(context.eternalFarming.connect(actors.farmingDeployer()).deactivateIncentive(dummyKey)).to.be.revertedWithoutReason;

      expect(context.eternalFarming.connect(actors.farmingDeployer()).setRates(dummyKey, 10, 10)).to.be.revertedWithoutReason;
    });
  });

  describe('#setFarmingCenterAddress', async () => {
    beforeEach(async () => {
      context = await loadFixture(algebraFixture);
    });

    it('only administrator', async () => {
      expect(context.eternalFarming.connect(actors.lpUser0()).setFarmingCenterAddress(ZERO_ADDRESS)).to.be.revertedWithoutReason;
    });

    it('cannot set the same farming center', async () => {
      expect(context.eternalFarming.connect(actors.wallets[0]).setFarmingCenterAddress(context.farmingCenter)).to.be.revertedWithoutReason;
    });

    it('can set new farming center', async () => {
      await context.eternalFarming.connect(actors.wallets[0]).setFarmingCenterAddress(ZERO_ADDRESS);
      expect(await context.eternalFarming.farmingCenter()).to.be.eq(ZERO_ADDRESS);
    });
  });

  describe('#EmergencyWithdraw', async () => {
    beforeEach(async () => {
      context = await loadFixture(algebraFixture);
    });

    it('only administrator', async () => {
      expect(context.eternalFarming.connect(actors.lpUser0()).setEmergencyWithdrawStatus(true)).to.be.revertedWithoutReason;
    });

    it('cannot set the current value', async () => {
      expect(context.eternalFarming.connect(actors.wallets[0]).setEmergencyWithdrawStatus(false)).to.be.revertedWithoutReason;
    });

    it('can set new value', async () => {
      await context.eternalFarming.connect(actors.wallets[0]).setEmergencyWithdrawStatus(true);
      expect(await context.eternalFarming.isEmergencyWithdrawActivated()).to.be.eq(true);
    });

    it('can not enter in farming if emergency', async () => {
      const helpers = HelperCommands.fromTestContext(context, actors, provider);

      const localNonce = await context.eternalFarming.numOfIncentives();

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, await context.nft.getAddress());

      tokenId = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      });

      const incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      };

      const incentiveId = await helpers.getIncentiveId(await helpers.createIncentiveFlow(incentiveArgs));

      await context.eternalFarming.connect(actors.wallets[0]).setEmergencyWithdrawStatus(true);
      await context.nft.connect(lpUser0).approveForFarming(tokenId, true, context.farmingCenter);

      await expect(
        context.farmingCenter.connect(lpUser0).enterFarming(
          {
            pool: context.pool01,
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            nonce: localNonce,
          },
          tokenId
        )
      ).to.be.revertedWithCustomError(context.eternalFarming, 'emergencyActivated');
    });

    it('can exit from farming if emergency', async () => {
      const helpers = HelperCommands.fromTestContext(context, actors, provider);

      const localNonce = await context.eternalFarming.numOfIncentives();

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, await context.nft.getAddress());

      tokenId = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      });

      const incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      };

      const incentiveId = await helpers.getIncentiveId(await helpers.createIncentiveFlow(incentiveArgs));

      await context.nft.connect(lpUser0).approveForFarming(tokenId, true, context.farmingCenter);

      await context.farmingCenter.connect(lpUser0).enterFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: localNonce,
        },
        tokenId
      );

      await context.eternalFarming.connect(actors.wallets[0]).setEmergencyWithdrawStatus(true);

      await context.farmingCenter.connect(lpUser0).exitFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: localNonce,
        },
        tokenId
      );
    });
  });

  describe('#isIncentiveDeactivated', async () => {
    let localNonce = 0n;
    let incentiveArgs;
    let incentiveId: string;

    beforeEach(async () => {
      context = await loadFixture(algebraFixture);
      helpers = HelperCommands.fromTestContext(context, actors, provider);

      localNonce = await context.eternalFarming.numOfIncentives();

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, await context.nft.getAddress());

      tokenId = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      });

      incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      };

      incentiveId = await helpers.getIncentiveId(await helpers.createIncentiveFlow(incentiveArgs));
    });

    it('false if incentive active', async () => {
      expect(await context.eternalFarming.isIncentiveDeactivated(incentiveId)).to.be.false;
    });

    it('true if incentive deactivated', async () => {
      await context.eternalFarming.connect(incentiveCreator).deactivateIncentive({
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: localNonce,
      });
      expect(await context.eternalFarming.isIncentiveDeactivated(incentiveId)).to.be.true;
    });

    it('true if incentive deactivated indirectly', async () => {
      await detachIncentiveIndirectly(localNonce);

      expect(await context.eternalFarming.isIncentiveDeactivated(incentiveId)).to.be.true;
    });
  });

  describe('#createEternalFarming', () => {
    let localNonce = 0n;

    beforeEach(async () => {
      context = await loadFixture(algebraFixture);
      helpers = HelperCommands.fromTestContext(context, actors, provider);

      /** We will be doing a lot of time-testing here, so leave some room between
        and when the incentive starts */
      localNonce = await context.eternalFarming.numOfIncentives();
    });

    it('cannot create farming without rewards', async () => {
      const incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward: 0n,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      };

      await expect(helpers.createIncentiveFlow(incentiveArgs)).to.be.revertedWithCustomError(
        context.eternalFarming as AlgebraEternalFarming,
        'zeroRewardAmount'
      );
    });

    it('cannot create farming if plugin is not connected', async () => {
      await context.poolObj.connect(actors.wallets[0]).setPlugin(ZERO_ADDRESS);
      const incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward: 10n,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      };

      await expect(helpers.createIncentiveFlow(incentiveArgs)).to.be.revertedWithCustomError(
        context.eternalFarming as AlgebraEternalFarming,
        'pluginNotConnected'
      );
    });

    it('cannot create farming if incorrect plugin is connected', async () => {
      await context.poolObj.connect(actors.wallets[0]).setPlugin(actors.wallets[1].address);
      const incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward: 10n,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        rewardRate: 10n,
        bonusRewardRate: 50n,
        plugin: actors.wallets[0].address,
      };

      await expect(helpers.createIncentiveFlow(incentiveArgs)).to.be.revertedWithCustomError(
        context.eternalFarming as AlgebraEternalFarming,
        'pluginNotConnected'
      );
    });

    it('cannot set too wide minimal position width', async () => {
      const incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        minimalPositionWidth: 2 ** 24 - 1,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      };

      await expect(helpers.createIncentiveFlow(incentiveArgs)).to.be.revertedWithCustomError(
        context.eternalFarming as AlgebraEternalFarming,
        'minimalPositionWidthTooWide'
      );
    });

    it('cannot create second eternal farming for one pool', async () => {
      const incentiveArgsBase = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      };

      await helpers.createIncentiveFlow(incentiveArgsBase);

      const incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce + 1n,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      };

      await expect(helpers.createIncentiveFlow(incentiveArgs)).to.be.revertedWithCustomError(
        context.eternalFarming as AlgebraEternalFarming,
        'anotherFarmingIsActive'
      );
    });
  });

  describe('#enterFarming', () => {
    let incentiveId: string;
    let incentiveArgs: HelperTypes.CreateIncentive.Args;
    let subject: (L2TokenId: string, _actor: Wallet) => Promise<any>;
    let localNonce = 0n;

    beforeEach(async () => {
      context = await loadFixture(algebraFixture);
      helpers = HelperCommands.fromTestContext(context, actors, provider);

      localNonce = await context.eternalFarming.numOfIncentives();

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, await context.nft.getAddress());

      tokenId = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      });

      incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      };

      incentiveId = await helpers.getIncentiveId(await helpers.createIncentiveFlow(incentiveArgs));

      await context.nft.connect(lpUser0).approveForFarming(tokenId, true, context.farmingCenter);
      subject = (L2TokenId: string, _actor: Wallet) =>
        context.farmingCenter.connect(_actor).enterFarming(
          {
            pool: context.pool01,
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            nonce: localNonce,
          },
          L2TokenId
        );
    });

    describe('increaseLiqudity', () => {
      it('liquidity updated correct', async () => {
        await subject(tokenId, lpUser0);
        await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, await context.nft.getAddress());

        let farmBefore = await context.eternalFarming.farms(tokenId, incentiveId);
        await context.nft.connect(lpUser0).increaseLiquidity({
          tokenId: tokenId,
          amount0Desired: amountDesired,
          amount1Desired: amountDesired,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        });
        let farmAfter = await context.eternalFarming.farms(tokenId, incentiveId);
        expect(farmAfter.liquidity - farmBefore.liquidity).to.eq(amountDesired);
      });
    });

    describe('works and', () => {
      it('emits the farm event', async () => {
        const { liquidity } = await context.nft.positions(tokenId);
        await expect(subject(tokenId, lpUser0)).to.emit(context.eternalFarming, 'FarmEntered').withArgs(tokenId, incentiveId, liquidity);
      });

      it('sets the farm struct properly', async () => {
        const liquidity = (await context.nft.positions(tokenId)).liquidity;

        const farmBefore = await context.eternalFarming.farms(tokenId, incentiveId);
        await subject(tokenId, lpUser0);
        const farmAfter = await context.eternalFarming.farms(tokenId, incentiveId);

        expect(farmBefore.liquidity).to.eq(0);
        expect(farmAfter.liquidity).to.eq(liquidity);
      });

      it('has gas cost [ @skip-on-coverage ]', async () => await snapshotGasCost(subject(tokenId, lpUser0)));
    });

    describe('fails when', () => {
      it('deposit is already farmd in the incentive', async () => {
        await subject(tokenId, lpUser0);
        await expect(subject(tokenId, lpUser0)).to.be.revertedWith('Token already farmed');
      });

      it('trying to forcefully enter twice', async () => {
        await subject(tokenId, lpUser0);
        await context.eternalFarming.connect(actors.wallets[0]).setFarmingCenterAddress(lpUser0);

        await expect(
          context.eternalFarming.connect(lpUser0).enterFarming(
            {
              pool: context.pool01,
              rewardToken: context.rewardToken,
              bonusRewardToken: context.bonusRewardToken,
              nonce: localNonce,
            },
            tokenId
          )
        ).to.be.revertedWithCustomError(context.eternalFarming, 'tokenAlreadyFarmed');
      });

      it('farming deactivated', async () => {
        await context.eternalFarming.connect(incentiveCreator).deactivateIncentive({
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: localNonce,
        });
        await expect(subject(tokenId, lpUser0)).to.be.revertedWithCustomError(context.eternalFarming, 'incentiveStopped');
      });

      it('farming indirectly deactivated', async () => {
        await detachIncentiveIndirectly(localNonce);

        await expect(subject(tokenId, lpUser0)).to.be.revertedWithCustomError(context.eternalFarming, 'incentiveStopped');
      });

      it('you are not the owner of the deposit', async () => {
        // lpUser2 calls, we're using lpUser0 elsewhere.
        await expect(subject(tokenId, actors.lpUser2())).to.be.revertedWith('Not approved for token');
      });

      it('has 0 liquidity in the position', async () => {
        await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, await context.nft.getAddress());

        const tokenId2 = await mintPosition(context.nft.connect(lpUser0), {
          token0: await context.token0.getAddress(),
          token1: await context.token1.getAddress(),
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: lpUser0.address,
          amount0Desired: amountDesired,
          amount1Desired: amountDesired,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        });

        await context.nft.connect(lpUser0).approveForFarming(tokenId2, true, context.farmingCenter);

        await context.nft.connect(lpUser0).decreaseLiquidity({
          tokenId: tokenId2,
          liquidity: (await context.nft.positions(tokenId2)).liquidity,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1_000,
        });
        await expect(subject(tokenId2, lpUser0)).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'zeroLiquidity');
      });

      it('token id is for a different pool than the incentive', async () => {
        const incentive2 = await helpers.createIncentiveFlow({
          ...incentiveArgs,
          poolAddress: context.pool12,
        });
        const { tokenId: otherTokenId } = await helpers.mintFlow({
          lp: lpUser0,
          tokens: [context.token1, context.rewardToken],
        });

        await helpers.depositFlow({
          lp: lpUser0,
          tokenId: otherTokenId,
        });

        await expect(
          context.farmingCenter.connect(lpUser0).enterFarming(
            {
              pool: context.pool01,
              rewardToken: context.rewardToken,
              bonusRewardToken: context.bonusRewardToken,
              nonce: localNonce,
            },
            otherTokenId
          )
        ).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'invalidPool');
      });

      it('incentive key does not exist', async () => {
        const _nonce = BN(999);
        await expect(
          context.farmingCenter.connect(lpUser0).enterFarming(
            {
              pool: context.pool01,
              rewardToken: context.rewardToken,
              bonusRewardToken: context.bonusRewardToken,
              nonce: _nonce,
            },
            tokenId
          )
        ).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'incentiveNotExist');
      });
    });
  });

  describe('#getRewardInfo', () => {
    let incentiveId: string;
    let farmIncentiveKey: ContractParams.IncentiveKey;

    beforeEach('set up incentive and farm', async () => {
      timestamps = makeTimestamps((await blockTimestamp()) + 1_000);

      const mintResult = await helpers.mintFlow({
        lp: lpUser0,
        tokens: [context.token0, context.token1],
      });
      tokenId = mintResult.tokenId;

      farmIncentiveKey = {
        rewardToken: await context.rewardToken.getAddress(),
        bonusRewardToken: await context.bonusRewardToken.getAddress(),
        pool: context.pool01,
        nonce: 0,
      };

      incentiveId = await helpers.getIncentiveId(
        await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: await context.poolObj.getAddress(),
          nonce: 0n,
          rewardRate: 10n,
          bonusRewardRate: 50n,
        })
      );

      await context.nft.connect(lpUser0).approveForFarming(tokenId, true, context.farmingCenter);
      await context.farmingCenter.connect(lpUser0).enterFarming(farmIncentiveKey, tokenId);
      await context.eternalFarming.farms(tokenId, incentiveId);
    });

    it('returns correct rewardAmount and secondsInsideX128 for the position', async () => {
      const pool = context.poolObj.connect(actors.lpUser0());

      await Time.set(timestamps.startTime + 10);
      //await provider.send('evm_mine', [timestamps.startTime + 100])
      const trader = actors.traderUser0();
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 10,
      });

      await Time.set(timestamps.endTime - 10);

      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 100,
      });

      await Time.set(timestamps.endTime + 10);

      const rewardInfo = await context.eternalFarming.connect(lpUser0).getRewardInfo(farmIncentiveKey, tokenId);

      const { tickLower, tickUpper } = await context.nft.positions(tokenId);
      const farm = await context.eternalFarming.farms(tokenId, incentiveId);

      // @ts-ignore
      expect(rewardInfo.reward).to.be.closeTo(BN('9900'), BN('10000'));
      //expect(rewardInfo.secondsInsideX128).to.equal(expectedSecondsInPeriod)
    });

    it('reverts if farm does not exist', async () => {
      // await Time.setAndMine(timestamps.endTime + 1)

      await expect(context.eternalFarming.connect(lpUser0).getRewardInfo(farmIncentiveKey, '100')).to.be.revertedWithCustomError(
        context.eternalFarming as AlgebraEternalFarming,
        'farmDoesNotExist'
      );
    });
  });

  describe('#decreaseRewards', () => {
    let incentiveArgs: HelperTypes.CreateIncentive.Args;
    let incentiveKey: ContractParams.IncentiveKey;
    let virtualPool: EternalVirtualPool;

    let factoryOwner: Wallet;

    beforeEach('set up incentive and farm', async () => {
      factoryOwner = actors.wallets[0];
      incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.pool01,
        nonce: 0n,
        rewardRate: 10000n,
        bonusRewardRate: 50000n,
      };

      incentiveKey = {
        nonce: 0n,
        rewardToken: await context.rewardToken.getAddress(),
        bonusRewardToken: await context.bonusRewardToken.getAddress(),

        pool: context.pool01,
      };

      const vpFactory = await ethers.getContractFactory('EternalVirtualPool');
      const createIncentiveResult = await helpers.createIncentiveFlow(incentiveArgs);
      const _vpool = createIncentiveResult.virtualPool;
      virtualPool = vpFactory.attach(_vpool) as any as EternalVirtualPool;
    });

    it('onlyOwner', async () => {
      expect(context.eternalFarming.connect(lpUser0).decreaseRewardsAmount(incentiveKey, 100, 100)).to.be.revertedWithoutReason;
    });

    it('can decrease rewards before start', async () => {
      await expect(context.eternalFarming.connect(factoryOwner).decreaseRewardsAmount(incentiveKey, 100, 100))
        .to.emit(context.rewardToken, 'Transfer')
        .withArgs(await context.eternalFarming.getAddress(), factoryOwner.address, 100)
        .to.emit(context.bonusRewardToken, 'Transfer')
        .withArgs(await context.eternalFarming.getAddress(), factoryOwner.address, 100)
        .to.emit(context.eternalFarming, 'RewardAmountsDecreased');

      const reserves = await virtualPool.rewardReserves();

      expect(reserves[0]).to.be.eq(totalReward - 100n);
      expect(reserves[1]).to.be.eq(bonusReward - 100n);
    });

    it('can decrease only main reward', async () => {
      await expect(context.eternalFarming.connect(factoryOwner).decreaseRewardsAmount(incentiveKey, 100, 0))
        .to.emit(context.eternalFarming, 'RewardAmountsDecreased')
        .to.emit(context.rewardToken, 'Transfer')
        .withArgs(await context.eternalFarming.getAddress(), factoryOwner.address, 100)
        .to.not.emit(context.bonusRewardToken, 'Transfer');

      const reserves = await virtualPool.rewardReserves();

      expect(reserves[0]).to.be.eq(totalReward - 100n);
      expect(reserves[1]).to.be.eq(bonusReward);
    });

    it('can decrease only bonus reward', async () => {
      await expect(context.eternalFarming.connect(factoryOwner).decreaseRewardsAmount(incentiveKey, 0, 100))
        .to.emit(context.eternalFarming, 'RewardAmountsDecreased')
        .to.emit(context.bonusRewardToken, 'Transfer')
        .withArgs(await context.eternalFarming.getAddress(), factoryOwner.address, 100)
        .to.not.emit(context.rewardToken, 'Transfer');

      const reserves = await virtualPool.rewardReserves();

      expect(reserves[0]).to.be.eq(totalReward);
      expect(reserves[1]).to.be.eq(bonusReward - 100n);
    });

    it('cannot exceed reserves', async () => {
      await expect(context.eternalFarming.connect(factoryOwner).decreaseRewardsAmount(incentiveKey, totalReward + 1n, bonusReward + 1n))
        .to.emit(context.rewardToken, 'Transfer')
        .withArgs(await context.eternalFarming.getAddress(), factoryOwner.address, totalReward - 1n)
        .to.emit(context.bonusRewardToken, 'Transfer')
        .withArgs(await context.eternalFarming.getAddress(), factoryOwner.address, bonusReward)
        .to.emit(context.eternalFarming, 'RewardAmountsDecreased');
    });

    it('max uint128', async () => {
      await expect(context.eternalFarming.connect(factoryOwner).decreaseRewardsAmount(incentiveKey, 2n ** 128n - 1n, 2n ** 128n - 1n))
        .to.emit(context.rewardToken, 'Transfer')
        .withArgs(await context.eternalFarming.getAddress(), factoryOwner.address, totalReward - 1n)
        .to.emit(context.bonusRewardToken, 'Transfer')
        .withArgs(await context.eternalFarming.getAddress(), factoryOwner.address, bonusReward)
        .to.emit(context.eternalFarming, 'RewardAmountsDecreased');
    });

    it('decrease with 0 amount', async () => {
      await expect(context.eternalFarming.connect(factoryOwner).decreaseRewardsAmount(incentiveKey, 0, 0));
    });
  });

  describe('#deactivate incentive', () => {
    let incentiveArgs: HelperTypes.CreateIncentive.Args;
    let incentiveKey: ContractParams.IncentiveKey;
    let virtualPool: EternalVirtualPool;
    let virtualPoolAddress: string;

    let localNonce = 0n;

    let factoryOwner: Wallet;

    beforeEach('set up incentive and farm', async () => {
      localNonce = await context.eternalFarming.numOfIncentives();
      factoryOwner = actors.wallets[0];
      incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.pool01,
        nonce: localNonce,
        rewardRate: 10000n,
        bonusRewardRate: 50000n,
      };

      incentiveKey = {
        nonce: localNonce,
        rewardToken: await context.rewardToken.getAddress(),
        bonusRewardToken: await context.bonusRewardToken.getAddress(),

        pool: context.pool01,
      };

      const vpFactory = await ethers.getContractFactory('EternalVirtualPool');
      const createIncentiveResult = await helpers.createIncentiveFlow(incentiveArgs);
      const _vpool = createIncentiveResult.virtualPool;
      virtualPool = vpFactory.attach(_vpool) as any as EternalVirtualPool;
      virtualPoolAddress = await virtualPool.getAddress();
    });

    it('deactivate incentive', async () => {
      let activeIncentiveBefore = await context.pluginObj.incentive();

      await context.eternalFarming.connect(incentiveCreator).deactivateIncentive(incentiveKey);
      let activeIncentiveAfter = await context.pluginObj.incentive();

      expect(activeIncentiveBefore).to.equal(await virtualPool.getAddress());
      expect(activeIncentiveAfter).to.equal(ZERO_ADDRESS);

      const rewardRates = await virtualPool.rewardRates();

      expect(rewardRates[0]).to.be.eq(0);
      expect(rewardRates[1]).to.be.eq(0);
    });

    it('deactivate incentive with zero rates', async () => {
      let activeIncentiveBefore = await context.pluginObj.incentive();

      await context.eternalFarming.connect(incentiveCreator).setRates(incentiveKey, 0, 0);

      await context.eternalFarming.connect(incentiveCreator).deactivateIncentive(incentiveKey);
      let activeIncentiveAfter = await context.pluginObj.incentive();

      expect(activeIncentiveBefore).to.equal(virtualPoolAddress);
      expect(activeIncentiveAfter).to.equal(ZERO_ADDRESS);

      const rewardRates = await virtualPool.rewardRates();

      expect(rewardRates[0]).to.be.eq(0);
      expect(rewardRates[1]).to.be.eq(0);
    });

    it('deactivate incentive only incentiveMaker', async () => {
      let activeIncentiveBefore = await context.pluginObj.incentive();

      expect(context.eternalFarming.connect(lpUser0).deactivateIncentive(incentiveKey)).to.be.revertedWithoutReason;
      let activeIncentiveAfter = await context.pluginObj.incentive();

      expect(activeIncentiveBefore).to.equal(virtualPoolAddress);
      expect(activeIncentiveAfter).to.equal(virtualPoolAddress);
    });

    it('cannot deactivate twice', async () => {
      await context.eternalFarming.connect(incentiveCreator).deactivateIncentive(incentiveKey);
      await expect(context.eternalFarming.connect(incentiveCreator).deactivateIncentive(incentiveKey)).to.be.revertedWithCustomError(
        context.eternalFarming,
        'incentiveStopped'
      );
    });

    it('cannot deactivate nonexistent incentive', async () => {
      const invalidKey = { ...incentiveKey };
      invalidKey.nonce = 999;
      await expect(context.eternalFarming.connect(incentiveCreator).deactivateIncentive(invalidKey)).to.be.revertedWithCustomError(
        context.eternalFarming,
        'incentiveNotExist'
      );
    });

    it('can deactivate manually after indirect deactivation', async () => {
      await detachIncentiveIndirectly(localNonce);
      await expect(context.eternalFarming.connect(incentiveCreator).deactivateIncentive(incentiveKey)).to.not.be.reverted;
    });

    it('can deactivate manually after indirect deactivation and exit', async () => {
      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, await context.nft.getAddress());

      const tokenIdNarrow = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: 120,
        tickUpper: 180,
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      });

      await helpers.depositFlow({
        lp: lpUser0,
        tokenId: tokenIdNarrow,
      });

      await context.farmingCenter.connect(lpUser0).enterFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: localNonce,
        },
        tokenIdNarrow
      );

      const incentiveAddress = await context.pluginObj.connect(actors.algebraRootUser()).incentive();
      const virtualPoolFactory = await ethers.getContractFactory('EternalVirtualPool');
      const virtualPool = virtualPoolFactory.attach(incentiveAddress) as any as EternalVirtualPool;

      expect(await virtualPool.deactivated()).to.be.false;
      const incentiveId = await helpers.getIncentiveId({
        poolAddress: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        virtualPool: virtualPool as any as Contract,
        nonce: localNonce,
        bonusReward: 0n,
        totalReward: 0n,
      });
      expect((await context.eternalFarming.incentives(incentiveId)).deactivated).to.be.false;

      await detachIncentiveIndirectly(localNonce);

      await context.farmingCenter.connect(lpUser0).exitFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: localNonce,
        },
        tokenIdNarrow
      );

      expect(await virtualPool.deactivated()).to.be.true;
      expect((await context.eternalFarming.incentives(incentiveId)).deactivated).to.be.false;

      await expect(context.eternalFarming.connect(incentiveCreator).deactivateIncentive(incentiveKey)).to.not.be.reverted;

      expect(await virtualPool.deactivated()).to.be.true;
      expect((await context.eternalFarming.incentives(incentiveId)).deactivated).to.be.true;
    });

    it('can deactivate manually if farming detached manually from plugin', async () => {
      await context.pluginFactory.setFarmingAddress(incentiveCreator.address);
      await context.pluginObj.connect(incentiveCreator).setIncentive(ZERO_ADDRESS);

      await expect(context.eternalFarming.connect(incentiveCreator).deactivateIncentive(incentiveKey)).to.not.be.reverted;
    });

    it('cross lower after deactivate', async () => {
      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired * 2n, await context.nft.getAddress());

      await erc20Helper.ensureBalancesAndApprovals(
        incentiveCreator,
        [context.rewardToken, context.bonusRewardToken],
        BNe18(1),
        await context.eternalFarming.getAddress()
      );

      await context.eternalFarming.connect(incentiveCreator).addRewards(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce: 0,
        },
        BNe18(1),
        BNe18(1)
      );

      const tokenIdWide = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      });

      const tokenIdNarrow = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: 120,
        tickUpper: 180,
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      });

      await helpers.depositFlow({
        lp: lpUser0,
        tokenId: tokenIdWide,
      });

      await context.farmingCenter.connect(lpUser0).enterFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: 0,
        },
        tokenIdWide
      );

      await helpers.depositFlow({
        lp: lpUser0,
        tokenId: tokenIdNarrow,
      });

      await context.farmingCenter.connect(lpUser0).enterFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: 0,
        },
        tokenIdNarrow
      );

      await helpers.moveTickTo({ direction: 'up', desiredValue: 150, trader: actors.farmingDeployer() });

      await context.eternalFarming.connect(incentiveCreator).deactivateIncentive(incentiveKey);

      await helpers.moveTickTo({ direction: 'down', desiredValue: -200, trader: actors.farmingDeployer() });

      await context.farmingCenter.connect(lpUser0).collectRewards(incentiveKey, tokenIdNarrow);
      let rewards = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
      let bonusRewards = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);
      let vpTick = await virtualPool.globalTick();
      expect(rewards).to.eq(9970);
      expect(bonusRewards).to.eq(49851);
      expect(vpTick).to.eq(150);
    });

    it('cross upper after deactivate', async () => {
      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired * 2n, await context.nft.getAddress());

      await erc20Helper.ensureBalancesAndApprovals(
        incentiveCreator,
        [context.rewardToken, context.bonusRewardToken],
        BNe18(1),
        await context.eternalFarming.getAddress()
      );

      await context.eternalFarming.connect(incentiveCreator).addRewards(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce: 0,
        },
        BNe18(1),
        BNe18(1)
      );

      const tokenIdWide = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      });

      const tokenIdNarrow = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: -180,
        tickUpper: -120,
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      });

      await helpers.depositFlow({
        lp: lpUser0,
        tokenId: tokenIdWide,
      });

      await context.farmingCenter.connect(lpUser0).enterFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: 0,
        },
        tokenIdWide
      );

      await helpers.depositFlow({
        lp: lpUser0,
        tokenId: tokenIdNarrow,
      });

      await context.farmingCenter.connect(lpUser0).enterFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: 0,
        },
        tokenIdNarrow
      );

      await helpers.moveTickTo({ direction: 'down', desiredValue: -150, trader: actors.farmingDeployer() });

      await context.eternalFarming.connect(incentiveCreator).deactivateIncentive(incentiveKey);

      await helpers.moveTickTo({ direction: 'up', desiredValue: 200, trader: actors.farmingDeployer() });

      await context.farmingCenter.connect(lpUser0).collectRewards(incentiveKey, tokenIdNarrow);
      let rewards = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
      let bonusRewards = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);
      let vpTick = await virtualPool.globalTick();
      expect(rewards).to.eq(9970);
      expect(bonusRewards).to.eq(49851);
      expect(vpTick).to.eq(-150);
    });
  });

  describe('#claimReward', () => {
    let createIncentiveResult: HelperTypes.CreateIncentive.Result;
    let subject: (token: string | TestERC20, to: string, amount: bigint) => Promise<any>;
    // The amount the user should be able to claim
    let claimable: bigint;
    let localNonce = 0n;

    beforeEach('setup', async () => {
      timestamps = makeTimestamps(await blockTimestamp());
      const tokensToFarm = [context.token0, context.token1] as [TestERC20, TestERC20];

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, tokensToFarm, amountDesired, await context.nft.getAddress());

      localNonce = await context.eternalFarming.numOfIncentives();

      createIncentiveResult = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      });

      await Time.setAndMine(timestamps.startTime + 1);

      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult,
      });
      tokenId = mintResult.tokenId;

      await Time.setAndMine(timestamps.endTime + 10);
      await context.farmingCenter.connect(lpUser0).exitFarming(
        {
          rewardToken: await context.rewardToken.getAddress(),
          bonusRewardToken: await context.bonusRewardToken.getAddress(),
          pool: context.pool01,
          nonce: localNonce,
        },
        tokenId
      );

      claimable = await context.eternalFarming.rewards(lpUser0.address, await context.rewardToken.getAddress());

      subject = (_token: string | TestERC20, _to: string, _amount: bigint) =>
        context.eternalFarming.connect(lpUser0).claimReward(_token, _to, _amount);
    });

    describe('when requesting the full amount', () => {
      it('emits RewardClaimed event', async () => {
        const { rewardToken } = context;
        claimable = await context.eternalFarming.rewards(lpUser0.address, rewardToken);
        await expect(subject(rewardToken, lpUser0.address, BN('0')))
          .to.emit(context.eternalFarming, 'RewardClaimed')
          .withArgs(lpUser0.address, claimable, await context.rewardToken.getAddress(), lpUser0.address);
      });

      it('transfers the correct reward amount to destination address', async () => {
        const { rewardToken } = context;
        claimable = await context.eternalFarming.rewards(lpUser0.address, rewardToken);
        const balance = await rewardToken.balanceOf(lpUser0.address);
        await subject(rewardToken, lpUser0.address, BN('0'));
        expect(await rewardToken.balanceOf(lpUser0.address)).to.equal(balance + claimable);
      });

      it('sets the claimed reward amount to zero', async () => {
        const { rewardToken } = context;
        expect(await context.eternalFarming.rewards(lpUser0.address, rewardToken)).to.not.equal(0);

        await subject(rewardToken, lpUser0.address, BN('0'));

        expect(await context.eternalFarming.rewards(lpUser0.address, rewardToken)).to.equal(0);
      });

      it('has gas cost [ @skip-on-coverage ]', async () =>
        await snapshotGasCost(subject(await context.rewardToken.getAddress(), lpUser0.address, BN('0'))));

      it('returns their claimable amount', async () => {
        const { rewardToken, eternalFarming } = context;
        const amountBefore = await rewardToken.balanceOf(lpUser0.address);
        await subject(rewardToken, lpUser0.address, BN('0'));
        expect(await eternalFarming.rewards(lpUser0.address, rewardToken)).to.eq(BN('0'));
        expect(await rewardToken.balanceOf(lpUser0.address)).to.eq(amountBefore + claimable);
      });
    });

    describe('when requesting a nonzero amount', () => {
      it('emits RewardClaimed event', async () => {
        const { rewardToken } = context;
        await expect(subject(rewardToken, lpUser0.address, claimable))
          .to.emit(context.eternalFarming, 'RewardClaimed')
          .withArgs(lpUser0.address, claimable, await context.rewardToken.getAddress(), lpUser0.address);
      });

      it('transfers the correct reward amount to destination address', async () => {
        const { rewardToken } = context;
        claimable = await context.eternalFarming.rewards(lpUser0.address, rewardToken);
        const balance = await rewardToken.balanceOf(lpUser0.address);
        await subject(rewardToken, lpUser0.address, claimable);
        expect(await rewardToken.balanceOf(lpUser0.address)).to.equal(balance + claimable);
      });

      it('reverts if transfer to zero', async () => {
        const { rewardToken } = context;
        claimable = await context.eternalFarming.rewards(lpUser0.address, rewardToken);
        await expect(subject(rewardToken, ZERO_ADDRESS, claimable)).to.be.revertedWithCustomError(context.eternalFarming, 'claimToZeroAddress');
      });

      it('sets the claimed reward amount to the correct amount', async () => {
        const { rewardToken, eternalFarming } = context;
        const initialRewardBalance = await eternalFarming.rewards(lpUser0.address, rewardToken);
        expect(initialRewardBalance).to.not.equal(BN('0'));

        const partialClaim = initialRewardBalance / BN('3');
        await subject(rewardToken, lpUser0.address, partialClaim);

        expect(await eternalFarming.rewards(lpUser0.address, rewardToken)).to.eq(initialRewardBalance - partialClaim);
      });

      it('not emit event if nothing to claim', async () => {
        const { rewardToken } = context;
        await expect(context.eternalFarming.connect(actors.lpUser2()).claimReward(rewardToken, actors.lpUser2().address, 100n)).to.not.emit(
          context.eternalFarming,
          'RewardClaimed'
        );
      });

      describe('when user claims more than they have', () => {
        it('only transfers what they have', async () => {
          const { rewardToken, eternalFarming } = context;
          const amountBefore = await rewardToken.balanceOf(lpUser0.address);
          await subject(rewardToken, lpUser0.address, claimable * 3n);
          expect(await eternalFarming.rewards(lpUser0.address, rewardToken)).to.eq(BN('0'));
          expect(await rewardToken.balanceOf(lpUser0.address)).to.eq(amountBefore + claimable);
        });
      });
    });
  });

  describe('#collectRewards', async () => {
    let createIncentiveResult: HelperTypes.CreateIncentive.Result;
    let localNonce = 0n;

    beforeEach('setup', async () => {
      timestamps = makeTimestamps(await blockTimestamp());
      const tokensToFarm = [context.token0, context.token1] as [TestERC20, TestERC20];

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, tokensToFarm, amountDesired, await context.nft.getAddress());

      localNonce = await context.eternalFarming.numOfIncentives();

      createIncentiveResult = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      });

      await Time.setAndMine(timestamps.startTime + 1);

      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult,
      });
      tokenId = mintResult.tokenId;

      await Time.setAndMine(timestamps.endTime + 10);

      await context.eternalFarming.connect(actors.wallets[0]).setFarmingCenterAddress(lpUser0);
    });

    it('cannot collect from nonexistent farm', async () => {
      const invalidTokenId = 9999n;
      await expect(
        context.eternalFarming.connect(lpUser0).collectRewards(
          {
            rewardToken: await context.rewardToken.getAddress(),
            bonusRewardToken: await context.bonusRewardToken.getAddress(),
            pool: context.pool01,
            nonce: localNonce,
          },
          invalidTokenId,
          lpUser0.address
        )
      ).to.be.revertedWithCustomError(context.eternalFarming, 'farmDoesNotExist');
    });

    it('do not update rewards if nothing to collect', async () => {
      await context.eternalFarming.connect(lpUser0).collectRewards(
        {
          rewardToken: await context.rewardToken.getAddress(),
          bonusRewardToken: await context.bonusRewardToken.getAddress(),
          pool: context.pool01,
          nonce: localNonce,
        },
        tokenId,
        lpUser0.address
      );

      const rewardTokenBalanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
      const bonusRewardTokenBalanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);

      await context.eternalFarming.connect(lpUser0).collectRewards(
        {
          rewardToken: await context.rewardToken.getAddress(),
          bonusRewardToken: await context.bonusRewardToken.getAddress(),
          pool: context.pool01,
          nonce: localNonce,
        },
        tokenId,
        lpUser0.address
      );

      const rewardTokenBalanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
      const bonusRewardTokenBalanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);

      expect(rewardTokenBalanceAfter).to.be.eq(rewardTokenBalanceBefore);
      expect(bonusRewardTokenBalanceAfter).to.be.eq(bonusRewardTokenBalanceBefore);
    });
  });

  describe('#exitFarming', () => {
    let incentiveId: string;
    let subject: (actor: Wallet) => Promise<any>;
    let createIncentiveResult: HelperTypes.CreateIncentive.Result;

    let localNonce = 0n;

    describe('before end time', () => {
      it('can exitFarming', async () => {
        timestamps = makeTimestamps(await blockTimestamp());

        localNonce = await context.eternalFarming.numOfIncentives();

        createIncentiveResult = await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: await context.poolObj.getAddress(),
          nonce: localNonce,
          rewardRate: 10n,
          bonusRewardRate: 50n,
        });

        await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, await context.nft.getAddress());

        tokenId = await mintPosition(context.nft.connect(lpUser0), {
          token0: context.token0,
          token1: context.token1,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: lpUser0.address,
          amount0Desired: amountDesired,
          amount1Desired: amountDesired,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        });

        // await Time.setAndMine(timestamps.startTime + 1)
        await context.nft.connect(lpUser0).approveForFarming(tokenId, true, context.farmingCenter);

        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            rewardToken: await context.rewardToken.getAddress(),
            bonusRewardToken: await context.bonusRewardToken.getAddress(),
            pool: context.pool01,
            nonce: localNonce,
          },
          tokenId
        );

        incentiveId = await helpers.getIncentiveId(createIncentiveResult);

        await expect(
          context.farmingCenter.connect(actors.lpUser0()).exitFarming(
            {
              pool: context.pool01,
              rewardToken: await context.rewardToken.getAddress(),
              bonusRewardToken: await context.bonusRewardToken.getAddress(),
              nonce: localNonce,
            },
            tokenId
          )
        ).to.be.emit(context.eternalFarming, 'FarmEnded');
      });
    });

    describe('after end time', () => {
      let tokenIdOut: string;
      beforeEach('create the incentive and nft and farm it', async () => {
        timestamps = makeTimestamps(await blockTimestamp());

        localNonce = await context.eternalFarming.numOfIncentives();

        createIncentiveResult = await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: await context.poolObj.getAddress(),
          nonce: localNonce,
          rewardRate: 10n,
          bonusRewardRate: 50n,
        });

        await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired * 3n, await context.nft.getAddress());
        tokenId = await mintPosition(context.nft.connect(lpUser0), {
          token0: context.token0,
          token1: context.token1,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: lpUser0.address,
          amount0Desired: amountDesired,
          amount1Desired: amountDesired,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        });

        tokenIdOut = await mintPosition(context.nft.connect(lpUser0), {
          token0: context.token0,
          token1: context.token1,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]) + TICK_SPACINGS[FeeAmount.MEDIUM],
          recipient: lpUser0.address,
          amount0Desired: 0,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 10000,
        });

        await Time.setAndMine(timestamps.startTime + 1);

        await context.nft.connect(lpUser0).approveForFarming(tokenId, true, context.farmingCenter);
        await context.nft.connect(lpUser0).approveForFarming(tokenIdOut, true, context.farmingCenter);
        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            rewardToken: await context.rewardToken.getAddress(),
            bonusRewardToken: await context.bonusRewardToken.getAddress(),
            pool: context.pool01,
            nonce: localNonce,
          },
          tokenId
        );

        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            rewardToken: await context.rewardToken.getAddress(),
            bonusRewardToken: await context.bonusRewardToken.getAddress(),
            pool: context.pool01,
            nonce: localNonce,
          },
          tokenIdOut
        );

        await Time.setAndMine(timestamps.endTime + 10);

        incentiveId = await helpers.getIncentiveId(createIncentiveResult);
        subject = (_actor: Wallet) =>
          context.farmingCenter.connect(_actor).exitFarming(
            {
              pool: context.pool01,
              rewardToken: context.rewardToken,
              bonusRewardToken: context.bonusRewardToken,
              nonce: localNonce,
            },
            tokenId
          );
      });

      describe('works and', () => {
        it('emits an exitFarmingd event', async () => {
          await expect(subject(lpUser0))
            .to.emit(context.eternalFarming, 'FarmEnded')
            .withArgs(
              tokenId,
              incentiveId,
              await context.rewardToken.getAddress(),
              await context.bonusRewardToken.getAddress(),
              lpUser0.address,
              9999n,
              199n
            );
        });

        it('has gas cost [ @skip-on-coverage ]', async () => {
          await snapshotGasCost(subject(lpUser0));
        });

        it('updates the reward available for the context.tokenomics', async () => {
          const rewardsAccured = await context.eternalFarming.rewards(lpUser0.address, await context.rewardToken.getAddress());
          await subject(lpUser0);
          expect(await context.eternalFarming.rewards(lpUser0.address, await context.rewardToken.getAddress())).to.be.gt(rewardsAccured);
        });

        it('updates the farm struct', async () => {
          const farmBefore = await context.eternalFarming.farms(tokenId, incentiveId);
          await subject(lpUser0);
          const farmAfter = await context.eternalFarming.farms(tokenId, incentiveId);

          expect(farmBefore.liquidity).to.gt(0);
          expect(farmAfter.liquidity).to.eq(0);
        });
      });

      it('can exit without rewards', async () => {
        await expect(
          context.farmingCenter.connect(lpUser0).exitFarming(
            {
              pool: context.pool01,
              rewardToken: await context.rewardToken.getAddress(),
              bonusRewardToken: await context.bonusRewardToken.getAddress(),
              nonce: localNonce,
            },
            tokenIdOut
          )
        )
          .to.emit(context.eternalFarming, 'FarmEnded')
          .withArgs(
            tokenIdOut,
            incentiveId,
            await context.rewardToken.getAddress(),
            await context.bonusRewardToken.getAddress(),
            lpUser0.address,
            BN('0'),
            BN('0')
          );
      });

      it('cannot exit twice', async () => {
        await subject(lpUser0);
        await expect(
          context.farmingCenter.connect(lpUser0).exitFarming(
            {
              pool: context.pool01,
              rewardToken: await context.rewardToken.getAddress(),
              bonusRewardToken: await context.bonusRewardToken.getAddress(),
              nonce: localNonce,
            },
            tokenId
          )
        ).to.be.revertedWith('Invalid incentiveId');
      });

      it('cannot exit from nonexistent farming', async () => {
        await context.eternalFarming.connect(actors.wallets[0]).setFarmingCenterAddress(lpUser0);

        await expect(
          context.eternalFarming.connect(lpUser0).exitFarming(
            {
              pool: context.pool12,
              rewardToken: await context.rewardToken.getAddress(),
              bonusRewardToken: await context.bonusRewardToken.getAddress(),
              nonce: localNonce,
            },
            tokenId,
            lpUser0.address
          )
        ).to.be.revertedWithCustomError(context.eternalFarming, 'farmDoesNotExist');
      });

      it('can exit from deactivated farming', async () => {
        await context.eternalFarming.connect(incentiveCreator).deactivateIncentive({
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: localNonce,
        });
        await subject(lpUser0);
      });

      it('can exit from indirectly deactivated farming', async () => {
        await detachIncentiveIndirectly(localNonce);
        await subject(lpUser0);
      });

      //it('calculates the right secondsPerLiquidity')
      //it('does not overflow totalSecondsUnclaimed')
    });

    it('rewards calculation underflow', async () => {
      const helpers = HelperCommands.fromTestContext(context, actors, provider);

      const localNonce = await context.eternalFarming.numOfIncentives();

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired * 3n, await context.nft.getAddress());

      tokenId = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      });

      const incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward: 1000000n,
        bonusReward: 1000000n,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      };

      const incentiveId = await helpers.getIncentiveId(await helpers.createIncentiveFlow(incentiveArgs));

      await context.nft.connect(lpUser0).approveForFarming(tokenId, true, context.farmingCenter);

      await context.farmingCenter.connect(lpUser0).enterFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: localNonce,
        },
        tokenId
      );

      const trader = actors.traderUser0();

      await helpers.makeTickGoFlow({
        trader,
        direction: 'down',
        desiredValue: -30,
      });

      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 0,
      });

      tokenId = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: -120,
        tickUpper: -60,
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      });

      await context.nft.connect(lpUser0).approveForFarming(tokenId, true, context.farmingCenter);

      await context.farmingCenter.connect(lpUser0).enterFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: localNonce,
        },
        tokenId
      );

      await helpers.makeTickGoFlow({
        trader,
        direction: 'down',
        desiredValue: -150,
      });

      tokenId = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: -240,
        tickUpper: -60,
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      });

      await context.nft.connect(lpUser0).approveForFarming(tokenId, true, context.farmingCenter);

      await context.farmingCenter.connect(lpUser0).enterFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: localNonce,
        },
        tokenId
      );

      let time = await blockTimestamp();

      await Time.set(time + 10000);

      await helpers.makeTickGoFlow({
        trader,
        direction: 'down',
        desiredValue: -238,
      });

      await context.farmingCenter.connect(lpUser0).exitFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: localNonce,
        },
        tokenId
      );
    });

    describe('fails if', () => {
      it('farm has already been exitFarming', async () => {
        await expect(subject(lpUser0)).to.revertedWith('ERC721: invalid token ID');
      });

      it('if reentrancy lock in pool is locked', async () => {
        const _factory = await ethers.getContractFactory('TestERC20Reentrant');
        const tokenReentrant = (await _factory.deploy(MaxUint256 / 2n)) as any as TestERC20Reentrant;

        const [token0, token1] =
          (await tokenReentrant.getAddress()) < (await context.token1.getAddress())
            ? [tokenReentrant, context.token1]
            : [context.token1, tokenReentrant];

        await erc20Helper.ensureBalancesAndApprovals(lpUser0, [token0, token1], amountDesired, await context.nft.getAddress());

        await context.nft.createAndInitializePoolIfNecessary(token0, token1, encodePriceSqrt(1, 1));

        const poolAddress = await context.factory.poolByPair(token0, token1);

        const _tokenId = await mintPosition(context.nft.connect(lpUser0), {
          token0: token0,
          token1: token1,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: lpUser0.address,
          amount0Desired: amountDesired,
          amount1Desired: amountDesired,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        });

        const _nonce = await context.eternalFarming.numOfIncentives();

        await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress,
          nonce: _nonce,
          rewardRate: 10n,
          bonusRewardRate: 50n,
        });

        await context.nft.connect(lpUser0).approveForFarming(_tokenId, true, context.farmingCenter);

        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            rewardToken: await context.rewardToken.getAddress(),
            bonusRewardToken: await context.bonusRewardToken.getAddress(),
            pool: poolAddress,
            nonce: _nonce,
          },
          _tokenId
        );

        //await tokenReentrant.prepareAttack(incentiveKey, 500, 500);

        await context.nft.connect(lpUser0).approve(tokenReentrant, _tokenId);
        const txData = await context.farmingCenter.exitFarming.populateTransaction(
          {
            pool: poolAddress,
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            nonce: _nonce,
          },
          _tokenId
        );

        await erc20Helper.ensureBalancesAndApprovals(lpUser0, [token0, token1], amountDesired, await context.router.getAddress());
        const swapData = {
          tokenIn: tokenReentrant,
          tokenOut: context.token1,
          amountIn: 10,
          amountOutMinimum: 0,
          recipient: lpUser0.address,
          deadline: (await blockTimestamp()) + 10000,
          limitSqrtPrice: 0,
        };

        await tokenReentrant.prepareComplexAttack(context.farmingCenter, txData.data);
        await expect(context.router.connect(lpUser0).exactInputSingle(swapData)).to.be.revertedWith('STF');

        await tokenReentrant.cancelComplexAttack();
        await expect(context.router.connect(lpUser0).exactInputSingle(swapData)).to.be.not.reverted;
      });
    });
  });

  describe('liquidityIfOverflow', () => {
    const MAX_UINT_96 = 2n ** 96n - 1n;

    let incentive: HelperTypes.CreateIncentive.Result;
    let incentiveId: string;
    let localNonce = 0n;

    beforeEach(async () => {
      timestamps = makeTimestamps(1_000 + (await blockTimestamp()));
      localNonce = await context.eternalFarming.numOfIncentives();
      incentive = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      });
      incentiveId = await helpers.getIncentiveId(incentive);
      // await Time.setAndMine(timestamps.startTime + 1)
    });

    it('works when no overflow', async () => {
      // With this `amount`, liquidity ends up less than MAX_UINT96
      const amount = MAX_UINT_96 / 1000n;

      const { tokenId } = await helpers.mintFlow({
        lp: lpUser0,
        tokens: [context.token0, context.token1],
        amounts: [amount, amount],
        tickLower: 0,
        tickUpper: 10 * TICK_SPACINGS[FeeAmount.MEDIUM],
      });

      await helpers.depositFlow({
        lp: lpUser0,
        tokenId,
      });

      await context.farmingCenter.connect(lpUser0).enterFarming(await incentiveResultToFarmAdapter(incentive), tokenId);
      const farm = await context.eternalFarming.farms(tokenId, incentiveId);
      expect(farm.liquidity).to.be.lt(MAX_UINT_96);
    });

    it('works when overflow', async () => {
      // With this `amount`, liquidity ends up more than MAX_UINT96
      const amount = MAX_UINT_96 - 100n;
      const { tokenId } = await helpers.mintFlow({
        lp: lpUser0,
        tokens: [context.token0, context.token1],
        amounts: [amount, amount],
        tickLower: 0,
        tickUpper: 10 * TICK_SPACINGS[FeeAmount.MEDIUM],
      });

      await helpers.depositFlow({
        lp: lpUser0,
        tokenId,
      });

      await context.farmingCenter.connect(lpUser0).enterFarming(await incentiveResultToFarmAdapter(incentive), tokenId);
      const farm = await context.eternalFarming.farms(tokenId, incentiveId);
      expect(farm.liquidity).to.be.gt(MAX_UINT_96);
    });
  });

  describe('#rewards', async () => {
    let incentiveArgs: HelperTypes.CreateIncentive.Args;
    let incentiveKey: ContractParams.IncentiveKey;
    let incentiveId: string;

    let localNonce = 0n;

    beforeEach(async () => {
      /** We will be doing a lot of time-testing here, so leave some room between
        and when the incentive starts */
      bonusReward = BN(10000);
      timestamps = makeTimestamps(1_000 + (await blockTimestamp()));

      localNonce = await context.eternalFarming.numOfIncentives();

      incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: localNonce,
        rewardRate: 100n,
        bonusRewardRate: 3n,
      };

      incentiveKey = {
        rewardToken: await context.rewardToken.getAddress(),
        bonusRewardToken: await context.bonusRewardToken.getAddress(),
        pool: context.pool01,
        nonce: localNonce,
      };

      incentiveId = await helpers.getIncentiveId(await helpers.createIncentiveFlow(incentiveArgs));
    });

    describe('#addRewards', async () => {
      it('can add rewards', async () => {
        let incentiveBefore = await context.eternalFarming.connect(lpUser0).incentives(incentiveId);

        await erc20Helper.ensureBalancesAndApprovals(
          lpUser0,
          [context.rewardToken, context.bonusRewardToken],
          amountDesired,
          await context.eternalFarming.getAddress()
        );

        await context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, amountDesired, amountDesired);

        let incentiveAfter = await context.eternalFarming.connect(lpUser0).incentives(incentiveId);

        expect(incentiveAfter.totalReward - amountDesired).to.eq(incentiveBefore.totalReward);
        expect(incentiveAfter.bonusReward - amountDesired).to.eq(incentiveBefore.bonusReward);
      });

      it('can add rewards in deflationary token', async () => {
        await context.rewardToken.setDefl(true, 5);

        let incentiveBefore = await context.eternalFarming.connect(lpUser0).incentives(incentiveId);

        await erc20Helper.ensureBalancesAndApprovals(
          lpUser0,
          [context.rewardToken, context.bonusRewardToken],
          amountDesired * 2n,
          await context.eternalFarming.getAddress()
        );

        await context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, amountDesired, amountDesired);

        let incentiveAfter = await context.eternalFarming.connect(lpUser0).incentives(incentiveId);

        expect(incentiveAfter.totalReward).to.be.gt(incentiveBefore.totalReward);
        expect(incentiveAfter.bonusReward - amountDesired).to.eq(incentiveBefore.bonusReward);
      });

      it('cannot add rewards if token does incorrect transfer', async () => {
        await erc20Helper.ensureBalancesAndApprovals(
          lpUser0,
          [context.rewardToken, context.bonusRewardToken],
          2n ** 128n + 10n,
          await context.eternalFarming.getAddress()
        );

        await context.rewardToken.setDefl(true, 100);

        expect(context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, amountDesired, amountDesired)).to.be.revertedWithoutReason;

        await context.rewardToken.setDefl(false, 0);

        await context.rewardToken.setNextTransferAmount(2n ** 128n);

        await expect(context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, amountDesired, amountDesired)).to.be.revertedWithCustomError(
          context.eternalFarming,
          'invalidTokenAmount'
        );
      });

      it('can add rewards with 0 amounts', async () => {
        let incentiveBefore = await context.eternalFarming.connect(lpUser0).incentives(incentiveId);

        await erc20Helper.ensureBalancesAndApprovals(
          lpUser0,
          [context.rewardToken, context.bonusRewardToken],
          amountDesired,
          await context.eternalFarming.getAddress()
        );

        await context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, 0, 0);

        let incentiveAfter = await context.eternalFarming.connect(lpUser0).incentives(incentiveId);

        expect(incentiveAfter.totalReward).to.eq(incentiveBefore.totalReward);
        expect(incentiveAfter.bonusReward).to.eq(incentiveBefore.bonusReward);

        await context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, 0, 1);
        incentiveAfter = await context.eternalFarming.connect(lpUser0).incentives(incentiveId);
        expect(incentiveAfter.totalReward).to.eq(incentiveBefore.totalReward);
        expect(incentiveAfter.bonusReward).to.eq(incentiveBefore.bonusReward + 1n);

        await context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, 1, 0);
        incentiveAfter = await context.eternalFarming.connect(lpUser0).incentives(incentiveId);
        expect(incentiveAfter.totalReward).to.eq(incentiveBefore.totalReward + 1n);
        expect(incentiveAfter.bonusReward).to.eq(incentiveBefore.bonusReward + 1n);
      });

      it('can add rewards with uint128 amounts', async () => {
        let incentiveBefore = await context.eternalFarming.connect(lpUser0).incentives(incentiveId);

        await erc20Helper.ensureBalancesAndApprovals(
          lpUser0,
          [context.rewardToken, context.bonusRewardToken],
          2n ** 128n,
          await context.eternalFarming.getAddress()
        );

        let factoryOwner = actors.wallets[0];

        await context.eternalFarming.connect(factoryOwner).decreaseRewardsAmount(incentiveKey, 10000n, 10000n);
        await expect(context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, 2n ** 128n - 1n, 2n ** 128n - 1n)).to.be.reverted;
      });

      it('cannot add rewards to non-existent incentive', async () => {
        incentiveKey = {
          rewardToken: await context.rewardToken.getAddress(),
          bonusRewardToken: await context.bonusRewardToken.getAddress(),
          pool: context.pool12,
          nonce: localNonce,
        };

        await expect(context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, 0, 0)).to.be.revertedWithCustomError(
          context.eternalFarming as AlgebraEternalFarming,
          'incentiveNotExist'
        );
      });

      it('cannot add rewards to deactivated incentive', async () => {
        await context.eternalFarming.connect(incentiveCreator).deactivateIncentive(incentiveKey);

        await expect(context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, 1, 1)).to.be.revertedWithCustomError(
          context.eternalFarming,
          'incentiveStopped'
        );
      });

      it('addRewards to indirectly deactivated incentive', async () => {
        await detachIncentiveIndirectly(localNonce);

        await expect(context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, 1, 1)).to.be.revertedWithCustomError(
          context.eternalFarming,
          'incentiveStopped'
        );
      });

      it('cannot reenter to addRewards', async () => {
        const _factory = await ethers.getContractFactory('TestERC20Reentrant');
        const tokenReentrant = (await _factory.deploy(MaxUint256 / 2n)) as any as TestERC20Reentrant;

        await erc20Helper.ensureBalancesAndApprovals(
          lpUser0,
          [tokenReentrant, context.bonusRewardToken],
          amountDesired,
          await context.eternalFarming.getAddress()
        );

        const nonce = await context.eternalFarming.numOfIncentives();
        await helpers.createIncentiveFlow({
          rewardToken: tokenReentrant,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.pool12,
          nonce: nonce,
          rewardRate: 10n,
          bonusRewardRate: 50n,
        });

        const incentiveKey2 = {
          rewardToken: await tokenReentrant.getAddress(),
          bonusRewardToken: await context.bonusRewardToken.getAddress(),
          pool: context.pool12,
          nonce: nonce,
        };

        await tokenReentrant.prepareAttack(incentiveKey, 500, 500);

        await expect(context.eternalFarming.connect(lpUser0).addRewards(incentiveKey2, 1, 1)).to.be.revertedWith('STF');
      });
    });

    describe('#setRates', async () => {
      it('can change rates', async () => {
        await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, await context.nft.getAddress());

        tokenId = await mintPosition(context.nft.connect(lpUser0), {
          token0: context.token0,
          token1: context.token1,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: lpUser0.address,
          amount0Desired: amountDesired,
          amount1Desired: amountDesired,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        });

        await context.nft.connect(lpUser0).approveForFarming(tokenId, true, context.farmingCenter);

        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            pool: context.pool01,
            rewardToken: await context.rewardToken.getAddress(),
            bonusRewardToken: await context.bonusRewardToken.getAddress(),
            nonce: localNonce,
          },
          tokenId
        );
        await context.eternalFarming.connect(incentiveCreator).setRates(incentiveKey, BN(60), BN(5));
        let rewardsBefore = await context.eternalFarming.getRewardInfo(incentiveKey, tokenId);
        let time = await blockTimestamp();

        await Time.set(time + 100);

        const trader = actors.traderUser0();

        await helpers.makeTickGoFlow({
          trader,
          direction: 'up',
          desiredValue: 10,
        });
        time = await blockTimestamp();
        let rewardsAfter = await context.eternalFarming.getRewardInfo(incentiveKey, tokenId);

        expect(rewardsAfter.reward - rewardsBefore.reward).to.eq(60n * 104n);
        expect(rewardsAfter.bonusReward - rewardsBefore.bonusReward).to.eq(5n * 104n);
      });

      it('cannot set nonzero to deactivated incentive', async () => {
        await context.eternalFarming.connect(incentiveCreator).deactivateIncentive(incentiveKey);

        await expect(context.eternalFarming.connect(incentiveCreator).setRates(incentiveKey, 1, 1)).to.be.revertedWithCustomError(
          context.eternalFarming,
          'incentiveStopped'
        );
      });

      it('set zero to deactivated incentive', async () => {
        await context.eternalFarming.connect(incentiveCreator).deactivateIncentive(incentiveKey);
        await context.eternalFarming.connect(incentiveCreator).setRates(incentiveKey, 0, 0);
      });

      it('set max rates', async () => {
        await expect(context.eternalFarming.connect(incentiveCreator).setRates(incentiveKey, 2n ** 128n - 1n, 2n ** 128n - 1n))
          .to.emit(context.eternalFarming, 'RewardsRatesChanged')
          .withArgs(2n ** 128n - 1n, 2n ** 128n - 1n, incentiveId);
      });

      it('cannot set nonzero to indirectly deactivated incentive', async () => {
        await detachIncentiveIndirectly(localNonce);

        await expect(context.eternalFarming.connect(incentiveCreator).setRates(incentiveKey, 1, 1)).to.be.revertedWithCustomError(
          context.eternalFarming,
          'incentiveStopped'
        );
      });

      it('set zero to indirectly deactivated incentive', async () => {
        await detachIncentiveIndirectly(localNonce);

        await context.eternalFarming.connect(incentiveCreator).setRates(incentiveKey, 0, 0);
      });
    });
  });
});
