import { Wallet, BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { AlgebraFactory } from '../typechain/AlgebraFactory'
import { AlgebraPoolDeployer } from "../typechain/AlgebraPoolDeployer";
import { AlgebraCommunityVault } from "../typechain/AlgebraCommunityVault"
import { TestERC20 } from '../typechain/test/TestERC20'
import { expect } from './shared/expect'

const { constants } = ethers

describe('AlgebraCommunityVault', () => {
  let wallet: Wallet, other: Wallet

  let factory: AlgebraFactory
  let poolDeployer: AlgebraPoolDeployer
  let vault: AlgebraCommunityVault

  let token0: TestERC20
  let token1: TestERC20
  const fixture = async () => {
    const [deployer] = await ethers.getSigners();
    // precompute
    const poolDeployerAddress = ethers.utils.getContractAddress({
      from: deployer.address, 
      nonce: (await deployer.getTransactionCount()) + 1
    })

    const factoryFactory = await ethers.getContractFactory('AlgebraFactory')
    const _factory = (await factoryFactory.deploy(poolDeployerAddress)) as AlgebraFactory

    const vaultAddress = await _factory.communityVault();
    const vaultFactory = await ethers.getContractFactory('AlgebraCommunityVault')
    vault = (vaultFactory.attach(vaultAddress)) as AlgebraCommunityVault;

    const tokenFactory = await ethers.getContractFactory('TestERC20')
    token0 = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20
    token1 = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20

    const poolDeployerFactory = await ethers.getContractFactory('AlgebraPoolDeployer')
    poolDeployer = (await poolDeployerFactory.deploy(_factory.address, vault.address)) as AlgebraPoolDeployer
    return _factory;
  }


  before('create fixture loader', async () => {
    [wallet, other] = await (ethers as any).getSigners()
  })


  beforeEach('add tokens to vault', async () => {
    factory = await loadFixture(fixture)
    await token0.transfer(vault.address, BigNumber.from(10).pow(18))
    await token1.transfer(vault.address, BigNumber.from(10).pow(18))
  })

  it('withdraw works correct', async () => {
    let balanceBefore = await token0.balanceOf(wallet.address)
    await vault.withdraw(token0.address, wallet.address, BigNumber.from(10).pow(18))
    let balanceAfter = await token0.balanceOf(wallet.address)
    expect(balanceAfter.sub(balanceBefore)).to.eq(BigNumber.from(10).pow(18))
  })

  it('withdraw onlyWithdrawer', async () => {
    await expect(vault.connect(other).withdraw(token0.address, wallet.address, BigNumber.from(10).pow(18))).to.be.reverted
  })

  it('withdrawTokens onlyWithdrawer', async () => {
    await expect(vault.connect(other).withdrawTokens([{
      token: token0.address, 
      to: wallet.address, 
      amount: BigNumber.from(10).pow(18)
    }])).to.be.reverted
  })

  it('withdrawTokens works correct', async () => {
    let balance0Before = await token0.balanceOf(wallet.address)
    let balance1Before = await token1.balanceOf(wallet.address)
    await vault.withdrawTokens([{
      token: token0.address, 
      to: wallet.address, 
      amount: BigNumber.from(10).pow(18)
    },
    {
      token: token1.address,
      to: wallet.address,
      amount: BigNumber.from(10).pow(18)
    }])
    let balance0After = await token0.balanceOf(wallet.address)
    let balance1After = await token1.balanceOf(wallet.address)
    expect(balance0After.sub(balance0Before)).to.eq(BigNumber.from(10).pow(18))
    expect(balance1After.sub(balance1Before)).to.eq(BigNumber.from(10).pow(18))
  })

})