import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { algebraFixture, AlgebraFixtureType } from '../shared/fixtures';
import { Wallet } from 'ethers';
import { BNe18, ActorFixture, maxGas, expect } from '../shared';
import { provider } from '../shared/provider';
import { HelperCommands, ERC20Helper } from '../helpers';
import { createTimeMachine } from '../shared/time';

type FarmIncentiveKey = {
  rewardToken: string;
  bonusRewardToken: string;
  pool: string;
  nonce: number;
};

describe('unit/Multicall', () => {
  let actors: ActorFixture;
  let incentiveCreator: Wallet;
  let multicaller: Wallet;
  const amountDesired = BNe18(10);
  const totalReward = BNe18(100);
  const bonusReward = BNe18(100);
  const erc20Helper = new ERC20Helper();
  const Time = createTimeMachine();
  let context: AlgebraFixtureType;
  let farmIncentiveKey: FarmIncentiveKey;
  let tokenId: string;

  let multicallFixture: () => Promise<{
    context: AlgebraFixtureType;
    helpers: HelperCommands;
    tokenId: string;
    farmIncentiveKey: FarmIncentiveKey;
  }>;

  before(async () => {
    const wallets = (await ethers.getSigners()) as any as Wallet[];
    actors = new ActorFixture(wallets, provider);
    incentiveCreator = actors.incentiveCreator();
    multicaller = actors.traderUser2();

    multicallFixture = async () => {
      const context = await algebraFixture();
      const helpers = HelperCommands.fromTestContext(context, actors, provider);

      await erc20Helper.ensureBalancesAndApprovals(multicaller, [context.token0, context.token1], amountDesired, await context.nft.getAddress());

      const mintResult = await helpers.mintFlow({
        lp: multicaller,
        tokens: [context.token0, context.token1],
      });
      const tokenId = mintResult.tokenId;

      const farmIncentiveKey = {
        rewardToken: await context.rewardToken.getAddress(),
        bonusRewardToken: await context.bonusRewardToken.getAddress(),
        pool: context.pool01,
        nonce: 0,
      };

      await erc20Helper.ensureBalancesAndApprovals(incentiveCreator, context.rewardToken, totalReward, await context.eternalFarming.getAddress());
      await erc20Helper.ensureBalancesAndApprovals(
        incentiveCreator,
        context.bonusRewardToken,
        totalReward,
        await context.eternalFarming.getAddress()
      );

      await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce: 0n,
        rewardRate: 10n,
        bonusRewardRate: 50n,
      });

      await context.nft.connect(multicaller).approveForFarming(tokenId, true, context.farmingCenter);
      await context.farmingCenter.connect(multicaller).enterFarming(farmIncentiveKey, tokenId);

      return { context, helpers, farmIncentiveKey, tokenId };
    };
  });

  beforeEach('loadFixture', async () => {
    ({ context, farmIncentiveKey, tokenId } = await loadFixture(multicallFixture));
  });

  it('is implemented', async () => {
    await Time.step(1000);

    const collectRewardsTx = context.farmingCenter.interface.encodeFunctionData('collectRewards', [farmIncentiveKey, tokenId]);

    expect(await context.eternalFarming.rewards(multicaller.address, context.rewardToken)).to.be.eq(0);

    await context.farmingCenter.connect(multicaller).multicall([collectRewardsTx], maxGas);

    expect(await context.eternalFarming.rewards(multicaller.address, context.rewardToken)).to.be.gt(0);
  });

  it('can be used to claim multiple tokens from one incentive', async () => {
    await Time.step(1000);

    const collectRewardsTx = context.farmingCenter.interface.encodeFunctionData('collectRewards', [farmIncentiveKey, tokenId]);

    const claimRewardsTx0 = context.farmingCenter.interface.encodeFunctionData('claimReward', [
      await context.rewardToken.getAddress(),
      multicaller.address,
      2n ** 128n - 1n,
    ]);

    const claimRewardsTx1 = context.farmingCenter.interface.encodeFunctionData('claimReward', [
      await context.bonusRewardToken.getAddress(),
      multicaller.address,
      2n ** 128n - 1n,
    ]);

    expect(await context.eternalFarming.rewards(multicaller.address, context.rewardToken)).to.be.eq(0);
    expect(await context.eternalFarming.rewards(multicaller.address, context.bonusRewardToken)).to.be.eq(0);

    await context.farmingCenter.connect(multicaller).multicall([collectRewardsTx, claimRewardsTx0, claimRewardsTx1], maxGas);

    expect(await context.eternalFarming.rewards(multicaller.address, context.rewardToken)).to.be.eq(0);
    expect(await context.eternalFarming.rewards(multicaller.address, context.bonusRewardToken)).to.be.eq(0);
  });
});
