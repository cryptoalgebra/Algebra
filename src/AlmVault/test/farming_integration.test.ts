import {
  IAlgebraEternalFarming,
  IAlgebraFactory,
  IFarmingCenter,
  INonfungiblePositionManager,
  IFarmingRewardsDistributor,
  IAlgebraPool,
  AlgebraVault,
  AlgebraVaultFactory,
  TestERC20,
  ISwapRouter,
} from "../types";
import { algebraVaultTestFixture } from "./shared/fixtures";
import {
  FeeAmount,
  TICK_SPACINGS,
  encodePriceSqrt,
  getMaxTick,
  getMinTick,
} from "./shared/utilities";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

const largeTokenAmount = ethers.parseEther("1000000");
const veryLargeTokenAmount = ethers.parseEther("100000000000");
const giantTokenAmount = ethers.parseEther("1000000000000");

describe("Farming Integration", () => {
  const totalReward = ethers.parseEther("2000000");
  const bonusReward = ethers.parseEther("4000");

  let factory: IAlgebraFactory;
  let nft: INonfungiblePositionManager;
  let token0: TestERC20;
  let token1: TestERC20;
  let token2: TestERC20;
  let token3: TestERC20;
  let algebraPool: IAlgebraPool;
  let router: ISwapRouter;
  let algebraVaultFactory: AlgebraVaultFactory;
  let algebraEternalFarming: IAlgebraEternalFarming;
  let farmingCenter: IFarmingCenter;
  let algebraVault: AlgebraVault;

  let wallet: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  before("create fixture loader", async () => {
    [wallet, alice, bob, carol, other] = await (ethers as any).getSigners();
  });

  beforeEach("deploy contracts", async () => {
    ({
      token0,
      token1,
      token2,
      token3,
      factory,
      router,
      nft,
      algebraVaultFactory,
      algebraEternalFarming,
      farmingCenter,
    } = await loadFixture(algebraVaultTestFixture));
    await factory.createPool(await token0.getAddress(), await token1.getAddress(), "0x");
    const poolAddress = await factory.poolByPair(
      await token0.getAddress(),
      await token1.getAddress()
    );

    algebraPool = (await ethers.getContractAt(
      "IAlgebraPool",
      poolAddress
    )) as IAlgebraPool;
    await algebraPool.initialize(encodePriceSqrt("1", "1"));

    let nonce = await algebraEternalFarming.numOfIncentives();

    await token1.approve(await algebraEternalFarming.getAddress(), bonusReward);
    await token2.approve(await algebraEternalFarming.getAddress(), totalReward);


    let pluginAddress = await algebraPool.plugin();


    await algebraEternalFarming.createEternalFarming(
      {
        pool: await algebraPool.getAddress(),
        rewardToken: await token2.getAddress(),
        bonusRewardToken: await token1.getAddress(),
        nonce,
      },
      {
        reward: totalReward,
        bonusReward: bonusReward,
        rewardRate: ethers.parseEther("1"),
        bonusRewardRate: ethers.parseEther("0.03"),
        minimalPositionWidth: 1,
      },
      pluginAddress
    );

    await algebraVaultFactory
      .connect(wallet)
      .createAlgebraVault(await token0.getAddress(), true, await token1.getAddress(), false);

    const vaultKey = await algebraVaultFactory.genKey(
      await wallet.getAddress(),
      await token0.getAddress(),
      await token1.getAddress(),
      true,
      false
    );
    const algebraVaultAddress = await algebraVaultFactory.getAlgebraVault(vaultKey);
    algebraVault = (await ethers.getContractAt(
      "AlgebraVault",
      algebraVaultAddress
    )) as AlgebraVault;

    await expect(
      algebraVault
        .connect(wallet)
        .setDepositMax(
          ethers.parseEther("100000"),
          ethers.parseEther("100000")
        )
    )
      .to.emit(algebraVault, "DepositMax")
      .withArgs(
        await wallet.getAddress(),
        ethers.parseEther("100000"),
        ethers.parseEther("100000")
      );

    // adding extra liquidity into pool to make sure there's always
    // someone to swap with
    await token0.mint(await carol.getAddress(), giantTokenAmount);
    await token1.mint(await carol.getAddress(), giantTokenAmount);

    await token0.connect(carol).approve(await nft.getAddress(), veryLargeTokenAmount);
    await token1.connect(carol).approve(await nft.getAddress(), veryLargeTokenAmount);

    await token0.connect(carol).approve(await router.getAddress(), veryLargeTokenAmount);
    await token1.connect(carol).approve(await router.getAddress(), veryLargeTokenAmount);

    await nft.connect(carol).mint({
      token0: await token0.getAddress(),
      token1: await token1.getAddress(),
      deployer: NULL_ADDRESS,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      recipient: await carol.getAddress(),
      amount0Desired: veryLargeTokenAmount,
      amount1Desired: veryLargeTokenAmount,
      amount0Min: 0,
      amount1Min: 0,
      deadline: 2000000000,
    });

    await network.provider.send("evm_increaseTime", [3600]);
  });

  describe("With deposits", () => {
    beforeEach("setup", async () => {
      // alice approves the AlgebraVault to transfer her tokens
      await token0
        .connect(alice)
        .approve(await algebraVault.getAddress(), largeTokenAmount);
      await token1
        .connect(alice)
        .approve(await algebraVault.getAddress(), largeTokenAmount);
      // mint tokens to alice
      await token0.mint(await alice.getAddress(), largeTokenAmount);
      await token1.mint(await alice.getAddress(), largeTokenAmount);

      await token0.connect(bob).approve(await algebraVault.getAddress(), largeTokenAmount);
      await token1.connect(bob).approve(await algebraVault.getAddress(), largeTokenAmount);
      // mint tokens to Bob
      await token0.mint(await bob.getAddress(), largeTokenAmount);
      await token1.mint(await bob.getAddress(), largeTokenAmount);

      await token0
        .connect(carol)
        .approve(await algebraVault.getAddress(), largeTokenAmount);
      await token1
        .connect(carol)
        .approve(await algebraVault.getAddress(), largeTokenAmount);
      // mint tokens to Bob
      await token0.mint(await carol.getAddress(), largeTokenAmount);
      await token1.mint(await carol.getAddress(), largeTokenAmount);
    });

    it("Enters farming on rebalance", async () => {
      await algebraVault
        .connect(alice)
        .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());

      await algebraVault.connect(wallet).rebalance(-1800, -60, 60, 15000, 0);
      const balance0 = await token0.balanceOf(await algebraVault.getAddress());
      const balance1 = await token1.balanceOf(await algebraVault.getAddress());
      expect(balance0).to.be.equal(0);
      expect(balance1).to.be.equal(0);

      expect(await nft.tokenFarmedIn(2)).to.be.equal(await farmingCenter.getAddress());
    });

    it("CollectRewards()", async () => {
      await algebraVault
        .connect(alice)
        .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());

              await algebraVault.setFarmingRewardsDistributor(await other.getAddress());
      await algebraVault.connect(wallet).rebalance(-1800, -60, 60, 15000, 0);


      await router.connect(carol).exactInputSingle({
        tokenIn: await token1.getAddress(),
        tokenOut: await token0.getAddress(),
        deployer: NULL_ADDRESS,
        recipient: await carol.getAddress(),
        deadline: 9999999999999,
        amountIn: veryLargeTokenAmount,
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      });

      await network.provider.send("evm_increaseTime", [3600]);

      await algebraVault.collectRewards();
      const rewardBalance = await token2.balanceOf(await other.getAddress());
      const bonusRewardBalance = await token1.balanceOf(await other.getAddress());

      expect(rewardBalance).to.be.greaterThan(0);
      expect(bonusRewardBalance).to.be.greaterThan(0);
    });

    describe("Rewards Distribution", () => {
      let farmingRewardsDistributor: IFarmingRewardsDistributor;

      beforeEach("Earn initial rewards", async () => {
        farmingRewardsDistributor = (await ethers.getContractAt(
          "FarmingRewardsDistributor",
          await algebraVault.farmingRewardsDistributor()
        )) as IFarmingRewardsDistributor;
        await farmingRewardsDistributor.addReward(await token2.getAddress());
        await farmingRewardsDistributor.addReward(await token1.getAddress());

        await token0.approve(await algebraVault.getAddress(), veryLargeTokenAmount);
        await token1.approve(await algebraVault.getAddress(), veryLargeTokenAmount);

        await algebraVault.deposit(
          ethers.parseEther("1"),
          0,
          await wallet.getAddress()
        );
        await algebraVault.approve(
          await farmingRewardsDistributor.getAddress(),
          giantTokenAmount
        );

        await algebraVault.connect(wallet).rebalance(-1800, -60, 60, 15000, 0);
        await router.connect(carol).exactInputSingle({
          tokenIn: await token1.getAddress(),
          tokenOut: await token0.getAddress(),
          deployer: NULL_ADDRESS,
          recipient: await carol.getAddress(),
          deadline: 9999999999999,
          amountIn: veryLargeTokenAmount,
          amountOutMinimum: 0,
          limitSqrtPrice: 0,
        });

        await network.provider.send("evm_increaseTime", [3600]);
        await network.provider.send("evm_mine");
      });

      it("Collects rewards on first stake but does not update", async () => {
        await algebraVault
          .connect(alice)
          .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());
        await algebraVault
          .connect(alice)
          .approve(await farmingRewardsDistributor.getAddress(), giantTokenAmount);

        const lpBalance = await algebraVault.balanceOf(await alice.getAddress());
        await farmingRewardsDistributor
          .connect(alice)
          .stake(lpBalance, await alice.getAddress());

        const rewardData = await farmingRewardsDistributor.rewardData(
          await token2.getAddress()
        );
        expect(rewardData[2]).to.be.equal(0);

        const rewardBalance = await token2.balanceOf(
          await farmingRewardsDistributor.getAddress()
        );
        const bonusRewardBalance = await token1.balanceOf(
          await farmingRewardsDistributor.getAddress()
        );

        expect(rewardBalance).to.be.greaterThan(0);
        expect(bonusRewardBalance).to.be.greaterThan(0);
      });

      it("Should handle rewards accrual when no users are staking", async () => {
        await algebraVault.collectRewards();

        // Get initial rewards in the distributor
        const initialToken2Balance = await token2.balanceOf(
          await farmingRewardsDistributor.getAddress()
        );
        const initialToken1Balance = await token1.balanceOf(
          await farmingRewardsDistributor.getAddress()
        );

        expect(initialToken2Balance).to.be.greaterThan(0);
        expect(initialToken1Balance).to.be.greaterThan(0);

        // Verify rewardPerToken remains 0 when no stakers
        const rewardDataToken2 = await farmingRewardsDistributor.rewardData(
          await token2.getAddress()
        );
        expect(rewardDataToken2[2]).to.equal(0); // rewardPerToken should be 0

        // Now add a staker
        await algebraVault
          .connect(alice)
          .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());
        await algebraVault
          .connect(alice)
          .approve(await farmingRewardsDistributor.getAddress(), giantTokenAmount);

        const aliceLpBalance = await algebraVault.balanceOf(await alice.getAddress());
        await farmingRewardsDistributor
          .connect(alice)
          .stake(aliceLpBalance, await alice.getAddress());

        // Generate more rewards
        // await plugin.updateVirtualPoolTick(550, false);
        await network.provider.send("evm_increaseTime", [3600]);
        await algebraVault.collectRewards();
        await farmingRewardsDistributor.updateReward();

        // Check that rewardPerToken is now updated
        const updatedRewardDataToken2 =
          await farmingRewardsDistributor.rewardData(await token2.getAddress());
        expect(updatedRewardDataToken2[2]).to.be.greaterThan(0);

        // New rewards should only include those generated after staking
        const [, amounts] = await farmingRewardsDistributor.claimableRewards(
          await alice.getAddress()
        );

        // Alice should get all new rewards but including the initial ones
        const currentToken2Balance = await token2.balanceOf(
          await farmingRewardsDistributor.getAddress()
        );

        expect(amounts[0]).to.be.closeTo(currentToken2Balance, 1);
      });

      describe("Not first stakers", () => {
        beforeEach("Clean rewards", async () => {
          await farmingRewardsDistributor.stake(
            await algebraVault.balanceOf(await wallet.getAddress()),
            await wallet.getAddress()
          );

          // Reset rewards for the subsequent tests
          await farmingRewardsDistributor.updateReward();

          await farmingRewardsDistributor.unstake(
            await farmingRewardsDistributor.totalBalance(await wallet.getAddress())
          );
          await farmingRewardsDistributor.getReward(await wallet.getAddress(), [
            await token1.getAddress(),
            await token2.getAddress(),
          ]);
        });

        it("Should handle unstaking correctly and update reward claims", async () => {
          // Setup initial stake
          await algebraVault
            .connect(alice)
            .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());
          await algebraVault
            .connect(alice)
            .approve(await farmingRewardsDistributor.getAddress(), giantTokenAmount);

          let aliceLpBalance = await algebraVault.balanceOf(await alice.getAddress());
          await farmingRewardsDistributor
            .connect(alice)
            .stake(aliceLpBalance, await alice.getAddress());
          await farmingRewardsDistributor.updateReward();

          // Get starting claimable rewards
          const [, startingAmounts] =
            await farmingRewardsDistributor.claimableRewards(await alice.getAddress());

          // Generate some rewards
          // await plugin.updateVirtualPoolTick(550, false);
          await network.provider.send("evm_increaseTime", [3600]);
          await algebraVault.collectRewards();
          await farmingRewardsDistributor.updateReward();

          // Get initial claimable rewards
          const [, initialAmounts] =
            await farmingRewardsDistributor.claimableRewards(await alice.getAddress());

          // Unstake half of the tokens
          const totalStaked = await farmingRewardsDistributor.totalBalance(
            await alice.getAddress()
          );
          const beforeUnstakeBalance = await token2.balanceOf(await alice.getAddress());
          await farmingRewardsDistributor
            .connect(alice)
            .unstake(totalStaked / 2n);
          const afterUnstakeBalance = await token2.balanceOf(await alice.getAddress());
          const claimedRewards = afterUnstakeBalance - beforeUnstakeBalance;

          // Slightly more rewards, because of accumulation while unstaking
          expect(claimedRewards).to.be.closeTo(
            initialAmounts[0],
            ethers.parseEther("1")
          );

          // Generate more rewards
          // await plugin.updateVirtualPoolTick(600, false);
          await network.provider.send("evm_increaseTime", [3600]);
          await algebraVault.collectRewards();
          await farmingRewardsDistributor.updateReward();

          // Get final claimable rewards
          const [, finalAmounts] =
            await farmingRewardsDistributor.claimableRewards(await alice.getAddress());

          // New rewards should accrue at half the rate (since half tokens unstaked)
          const previousReward = initialAmounts[0] - startingAmounts[0];
          const newRewardsAccrued = finalAmounts[0]
            - previousReward
            - startingAmounts[0]
            + claimedRewards;
          const previousTotalRewards = previousReward * 2n; // Double the claimed amount as estimate

          const accruedRewardsDiff = (newRewardsAccrued * 100n) / previousTotalRewards;

          // With 50% of original tokens, rewards should be ~50% of what they were before
          expect(accruedRewardsDiff).to.be.within(45, 55); // Allow for some rounding
        });

        it("Handles getReward for specific reward tokens correctly", async () => {
          // Setup Bob for testing
          await token0.mint(await bob.getAddress(), largeTokenAmount);
          await token1.mint(await bob.getAddress(), largeTokenAmount);
          await token0
            .connect(bob)
            .approve(await algebraVault.getAddress(), largeTokenAmount);
          await token1
            .connect(bob)
            .approve(await algebraVault.getAddress(), largeTokenAmount);
          await algebraVault
            .connect(bob)
            .deposit(ethers.parseEther("2000"), 0, await bob.getAddress());

          // Rebalance to enter farming
          await algebraVault
            .connect(wallet)
            .rebalance(60, 15000, -1800, -60, 0);

          // Generate rewards
          // await plugin.updateVirtualPoolTick(500, false);
          await network.provider.send("evm_increaseTime", [3600]);
          await algebraVault.collectRewards();

          // Stake LP tokens
          const bobLpBalance = await algebraVault.balanceOf(await bob.getAddress());
          await algebraVault
            .connect(bob)
            .approve(await farmingRewardsDistributor.getAddress(), bobLpBalance);
          await farmingRewardsDistributor
            .connect(bob)
            .stake(bobLpBalance, await bob.getAddress());

          // Generate more rewards
          // await plugin.updateVirtualPoolTick(550, false);
          await network.provider.send("evm_increaseTime", [3600]);
          await algebraVault.collectRewards();
          await farmingRewardsDistributor.updateReward();

          // Check initial balances
          const initialToken2Balance = await token2.balanceOf(await bob.getAddress());
          const initialToken1Balance = await token1.balanceOf(await bob.getAddress());

          // Get claimable amounts for reference
          const [, amounts] = await farmingRewardsDistributor.claimableRewards(
            await bob.getAddress()
          );
          const expectedToken2Reward = amounts[0];
          const expectedToken1Reward = amounts[1];

          // Claim only token2 rewards
          const rewardsToGet = [await token2.getAddress()];
          const claimTx = await farmingRewardsDistributor
            .connect(bob)
            .getReward(await bob.getAddress(), rewardsToGet);
          const claimReceipt = await claimTx.wait();

          // Extract claimed amounts from RewardPaid events using logs
          if (!claimReceipt) throw new Error("Receipt is null");
          
          const rewardPaidTopic = farmingRewardsDistributor.interface.getEvent("RewardPaid")?.topicHash;
          const rewardPaidLogs = claimReceipt.logs.filter(log => log.topics[0] === rewardPaidTopic);
          
          expect(rewardPaidLogs.length).to.equal(1);
          const token2Address = await token2.getAddress();
          const parsedLog = farmingRewardsDistributor.interface.parseLog({
            topics: [...rewardPaidLogs[0].topics],
            data: rewardPaidLogs[0].data
          });
          expect(parsedLog).to.not.be.null;
          const claimedToken2Amount = parsedLog?.args.reward;

          // Check that only token2 was claimed
          const finalToken2Balance = await token2.balanceOf(await bob.getAddress());
          const finalToken1Balance = await token1.balanceOf(await bob.getAddress());

          expect(claimedToken2Amount).to.be.closeTo(
            expectedToken2Reward,
            ethers.parseEther("1")
          );
          expect(finalToken2Balance).to.be.closeTo(
            initialToken2Balance + expectedToken2Reward,
            ethers.parseEther("1")
          );
          expect(finalToken1Balance).to.be.equal(initialToken1Balance); // Should remain unchanged

          // Now claim token1 rewards
          const token1RewardsToGet = [await token1.getAddress()];
          const token1ClaimTx = await farmingRewardsDistributor
            .connect(bob)
            .getReward(await bob.getAddress(), token1RewardsToGet);
          const token1ClaimReceipt = await token1ClaimTx.wait();

          // Extract claimed amounts from RewardPaid events using logs
          if (!token1ClaimReceipt) throw new Error("Receipt is null");
          
          const token1RewardPaidLogs = token1ClaimReceipt.logs.filter(log => log.topics[0] === rewardPaidTopic);
          const token1Address = await token1.getAddress();
          const token1ParsedLog = farmingRewardsDistributor.interface.parseLog({
            topics: [...token1RewardPaidLogs[0].topics],
            data: token1RewardPaidLogs[0].data
          });
          const claimedToken1Amount = token1ParsedLog?.args.reward;

          // Verify token1 was claimed correctly
          const afterToken1ClaimBalance = await token1.balanceOf(await bob.getAddress());
          expect(claimedToken1Amount).to.be.closeTo(
            expectedToken1Reward,
            ethers.parseEther("1")
          );
          expect(afterToken1ClaimBalance).to.be.closeTo(
            initialToken1Balance + expectedToken1Reward,
            ethers.parseEther("1")
          );
        });

        it("Distributes rewards correctly between multiple users", async () => {
          // Setup Bob's account
          await token0.mint(await bob.getAddress(), largeTokenAmount);
          await token1.mint(await bob.getAddress(), largeTokenAmount);
          await token0
            .connect(bob)
            .approve(await algebraVault.getAddress(), largeTokenAmount);
          await token1
            .connect(bob)
            .approve(await algebraVault.getAddress(), largeTokenAmount);

          // Both deposit

          await algebraVault
            .connect(alice)
            .deposit(ethers.parseEther("2000"), 0, await alice.getAddress());
          await algebraVault
            .connect(bob)
            .deposit(ethers.parseEther("1000"), 0, await bob.getAddress());

          // Rebalance to enter farming
          await algebraVault
            .connect(wallet)
            .rebalance(120, 15000, -1800, -60, 0);

          // Both stake their LP tokens
          const aliceLpBalance = await algebraVault.balanceOf(await alice.getAddress());
          const bobLpBalance = await algebraVault.balanceOf(await bob.getAddress());
          await algebraVault
            .connect(alice)
            .approve(await farmingRewardsDistributor.getAddress(), aliceLpBalance);
          await algebraVault
            .connect(bob)
            .approve(await farmingRewardsDistributor.getAddress(), bobLpBalance);

          await farmingRewardsDistributor
            .connect(alice)
            .stake(aliceLpBalance, await alice.getAddress());
          await farmingRewardsDistributor
            .connect(bob)
            .stake(bobLpBalance, await bob.getAddress());

          // Fast forward to accumulate more rewards
          // await plugin.updateVirtualPoolTick(600, false);
          await network.provider.send("evm_increaseTime", [7200]);
          await algebraVault.collectRewards();
          await farmingRewardsDistributor.updateReward();

          // Check rewards distribution proportions
          const [, aliceAmounts] =
            await farmingRewardsDistributor.claimableRewards(await alice.getAddress());
          const [, bobAmounts] =
            await farmingRewardsDistributor.claimableRewards(await bob.getAddress());

          // Alice should have approximately 2x the rewards of Bob based on stake ratio
          const aliceReward = aliceAmounts[0];
          const bobReward = bobAmounts[0];
          const ratio = (aliceReward * 100n) / bobReward;

          // Allow some margin of error, but ratio should be close to 200 (2:1)
          expect(ratio).to.be.within(190, 210);

          // Claim rewards and verify they received the correct amounts
          const aliceRewardsBefore = await token2.balanceOf(await alice.getAddress());
          const bobRewardsBefore = await token2.balanceOf(await bob.getAddress());

          await farmingRewardsDistributor.connect(alice).getAllRewards();
          await farmingRewardsDistributor.connect(bob).getAllRewards();

          const aliceRewardsAfter = await token2.balanceOf(await alice.getAddress());
          const bobRewardsAfter = await token2.balanceOf(await bob.getAddress());

          const aliceRewardsClaimed = aliceRewardsAfter - aliceRewardsBefore;
          const bobRewardsClaimed = bobRewardsAfter - bobRewardsBefore;

          expect(aliceRewardsClaimed).to.be.closeTo(
            aliceReward,
            ethers.parseEther("1")
          );
          expect(bobRewardsClaimed).to.be.closeTo(
            bobReward,
            ethers.parseEther("1")
          );
        });

        it("Updates rewards on the subsequent stakes", async () => {
          await algebraVault
            .connect(alice)
            .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());
          await algebraVault
            .connect(alice)
            .approve(await farmingRewardsDistributor.getAddress(), giantTokenAmount);

          let lpBalance = await algebraVault.balanceOf(await alice.getAddress());
          await farmingRewardsDistributor
            .connect(alice)
            .stake(lpBalance / 2n, await alice.getAddress());

          lpBalance = await algebraVault.balanceOf(await alice.getAddress());

          await farmingRewardsDistributor
            .connect(alice)
            .stake(lpBalance, await alice.getAddress());

          await network.provider.send("evm_increaseTime", [7200]);

          const rewardData = await farmingRewardsDistributor.rewardData(
            await token2.getAddress()
          );
          const rewardDataBonus = await farmingRewardsDistributor.rewardData(
            await token2.getAddress()
          );
          expect(rewardData[2]).to.be.greaterThan(0);
          expect(rewardDataBonus[2]).to.be.greaterThan(0);

          await farmingRewardsDistributor.updateReward();
          const rewardBalance = await token2.balanceOf(
            await farmingRewardsDistributor.getAddress()
          );
          const bonusRewardBalance = await token1.balanceOf(
            await farmingRewardsDistributor.getAddress()
          );

          const [claimableTokens, claimableAmounts] =
            await farmingRewardsDistributor.claimableRewards(await alice.getAddress());
          expect(claimableTokens[0]).to.be.equal(await token2.getAddress());
          expect(claimableTokens[1]).to.be.equal(await token1.getAddress());
          expect(claimableAmounts[0]).to.be.closeTo(rewardBalance, 2);
          expect(claimableAmounts[1]).to.be.closeTo(bonusRewardBalance, 2);
        });

        it("Transfers rewards to distributor contract on alm deposit", async () => {
          await algebraVault
            .connect(alice)
            .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());
          await algebraVault
            .connect(alice)
            .approve(await farmingRewardsDistributor.getAddress(), giantTokenAmount);

          let lpBalance = await algebraVault.balanceOf(await alice.getAddress());
          await farmingRewardsDistributor
            .connect(alice)
            .stake(lpBalance, await alice.getAddress());

          const rewardsBeforeData = await token2.balanceOf(
            await farmingRewardsDistributor.getAddress()
          );

          await network.provider.send("evm_increaseTime", [7200]);
          await algebraVault
            .connect(alice)
            .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());

          const rewardsAfterData = await token2.balanceOf(
            await farmingRewardsDistributor.getAddress()
          );

          expect(rewardsAfterData).to.be.greaterThan(rewardsBeforeData);
        });

        it("Transfers rewards to distributor contract on rebalance", async () => {
          await algebraVault
            .connect(alice)
            .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());
          await algebraVault
            .connect(alice)
            .approve(await farmingRewardsDistributor.getAddress(), giantTokenAmount);

          let lpBalance = await algebraVault.balanceOf(await alice.getAddress());
          await farmingRewardsDistributor
            .connect(alice)
            .stake(lpBalance, await alice.getAddress());

          const rewardsBeforeData = await token2.balanceOf(
            await farmingRewardsDistributor.getAddress()
          );

          await network.provider.send("evm_increaseTime", [7200]);
          await algebraVault
            .connect(wallet)
            .rebalance(-1800, -60, 60, 15000, 0);

          const rewardsAfterData = await token2.balanceOf(
            await farmingRewardsDistributor.getAddress()
          );

          expect(rewardsAfterData).to.be.greaterThan(rewardsBeforeData);
        });

        it("Transfers rewards to distributor contract on withdraw", async () => {
          await algebraVault
            .connect(alice)
            .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());
          await algebraVault
            .connect(alice)
            .approve(await farmingRewardsDistributor.getAddress(), giantTokenAmount);

          let lpBalance = await algebraVault.balanceOf(await alice.getAddress());

          await farmingRewardsDistributor
            .connect(alice)
            .stake(lpBalance - 1000000n, await alice.getAddress());

          const rewardsBeforeData = await token2.balanceOf(
            await farmingRewardsDistributor.getAddress()
          );

          await network.provider.send("evm_increaseTime", [7200]);
          await algebraVault.connect(alice).withdraw(1000000, await alice.getAddress());

          const rewardsAfterData = await token2.balanceOf(
            await farmingRewardsDistributor.getAddress()
          );

          expect(rewardsAfterData).to.be.greaterThan(rewardsBeforeData);
        });

        it("Distribute reward after blurred shares", async () => {
          //prepare
          await algebraVault
            .connect(alice)
            .deposit(ethers.parseEther("10000"), 0, await alice.getAddress());
          await algebraVault
            .connect(bob)
            .deposit(ethers.parseEther("10000"), 0, await bob.getAddress());
          let bob_liq_amount = await algebraVault.balanceOf(await bob.getAddress());
          await algebraVault.connect(bob).withdraw(bob_liq_amount, await bob.getAddress());

          await algebraVault
            .connect(wallet)
            .rebalance(120, 15000, -1800, -60, 0);

          await algebraVault
            .connect(carol)
            .deposit(ethers.parseEther("10000"), 0, await carol.getAddress());
          let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
          let carol_liq_balance = await algebraVault.balanceOf(await carol.getAddress());
          await algebraVault
            .connect(alice)
            .approve(await farmingRewardsDistributor.getAddress(), veryLargeTokenAmount);
          await algebraVault
            .connect(carol)
            .approve(await farmingRewardsDistributor.getAddress(), veryLargeTokenAmount);

          await farmingRewardsDistributor
            .connect(alice)
            .stake(alice_liq_balance, await alice.getAddress());
          await farmingRewardsDistributor
            .connect(carol)
            .stake(carol_liq_balance, await carol.getAddress());

          // Fast forward to accumulate more rewards
          // await plugin.updateVirtualPoolTick(600, false);
          await network.provider.send("evm_increaseTime", [7200]);
          await algebraVault.collectRewards();
          await farmingRewardsDistributor.updateReward();

          // Check rewards distribution proportions
          const [, aliceAmounts] =
            await farmingRewardsDistributor.claimableRewards(await alice.getAddress());
          const [, carolAmounts] =
            await farmingRewardsDistributor.claimableRewards(await carol.getAddress());

        });

        it("Puase/Unpause stake", async () => {
          await algebraVault
            .connect(alice)
            .deposit(ethers.parseEther("1"), 0, await alice.getAddress());
          await algebraVault
            .connect(alice)
            .approve(await farmingRewardsDistributor.getAddress(), veryLargeTokenAmount);
          const aliceLpBalance = await algebraVault.balanceOf(await alice.getAddress());

          await expect(farmingRewardsDistributor.connect(alice).pause()).to.be
            .reverted;
          await farmingRewardsDistributor.connect(wallet).pause();

          await expect(
            farmingRewardsDistributor
              .connect(alice)
              .stake(aliceLpBalance, await alice.getAddress())
          ).to.be.reverted;

          await farmingRewardsDistributor.connect(wallet).unpause();
          await farmingRewardsDistributor
            .connect(alice)
            .stake(aliceLpBalance, await alice.getAddress());
        });

        it("Recover erc20", async () => {
          await token3.mint(
            await farmingRewardsDistributor.getAddress(),
            veryLargeTokenAmount
          );
          await expect(
            farmingRewardsDistributor
              .connect(wallet)
              .recoverERC20(await token3.getAddress(), veryLargeTokenAmount)
          ).to.be.emit(farmingRewardsDistributor, "Recovered");

          await algebraVault
            .connect(alice)
            .deposit(ethers.parseEther("1000"), 0, await alice.getAddress());
          await algebraVault
            .connect(alice)
            .approve(await farmingRewardsDistributor.getAddress(), giantTokenAmount);
          await farmingRewardsDistributor
            .connect(alice)
            .stake(await algebraVault.balanceOf(await alice.getAddress()), await alice.getAddress());

          await token2.approve(await algebraEternalFarming.getAddress(), giantTokenAmount);
          await token1.approve(await algebraEternalFarming.getAddress(), giantTokenAmount);
          await algebraEternalFarming.addRewards(
            {
              pool: await algebraPool.getAddress(),
              rewardToken: await token2.getAddress(),
              bonusRewardToken: await token1.getAddress(),
              nonce: 0,
            },
            ethers.parseEther("1"),
            ethers.parseEther("1")
          );

          await network.provider.send("evm_increaseTime", [7200]);

          expect(
            farmingRewardsDistributor.connect(alice).getAllRewards()
          ).to.emit(farmingRewardsDistributor, "RewardPaid");
        });
        it("check getUserRewardPerToken",async()=>{
          await farmingRewardsDistributor.getUserRewardPerToken(await alice.getAddress(),await token0.getAddress());
        })
        it("check getUserData", async()=>{
          await farmingRewardsDistributor.getUserData(await alice.getAddress());
        })
      });
    });

    describe("Farming detach", () => {
      let farmingRewardsDistributor: IFarmingRewardsDistributor;

      beforeEach("Earn initial rewards", async () => {
        farmingRewardsDistributor = (await ethers.getContractAt(
          "FarmingRewardsDistributor",
          await algebraVault.farmingRewardsDistributor()
        )) as IFarmingRewardsDistributor;

        // Add reward tokens to whitelist
        await farmingRewardsDistributor.addReward(await token2.getAddress());
        await farmingRewardsDistributor.addReward(await token1.getAddress());

        await token0.approve(await algebraVault.getAddress(), veryLargeTokenAmount);
        await token1.approve(await algebraVault.getAddress(), veryLargeTokenAmount);

        await algebraVault.deposit(
          ethers.parseEther("1"),
          0,
          await wallet.getAddress()
        );
        await algebraVault.approve(
          await farmingRewardsDistributor.getAddress(),
          giantTokenAmount
        );

        await algebraVault.connect(wallet).rebalance(-1800, -60, 60, 15000, 0);
        await router.connect(carol).exactInputSingle({
          tokenIn: await token1.getAddress(),
          tokenOut: await token0.getAddress(),
          deployer: NULL_ADDRESS,
          recipient: await carol.getAddress(),
          deadline: 9999999999999,
          amountIn: veryLargeTokenAmount,
          amountOutMinimum: 0,
          limitSqrtPrice: 0,
        });

        await network.provider.send("evm_increaseTime", [3600]);

        await farmingRewardsDistributor.stake(
          await algebraVault.balanceOf(await wallet.getAddress()),
          await wallet.getAddress()
        );

        // Reset rewards for the subsequent tests
        await farmingRewardsDistributor.updateReward();

        await farmingRewardsDistributor.unstake(
          await farmingRewardsDistributor.totalBalance(await wallet.getAddress())
        );
        await farmingRewardsDistributor.getReward(await wallet.getAddress(), [
          await token1.getAddress(),
          await token2.getAddress(),
        ]);
      });

      it("pos has rewards after detach", async () => {
        await algebraVault
          .connect(alice)
          .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());
        await algebraVault
          .connect(alice)
          .approve(await farmingRewardsDistributor.getAddress(), giantTokenAmount);

        let lpBalance = await algebraVault.balanceOf(await alice.getAddress());
        await farmingRewardsDistributor
          .connect(alice)
          .stake(lpBalance / 2n, await alice.getAddress());

        const rewardsBeforeData = await token2.balanceOf(
          await farmingRewardsDistributor.getAddress()
        );

        await network.provider.send("evm_increaseTime", [7200]);
        await algebraEternalFarming.deactivateIncentive({
          pool: await algebraPool.getAddress(),
          rewardToken: await token2.getAddress(),
          bonusRewardToken: await token1.getAddress(),
          nonce: 0,
        });

        await token1.approve(await algebraEternalFarming.getAddress(), bonusReward);
        await token2.approve(await algebraEternalFarming.getAddress(), totalReward);

        // Get plugin address - handle potential empty return
        let pluginAddress: string;
        try {
          pluginAddress = await algebraPool.plugin();
        } catch (e) {
          pluginAddress = "0x0000000000000000000000000000000000000000";
        }

        await algebraEternalFarming.createEternalFarming(
          {
            pool: await algebraPool.getAddress(),
            rewardToken: await token2.getAddress(),
            bonusRewardToken: await token1.getAddress(),
            nonce: 1,
          },
          {
            reward: totalReward,
            bonusReward: bonusReward,
            rewardRate: ethers.parseEther("1"),
            bonusRewardRate: ethers.parseEther("0.03"),
            minimalPositionWidth: 1,
          },
          pluginAddress
        );

        await algebraVault
          .connect(alice)
          .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());
      });

      it("ALM participates in new farming after detach", async () => {
        await algebraVault
          .connect(alice)
          .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());
        await algebraVault
          .connect(alice)
          .approve(await farmingRewardsDistributor.getAddress(), giantTokenAmount);

        let lpBalance = await algebraVault.balanceOf(await alice.getAddress());
        await farmingRewardsDistributor
          .connect(alice)
          .stake(lpBalance / 2n, await alice.getAddress());

        await network.provider.send("evm_increaseTime", [7200]);
        await algebraEternalFarming.deactivateIncentive({
          pool: await algebraPool.getAddress(),
          rewardToken: await token2.getAddress(),
          bonusRewardToken: await token1.getAddress(),
          nonce: 0,
        });

        await token1.approve(await algebraEternalFarming.getAddress(), bonusReward);
        await token2.approve(await algebraEternalFarming.getAddress(), totalReward);

        // Get plugin address - handle potential empty return
        let pluginAddress: string;
        try {
          pluginAddress = await algebraPool.plugin();
        } catch (e) {
          pluginAddress = "0x0000000000000000000000000000000000000000";
        }

        await algebraEternalFarming.createEternalFarming(
          {
            pool: await algebraPool.getAddress(),
            rewardToken: await token2.getAddress(),
            bonusRewardToken: await token1.getAddress(),
            nonce: 1,
          },
          {
            reward: totalReward,
            bonusReward: bonusReward,
            rewardRate: ethers.parseEther("1"),
            bonusRewardRate: ethers.parseEther("0.03"),
            minimalPositionWidth: 1,
          },
          pluginAddress
        );

        await algebraVault.connect(wallet).rebalance(-1800, -60, 60, 15000, 0);
        const incentiveId = await farmingCenter.deposits(3); // last pos id

        let res = await farmingCenter.incentiveKeys(incentiveId);
        expect(res.nonce).to.be.eq(1); // alm pos in new farming
      });

      it("Add new token as reward", async () => {
        await algebraVault
          .connect(alice)
          .deposit(ethers.parseEther("1"), 0, await alice.getAddress());
        await algebraVault
          .connect(alice)
          .approve(await farmingRewardsDistributor.getAddress(), giantTokenAmount);
        let lpBalance = await algebraVault.balanceOf(await alice.getAddress());
        await farmingRewardsDistributor
          .connect(alice)
          .stake(lpBalance, await alice.getAddress());

        await network.provider.send("evm_increaseTime", [7200]);
        await algebraEternalFarming.deactivateIncentive({
          pool: await algebraPool.getAddress(),
          rewardToken: await token2.getAddress(),
          bonusRewardToken: await token1.getAddress(),
          nonce: 0,
        });

        let nonce = await algebraEternalFarming.numOfIncentives();
        await token3.approve(await algebraEternalFarming.getAddress(), totalReward);

        // Get plugin address - handle potential empty return
        let pluginAddress: string;
        try {
          pluginAddress = await algebraPool.plugin();
        } catch (e) {
          pluginAddress = "0x0000000000000000000000000000000000000000";
        }

        await algebraEternalFarming.createEternalFarming(
          {
            pool: await algebraPool.getAddress(),
            rewardToken: await token3.getAddress(),
            bonusRewardToken: NULL_ADDRESS,
            nonce,
          },
          {
            reward: totalReward,
            bonusReward: 0,
            rewardRate: ethers.parseEther("0.01"),
            bonusRewardRate: 0,
            minimalPositionWidth: 1,
          },
          pluginAddress
        );
        await expect(
          algebraVault.connect(wallet).rebalance(-1800, -60, 60, 15000, 0)
        )
          .to.be.emit(algebraPool, "Mint")
          .to.be.emit(algebraEternalFarming, "FarmEntered");

        await farmingRewardsDistributor.addReward(await token3.getAddress());

        await network.provider.send("evm_increaseTime", [7200]);

        await expect(
          farmingRewardsDistributor.connect(alice).getAllRewards()
        ).to.be.emit(algebraEternalFarming, "RewardsCollected");
      });
    });
  });
});
