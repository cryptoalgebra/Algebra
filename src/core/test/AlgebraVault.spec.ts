import { Wallet, getCreateAddress, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { AlgebraFactory, AlgebraPoolDeployer, AlgebraCommunityVault, TestERC20 } from '../typechain';
import { expect } from './shared/expect';

describe('AlgebraCommunityVault', () => {
  let wallet: Wallet, other: Wallet, third: Wallet;

  let factory: AlgebraFactory;
  let poolDeployer: AlgebraPoolDeployer;
  let vault: AlgebraCommunityVault;

  let token0: TestERC20;
  let token1: TestERC20;

  const AMOUNT = 10n ** 18n;

  const fixture = async () => {
    const [deployer] = await ethers.getSigners();
    // precompute
    const poolDeployerAddress = getCreateAddress({
      from: deployer.address,
      nonce: (await ethers.provider.getTransactionCount(deployer.address)) + 1,
    });

    const factoryFactory = await ethers.getContractFactory('AlgebraFactory');
    const _factory = (await factoryFactory.deploy(poolDeployerAddress)) as any as AlgebraFactory;

    const poolDeployerFactory = await ethers.getContractFactory('AlgebraPoolDeployer');
    poolDeployer = (await poolDeployerFactory.deploy(_factory)) as any as AlgebraPoolDeployer;

    const vaultFactory = await ethers.getContractFactory('AlgebraCommunityVault');
    vault = (await vaultFactory.deploy(_factory)) as any as AlgebraCommunityVault;

    const vaultFactoryStubFactory = await ethers.getContractFactory('AlgebraVaultFactoryStub');
    const vaultFactoryStub = await vaultFactoryStubFactory.deploy(vault);

    await _factory.setVaultFactory(vaultFactoryStub);

    const tokenFactory = await ethers.getContractFactory('TestERC20');
    token0 = (await tokenFactory.deploy(2n ** 255n)) as any as TestERC20;
    token1 = (await tokenFactory.deploy(2n ** 255n)) as any as TestERC20;

    return _factory;
  };

  before('create fixture loader', async () => {
    [wallet, other, third] = await (ethers as any).getSigners();
  });

  beforeEach('add tokens to vault', async () => {
    factory = await loadFixture(fixture);
    await token0.transfer(vault, AMOUNT);
    await token1.transfer(vault, AMOUNT);
  });

  describe('#Withdraw', async () => {
    describe('successful cases', async () => {
      let communityFeeReceiver: string;

      beforeEach('set communityFee receiver', async () => {
        communityFeeReceiver = wallet.address;
        await vault.changeCommunityFeeReceiver(communityFeeReceiver);
      });

      it('withdraw works', async () => {
        let balanceBefore = await token0.balanceOf(communityFeeReceiver);
        await vault.withdraw(token0, AMOUNT);
        let balanceAfter = await token0.balanceOf(communityFeeReceiver);
        expect(balanceAfter - balanceBefore).to.eq(AMOUNT);
      });

      it('withdrawTokens works', async () => {
        let balance0Before = await token0.balanceOf(communityFeeReceiver);
        let balance1Before = await token1.balanceOf(communityFeeReceiver);
        await vault.withdrawTokens([
          {
            token: token0,
            amount: AMOUNT,
          },
          {
            token: token1,
            amount: AMOUNT,
          },
        ]);
        let balance0After = await token0.balanceOf(communityFeeReceiver);
        let balance1After = await token1.balanceOf(communityFeeReceiver);
        expect(balance0After - balance0Before).to.eq(AMOUNT);
        expect(balance1After - balance1Before).to.eq(AMOUNT);
      });
    });

    describe('failing cases', async () => {
      it('withdraw onlyWithdrawer', async () => {
        await vault.changeCommunityFeeReceiver(wallet.address);
        expect(await vault.communityFeeReceiver()).to.be.eq(wallet.address);
        await expect(vault.connect(other).withdraw(token0, AMOUNT)).to.be.revertedWith('only withdrawer');
      });

      it('cannot withdraw without communityFeeReceiver', async () => {
        await expect(vault.withdraw(token0, AMOUNT)).to.be.revertedWith('invalid receiver');
      });

      it('withdrawTokens onlyWithdrawer', async () => {
        await vault.changeCommunityFeeReceiver(wallet.address);
        expect(await vault.communityFeeReceiver()).to.be.eq(wallet.address);
        await expect(
          vault.connect(other).withdrawTokens([
            {
              token: token0,
              amount: AMOUNT,
            },
          ])
        ).to.be.reverted;
      });

      it('cannot withdrawTokens without communityFeeReceiver', async () => {
        await expect(
          vault.withdrawTokens([
            {
              token: token0,
              amount: AMOUNT,
            },
          ])
        ).to.be.revertedWith('invalid receiver');
      });
    });
  });

  describe('#FactoryOwner permissioned actions', async () => {
    it('can change communityFeeReceiver', async () => {
      await vault.changeCommunityFeeReceiver(other.address);
      expect(await vault.communityFeeReceiver()).to.be.eq(other.address);
    });

    it('can not change communityFeeReceiver to zero address', async () => {
      await expect(vault.changeCommunityFeeReceiver(ZeroAddress)).to.be.reverted;
    });

    it('can not change communityFeeReceiver to same address', async () => {
      await vault.changeCommunityFeeReceiver(other.address);
      await expect(vault.changeCommunityFeeReceiver(other.address)).to.be.reverted;
    });

    it('only administrator can change communityFeeReceiver', async () => {
      await expect(vault.connect(other).changeCommunityFeeReceiver(other.address)).to.be.revertedWith(
        'only administrator'
      );
    });
  });
});
