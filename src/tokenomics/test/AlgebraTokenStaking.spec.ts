import {ethers, network} from "hardhat";
import { expect } from "chai";

describe("AlgebraTokenStaking", function () {
  before(async function () {
    this.ALGBToken = await ethers.getContractFactory("TestERC20")
    this.stakingContract = await ethers.getContractFactory("AlgebraTokenStaking")

    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
  })

  beforeEach(async function () {
    this.ALGB = await this.ALGBToken.deploy("0")
    this.AlgebraStaking = await this.stakingContract.deploy(this.ALGB.address)
    this.ALGB.mint(this.alice.address, "100")
    this.ALGB.mint(this.bob.address, "100")
    this.ALGB.mint(this.carol.address, "100")
  })

  it("First staker should claim all provided before rewards", async function() {
    await this.ALGB.connect(this.carol).approve(this.AlgebraStaking.address, "20", { from: this.carol.address })
    await this.ALGB.connect(this.carol).transfer(this.AlgebraStaking.address, "20", { from: this.carol.address })
    await this.ALGB.approve(this.AlgebraStaking.address, "100")
    await this.AlgebraStaking.enter("100")
    await network.provider.send("evm_increaseTime", [1800])
    await network.provider.send("evm_mine")
    expect((await this.AlgebraStaking.currentBalance("100")).toString()).to.be.eq('120')
  })

  it("should not allow enter if not enough approve", async function () {
    await expect(this.AlgebraStaking.enter("100")).to.be.revertedWith("allowance insufficient")
    await this.ALGB.approve(this.AlgebraStaking.address, "50")
    await expect(this.AlgebraStaking.enter("100")).to.be.revertedWith("allowance insufficient")
    await this.ALGB.approve(this.AlgebraStaking.address, "100")
    await this.AlgebraStaking.enter("100")
    expect(await this.AlgebraStaking.balanceOf(this.alice.address)).to.equal("100")
  })

  it("should not allow withraw more than what you have", async function () {
    await this.ALGB.approve(this.AlgebraStaking.address, "100")
    await this.AlgebraStaking.enter("100")
    await expect(this.AlgebraStaking.leave("200")).to.be.revertedWith("ERC20: burn amount exceeds balance")
  })

  it("should not be able to transfer xALGB until unfreeze time", async function (){
    await this.ALGB.approve(this.AlgebraStaking.address, "100")
    await this.AlgebraStaking.enter("20")

    await expect(this.AlgebraStaking.transfer(this.bob.address, "1")).to.be.revertedWith(
        "ERC20: transfer amount exceeds balance"
    )

    await network.provider.send("evm_increaseTime", [1800])
    await network.provider.send("evm_mine")

    await this.AlgebraStaking.transfer(this.bob.address, "1")

    expect(await this.AlgebraStaking.balanceOf(this.bob.address)).to.equal("1")
  })

  it("should work with more than one participant", async function () {
    await this.ALGB.approve(this.AlgebraStaking.address, "100")
    await this.ALGB.connect(this.bob).approve(this.AlgebraStaking.address, "100", { from: this.bob.address })
    // Alice enters and gets 20 shares. Bob enters and gets 10 shares.
    await this.AlgebraStaking.enter("20")
    await this.AlgebraStaking.connect(this.bob).enter("10", { from: this.bob.address })
    expect(await this.AlgebraStaking.balanceOf(this.alice.address)).to.equal("20")
    expect(await this.AlgebraStaking.balanceOf(this.bob.address)).to.equal("10")
    expect(await this.ALGB.balanceOf(this.AlgebraStaking.address)).to.equal("30")
    // stakingContract get 20 more ALGBs from an external source.
    await this.ALGB.connect(this.carol).transfer(this.AlgebraStaking.address, "20", { from: this.carol.address })
    // Alice deposits 10 more ALGBs. She should receive 10*30/50 = 6 shares.
    await this.AlgebraStaking.enter("10")
    expect(await this.AlgebraStaking.balanceOf(this.alice.address)).to.equal("26")
    expect(await this.AlgebraStaking.balanceOf(this.bob.address)).to.equal("10")
    // Bob withdraws 5 shares. He should receive 5*60/36 = 8 shares
    await expect(this.AlgebraStaking.connect(this.bob).leave("5", { from: this.bob.address })).to.be.revertedWith(
        "ERC20: burn amount exceeds balance"
    )
    await network.provider.send("evm_increaseTime", [1800])
    await network.provider.send("evm_mine")
    await this.AlgebraStaking.connect(this.bob).leave("5", { from: this.bob.address })
    expect(await this.AlgebraStaking.balanceOf(this.alice.address)).to.equal("26")
    expect(await this.AlgebraStaking.balanceOf(this.bob.address)).to.equal("5")
    expect(await this.ALGB.balanceOf(this.AlgebraStaking.address)).to.equal("52")
    expect(await this.ALGB.balanceOf(this.alice.address)).to.equal("70")
    expect(await this.ALGB.balanceOf(this.bob.address)).to.equal("98")
  })
})