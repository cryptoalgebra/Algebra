import { PairFlash } from "../types/contracts/mocks/TestFlashloan.sol/PairFlash";
import {
  IAlgebraFactory,
  IAlgebraPool,
  AlgebraVault,
  AlgebraVaultFactory,
  INonfungiblePositionManager,
  ISwapRouter,
  TestERC20,
  TestOracle,
  AlgebraVaultDepositGuard,
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
const PERCENT_100 = "1000000000000000000";
const PERCENT_50 = "500000000000000000";
const PERCENT_40 = "400000000000000000";
const PERCENT_20 = "200000000000000000";
const PERCENT_10 = "100000000000000000";

const MIN_SHARES = 1000000;

const smallTokenAmount = ethers.parseEther("1000");
const largeTokenAmount = ethers.parseEther("1000000");
const veryLargeTokenAmount = ethers.parseEther("10000000000");
const giantTokenAmount = ethers.parseEther("1000000000000");

describe("AlgebraVault General Functionality", () => {
  let wallet: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;
  let other: HardhatEthersSigner;
  let user0: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let user4: HardhatEthersSigner;

  let factory: IAlgebraFactory;
  let router: ISwapRouter;
  let nft: INonfungiblePositionManager;
  let oracle: TestOracle;
  let token0: TestERC20;
  let token1: TestERC20;
  let token2: TestERC20;
  let algebraPool: IAlgebraPool;
  let algebraVaultFactory: AlgebraVaultFactory;
  let depositGuard: AlgebraVaultDepositGuard;
  let algebraVault: AlgebraVault;

  before("create fixture loader", async () => {
    [wallet, alice, bob, carol, other, user0, user1, user2, user3, user4] =
      await (ethers as any).getSigners();
  });

  beforeEach("deploy contracts", async () => {
    ({
      token0,
      token1,
      token2,
      factory,
      router,
      nft,
      oracle,
      algebraVaultFactory,
      depositGuard,
    } = await loadFixture(algebraVaultTestFixture));
   
    await algebraVaultFactory.connect(wallet).setFeeRecipient(await other.getAddress());

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

    await algebraVaultFactory
      .connect(wallet)
      .createAlgebraVault(await token0.getAddress(), true, await token1.getAddress(), false);

    // adding extra liquidity into pool to make sure there's always
    // someone to swap with
    await token0.mint(await carol.getAddress(), giantTokenAmount);
    await token1.mint(await carol.getAddress(), giantTokenAmount);

    

    await token0.connect(carol).approve(await nft.getAddress(), veryLargeTokenAmount);
    await token1.connect(carol).approve(await nft.getAddress(), veryLargeTokenAmount);

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

    const vaultKey = await algebraVaultFactory.genKey(
      await wallet.getAddress(),
      await token0.getAddress(),
      await token1.getAddress(),
      true,
      false
    );
    const algebraVaultAddress = await algebraVaultFactory.getAlgebraVault(
      vaultKey
    );
    algebraVault = (await ethers.getContractAt(
      "AlgebraVault",
      algebraVaultAddress
    )) as AlgebraVault;
    await algebraVault.connect(wallet).setAffiliate(await bob.getAddress());
    

    await algebraVault
      .connect(wallet)
      .setDepositMax(
        ethers.parseEther("100000"),
        ethers.parseEther("100000")
      );
  });

  function msg(text: string) {
    return (
      "VM Exception while processing transaction: reverted with reason string '" +
      text +
      "'"
    );
  }

  // Should be reverted because of zero amount
  it("deposit with zero amount", async () => {
    await expect(algebraVault.connect(alice).deposit(0, 0, await alice.getAddress())).to.be
      .reverted;
    await expect(algebraVault.connect(alice).deposit(0, 0, await alice.getAddress())).to.be
      .reverted;
  });

  // should be passed,
  // balance token0 in vault should be equal to smallTokenAmount
  it("deposit from only Alice account", async () => {
    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await token1.connect(alice).mint(await alice.getAddress(), largeTokenAmount);

    await algebraVault
      .connect(alice)
      .deposit(smallTokenAmount, 0, await alice.getAddress());
    let token0vault = await token0.balanceOf(await algebraVault.getAddress());
    let token1vault = await token1.balanceOf(await algebraVault.getAddress());
    expect(token0vault).to.equal(smallTokenAmount);
    expect(token1vault).to.equal(0);
  });

  it("deposit and withdraw", async () => {
    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await token1.connect(alice).mint(await alice.getAddress(), largeTokenAmount);

    await algebraVault
      .connect(alice)
      .deposit(smallTokenAmount, 0, await alice.getAddress());
    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    await algebraVault
      .connect(alice)
      .withdraw(alice_liq_balance, await alice.getAddress());
    let token0vault = await token0.balanceOf(await algebraVault.getAddress());
    let token1vault = await token1.balanceOf(await algebraVault.getAddress());
    expect(token0vault).to.equal(0);
    expect(token1vault).to.equal(0);
  });

  // Should pass - multiple users deposit and withdraw
  it("multiple users deposit and withdraw", async () => {
    // alice deposit
    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), smallTokenAmount);
    await token1.connect(alice).mint(await alice.getAddress(), smallTokenAmount);
    await algebraVault
      .connect(alice)
      .deposit(smallTokenAmount, 0, await alice.getAddress());

    // bob deposit
    await token0.connect(bob).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(bob).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token0.connect(bob).mint(await bob.getAddress(), smallTokenAmount);
    await token1.connect(bob).mint(await bob.getAddress(), smallTokenAmount);
    await algebraVault.connect(bob).deposit(smallTokenAmount, 0, await bob.getAddress());

    //actual balances after deposits
    let vault_balance_after_deposits = await algebraVault.getTotalAmounts();

    //alice withdraw
    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    await algebraVault
      .connect(alice)
      .withdraw(alice_liq_balance, await alice.getAddress());
    let token0vault = await token0.balanceOf(await algebraVault.getAddress());
    let token1vault = await token1.balanceOf(await algebraVault.getAddress());
    
    expect(token0vault).to.equal(
      vault_balance_after_deposits[0] - smallTokenAmount
    );

    //bob withdraw
    let bob_liq_balance = await algebraVault.balanceOf(await bob.getAddress());
    await algebraVault.connect(bob).withdraw(bob_liq_balance, await bob.getAddress());
    token0vault = await token0.balanceOf(await algebraVault.getAddress());
    token1vault = await token1.balanceOf(await algebraVault.getAddress());
    expect(token0vault).to.equal(0);
    expect(token1vault).to.equal(0);
  });

  it("multiple users deposit with different amounts", async () => {
    let alice_deposit_amount = ethers.parseEther("1000");
    let bob_deposit_amount = ethers.parseEther("2000");
    let carol_deposit_amount = ethers.parseEther("4000");

    //alice deposit
    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), alice_deposit_amount);
    await token1.connect(alice).mint(await alice.getAddress(), alice_deposit_amount);
    await algebraVault
      .connect(alice)
      .deposit(alice_deposit_amount, 0, await alice.getAddress());
    //bob deposit
    await token0.connect(bob).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(bob).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token0.connect(bob).mint(await bob.getAddress(), bob_deposit_amount);
    await token1.connect(bob).mint(await bob.getAddress(), bob_deposit_amount);
    await algebraVault.connect(bob).deposit(bob_deposit_amount, 0, await bob.getAddress());

    //carol deposit
    await token0.connect(carol).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(carol).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token0.connect(carol).mint(await carol.getAddress(), carol_deposit_amount);
    await token1.connect(carol).mint(await carol.getAddress(), carol_deposit_amount);
    await algebraVault
      .connect(carol)
      .deposit(carol_deposit_amount, 0, await carol.getAddress());

    //actual balances after deposits
    let vault_balance_after_deposits = await algebraVault.getTotalAmounts();
    expect(vault_balance_after_deposits[0]).to.equal(
      alice_deposit_amount + bob_deposit_amount + carol_deposit_amount
    );
  });

  // Should be reverted - alice tries to withdraw more than she deposited
  it("alice withdraw amount greater than her deposited", async () => {
    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), smallTokenAmount);
    await token1.connect(alice).mint(await alice.getAddress(), smallTokenAmount);
    await algebraVault
      .connect(alice)
      .deposit(smallTokenAmount, 0, await alice.getAddress());
    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    await expect(
      algebraVault
        .connect(alice)
        .withdraw(alice_liq_balance + 1n, await alice.getAddress())
    ).to.be.reverted;
  });

  it("swap and deposit in same block", async () => {
    let amount_for_swap = ethers.parseEther("1000");
    await token0.connect(alice).mint(await alice.getAddress(), smallTokenAmount);
    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(carol).approve(await router.getAddress(), veryLargeTokenAmount);
    await token1.connect(carol).mint(await carol.getAddress(), amount_for_swap);
    await network.provider.send("evm_setAutomine", [false]);
    await router.connect(carol).exactInputSingle(
      {
        tokenIn: await token1.getAddress(),
        tokenOut: await token0.getAddress(),
        recipient: await alice.getAddress(),
        deployer: NULL_ADDRESS,
        deadline: 2000000000, // Wed May 18 2033 03:33:20 GMT+0000
        amountIn: amount_for_swap,
        amountOutMinimum: ethers.parseEther("0"),
        limitSqrtPrice: 0,
      },
      { gasLimit: 30000000 }
    );
    await algebraVault
      .connect(alice)
      .deposit(smallTokenAmount, 0, await alice.getAddress());
    await network.provider.send("evm_mine");
    await network.provider.send("evm_setAutomine", [true]);
  });

  // Should be reverted - multiple users deposit and alice tries to withdraw more than she deposited
  it("multiple users deposit and alice withdraw amount greater than her deposited", async () => {
    let alice_deposit_amount = ethers.parseEther("1000");
    let bob_deposit_amount = ethers.parseEther("2000");
    //alice deposit
    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), alice_deposit_amount);
    await token1.connect(alice).mint(await alice.getAddress(), alice_deposit_amount);
    await algebraVault
      .connect(alice)
      .deposit(alice_deposit_amount, 0, await alice.getAddress());
    //bob deposit
    await token0.connect(bob).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(bob).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token0.connect(bob).mint(await bob.getAddress(), bob_deposit_amount);
    await token1.connect(bob).mint(await bob.getAddress(), bob_deposit_amount);
    await algebraVault.connect(bob).deposit(bob_deposit_amount, 0, await bob.getAddress());

    //alice withdraw
    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    await expect(
      algebraVault
        .connect(alice)
        .withdraw(alice_liq_balance + 1n, await alice.getAddress())
    ).to.be.reverted;
  });

  it("rebalance after deposited amount", async () => {
    let amount_for_swap = ethers.parseEther("10000000");
    let amount_for_deposit = ethers.parseEther("10000");

    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await token1.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await algebraVault
      .connect(alice)
      .deposit(amount_for_deposit, 0, await alice.getAddress());
    await network.provider.send("evm_mine");
    await network.provider.send("evm_increaseTime", [3600]);

    await token0.connect(carol).approve(await router.getAddress(), veryLargeTokenAmount);
    await token1.connect(carol).approve(await router.getAddress(), veryLargeTokenAmount);
    await token0.connect(carol).mint(await carol.getAddress(), amount_for_swap);
    await token1.connect(carol).mint(await carol.getAddress(), amount_for_swap);
    await router.connect(carol).exactInputSingle(
      {
        tokenIn: await token1.getAddress(),
        tokenOut: await token0.getAddress(),
        recipient: await alice.getAddress(),
        deployer: NULL_ADDRESS,
        deadline: 2000000000, // Wed May 18 2033 03:33:20 GMT+0000
        amountIn: amount_for_swap,
        amountOutMinimum: ethers.parseEther("0"),
        limitSqrtPrice: 0,
      },
      { gasLimit: 30000000 }
    );

    await network.provider.send("evm_mine");
    await network.provider.send("evm_increaseTime", [36000]);
    await algebraVault
      .connect(alice)
      .deposit(amount_for_deposit, 0, await alice.getAddress());
    await network.provider.send("evm_mine");
    await network.provider.send("evm_increaseTime", [36000]);

    await token1.connect(alice).transfer(await algebraVault.getAddress(), largeTokenAmount);

    const rebalanceTx = await algebraVault.rebalance(1800, 3600, -600, -300, 0);
    const rebalanceReceipt = await rebalanceTx.wait();
    console.log("Rebalance gas used:", rebalanceReceipt?.gasUsed.toString());

    let token0vault = await token0.balanceOf(await algebraVault.getAddress());
    let token1vault = await token1.balanceOf(await algebraVault.getAddress());

    // expect(token0vault).to.equal(0);
    // expect(token1vault).to.equal(0);

    let basePosition = await algebraVault.getBasePosition();
    let limitPosition = await algebraVault.getLimitPosition();

    console.log(basePosition[0]);
    console.log(limitPosition[0]);

    // expect(basePosition[0]).to.be.gt(ethers.parseEther("0"));
    // expect(limitPosition[0]).to.be.equal(0);

    const rebalanceTx2 = await algebraVault.rebalance(3600, 7200, -1200, -600, 0);
    const rebalanceReceipt2 = await rebalanceTx2.wait();
    console.log("Second rebalance gas used:", rebalanceReceipt2?.gasUsed.toString());
  });

  it("withdraw after deposit and rebalance", async () => {
    let amount_for_swap = ethers.parseEther("10000000");
    let amount_for_deposit = ethers.parseEther("10000");

    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await token1.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await algebraVault
      .connect(alice)
      .deposit(amount_for_deposit, 0, await alice.getAddress());
    await network.provider.send("evm_mine");
    await network.provider.send("evm_increaseTime", [3600]);

    await token0.connect(carol).approve(await router.getAddress(), veryLargeTokenAmount);
    await token1.connect(carol).approve(await router.getAddress(), veryLargeTokenAmount);
    await token0.connect(carol).mint(await carol.getAddress(), amount_for_swap);
    await token1.connect(carol).mint(await carol.getAddress(), amount_for_swap);

    await network.provider.send("evm_mine");
    await network.provider.send("evm_increaseTime", [36000]);
    await algebraVault
      .connect(alice)
      .deposit(amount_for_deposit, 0, await alice.getAddress());
    await network.provider.send("evm_mine");
    await network.provider.send("evm_increaseTime", [36000]);

    await algebraVault.rebalance(1800, 3600, -600, 600, 0);
    await network.provider.send("evm_mine");
    await network.provider.send("evm_increaseTime", [36000]);

    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    await expect(
      algebraVault.connect(alice).withdraw(alice_liq_balance, await alice.getAddress())
    ).to.emit(algebraVault, "Withdraw");
    let token0vault = await token0.balanceOf(await algebraVault.getAddress());
    let token1vault = await token1.balanceOf(await algebraVault.getAddress());
    expect(token0vault).to.equal(0);
    expect(token1vault).to.equal(0);
  });

  //should be passed
  //1. deposit
  //2. rebalance
  //3. swap
  //4. withdraw
  it("withdraw after deposit and rebalance with swap", async () => {
    let amount_for_swap = ethers.parseEther("10000000");
    let amount_for_deposit = ethers.parseEther("10000");

    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await token1.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await algebraVault
      .connect(alice)
      .deposit(amount_for_deposit, 0, await alice.getAddress());
    await network.provider.send("evm_mine");
    await network.provider.send("evm_increaseTime", [3600]);

    await token0.connect(carol).approve(await router.getAddress(), veryLargeTokenAmount);
    await token1.connect(carol).approve(await router.getAddress(), veryLargeTokenAmount);
    await token0.connect(carol).mint(await carol.getAddress(), amount_for_swap);
    await token1.connect(carol).mint(await carol.getAddress(), amount_for_swap);
    await router.connect(carol).exactInputSingle(
      {
        tokenIn: await token1.getAddress(),
        tokenOut: await token0.getAddress(),
        recipient: await alice.getAddress(),
        deployer: NULL_ADDRESS,
        deadline: 2000000000, // Wed May 18 2033 03:33:20 GMT+0000
        amountIn: amount_for_swap,
        amountOutMinimum: ethers.parseEther("0"),
        limitSqrtPrice: 0,
      },
      { gasLimit: 30000000 }
    );
    await network.provider.send("evm_mine");
    await network.provider.send("evm_increaseTime", [36000]);

    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    await expect(
      algebraVault.connect(alice).withdraw(alice_liq_balance, await alice.getAddress())
    ).to.emit(algebraVault, "Withdraw");
    let token0vault = await token0.balanceOf(await algebraVault.getAddress());
    let token1vault = await token1.balanceOf(await algebraVault.getAddress());
    expect(token0vault).to.equal(0);
    expect(token1vault).to.equal(0);
  });

  it("deposit with deposit guard", async () => {
    await token0.connect(alice).approve(await depositGuard.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await depositGuard.getAddress(), largeTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await token1.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await depositGuard
      .connect(alice)
      .forwardDepositToAlgebraVault(
        await algebraVault.getAddress(),
        await wallet.getAddress(),
        await token0.getAddress(),
        smallTokenAmount,
        0,
        await alice.getAddress()
      );
  });

  it("deposit with deposit guard with native deposit", async () => {
    
    await depositGuard
      .connect(alice)
      .forwardNativeDepositToAlgebraVault(
        await algebraVault.getAddress(),
        await wallet.getAddress(),
        0,
        await alice.getAddress(),
        { value: ethers.parseEther("1"), gasLimit: 30000000 }
      );
    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    expect(alice_liq_balance).to.gt(0);
  });

  //should be reverted
  //because only accept ETH via fallback from the WRAPPED_NATIVE contract
  it("native deposit with deposit guard", async () => {
    await expect(
      alice.sendTransaction({
        to: await depositGuard.getAddress(),
        value: ethers.parseEther("1"),
        gasLimit: 30000000,
      })
    ).to.be.reverted;
  });

  it("deposit guard -- forward withdraw from algebra vault", async () => {
    await token0.connect(alice).approve(await depositGuard.getAddress(), largeTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await depositGuard
      .connect(alice)
      .forwardDepositToAlgebraVault(
        await algebraVault.getAddress(),
        await wallet.getAddress(),
        await token0.getAddress(),
        smallTokenAmount,
        0,
        await alice.getAddress()
      );
    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    await algebraVault
      .connect(alice)
      .approve(await depositGuard.getAddress(), alice_liq_balance);
    await depositGuard
      .connect(alice)
      .forwardWithdrawFromAlgebraVault(
        await algebraVault.getAddress(),
        await wallet.getAddress(),
        alice_liq_balance,
        await alice.getAddress(),
        0,
        0
      );
    alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    expect(alice_liq_balance).to.equal(0);
  });

  it("withdraw with deposit guard with native withdraw", async () => {
    await depositGuard
      .connect(alice)
      .forwardNativeDepositToAlgebraVault(
        await algebraVault.getAddress(),
        await wallet.getAddress(),
        0,
        await alice.getAddress(),
        { value: ethers.parseEther("1") }
      );
    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    expect(alice_liq_balance).to.be.gt(0);
    await algebraVault
      .connect(alice)
      .approve(await depositGuard.getAddress(), alice_liq_balance);

    await depositGuard
      .connect(alice)
      .forwardNativeWithdrawFromAlgebraVault(
        await algebraVault.getAddress(),
        await wallet.getAddress(),
        alice_liq_balance,
        await alice.getAddress(),
        0,
        0
      );

    alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());

    expect(alice_liq_balance).to.equal(0);
  });

  it("deposit guard -- deposit and withdraw native after rebalance", async () => {
    await depositGuard
      .connect(alice)
      .forwardNativeDepositToAlgebraVault(
        await algebraVault.getAddress(),
        await wallet.getAddress(),
        0,
        await alice.getAddress(),
        { value: ethers.parseEther("1") }
      );
    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());

    await algebraVault.rebalance(1800, 3600, -600, 600, 0);
    await algebraVault
      .connect(alice)
      .approve(await depositGuard.getAddress(), alice_liq_balance);
    await expect(
      depositGuard
        .connect(alice)
        .forwardNativeWithdrawFromAlgebraVault(
          await algebraVault.getAddress(),
          await wallet.getAddress(),
          alice_liq_balance,
          await alice.getAddress(),
          0,
          0
        )
    ).to.emit(token0, "Withdraw");
    alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    expect(alice_liq_balance).to.equal(0);
  });

  it("Deposit guard - deposit token if this token not allowed", async () => {
    await token1.mint(await alice.getAddress(), smallTokenAmount);
    await token1.connect(alice).approve(await depositGuard.getAddress(), smallTokenAmount);
    await expect(
      depositGuard
        .connect(alice)
        .forwardDepositToAlgebraVault(
          await algebraVault.getAddress(),
          await wallet.getAddress(),
          await token1.getAddress(),
          smallTokenAmount,
          0,
          await alice.getAddress()
        )
    ).to.be.reverted;
  });

  it("DepositGuard - deposit another token", async () => {
    await token2.mint(await alice.getAddress(), smallTokenAmount);
    await token2.connect(alice).approve(await depositGuard.getAddress(), smallTokenAmount);
    await expect(
      depositGuard
        .connect(alice)
        .forwardDepositToAlgebraVault(
          await algebraVault.getAddress(),
          await wallet.getAddress(),
          await token2.getAddress(),
          smallTokenAmount,
          0,
          await alice.getAddress()
        )
    ).to.be.revertedWith("Invalid token");
  });

  it("deposit after set DepositMax==0", async () => {
    await algebraVault.connect(wallet).setDepositMax(0, 0);
    await token0.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await expect(
      algebraVault.connect(alice).deposit(smallTokenAmount, 0, await alice.getAddress())
    ).to.be.reverted;

    await token0.connect(alice).approve(await depositGuard.getAddress(), largeTokenAmount);
    await expect(
      depositGuard
        .connect(alice)
        .forwardDepositToAlgebraVault(
          await algebraVault.getAddress(),
          await wallet.getAddress(),
          await token0.getAddress(),
          smallTokenAmount,
          0,
          await alice.getAddress()
        )
    ).to.be.reverted;

    await expect(
      depositGuard
        .connect(alice)
        .forwardNativeDepositToAlgebraVault(
          await algebraVault.getAddress(),
          await wallet.getAddress(),
          0,
          await alice.getAddress(),
          { value: ethers.parseEther("1") }
        )
    ).to.be.reverted;
  });

  // shoule be reverted with InvalidDeposit
  // because pool is locked
  it("deposit from one with flashloan", async () => {
    const poolDeployer = await factory.poolDeployer();
    const pairFlashFactory = await ethers.getContractFactory("PairFlash");
    const pairFlash = (await pairFlashFactory.deploy(
      await factory.getAddress(),
      poolDeployer,
      await algebraVault.getAddress() // используем factory как poolDeployer для простоты
    )) as PairFlash;

    await token0.connect(alice).approve(await depositGuard.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await depositGuard.getAddress(), largeTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await token1.connect(alice).mint(await alice.getAddress(), largeTokenAmount);
    await token0.connect(alice).mint(await pairFlash.getAddress(), largeTokenAmount);
    await token1.connect(alice).mint(await pairFlash.getAddress(), largeTokenAmount);
    const flashAmount0 = ethers.parseEther("0.1");
    const flashAmount1 = ethers.parseEther("0.1");
    const computedPool = await factory.computePoolAddress(
      await token0.getAddress(),
      await token1.getAddress()
    );

    const pool = await pairFlash.getPool(await token0.getAddress(), await token1.getAddress());
    

    
    await expect(
      pairFlash.connect(alice).initFlash({
        token0: await token0.getAddress(),
        token1: await token1.getAddress(),
        deployer: poolDeployer,
        amount0: flashAmount0,
        amount1: flashAmount1,
      })
    ).to.revertedWithCustomError(algebraVault, "InvalidDeposit");
  });

  it("Withdraw to vault address", async () => {
    await token0.connect(alice).mint(await alice.getAddress(), veryLargeTokenAmount);
    await token0
      .connect(alice)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);

    await algebraVault
      .connect(alice)
      .deposit(smallTokenAmount, 0, await alice.getAddress());

    await token0.connect(bob).mint(await bob.getAddress(), veryLargeTokenAmount);
    await token0
      .connect(bob)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);

    await algebraVault.connect(bob).deposit(smallTokenAmount, 0, await bob.getAddress());

    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    let bob_liq_balance = await algebraVault.balanceOf(await bob.getAddress());

    await algebraVault
      .connect(alice)
      .withdraw(alice_liq_balance, await algebraVault.getAddress());

    await algebraVault.connect(bob).withdraw(bob_liq_balance, await bob.getAddress());
  });

  it("Collected fees", async () => {
    await token1.connect(alice).mint(await algebraVault.getAddress(), smallTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), veryLargeTokenAmount);
    
    
    await algebraVaultFactory.connect(wallet).setAmmFee(ethers.parseEther("0.1"));
    await algebraVault.connect(wallet).setAmmFeeRecipient(await alice.getAddress());
    await token0
      .connect(alice)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);
    await algebraVault
      .connect(alice)
      .deposit(smallTokenAmount, 0, await alice.getAddress());

    await algebraVault.rebalance(-600, 600, -1800, 3600, 0);
    await token0.connect(carol).mint(await carol.getAddress(), veryLargeTokenAmount);
    await token0.connect(carol).approve(await router.getAddress(), veryLargeTokenAmount);
    await router.connect(carol).exactInputSingle(
      {
        tokenIn: await token0.getAddress(),
        tokenOut: await token1.getAddress(),
        recipient: await alice.getAddress(),
        deployer: NULL_ADDRESS,
        deadline: 2000000000, // Wed May 18 2033 03:33:20 GMT+0000
        amountIn: largeTokenAmount,
        amountOutMinimum: ethers.parseEther("0"),
        limitSqrtPrice: 0,
      },
      { gasLimit: 30000000 }
    );

    await token1.mint(await carol.getAddress(), giantTokenAmount);
    await token1.connect(carol).approve(await router.getAddress(), giantTokenAmount);
    await router.connect(carol).exactInputSingle(
      {
        tokenIn: await token1.getAddress(),
        tokenOut: await token0.getAddress(),
        recipient: await alice.getAddress(),
        deployer: NULL_ADDRESS,
        deadline: 2000000000, // Wed May 18 2033 03:33:20 GMT+0000
        amountIn: largeTokenAmount,
        amountOutMinimum: ethers.parseEther("0"),
        limitSqrtPrice: 0,
      },
      { gasLimit: 30000000 }
    );

    
    let fees = await algebraVault.connect(alice).collectFees.staticCall();
    
    await algebraVault.connect(alice).collectFees();
    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    await algebraVault
      .connect(alice)
      .withdraw(alice_liq_balance, await alice.getAddress());

  });

  it("Deposit from two accounts and Collect fees", async () => {
    await token1.connect(alice).mint(await algebraVault.getAddress(), smallTokenAmount);
    await token0.connect(alice).mint(await alice.getAddress(), veryLargeTokenAmount);
    await token0
      .connect(alice)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);
    await algebraVault
      .connect(alice)
      .deposit(ethers.parseEther("0.001"), 0, await alice.getAddress());

    await token0.connect(bob).mint(await bob.getAddress(), veryLargeTokenAmount);
    await token0
      .connect(bob)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);
    await algebraVault
      .connect(bob)
      .deposit(ethers.parseEther("0.001"), 0, await bob.getAddress());

    await token0.connect(carol).mint(await carol.getAddress(), veryLargeTokenAmount);
    await token0
      .connect(carol)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);
    await algebraVault
      .connect(carol)
      .deposit(ethers.parseEther("0.001"), 0, await carol.getAddress());

    await algebraVault.rebalance(-60, 60, -600, 600, 0);

    await token0.connect(carol).mint(await carol.getAddress(), veryLargeTokenAmount);
    await token0.connect(carol).approve(await router.getAddress(), veryLargeTokenAmount);
    await router.connect(carol).exactInputSingle(
      {
        tokenIn: await token0.getAddress(),
        tokenOut: await token1.getAddress(),
        recipient: await alice.getAddress(),
        deployer: NULL_ADDRESS,
        deadline: 2000000000, // Wed May 18 2033 03:33:20 GMT+0000
        amountIn: smallTokenAmount,
        amountOutMinimum: ethers.parseEther("0"),
        limitSqrtPrice: 0,
      },
      { gasLimit: 30000000 }
    );
    
    await algebraVault.connect(alice).collectFees();
    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    const [amount0_alice, amount1_alice] = await algebraVault
      .connect(alice)
      .withdraw.staticCall(alice_liq_balance, await alice.getAddress());

    await algebraVault
      .connect(alice)
      .withdraw(alice_liq_balance, await alice.getAddress());
    let bob_liq_balance = await algebraVault.balanceOf(await bob.getAddress());
    const [amount0_bob, amount1_bob] = await algebraVault
      .connect(bob)
      .withdraw.staticCall(bob_liq_balance, await bob.getAddress());
    

    await algebraVault.connect(bob).withdraw(bob_liq_balance, await bob.getAddress());
  });

  it("deposit after tranfer token1 to vault", async () => {
    //despoit Alice
    await token0.connect(alice).mint(await alice.getAddress(), veryLargeTokenAmount);
    let token0_alice_balance = await token0.balanceOf(await alice.getAddress());
    await token0
      .connect(alice)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);

    await algebraVault
      .connect(alice)
      .deposit(ethers.parseEther("0.001"), 0, await alice.getAddress());
    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());

    //deposit Bob
    await token0.connect(bob).mint(await bob.getAddress(), veryLargeTokenAmount);
    await token0
      .connect(bob)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);
    await algebraVault
      .connect(bob)
      .deposit(ethers.parseEther("0.001"), 0, await bob.getAddress());
    let bob_liq_balance = await algebraVault.balanceOf(await bob.getAddress());
    

    //Mint token
    await token1.mint(await algebraVault.getAddress(), ethers.parseEther("0.001"));
    let token0_alice_balance_after = await token0.balanceOf(await alice.getAddress());

    
    await algebraVault.connect(bob).withdraw(bob_liq_balance, await bob.getAddress());
    let token0_bob_balance_after_withdraw = await token0.balanceOf(await bob.getAddress());
    
    await token0.connect(carol).mint(await carol.getAddress(), veryLargeTokenAmount);
    await token0
      .connect(carol)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);
    await algebraVault
      .connect(carol)
      .deposit(ethers.parseEther("0.001"), 0, await carol.getAddress());
    let carol_liq_balance = await algebraVault.balanceOf(await carol.getAddress());
    

    await algebraVault
      .connect(carol)
      .withdraw(carol_liq_balance, await carol.getAddress());
    let carol_tokn0_balance_after = await token0.balanceOf(await carol.getAddress());
    
  });

  it("Delta balances after withdrowal", async () => {
    await token0.mint(await alice.getAddress(), veryLargeTokenAmount);
    await token0.mint(await bob.getAddress(), veryLargeTokenAmount);

    await token0
      .connect(alice)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);
    await token0
      .connect(bob)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);

    await token0.mint(await algebraVault.getAddress(), smallTokenAmount);
    //Deposit Alice
    await algebraVault
      .connect(alice)
      .deposit(smallTokenAmount, 0, await alice.getAddress());
    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    //Mint to Vault

    //Deposit Bob
    await algebraVault.connect(bob).deposit(smallTokenAmount, 0, await bob.getAddress());
    let bob_liq_balance = await algebraVault.balanceOf(await bob.getAddress());

    //Balances before Withdraw
    let aliceToken0BalanceBefore = await token0.balanceOf(await alice.getAddress());
    let bobToken0BalanceBefore = await token0.balanceOf(await bob.getAddress());

    //withdraws
    await algebraVault
      .connect(alice)
      .withdraw(alice_liq_balance, await alice.getAddress());
    await algebraVault.connect(bob).withdraw(bob_liq_balance, await bob.getAddress());

    //Balances after Withdraw
    let aliceToken0BalanceAfter = await token0.balanceOf(await alice.getAddress());
    let bobToken0BalanceAfter = await token0.balanceOf(await bob.getAddress());

    let aliceDelta = aliceToken0BalanceAfter - aliceToken0BalanceBefore;
    let bobDelta = bobToken0BalanceAfter - bobToken0BalanceBefore;

    alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
  });
  it("check Lp balance", async () => {
    await token0.mint(await alice.getAddress(), veryLargeTokenAmount);
    await token0.mint(await bob.getAddress(), smallTokenAmount);
    await token0.mint(await carol.getAddress(), smallTokenAmount);

    await token0
      .connect(alice)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);
    await token0
      .connect(bob)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);
    await token0
      .connect(carol)
      .approve(await algebraVault.getAddress(), veryLargeTokenAmount);

    await algebraVault
      .connect(alice)
      .deposit(smallTokenAmount, 0, await alice.getAddress());
    await algebraVault.connect(bob).deposit(smallTokenAmount, 0, await bob.getAddress());
    await token0.mint(await algebraVault.getAddress(), smallTokenAmount);
    await algebraVault
      .connect(carol)
      .deposit(smallTokenAmount, 0, await carol.getAddress());

    let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
    let bob_liq_balance = await algebraVault.balanceOf(await bob.getAddress());
    let carol_liq_balance = await algebraVault.balanceOf(await carol.getAddress());

   
  });

  it("check base position",async () => {
    await token0.mint(await alice.getAddress(), veryLargeTokenAmount);
    await token0.connect(alice).approve(await algebraVault.getAddress(), veryLargeTokenAmount);
    await algebraVault.connect(alice).deposit(smallTokenAmount, 0, await alice.getAddress());
    await expect(algebraVault.connect(wallet).rebalance(1800, 3600, -600, 600, 0)).to.emit(algebraPool, "Mint");
    let baseLower = await algebraVault.baseLower();
    expect(baseLower).to.be.equal(1800, "wrong base lower")
    let baseUpper = await algebraVault.baseUpper();
    expect(baseUpper).to.be.equal(3600, "wrong base upper")
  });

  it("check limitPosition",async () => {
    await token0.mint(await algebraVault.getAddress(), veryLargeTokenAmount);
    await token1.mint(await algebraVault.getAddress(),veryLargeTokenAmount);
    await token0.mint(await alice.getAddress(), veryLargeTokenAmount);
    await token0.connect(alice).approve(await algebraVault.getAddress(), veryLargeTokenAmount);
    await algebraVault.connect(alice).deposit(smallTokenAmount, 0, await alice.getAddress());
    await expect(algebraVault.connect(wallet).rebalance(1800, 3600, -3600, -1800, 0)).to.emit(algebraPool, "Mint");
    let limitUpper = await algebraVault.limitUpper();
    expect(limitUpper).to.be.equal(-1800, "wrong base upper")
    let limitLower = await algebraVault.limitLower();
    expect(limitLower).to.be.equal(-3600, "wrong base lower")
  });

  it("check setAuxTwapPeriod",async () => {
    await expect(algebraVault.connect(wallet).setAuxTwapPeriod(100)).to.emit(algebraVault, "SetAuxTwapPeriod");
  });
  it("check hysteresis",async () => {
    let hysteresis = await algebraVault.hysteresis();
    
  });
  
  it("check change rebalance manager",async () => {
    await expect(algebraVault.connect(wallet).setRebalanceManager(await alice.getAddress())).to.emit(algebraVault, "RebalanceManager");
  });
  it("check setHysteresis", async()=>{
    // Set small hysteresis to trigger check on significant price deviation
    await expect(algebraVault.connect(wallet).setHysteresis(ethers.parseEther("0.01")))
      .to.emit(algebraVault, "Hysteresis");
    await token0.mint(await alice.getAddress(), giantTokenAmount);
    await algebraVault.connect(wallet).setDepositMax(giantTokenAmount,giantTokenAmount);

    // Deploy TestDepositHelper
    const helperFactory = await ethers.getContractFactory("TestDepositHelper");
    const helper = await helperFactory.deploy();
    
    // Approve helper to spend tokens
    const totalAmount = veryLargeTokenAmount + largeTokenAmount;
    await token0.connect(alice).approve(await helper.getAddress(), totalAmount);
    
    // Execute swap and deposit in same transaction - should revert
    // because both happen in same block, oracle timestamp == block.timestamp
    await expect(
      helper.connect(alice).swapAndDeposit(
        await router.getAddress(),
        await algebraVault.getAddress(),
        await token0.getAddress(),
        await token1.getAddress(),
        NULL_ADDRESS,
        veryLargeTokenAmount, // Large swap to move price significantly
        largeTokenAmount,     // Deposit amount
        await alice.getAddress()
      )
    ).to.be.revertedWithCustomError(algebraVault, "InvalidDeposit");
  });

  it("check Hysteresis and auxTWAP=0", async()=>{
    // Set hysteresis to 0 to trigger check on any price deviation when auxTWAP=0
    await expect(algebraVault.connect(wallet).setHysteresis(0))
      .to.emit(algebraVault, "Hysteresis");

    await expect(algebraVault.connect(wallet).setAuxTwapPeriod(0))
      .to.emit(algebraVault,"SetAuxTwapPeriod");

    await token0.mint(await alice.getAddress(), giantTokenAmount);
    await algebraVault.connect(wallet).setDepositMax(giantTokenAmount,giantTokenAmount);

    // Deploy TestDepositHelper
    const helperFactory = await ethers.getContractFactory("TestDepositHelper");
    const helper = await helperFactory.deploy();
    
    // Approve helper to spend tokens
    const totalAmount = largeTokenAmount + largeTokenAmount;
    await token0.connect(alice).approve(await helper.getAddress(), totalAmount);
    
    // Execute swap and deposit in same transaction - should revert
    // With hysteresis=0 and auxTWAP=0, any price deviation triggers the timestamp check
    await expect(
      helper.connect(alice).swapAndDeposit(
        await router.getAddress(),
        await algebraVault.getAddress(),
        await token0.getAddress(),
        await token1.getAddress(),
        NULL_ADDRESS,
        largeTokenAmount,     // Regular swap amount
        largeTokenAmount,     // Deposit amount
        await alice.getAddress()
      )
    ).to.be.revertedWithCustomError(algebraVault, "InvalidDeposit");
  });

  it("check factory: setAmmFee",async () => {
    await expect(algebraVaultFactory.connect(alice).setAmmFee(ethers.parseEther("0.001"))).to.be.reverted;
    await expect(algebraVaultFactory.connect(wallet).setAmmFee(ethers.parseEther("10"))).to.be.reverted;
    expect(algebraVaultFactory.connect(wallet).setAmmFee(ethers.parseEther("0.001")))
      .to.emit(algebraVaultFactory, "AmmFee");

  });
  it("check factory: setBaseFee",async () => {
    await expect(algebraVaultFactory.connect(alice).setBaseFee(ethers.parseEther("0.001"))).to.be.reverted;
    await expect(algebraVaultFactory.connect(wallet).setBaseFee(ethers.parseEther("10"))).to.be.reverted;
    expect(algebraVaultFactory.connect(wallet).setBaseFee(ethers.parseEther("0.001")))
      .to.emit(algebraVaultFactory, "BaseFee");
  });
  it("check factory: setBaseFeeSplit",async () => {
    await expect(algebraVaultFactory.connect(alice).setBaseFeeSplit(ethers.parseEther("0.001"))).to.be.reverted;
    await expect(algebraVaultFactory.connect(wallet).setBaseFeeSplit(ethers.parseEther("10"))).to.be.reverted;
    expect(algebraVaultFactory.connect(wallet).setBaseFeeSplit(ethers.parseEther("0.001")))
      .to.emit(algebraVaultFactory, "BaseFeeSplit");
  });
  it("check createAlgebraVault",async()=>{
    await expect(algebraVaultFactory.connect(alice).createAlgebraVault(await token0.getAddress(),true, await token1.getAddress(),false)).to.be.reverted;

  });
});

describe("AlgebraVault General Functionality (allowed token1)", () => {
  let wallet: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;
  let other: HardhatEthersSigner;
  let user0: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let user4: HardhatEthersSigner;

  let factory: IAlgebraFactory;
  let router: ISwapRouter;
  let nft: INonfungiblePositionManager;
  let oracle: TestOracle;
  let token0: TestERC20;
  let token1: TestERC20;
  let token2: TestERC20;
  let algebraPool: IAlgebraPool;
  let algebraVaultFactory: AlgebraVaultFactory;
  let depositGuard: AlgebraVaultDepositGuard;
  let depositGuardToken1: AlgebraVaultDepositGuard;
  let algebraVault: AlgebraVault;

  before("create fixture loader", async () => {
    [wallet, alice, bob, carol, other, user0, user1, user2, user3, user4] =
      await (ethers as any).getSigners();
  });

    beforeEach("deploy contracts", async () => {
        ({
            token0,
            token1,
            token2,
            factory,
            router,
            nft,
            oracle,
            algebraVaultFactory,
            depositGuard,
            depositGuardToken1,
        } = await loadFixture(algebraVaultTestFixture));
        
        await algebraVaultFactory.setFeeRecipient(await alice.getAddress());
        await algebraVaultFactory.connect(wallet).setFeeRecipient(await other.getAddress());

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

        await algebraVaultFactory.connect(wallet).setAmmFee(100);
        await algebraVaultFactory
            .connect(wallet)
            .createAlgebraVault(await token0.getAddress(), false, await token1.getAddress(), true);

        // adding extra liquidity into pool to make sure there's always
        // someone to swap with
        await token0.mint(await carol.getAddress(), giantTokenAmount);
        await token1.mint(await carol.getAddress(), giantTokenAmount);

        await token0.connect(carol).approve(await nft.getAddress(), veryLargeTokenAmount);
        await token1.connect(carol).approve(await nft.getAddress(), veryLargeTokenAmount);

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

        const vaultKey = await algebraVaultFactory.genKey(
            await wallet.getAddress(),
            await token0.getAddress(),
            await token1.getAddress(),
            false,
            true
        );
        const algebraVaultAddress = await algebraVaultFactory.getAlgebraVault(
            vaultKey
        );
        algebraVault = (await ethers.getContractAt(
            "AlgebraVault",
            algebraVaultAddress
        )) as AlgebraVault;
        await algebraVault.connect(wallet).setAffiliate(await bob.getAddress());
        

        await algebraVault
            .connect(wallet)
            .setDepositMax(
                ethers.parseEther("100000"),
                ethers.parseEther("100000")
            );
    });

    it("deposit and withdraw token1 if allowed token1", async () => {
      let wrappedNative = await depositGuardToken1.WRAPPED_NATIVE();
      await expect(wrappedNative).to.be.equal(await token1.getAddress());
      await token1.connect(alice).approve(wrappedNative, smallTokenAmount);
      await expect(depositGuardToken1.connect(alice).forwardNativeDepositToAlgebraVault(
        await algebraVault.getAddress(),
        await wallet.getAddress(),
        0,
        await alice.getAddress(),
        { value: ethers.parseEther("1"), gasLimit: 30000000 }
      )).to.emit(depositGuardToken1, "DepositForwarded");

      await token0.mint(await carol.getAddress(), giantTokenAmount);
      await token1.mint(await carol.getAddress(), giantTokenAmount);
      await token0.connect(carol).approve(await router.getAddress(), giantTokenAmount);
      await token1.connect(carol).approve(await router.getAddress(), giantTokenAmount);
      await router.connect(carol).exactInputSingle(
        {
          tokenIn: await token0.getAddress(),
          tokenOut: await token1.getAddress(),
          recipient: await carol.getAddress(),
          deployer: NULL_ADDRESS,
          deadline: 2000000000,
          amountIn: ethers.parseEther("0.0001"),
          amountOutMinimum: 0,
          limitSqrtPrice: 0,
        },
        { gasLimit: 30000000 }
      );
      await router.connect(carol).exactInputSingle(
        {
          tokenIn: await token1.getAddress(),
          tokenOut: await token0.getAddress(),
          recipient: await carol.getAddress(),
          deployer: NULL_ADDRESS,
          deadline: 2000000000,
          amountIn: ethers.parseEther("0.0001"),
          amountOutMinimum: 0,
          limitSqrtPrice: 0,
        },
        { gasLimit: 30000000 }
      );

      let alice_liq_balance = await algebraVault.balanceOf(await alice.getAddress());
      await algebraVault.connect(alice).approve(await depositGuardToken1.getAddress(), alice_liq_balance);
      expect(depositGuardToken1.connect(alice).forwardNativeWithdrawFromAlgebraVault(
        await algebraVault.getAddress(),
        await wallet.getAddress(),
        alice_liq_balance,
        await alice.getAddress(),
        0,
        0
      )).to.emit(algebraVault, "Withdraw");
    });
    
  });

