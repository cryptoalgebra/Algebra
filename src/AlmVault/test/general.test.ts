import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";

import { IAlgebraFactory, INonfungiblePositionManager, ISwapRouter } from "../types";
import { IAlgebraPool } from "../types/@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool";
import { AlgebraVault } from "../types/contracts/AlgebraVault";
import { AlgebraVaultFactory } from "../types/contracts/AlgebraVaultFactory";
import { UV3Math } from "../types/contracts/lib/UV3Math";
import { TestERC20 } from "../types/contracts/mocks/TestERC20";
import { TestOracle } from "../types/contracts/mocks/TestOracle";
import { algebraVaultTestFixture } from "./shared/fixtures";
import { FeeAmount, TICK_SPACINGS, encodePriceSqrt, getMaxTick, getMinTick } from "./shared/utilities";

const hre = ethers as any;
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

const PERCENT_101 = "1010000000000000000";
const PERCENT_100 = "1000000000000000000";
const PERCENT_81 = "810000000000000000";
const PERCENT_50 = "500000000000000000";
const PERCENT_40 = "400000000000000000";
const PERCENT_20 = "200000000000000000";
const PERCENT_10 = "100000000000000000";

const smallTokenAmount = ethers.parseEther("1000");
const largeTokenAmount = ethers.parseEther("1000000");
const veryLargeTokenAmount = ethers.parseEther("10000000000");
const giantTokenAmount = ethers.parseEther("1000000000000");

describe("Access Control Checks", () => {
  let factory: IAlgebraFactory;
  let router: ISwapRouter;
  let nft: INonfungiblePositionManager;
  let oracle: TestOracle;
  let token0: TestERC20;
  let token1: TestERC20;
  let token2: TestERC20;
  let uniswapPool: IAlgebraPool;
  let algebraVaultFactory: AlgebraVaultFactory;
  let algebraVault: AlgebraVault;

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

  before("create fixture loader", async () => {
    [wallet, alice, bob, carol, other, user0, user1, user2, user3, user4] = await hre.getSigners();
  });

  beforeEach("deploy contracts", async () => {
    ({ token0, token1, token2, factory, router, nft, oracle, algebraVaultFactory } = await loadFixture(
      algebraVaultTestFixture,
    ));
    await factory.createPool(await token0.getAddress(), await token1.getAddress(), '0x');
    const poolAddress = await factory.poolByPair(await token0.getAddress(), await token1.getAddress());
    // console.log(poolAddress);
    uniswapPool = (await ethers.getContractAt("IAlgebraPool", poolAddress)) as IAlgebraPool;
    await uniswapPool.initialize(encodePriceSqrt("1", "1"));

    await algebraVaultFactory.connect(wallet).createAlgebraVault(await token0.getAddress(), true, await token1.getAddress(), false);

    const vaultKey = await algebraVaultFactory.genKey(
      await wallet.getAddress(),
      await token0.getAddress(),
      await token1.getAddress(),
      true,
      false
    );
    const algebraVaultAddress = await algebraVaultFactory.getAlgebraVault(vaultKey);
    algebraVault = (await ethers.getContractAt("AlgebraVault", algebraVaultAddress)) as AlgebraVault;

    await expect(
      algebraVault.connect(wallet).setDepositMax(ethers.parseEther("100000"), ethers.parseEther("100000")),
    )
      .to.emit(algebraVault, "DepositMax")
      .withArgs(await wallet.getAddress(), ethers.parseEther("100000"), ethers.parseEther("100000"));

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
      //fee: FeeAmount.MEDIUM,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      recipient: await carol.getAddress(),
      amount0Desired: veryLargeTokenAmount,
      amount1Desired: veryLargeTokenAmount,
      //amount0Desired: 1000,
      //amount1Desired: 1000,
      amount0Min: 0,
      amount1Min: 0,
      deadline: 2000000000,
    });

    await network.provider.send("evm_increaseTime", [3600]);
  });

  it("AlgebraVault", async () => {
    await expect(algebraVault.connect(alice).rebalance(-1800, 1800, -600, 0, 0))
      .to.be.revertedWithCustomError(algebraVault, "NotRebalancer");
    await expect(
      algebraVault.connect(alice).setDepositMax(ethers.parseEther("100000"), ethers.parseEther("100000")),
    ).to.be.revertedWithCustomError(algebraVault, "NotRebalancer");
    await expect(algebraVault.connect(alice).setHysteresis(50)) // 5%
      .to.be.revertedWithCustomError(algebraVault, "NotManager");
    await expect(algebraVault.connect(alice).setTwapPeriod(1800))
      .to.be.revertedWithCustomError(algebraVault, "NotManager");
  });
});

describe("Input Validation Checks", () => {
  let factory: IAlgebraFactory;
  let router: ISwapRouter;
  let nft: INonfungiblePositionManager;
  let oracle: TestOracle;
  let token0: TestERC20;
  let token1: TestERC20;
  let token2: TestERC20;
  let uniswapPool: IAlgebraPool;
  let algebraVaultFactory: AlgebraVaultFactory;
  let algebraVault: AlgebraVault;
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

  before("create fixture loader", async () => {
    [wallet, alice, bob, carol, other, user0, user1, user2, user3, user4] = await (ethers as any).getSigners();
  });

  beforeEach("deploy contracts", async () => {
    ({ token0, token1, token2, factory, router, nft, oracle, algebraVaultFactory } = await loadFixture(
      algebraVaultTestFixture,
    ));

    await factory.createPool(await token0.getAddress(), await token1.getAddress(), '0x');
    let poolAddress = await factory.poolByPair(await token0.getAddress(), await token1.getAddress());
    uniswapPool = (await ethers.getContractAt("IAlgebraPool", poolAddress)) as IAlgebraPool;
    await uniswapPool.initialize(encodePriceSqrt("1", "1"));

    const tx = await algebraVaultFactory.connect(wallet).createAlgebraVault(await token0.getAddress(), true, await token1.getAddress(), false);

    const vaultKey = await algebraVaultFactory.genKey(
      await wallet.getAddress(),
      await token0.getAddress(),
      await token1.getAddress(),
      true,
      false
    );
    const algebraVaultAddress = await algebraVaultFactory.getAlgebraVault(vaultKey);
    algebraVault = (await ethers.getContractAt("AlgebraVault", algebraVaultAddress)) as AlgebraVault;

    await expect(tx)
      .to.emit(algebraVaultFactory, "AlgebraVaultCreated")
      .withArgs(await wallet.getAddress(), await algebraVault.getAddress(), await token0.getAddress(), true, await token1.getAddress(), false, 1);
    poolAddress = await algebraVault.pool();
    await expect(tx)
      .to.emit(algebraVault, "DeployAlgebraVault")
      .withArgs(await algebraVaultFactory.getAddress(), poolAddress, true, false, 3600);

    await algebraVault.connect(wallet).setDepositMax(ethers.parseEther("100000"), ethers.parseEther("100000"));

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
  });

  it("AlgebraVaultFactory - misc", async () => {
    const msg1 = "AVF.constructor: zero address",
      msg2 = "AVF.setFeeRecipient: zero address",
      msg3 = "AVF.setBaseFee: fees must be <= 10**18",
      msg4 = "AVF.setAmmFee: fees must be <= 10**18",
      msg5 = "AVF.setBaseFeeSplit: must be <= 10**18";

    const uV3MathFactory = await ethers.getContractFactory("UV3Math");
    const uV3Math = (await uV3MathFactory.deploy()) as UV3Math;

    const algebraVaultDeployer = await ethers.getContractFactory("AlgebraVaultDeployer", {
      libraries: {
        UV3Math: await uV3Math.getAddress(),
      },
    });
    const libAlgebraVaultDeployer = await algebraVaultDeployer.deploy();

    const farmingRewardsDistributorDeployer = await ethers.getContractFactory(
      "FarmingRewardsDistributorDeployer"
    );
    const libFarmingRewardsDistributorDeployer = await farmingRewardsDistributorDeployer.deploy();

    const algebraVaultFactoryFactory = await ethers.getContractFactory("AlgebraVaultFactory", {
      libraries: {
        AlgebraVaultDeployer: await libAlgebraVaultDeployer.getAddress(),
        FarmingRewardsDistributorDeployer: await libFarmingRewardsDistributorDeployer.getAddress(),
      },
    });

    await expect(algebraVaultFactoryFactory.deploy(NULL_ADDRESS, NULL_ADDRESS, NULL_ADDRESS, NULL_ADDRESS, "VEL")).to.be.revertedWith(msg1);

    await expect(algebraVaultFactory.connect(wallet).setFeeRecipient(NULL_ADDRESS)).to.be.revertedWith(msg2);
    await expect(algebraVaultFactory.connect(wallet).setBaseFee(PERCENT_101)).to.be.revertedWith(msg3);
    await expect(algebraVaultFactory.connect(wallet).setAmmFee(PERCENT_101)).to.be.revertedWith(msg4);
    await expect(algebraVaultFactory.connect(wallet).setBaseFeeSplit(PERCENT_101)).to.be.revertedWith(msg5);
    await algebraVaultFactory.connect(wallet).setAmmFee(PERCENT_10);
    await algebraVaultFactory.connect(wallet).setAmmFee(0);

    await expect(algebraVaultFactory.connect(wallet).setAmmFee(PERCENT_81)).to.be.revertedWith(msg4);
  });

  it("AlgebraVaultFactory - createAlgebraVault", async () => {
    const msg1 = "AVF.createAlgebraVault: identical tokens",
      msg2 = "AVF.createAlgebraVault: zero address",
      msg3 = "AVF.createAlgebraVault: no allowed tokens",
      msg4 = "AVF.createAlgebraVault: vault exists",
      msg6 = "AVF.createAlgebraVault: pool must exist";

    await expect(
      algebraVaultFactory.connect(wallet).createAlgebraVault(await token0.getAddress(), true, await token0.getAddress(), false),
    ).to.be.revertedWith(msg1);
    await expect(
      algebraVaultFactory.connect(wallet).createAlgebraVault(NULL_ADDRESS, true, await token1.getAddress(), false),
    ).to.be.revertedWith(msg2);
    await expect(
      algebraVaultFactory.connect(wallet).createAlgebraVault(await token0.getAddress(), true, NULL_ADDRESS, false),
    ).to.be.revertedWith(msg2);
    await expect(
      algebraVaultFactory.connect(wallet).createAlgebraVault(await token0.getAddress(), false, await token1.getAddress(), false),
    ).to.be.revertedWith(msg3);
    await expect(
      algebraVaultFactory.connect(wallet).createAlgebraVault(await token0.getAddress(), true, await token1.getAddress(), false),
    ).to.be.revertedWith(msg4);
    await expect(
      algebraVaultFactory.connect(wallet).createAlgebraVault(await token0.getAddress(), true, await token2.getAddress(), false),
    ).to.be.revertedWith(msg6);

    await factory.createPool(await token0.getAddress(), await token2.getAddress(), '0x');
    const poolAddress = await factory.poolByPair(await token0.getAddress(), await token2.getAddress());
    uniswapPool = (await ethers.getContractAt("IAlgebraPool", poolAddress)) as IAlgebraPool;
    await uniswapPool.initialize(encodePriceSqrt("1", "1"));

    await algebraVaultFactory.connect(wallet).createAlgebraVault(await token0.getAddress(), true, await token2.getAddress(), false);
  });

  function msg(text: string) {
    return "VM Exception while processing transaction: reverted with reason string '" + text + "'";
  }

  it("AlgebraVault - manual calls", async () => {
    const msg1 = "AV.constructor: zero address";

    const uV3MathFactory = await ethers.getContractFactory("UV3Math");
    const uV3Math = (await uV3MathFactory.deploy()) as UV3Math;

    const algebraVaultFactory = await ethers.getContractFactory("AlgebraVault", {
      libraries: {
        UV3Math: await uV3Math.getAddress(),
      },
    });

    await expect(algebraVaultFactory.deploy(NULL_ADDRESS, true, true, 3600, 0)).to.be.reverted;

    await expect(algebraVault.algebraSwapCallback(1, 1, "0x")).to.be.reverted;
  });

  it("AlgebraVault - disconnected plugin", async () => {
    let poolAddress = await factory.poolByPair(await token0.getAddress(), await token1.getAddress());
    let uniswapPool = (await ethers.getContractAt("IAlgebraPool", poolAddress)) as IAlgebraPool;

    const pluginAddress = await uniswapPool.plugin()
    //console.log("default plugin: " + pluginAddress);

    // plugin isn't connected yet
    await uniswapPool.setPlugin(NULL_ADDRESS);
    
    // Mint tokens to alice first
    await token0.mint(await alice.getAddress(), largeTokenAmount);
    await token1.mint(await alice.getAddress(), largeTokenAmount);
    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    
    await expect(
        algebraVault.connect(alice).deposit(ethers.parseEther("4000"), 0, await alice.getAddress()),
      ).to.be.revertedWithCustomError(algebraVault, "AlgebraDisconnectedPlugin");

    // connect plugin here
    await uniswapPool.setPlugin(pluginAddress);

    //check 'to' address
    await expect(
      algebraVault.connect(alice).deposit(ethers.parseEther("4000"), 0, NULL_ADDRESS),
    ).to.be.revertedWithCustomError(algebraVault, "ZeroAddress");
  });

  it("AlgebraVault - deposit", async () => {
    // Create pool for token0/token2 if not exists
    await factory.createPool(await token0.getAddress(), await token2.getAddress(), '0x');
    let poolAddress = await factory.poolByPair(await token0.getAddress(), await token2.getAddress());
    let uniswapPool = (await ethers.getContractAt("IAlgebraPool", poolAddress)) as IAlgebraPool;
    await uniswapPool.initialize(encodePriceSqrt("1", "1"));

    await network.provider.send("evm_increaseTime", [3600]);
    await network.provider.send("evm_mine", []);

    // Create vaults with token0/token2 pairs (different from token0/token1 in beforeEach)
    const tx1 = await algebraVaultFactory.connect(wallet).createAlgebraVault(await token0.getAddress(), true, await token2.getAddress(), false);
    const tx2 = await algebraVaultFactory.connect(wallet).createAlgebraVault(await token0.getAddress(), false, await token2.getAddress(), true);

    // check allowToken policy - first vault allows only token0
    let vaultKey = await algebraVaultFactory.genKey(await wallet.getAddress(), await token0.getAddress(), await token2.getAddress(), true, false);
    let algebraVaultAddress = await algebraVaultFactory.getAlgebraVault(vaultKey);
    let testVault = (await ethers.getContractAt("AlgebraVault", algebraVaultAddress)) as AlgebraVault;

    // This vault allows only token0, trying to deposit token1 (token2) should fail
    await expect(
      testVault.deposit(smallTokenAmount, ethers.parseEther("4000"), await alice.getAddress()),
    ).to.be.revertedWithCustomError(testVault, "InvalidDeposit");

    // Second vault allows only token1 (token2)
    vaultKey = await algebraVaultFactory.genKey(await wallet.getAddress(), await token0.getAddress(), await token2.getAddress(), false, true);
    algebraVaultAddress = await algebraVaultFactory.getAlgebraVault(vaultKey);
    testVault = (await ethers.getContractAt("AlgebraVault", algebraVaultAddress)) as AlgebraVault;

    // This vault allows only token1 (token2), trying to deposit token0 should fail
    await expect(
      testVault.deposit(smallTokenAmount, ethers.parseEther("4000"), await alice.getAddress()),
    ).to.be.revertedWithCustomError(testVault, "InvalidDeposit");

    // check deposit values
    vaultKey = await algebraVaultFactory.genKey(await wallet.getAddress(), await token0.getAddress(), await token2.getAddress(), true, false);
    algebraVaultAddress = await algebraVaultFactory.getAlgebraVault(vaultKey);
    testVault = (await ethers.getContractAt("AlgebraVault", algebraVaultAddress)) as AlgebraVault;
    await expect(testVault.deposit(0, 0, await alice.getAddress())).to.be.revertedWithCustomError(testVault, "InvalidDeposit");

    vaultKey = await algebraVaultFactory.genKey(await wallet.getAddress(), await token0.getAddress(), await token2.getAddress(), false, true);
    algebraVaultAddress = await algebraVaultFactory.getAlgebraVault(vaultKey);
    testVault = (await ethers.getContractAt("AlgebraVault", algebraVaultAddress)) as AlgebraVault;
    await expect(testVault.deposit(0, 0, await alice.getAddress())).to.be.revertedWithCustomError(testVault, "InvalidDeposit");

    // check against max deposit amounts
    vaultKey = await algebraVaultFactory.genKey(await wallet.getAddress(), await token0.getAddress(), await token2.getAddress(), true, false);
    algebraVaultAddress = await algebraVaultFactory.getAlgebraVault(vaultKey);
    testVault = (await ethers.getContractAt("AlgebraVault", algebraVaultAddress)) as AlgebraVault;
    await testVault.connect(wallet).setDepositMax(ethers.parseEther("100000"), ethers.parseEther("100000"));
    
    await expect(
      testVault.deposit(ethers.parseEther("200000"), ethers.parseEther("4000"), await alice.getAddress()),
    ).to.be.revertedWithCustomError(testVault, "InvalidDeposit");
    await expect(
      testVault.deposit(ethers.parseEther("4000"), ethers.parseEther("200000"), await alice.getAddress()),
    ).to.be.revertedWithCustomError(testVault, "InvalidDeposit");

    // alice approves the AlgebraVault to transfer her tokens
    await token0.connect(alice).approve(await testVault.getAddress(), largeTokenAmount);
    await token2.connect(alice).approve(await testVault.getAddress(), largeTokenAmount);
    // mint tokens to alice
    await token0.mint(await alice.getAddress(), largeTokenAmount);
    await token2.mint(await alice.getAddress(), largeTokenAmount);

    //check 'to' address
    await expect(
      testVault.connect(alice).deposit(ethers.parseEther("4000"), 0, NULL_ADDRESS),
    ).to.be.revertedWithCustomError(testVault, "ZeroAddress");
    await expect(
      testVault
        .connect(alice)
        .deposit(ethers.parseEther("4000"), 0, algebraVaultAddress),
    ).to.be.revertedWithCustomError(testVault, "ZeroAddress");
  });

  it("AlgebraVault - withdraw", async () => {
    // alice approves the AlgebraVault to transfer her tokens
    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    // mint tokens to alice
    await token0.mint(await alice.getAddress(), largeTokenAmount);
    await token1.mint(await alice.getAddress(), largeTokenAmount);

    // Increase time significantly to pass hysteresis check
    await network.provider.send("evm_increaseTime", [7200]); // 2 hours
    await network.provider.send("evm_mine", []);

    await algebraVault
      .connect(alice)
      .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());

    //check 'to' address
    await expect(algebraVault.connect(alice).withdraw(ethers.parseEther("4000"), NULL_ADDRESS)).to.be.revertedWithCustomError(
      algebraVault,
      "ZeroAddress",
    );
    //check shares
    await expect(algebraVault.connect(alice).withdraw(0, await alice.getAddress())).to.be.revertedWithCustomError(algebraVault, "ZeroValue");
  });

  it("AlgebraVault - rebalance", async () => {
    const msg1 = "InvalidPosition",
      msg3 = "IdenticalPositions",
      msg2 = "InvalidPosition";

    // alice approves the AlgebraVault to transfer her tokens
    await token0.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    await token1.connect(alice).approve(await algebraVault.getAddress(), largeTokenAmount);
    // mint tokens to alice
    await token0.mint(await alice.getAddress(), largeTokenAmount);
    await token1.mint(await alice.getAddress(), largeTokenAmount);

    const tickSpacing = await algebraVault.tickSpacing();
    //console.log(tickSpacing.toString());
    const fee = await algebraVault.fee();
    //console.log(fee.toString());

    await algebraVault
      .connect(alice)
      .deposit(ethers.parseEther("4000"), 0, await alice.getAddress());

    await expect(algebraVault.connect(wallet).rebalance(
        -1800, -1200, -1800, -1200, 0)
    ).to.be.revertedWithCustomError(algebraVault, msg3);
    await expect(algebraVault.connect(wallet).rebalance(
        1800, 1200, 60, 600, 0)
    ).to.be.revertedWithCustomError(algebraVault, msg1);
    await expect(algebraVault.connect(wallet).rebalance(
        -1800, -1200, -180, -600, 0)
    ).to.be.revertedWithCustomError(algebraVault, msg2);

    await algebraVault.connect(wallet).rebalance(-1800, -1200, 180, 600, 0);
    const balance0 = await token0.balanceOf(await algebraVault.getAddress());
    const balance1 = await token1.balanceOf(await algebraVault.getAddress());
    expect(balance0).to.be.equal(0);
    expect(balance1).to.be.equal(0);

    const rebalanceSwapAmount = ethers.parseEther("4000");
    await expect(algebraVault.connect(wallet).rebalance(1800, 1000, 50, 550, rebalanceSwapAmount)).to.be.revertedWithCustomError(algebraVault, msg1);
    await expect(algebraVault.connect(wallet).rebalance(-1800, 1000, 50, 550, rebalanceSwapAmount)).to.be.revertedWithCustomError(algebraVault, msg1);
    await expect(algebraVault.connect(wallet).rebalance(-1000, 1800, 50, 550, rebalanceSwapAmount)).to.be.revertedWithCustomError(algebraVault, msg1);

    await expect(algebraVault.connect(wallet).rebalance(-1800, 1200, -50, -550, rebalanceSwapAmount)).to.be.revertedWithCustomError(algebraVault, msg2);
    await expect(algebraVault.connect(wallet).rebalance(-1800, 1200, -600, -500, rebalanceSwapAmount)).to.be.revertedWithCustomError(algebraVault, msg2);
    await expect(algebraVault.connect(wallet).rebalance(
        -1800, 1200, -600, -550, rebalanceSwapAmount)
    ).to.be.revertedWithCustomError(algebraVault, msg2);
  });

  it("AlgebraVault - setTwapPeriod", async () => {
    const msg1 = "ZeroValue"

    await expect(algebraVault.connect(wallet).setTwapPeriod(0)).to.be.revertedWithCustomError(
        algebraVault,
        msg1
    )

    await expect(algebraVault.connect(wallet).setTwapPeriod(1800))
      .to.emit(algebraVault, "SetTwapPeriod")
      .withArgs(await wallet.getAddress(), 1800);
  });

  it("AlgebraVault - setHysteresis", async () => {
    await expect(algebraVault.connect(wallet).setHysteresis(50)) // 5%
      .to.emit(algebraVault, "Hysteresis")
      .withArgs(await wallet.getAddress(), 50);
  });

  it("AlgebraVault - setAmmFeeRecipient", async () => {
    await expect(algebraVault.connect(wallet).setAmmFeeRecipient(NULL_ADDRESS))
      .to.emit(algebraVault, "AmmFeeRecipient")
      .withArgs(await wallet.getAddress(), NULL_ADDRESS);
  });

  it("AlgebraVault - symbol", async () => {
    const tx = await algebraVaultFactory.connect(wallet).createAlgebraVault(await token0.getAddress(), false, await token1.getAddress(), true);

    let algebraVaultAddress = await algebraVaultFactory.allVaults(0);
    algebraVault = (await ethers.getContractAt("AlgebraVault", algebraVaultAddress)) as AlgebraVault;

    let symbol = await algebraVault.symbol();
    expect(symbol).to.equal("AV-VEL-0-symbol-symbol");

    algebraVaultAddress = await algebraVaultFactory.allVaults(1);
    algebraVault = (await ethers.getContractAt("AlgebraVault", algebraVaultAddress)) as AlgebraVault;

    symbol = await algebraVault.symbol();
    expect(symbol).to.equal("AV-VEL-1-symbol-symbol");
  });
});
