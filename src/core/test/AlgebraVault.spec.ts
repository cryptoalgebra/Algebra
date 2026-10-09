import { Wallet, getCreateAddress, MaxUint256, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { AlgebraFactory, AlgebraCommunityVault, TestERC20 } from '../typechain';
import { expect } from './shared/expect';
import { encodePriceSqrt } from './shared/utilities';

describe('AlgebraCommunityVault', () => {
  let wallet: Wallet, other: Wallet;
  let factory: AlgebraFactory;
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
    await poolDeployerFactory.deploy(_factory, await _factory.poolExtension());

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
    [wallet, other] = await (ethers as any).getSigners();
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
        await expect(vault.withdraw(token0, AMOUNT))
          .to.emit(vault, 'TokensWithdrawal')
          .withArgs(await token0.getAddress(), communityFeeReceiver, AMOUNT);
        let balanceAfter = await token0.balanceOf(communityFeeReceiver);
        expect(balanceAfter - balanceBefore).to.eq(AMOUNT);
      });

      it('withdrawTokens works', async () => {
        let balance0Before = await token0.balanceOf(communityFeeReceiver);
        let balance1Before = await token1.balanceOf(communityFeeReceiver);
        const tx = await vault.withdrawTokens([
          {
            token: token0,
            amount: AMOUNT,
          },
          {
            token: token1,
            amount: AMOUNT,
          },
        ]);
        for (const token of [token0, token1])
          await expect(tx)
            .to.emit(vault, 'TokensWithdrawal')
            .withArgs(await token.getAddress(), communityFeeReceiver, AMOUNT);
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
        ).to.be.revertedWith('only withdrawer');
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
      await expect(vault.changeCommunityFeeReceiver(other.address))
        .to.emit(vault, 'CommunityFeeReceiver')
        .withArgs(other.address);
      expect(await vault.communityFeeReceiver()).to.be.eq(other.address);
    });

    it('can not change communityFeeReceiver to the zero or the same address', async () => {
      // the receiver starts at zero, where both checks reject the same call, so one is set first
      await vault.changeCommunityFeeReceiver(other.address);
      await expect(vault.changeCommunityFeeReceiver(ZeroAddress)).to.be.revertedWithoutReason();
      await expect(vault.changeCommunityFeeReceiver(other.address)).to.be.revertedWithoutReason();
    });

    it('only administrator can change communityFeeReceiver', async () => {
      await expect(vault.connect(other).changeCommunityFeeReceiver(other.address)).to.be.revertedWith(
        'only administrator'
      );
    });
  });

  describe('#claimCommunityFees', async () => {
    async function createPool(tokenA: string, tokenB: string) {
      await factory.createPool(tokenA, tokenB, '0x');
      return ethers.getContractAt('AlgebraPool', await factory.poolByPair(tokenA, tokenB));
    }

    it('claims from several pools of this vault', async () => {
      const token2 = await (await ethers.getContractFactory('TestERC20')).deploy(2n ** 255n);
      const pools = [await createPool(await token0.getAddress(), await token1.getAddress()), await createPool(await token0.getAddress(), await token2.getAddress())];
      const callee = await (await ethers.getContractFactory('TestAlgebraCallee')).deploy();
      for (const token of [token0, token1, token2]) await token.approve(callee, MaxUint256);

      // each pool gets a flash payment in both of its tokens, all of it kept as the community fee
      const payments = [100n, 200n];
      for (const [i, pool] of pools.entries()) {
        expect(await pool.communityVault()).to.eq(await vault.getAddress());
        await pool.initialize(encodePriceSqrt(1, 1));
        await pool.setCommunityFee(1000);
        await callee.flash(pool, wallet.address, 0, 0, payments[i], payments[i]);
        expect(await pool.getCommunityFeePending()).to.deep.eq([payments[i], payments[i]]);
      }

      const tx = await vault.claimCommunityFees(pools);
      for (const [i, pool] of pools.entries()) {
        await expect(tx)
          .to.emit(pool, 'CommunityFeeTransfer')
          .withArgs(await vault.getAddress(), payments[i], payments[i]);
        expect(await pool.getCommunityFeePending()).to.deep.eq([0n, 0n]);
      }
      await expect(tx).to.changeTokenBalance(token0, vault, payments[0] + payments[1]);
      await expect(tx).to.changeTokenBalance(token1, vault, payments[0]);
      await expect(tx).to.changeTokenBalance(token2, vault, payments[1]);
    });
  });
});
