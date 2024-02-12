import { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import { loadFixture, impersonateAccount, stopImpersonatingAccount, setBalance } from '@nomicfoundation/hardhat-network-helpers';
import { TestERC20, AlgebraEternalFarming, NftPosManagerMock, FarmingCenter } from '../../typechain';
import { algebraFixture, AlgebraFixtureType, mintPosition } from '../shared/fixtures';
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
} from '../shared';
import { provider } from '../shared/provider';
import { HelperCommands, ERC20Helper } from '../helpers';
import { createTimeMachine } from '../shared/time';
import { HelperTypes } from '../helpers/types';
import { ContractParams } from '../../types/contractParams';

describe('unit/FarmingCenter', () => {
  let actors: ActorFixture;
  let lpUser0: Wallet;
  let incentiveCreator: Wallet;
  const amountDesired = BNe18(10);
  const totalReward = 10000n;
  const bonusReward = 200n;
  const erc20Helper = new ERC20Helper();
  const Time = createTimeMachine();
  let helpers: HelperCommands;
  let context: AlgebraFixtureType;
  let timestamps: ContractParams.Timestamps;
  let nonce = 0n;

  before(async () => {
    const wallets = (await ethers.getSigners()) as any as Wallet[];
    actors = new ActorFixture(wallets, provider);
    lpUser0 = actors.lpUser0();
    incentiveCreator = actors.incentiveCreator();
  });

  beforeEach('create fixture loader', async () => {
    context = await loadFixture(algebraFixture);
    helpers = HelperCommands.fromTestContext(context, actors, provider);
  });

  describe('#connectVirtualPoolToPlugin', async () => {
    it('cannot call connectVirtualPool directly', async () => {
      await expect(context.farmingCenter.connectVirtualPoolToPlugin(context.pool01, context.pool01)).to.be.revertedWith('Only farming can call this');
    });

    it('cannot connect zero address to pool', async () => {
      const eternalFarmingAddress = await context.eternalFarming.getAddress();
      await impersonateAccount(eternalFarmingAddress);
      await setBalance(eternalFarmingAddress, 10 ** 18);
      const fakeSigner = await ethers.getSigner(eternalFarmingAddress);
      await expect(
        context.farmingCenter.connect(fakeSigner).connectVirtualPoolToPlugin(ZERO_ADDRESS, context.pluginObj, { from: eternalFarmingAddress })
      ).to.be.revertedWith('Zero address as virtual pool');
      await setBalance(eternalFarmingAddress, 0);
      await stopImpersonatingAccount(eternalFarmingAddress);
    });

    it('cannot connect virtual pool to invalid pool', async () => {
      const newContext = await algebraFixture();
      const eternalFarmingAddress = await context.eternalFarming.getAddress();
      await impersonateAccount(eternalFarmingAddress);
      await setBalance(eternalFarmingAddress, 10 ** 18);
      const fakeSigner = await ethers.getSigner(eternalFarmingAddress);
      await expect(
        context.farmingCenter.connect(fakeSigner).connectVirtualPoolToPlugin(context.pool01, newContext.pluginObj, { from: eternalFarmingAddress })
      ).to.be.revertedWith('Invalid pool');
      await setBalance(eternalFarmingAddress, 0);
      await stopImpersonatingAccount(eternalFarmingAddress);
    });

    it('can connect virtual pool', async () => {
      const eternalFarmingAddress = await context.eternalFarming.getAddress();
      await impersonateAccount(eternalFarmingAddress);
      await setBalance(eternalFarmingAddress, 10 ** 18);
      const fakeSigner = await ethers.getSigner(eternalFarmingAddress);
      await context.farmingCenter.connect(fakeSigner).connectVirtualPoolToPlugin(context.pool01, context.pluginObj, { from: eternalFarmingAddress });
      await setBalance(eternalFarmingAddress, 0);
      await stopImpersonatingAccount(eternalFarmingAddress);
      expect(await context.farmingCenter.virtualPoolAddresses(context.pool01)).to.not.be.eq(ZERO_ADDRESS);
    });

    it('cannot connect virtual pool if something already connected', async () => {
      const eternalFarmingAddress = await context.eternalFarming.getAddress();
      await impersonateAccount(eternalFarmingAddress);
      await setBalance(eternalFarmingAddress, 10 ** 18);
      const fakeSigner = await ethers.getSigner(eternalFarmingAddress);
      await context.pluginFactory.setFarmingAddress(incentiveCreator);
      await context.pluginObj.connect(incentiveCreator).setIncentive(eternalFarmingAddress);
      await context.pluginFactory.setFarmingAddress(context.farmingCenter);
      await expect(
        context.farmingCenter.connect(fakeSigner).connectVirtualPoolToPlugin(context.pool01, context.pluginObj, { from: eternalFarmingAddress })
      ).to.be.revertedWith('Another incentive is connected');
      await setBalance(eternalFarmingAddress, 0);
      await stopImpersonatingAccount(eternalFarmingAddress);
    });
  });

  describe('#disconnectVirtualPoolFromPlugin', async () => {
    it('cannot call disconnectVirtualPoolFromPlugin directly', async () => {
      await expect(context.farmingCenter.disconnectVirtualPoolFromPlugin(context.pool01, context.pool01)).to.be.revertedWith(
        'Only farming can call this'
      );
    });

    it('cannot disconnect zero address from pool', async () => {
      const eternalFarmingAddress = await context.eternalFarming.getAddress();
      await impersonateAccount(eternalFarmingAddress);
      await setBalance(eternalFarmingAddress, 10 ** 18);
      const fakeSigner = await ethers.getSigner(eternalFarmingAddress);
      await expect(
        context.farmingCenter.connect(fakeSigner).disconnectVirtualPoolFromPlugin(ZERO_ADDRESS, context.pluginObj, { from: eternalFarmingAddress })
      ).to.be.revertedWith('Zero address as virtual pool');
      await setBalance(eternalFarmingAddress, 0);
      await stopImpersonatingAccount(eternalFarmingAddress);
    });

    it('cannot disconnect virtual pool from invalid pool', async () => {
      const newContext = await algebraFixture();
      const eternalFarmingAddress = await context.eternalFarming.getAddress();
      await impersonateAccount(eternalFarmingAddress);
      await setBalance(eternalFarmingAddress, 10 ** 18);
      const fakeSigner = await ethers.getSigner(eternalFarmingAddress);
      await expect(
        context.farmingCenter
          .connect(fakeSigner)
          .disconnectVirtualPoolFromPlugin(context.pool01, newContext.pluginObj, { from: eternalFarmingAddress })
      ).to.be.revertedWith('Invalid pool');
      await setBalance(eternalFarmingAddress, 0);
      await stopImpersonatingAccount(eternalFarmingAddress);
    });

    it('can disconnect virtual pool', async () => {
      const eternalFarmingAddress = await context.eternalFarming.getAddress();
      await impersonateAccount(eternalFarmingAddress);
      await setBalance(eternalFarmingAddress, 10 ** 18);
      const fakeSigner = await ethers.getSigner(eternalFarmingAddress);
      await context.farmingCenter.connect(fakeSigner).connectVirtualPoolToPlugin(context.pool01, context.pluginObj, { from: eternalFarmingAddress });
      await context.farmingCenter
        .connect(fakeSigner)
        .disconnectVirtualPoolFromPlugin(context.pool01, context.pluginObj, { from: eternalFarmingAddress });
      await setBalance(eternalFarmingAddress, 0);
      await stopImpersonatingAccount(eternalFarmingAddress);
      expect(await context.farmingCenter.virtualPoolAddresses(context.pool01)).to.be.eq(ZERO_ADDRESS);
    });

    it('can disconnect virtual pool if something another connected', async () => {
      const eternalFarmingAddress = await context.eternalFarming.getAddress();
      await impersonateAccount(eternalFarmingAddress);
      await setBalance(eternalFarmingAddress, 10 ** 18);
      const fakeSigner = await ethers.getSigner(eternalFarmingAddress);
      await context.pluginFactory.setFarmingAddress(incentiveCreator);
      await context.pluginObj.connect(incentiveCreator).setIncentive(eternalFarmingAddress);
      await context.pluginFactory.setFarmingAddress(context.farmingCenter);
      await context.farmingCenter
        .connect(fakeSigner)
        .disconnectVirtualPoolFromPlugin(context.pool01, context.pluginObj, { from: eternalFarmingAddress });
      await setBalance(eternalFarmingAddress, 0);
      await stopImpersonatingAccount(eternalFarmingAddress);
      expect(await context.farmingCenter.virtualPoolAddresses(context.pool01)).to.be.eq(ZERO_ADDRESS);
    });
  });

  describe('#applyLiquidityDelta', () => {
    let createIncentiveResultEternal: HelperTypes.CreateIncentive.Result;
    let tokenIdEternal: string;

    beforeEach('setup', async () => {
      timestamps = makeTimestamps(await blockTimestamp());
      const tokensToFarm = [context.token0, context.token1] as [TestERC20, TestERC20];

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, tokensToFarm, amountDesired, await context.nft.getAddress());

      createIncentiveResultEternal = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce,
        rewardRate: 100n,
        bonusRewardRate: 50n,
      });

      await Time.setAndMine(timestamps.startTime + 1);

      const mintResultEternal = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });
      tokenIdEternal = mintResultEternal.tokenId;
    });

    it('cannot use if not nonfungiblePosManager', async () => {
      await expect(context.farmingCenter.applyLiquidityDelta(tokenIdEternal, 100)).to.be.revertedWith('Only nonfungiblePosManager');
    });

    it('works if liquidity decreased', async () => {
      await expect(
        context.nft.connect(lpUser0).decreaseLiquidity({
          tokenId: tokenIdEternal,
          liquidity: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        })
      ).to.emit(context.eternalFarming, 'FarmEntered');
    });

    it('works if liquidity decreased and incentive detached', async () => {
      await context.eternalFarming.connect(incentiveCreator).deactivateIncentive({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        pool: context.pool01,
        nonce: 0,
      });

      await expect(
        context.nft.connect(lpUser0).decreaseLiquidity({
          tokenId: tokenIdEternal,
          liquidity: 5,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        })
      ).to.emit(context.eternalFarming, 'FarmEnded');

      expect(await context.farmingCenter.deposits(tokenIdEternal)).to.be.eq('0x0000000000000000000000000000000000000000000000000000000000000000');
    });

    it('works if liquidity decreased and emergency activated', async () => {
      await context.eternalFarming.connect(actors.wallets[0]).setEmergencyWithdrawStatus(true);

      await expect(
        context.nft.connect(lpUser0).decreaseLiquidity({
          tokenId: tokenIdEternal,
          liquidity: 5,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        })
      )
        .to.emit(context.eternalFarming, 'FarmEnded')
        .to.not.emit(context.nft, 'FarmingFailed');

      expect(await context.farmingCenter.deposits(tokenIdEternal)).to.be.eq('0x0000000000000000000000000000000000000000000000000000000000000000');
    });

    it('works if liquidity decreased and incentive deactivated automatically', async () => {
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

      await context.nft.connect(lpUser0).approveForFarming(_tokenId, true, context.farmingCenter);
      await context.farmingCenter.connect(lpUser0).enterFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: nonce,
        },
        _tokenId
      );

      await context.pluginObj.connect(actors.algebraRootUser()).setIncentive(ZERO_ADDRESS);

      await helpers.moveTickTo({ direction: 'down', desiredValue: -160, trader: actors.farmingDeployer() });

      await context.pluginObj.connect(actors.algebraRootUser()).setIncentive(incentiveAddress);

      await helpers.moveTickTo({ direction: 'up', desiredValue: -140, trader: actors.farmingDeployer() });

      await expect(
        context.nft.connect(lpUser0).decreaseLiquidity({
          tokenId: tokenIdEternal,
          liquidity: 5,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        })
      ).to.emit(context.eternalFarming, 'FarmEnded');

      expect(await context.farmingCenter.deposits(tokenIdEternal)).to.be.eq('0x0000000000000000000000000000000000000000000000000000000000000000');
    });

    it('works if liquidity decreased and incentive detached indirectly', async () => {
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

      await context.nft.connect(lpUser0).approveForFarming(_tokenId, true, context.farmingCenter);
      await context.farmingCenter.connect(lpUser0).enterFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          nonce: nonce,
        },
        _tokenId
      );

      await context.pluginObj.connect(actors.algebraRootUser()).setIncentive(ZERO_ADDRESS);

      await helpers.moveTickTo({ direction: 'down', desiredValue: -160, trader: actors.farmingDeployer() });

      await context.pluginObj.connect(actors.algebraRootUser()).setIncentive(incentiveAddress);

      await expect(
        context.nft.connect(lpUser0).decreaseLiquidity({
          tokenId: tokenIdEternal,
          liquidity: 5,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        })
      ).to.emit(context.eternalFarming, 'FarmEnded');

      expect(await context.farmingCenter.deposits(tokenIdEternal)).to.be.eq('0x0000000000000000000000000000000000000000000000000000000000000000');
    });

    it('works if liquidity increased', async () => {
      const _erc20Helper = new ERC20Helper();
      await _erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.tokens[0], context.tokens[1]], 100n, await context.nft.getAddress());

      await expect(
        context.nft.connect(lpUser0).increaseLiquidity({
          tokenId: tokenIdEternal,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        })
      ).to.emit(context.eternalFarming, 'FarmEntered');
    });

    it('works if liquidity removed completely', async () => {
      const liquidity = (await context.nft.positions(tokenIdEternal)).liquidity;
      await expect(
        context.nft.connect(lpUser0).decreaseLiquidity({
          tokenId: tokenIdEternal,
          liquidity: liquidity,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        })
      ).to.emit(context.eternalFarming, 'FarmEnded');
      expect(await context.farmingCenter.deposits(tokenIdEternal)).to.be.eq('0x0000000000000000000000000000000000000000000000000000000000000000');
    });

    it('do nothing if nft position manager calls for invalid token', async () => {
      const nftPosMockFactory = await ethers.getContractFactory('NftPosManagerMock');
      const nftPosMock = (await nftPosMockFactory.deploy()) as any as NftPosManagerMock;

      const farmingCenterFactory = await ethers.getContractFactory('FarmingCenter');
      const farmingCenter = (await farmingCenterFactory.deploy(ZERO_ADDRESS, nftPosMock)) as any as FarmingCenter;

      await nftPosMock.setPosition(0, {
        nonce: 0,
        operator: ZERO_ADDRESS,
        poolId: 0,
        tickLower: -60,
        tickUpper: 60,
        liquidity: 100,
        feeGrowthInside0LastX128: 1,
        feeGrowthInside1LastX128: 1,
        tokensOwed0: 0,
        tokensOwed1: 0,
      });

      await nftPosMock.applyLiquidityDeltaInFC(farmingCenter, 0, 100);
      expect(await farmingCenter.deposits(0)).to.be.eq('0x0000000000000000000000000000000000000000000000000000000000000000');
    });
  });

  describe('#exitFarming', async () => {
    let createIncentiveResultEternal: HelperTypes.CreateIncentive.Result;

    let tokenIdEternal: string;

    beforeEach('setup', async () => {
      const tokensToFarm = [context.token0, context.token1] as [TestERC20, TestERC20];

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, tokensToFarm, amountDesired, await context.nft.getAddress());

      createIncentiveResultEternal = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce,
        rewardRate: 100n,
        bonusRewardRate: 50n,
      });

      const mintResultEternal = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });
      tokenIdEternal = mintResultEternal.tokenId;
    });

    it('can exit if farmedIn changed forcefully', async () => {
      await context.nft.setFarmingCenter(lpUser0);
      await context.nft.connect(lpUser0).approveForFarming(tokenIdEternal, true, lpUser0.address);
      await context.nft.connect(lpUser0).switchFarmingStatus(tokenIdEternal, true);
      expect(await context.nft.tokenFarmedIn(tokenIdEternal)).to.be.eq(lpUser0.address);

      await context.farmingCenter.connect(lpUser0).exitFarming(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce,
        },
        tokenIdEternal
      );
    });
  });

  describe('#collectRewards', () => {
    let createIncentiveResultEternal: HelperTypes.CreateIncentive.Result;

    let tokenIdEternal: string;

    let claimAndCheck: (token: TestERC20, from: Wallet, amount: bigint, expectedAmountRewardBalance?: bigint) => Promise<void>;

    beforeEach('setup', async () => {
      timestamps = makeTimestamps(await blockTimestamp());
      const tokensToFarm = [context.token0, context.token1] as [TestERC20, TestERC20];

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, tokensToFarm, amountDesired, await context.nft.getAddress());

      createIncentiveResultEternal = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce,
        rewardRate: 100n,
        bonusRewardRate: 50n,
      });

      await Time.setAndMine(timestamps.startTime + 1);

      const mintResultEternal = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });
      tokenIdEternal = mintResultEternal.tokenId;

      const trader = actors.traderUser0();
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 10,
      });

      claimAndCheck = async (token: TestERC20, from: Wallet, amount: bigint, expectedAmountRewardBalance?: bigint) => {
        const rewards = await context.eternalFarming.rewards(from.address, token);

        let balanceOfTokenBefore = await token.balanceOf(from.address);

        await context.farmingCenter.connect(from).claimReward(token, from.address, amount);

        let balanceOfTokenAfter = await token.balanceOf(from.address);

        if (amount != 0n) expect(balanceOfTokenAfter - balanceOfTokenBefore).to.equal(amount);
        else {
          expect(balanceOfTokenAfter - balanceOfTokenBefore).to.equal(rewards);
        }

        if (expectedAmountRewardBalance === undefined) expectedAmountRewardBalance = 0n;

        expect(await context.eternalFarming.rewards(from.address, token)).to.be.eq(expectedAmountRewardBalance);
      };
    });

    it('works', async () => {
      let balanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
      let bonusBalanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);

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
          nonce,
        },
        BNe18(1),
        BNe18(1)
      );

      const trader = actors.traderUser0();

      await Time.set(timestamps.endTime + 1000);

      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 10,
      });

      await context.farmingCenter.connect(lpUser0).collectRewards(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce,
        },
        tokenIdEternal
      );

      let balanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
      let bonusBalanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);

      expect(balanceAfter - balanceBefore).to.equal(199699n);
      expect(bonusBalanceAfter - bonusBalanceBefore).to.equal(99549n);

      await claimAndCheck(context.rewardToken, lpUser0, 199699n);
      await claimAndCheck(context.bonusRewardToken, lpUser0, 99549n);
    });

    it('collect rewards after eternalFarming deactivate', async () => {
      let balanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
      let bonusBalanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);

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
          nonce,
        },
        BNe18(1),
        BNe18(1)
      );

      const trader = actors.traderUser0();

      await Time.set(timestamps.endTime + 1000);

      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 10,
      });

      await context.eternalFarming.connect(incentiveCreator).deactivateIncentive({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        pool: context.pool01,
        nonce,
      });

      await context.farmingCenter.connect(lpUser0).collectRewards(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce,
        },
        tokenIdEternal
      );

      let balanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
      let bonusBalanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);

      expect(balanceAfter - balanceBefore).to.equal(199699n);
      expect(bonusBalanceAfter - bonusBalanceBefore).to.equal(99549n);

      await claimAndCheck(context.rewardToken, lpUser0, 199699n);
      await claimAndCheck(context.bonusRewardToken, lpUser0, 99549n);
    });

    it('cannot collect if not owner', async () => {
      let balanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
      let bonusBalanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);

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
          nonce,
        },
        BNe18(1),
        BNe18(1)
      );

      const trader = actors.traderUser0();

      await Time.set(timestamps.endTime + 1000);

      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 10,
      });

      await expect(
        context.farmingCenter.collectRewards(
          {
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            pool: context.pool01,
            nonce,
          },
          tokenIdEternal
        )
      ).to.be.revertedWith('Not approved for token');

      let balanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
      let bonusBalanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);

      expect(balanceAfter - balanceBefore).to.equal(0);
      expect(bonusBalanceAfter - bonusBalanceBefore).to.equal(0);
    });

    it('when requesting zero amount', async () => {
      await Time.set(timestamps.endTime + 10000);
      let balanceBeforeFirstCollect: bigint = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
      let bonusBalanceBeforeFirstCollect: bigint = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);

      await context.farmingCenter.connect(lpUser0).collectRewards(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce,
        },
        tokenIdEternal
      );

      let balanceBeforeSecondCollect: bigint = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
      let bonusBalanceBeforeSecondCollect: bigint = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);

      await context.farmingCenter.connect(lpUser0).collectRewards(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce,
        },
        tokenIdEternal
      );

      let balanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
      let bonusBalanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);

      expect(balanceAfter - balanceBeforeSecondCollect).to.equal(0);
      expect(bonusBalanceAfter - bonusBalanceBeforeSecondCollect).to.equal(0);

      expect(await context.eternalFarming.rewards(lpUser0.address, context.rewardToken)).to.be.eq(
        balanceBeforeSecondCollect - balanceBeforeFirstCollect
      );
      expect(await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken)).to.be.eq(
        bonusBalanceBeforeSecondCollect - bonusBalanceBeforeFirstCollect
      );

      await claimAndCheck(context.rewardToken, lpUser0, 0n);
      await claimAndCheck(context.bonusRewardToken, lpUser0, 0n);
    });

    it('collect with non-existent incentive', async () => {
      await expect(
        context.farmingCenter.connect(lpUser0).collectRewards(
          {
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            pool: context.pool12,
            nonce,
          },
          tokenIdEternal
        )
      ).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'incentiveNotExist');
    });

    it('collect with non-existent nft', async () => {
      await context.farmingCenter.connect(lpUser0).exitFarming(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce,
        },
        tokenIdEternal
      );

      await expect(
        context.farmingCenter.connect(lpUser0).collectRewards(
          {
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            pool: context.pool01,
            nonce,
          },
          tokenIdEternal
        )
      ).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'farmDoesNotExist');
    });
  });
});
