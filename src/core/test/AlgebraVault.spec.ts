import { Wallet, BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { AlgebraFactory, AlgebraPoolDeployer, AlgebraCommunityVault, TestERC20 } from '../typechain';
import { expect } from './shared/expect';

const { constants } = ethers;

describe('AlgebraCommunityVault', () => {
  let wallet: Wallet, other: Wallet, third: Wallet;

  let factory: AlgebraFactory;
  let poolDeployer: AlgebraPoolDeployer;
  let vault: AlgebraCommunityVault;

  let token0: TestERC20;
  let token1: TestERC20;

  const AMOUNT = BigNumber.from(10).pow(18);

  const fixture = async () => {
    const [deployer] = await ethers.getSigners();
    // precompute
    const poolDeployerAddress = ethers.utils.getContractAddress({
      from: deployer.address,
      nonce: (await deployer.getTransactionCount()) + 1,
    });

    const factoryFactory = await ethers.getContractFactory('AlgebraFactory');
    const _factory = (await factoryFactory.deploy(poolDeployerAddress)) as AlgebraFactory;

    const vaultAddress = await _factory.communityVault();
    const vaultFactory = await ethers.getContractFactory('AlgebraCommunityVault');
    vault = vaultFactory.attach(vaultAddress) as AlgebraCommunityVault;

    const tokenFactory = await ethers.getContractFactory('TestERC20');
    token0 = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20;
    token1 = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20;

    const poolDeployerFactory = await ethers.getContractFactory('AlgebraPoolDeployer');
    poolDeployer = (await poolDeployerFactory.deploy(_factory.address, vault.address)) as AlgebraPoolDeployer;
    return _factory;
  };

  before('create fixture loader', async () => {
    [wallet, other, third] = await (ethers as any).getSigners();
  });

  beforeEach('add tokens to vault', async () => {
    factory = await loadFixture(fixture);
    await token0.transfer(vault.address, BigNumber.from(10).pow(18));
    await token1.transfer(vault.address, BigNumber.from(10).pow(18));
  });

  describe('#Withdraw', async () => {
    describe('successful cases', async () => {
      let communityFeeReceiver: string;

      beforeEach('set communityFee receiver', async () => {
        communityFeeReceiver = wallet.address;
        await vault.changeCommunityFeeReceiver(communityFeeReceiver);

        await vault.transferAlgebraFeeManagerRole(other.address);
        await vault.connect(other).acceptAlgebraFeeManagerRole();
      });

      describe('Algebra fee off', async () => {
        it('withdraw works', async () => {
          let balanceBefore = await token0.balanceOf(communityFeeReceiver);
          await vault.withdraw(token0.address, AMOUNT);
          let balanceAfter = await token0.balanceOf(communityFeeReceiver);
          expect(balanceAfter.sub(balanceBefore)).to.eq(AMOUNT);
        });

        it('algebra fee manager can withdraw', async () => {
          let balanceBefore = await token0.balanceOf(communityFeeReceiver);

          await expect(vault.connect(third).withdraw(token0.address, AMOUNT)).to.be.reverted;

          await vault.connect(other).withdraw(token0.address, AMOUNT);

          let balanceAfter = await token0.balanceOf(communityFeeReceiver);
          expect(balanceAfter.sub(balanceBefore)).to.eq(AMOUNT);
        });

        it('withdrawTokens works', async () => {
          let balance0Before = await token0.balanceOf(communityFeeReceiver);
          let balance1Before = await token1.balanceOf(communityFeeReceiver);
          await vault.withdrawTokens([
            {
              token: token0.address,
              amount: AMOUNT,
            },
            {
              token: token1.address,
              amount: AMOUNT,
            },
          ]);
          let balance0After = await token0.balanceOf(communityFeeReceiver);
          let balance1After = await token1.balanceOf(communityFeeReceiver);
          expect(balance0After.sub(balance0Before)).to.eq(AMOUNT);
          expect(balance1After.sub(balance1Before)).to.eq(AMOUNT);
        });
      });

      describe('Algebra fee on', async () => {
        let algebraFeeReceiver: string;
        const ALGEBRA_FEE = 100; // 10%

        beforeEach('turn on algebra fee', async () => {
          algebraFeeReceiver = other.address;
          await vault.connect(other).changeAlgebraFeeReceiver(algebraFeeReceiver);

          await vault.connect(other).proposeAlgebraFeeChange(ALGEBRA_FEE);
          await vault.acceptAlgebraFeeChangeProposal(ALGEBRA_FEE);
        });

        it('withdraw works', async () => {
          let balanceBefore = await token0.balanceOf(communityFeeReceiver);
          let balanceAlgebraBefore = await token0.balanceOf(algebraFeeReceiver);

          await vault.withdraw(token0.address, AMOUNT);
          let balanceAfter = await token0.balanceOf(communityFeeReceiver);
          let balanceAlgebraAfter = await token0.balanceOf(algebraFeeReceiver);

          expect(balanceAfter.sub(balanceBefore)).to.eq(AMOUNT.sub(AMOUNT.mul(ALGEBRA_FEE).div(1000)));
          expect(balanceAlgebraAfter.sub(balanceAlgebraBefore)).to.eq(AMOUNT.mul(ALGEBRA_FEE).div(1000));
        });

        it('algebra fee manager can withdraw', async () => {
          let balanceBefore = await token0.balanceOf(communityFeeReceiver);
          let balanceAlgebraBefore = await token0.balanceOf(algebraFeeReceiver);

          await expect(vault.connect(third).withdraw(token0.address, AMOUNT)).to.be.reverted;

          await vault.connect(other).withdraw(token0.address, AMOUNT);

          let balanceAfter = await token0.balanceOf(communityFeeReceiver);
          let balanceAlgebraAfter = await token0.balanceOf(algebraFeeReceiver);

          expect(balanceAfter.sub(balanceBefore)).to.eq(AMOUNT.sub(AMOUNT.mul(ALGEBRA_FEE).div(1000)));
          expect(balanceAlgebraAfter.sub(balanceAlgebraBefore)).to.eq(AMOUNT.mul(ALGEBRA_FEE).div(1000));
        });

        it('withdrawTokens works', async () => {
          let balance0Before = await token0.balanceOf(communityFeeReceiver);
          let balance1Before = await token1.balanceOf(communityFeeReceiver);
          let balance0AlgebraBefore = await token0.balanceOf(algebraFeeReceiver);
          let balance1AlgebraBefore = await token1.balanceOf(algebraFeeReceiver);

          await vault.withdrawTokens([
            {
              token: token0.address,
              amount: AMOUNT,
            },
            {
              token: token1.address,
              amount: AMOUNT,
            },
          ]);
          let balance0After = await token0.balanceOf(communityFeeReceiver);
          let balance1After = await token1.balanceOf(communityFeeReceiver);
          let balance0AlgebraAfter = await token0.balanceOf(algebraFeeReceiver);
          let balance1AlgebraAfter = await token1.balanceOf(algebraFeeReceiver);

          expect(balance0After.sub(balance0Before)).to.eq(AMOUNT.sub(AMOUNT.mul(ALGEBRA_FEE).div(1000)));
          expect(balance1After.sub(balance1Before)).to.eq(AMOUNT.sub(AMOUNT.mul(ALGEBRA_FEE).div(1000)));
          expect(balance0AlgebraAfter.sub(balance0AlgebraBefore)).to.eq(AMOUNT.mul(ALGEBRA_FEE).div(1000));
          expect(balance1AlgebraAfter.sub(balance1AlgebraBefore)).to.eq(AMOUNT.mul(ALGEBRA_FEE).div(1000));
        });
      });
    });

    describe('failing cases', async () => {
      it('withdraw onlyWithdrawer', async () => {
        await vault.changeCommunityFeeReceiver(wallet.address);
        await expect(vault.connect(other).withdraw(token0.address, AMOUNT)).to.be.reverted;
      });

      it('cannot withdraw without communityFeeReceiver', async () => {
        await expect(vault.withdraw(token0.address, AMOUNT)).to.be.revertedWith('invalid receiver');
      });

      it('withdrawTokens onlyWithdrawer', async () => {
        await vault.changeCommunityFeeReceiver(wallet.address);
        await expect(
          vault.connect(other).withdrawTokens([
            {
              token: token0.address,
              amount: AMOUNT,
            },
          ])
        ).to.be.reverted;
      });

      it('cannot withdrawTokens without communityFeeReceiver', async () => {
        await expect(
          vault.withdrawTokens([
            {
              token: token0.address,
              amount: AMOUNT,
            },
          ])
        ).to.be.revertedWith('invalid receiver');
      });

      describe('Algebra fee on', async () => {
        const ALGEBRA_FEE = 100; // 10%

        beforeEach('turn on algebra fee', async () => {
          await vault.proposeAlgebraFeeChange(ALGEBRA_FEE);
          await vault.acceptAlgebraFeeChangeProposal(ALGEBRA_FEE);
        });

        it('cannot withdraw without algebraFeeReceiver', async () => {
          await vault.changeCommunityFeeReceiver(wallet.address);
          await expect(vault.withdraw(token0.address, AMOUNT)).to.be.revertedWith('invalid algebra fee receiver');
        });

        it('cannot withdrawTokens without algebraFeeReceiver', async () => {
          await vault.changeCommunityFeeReceiver(wallet.address);
          await expect(
            vault.withdrawTokens([
              {
                token: token0.address,
                amount: AMOUNT,
              },
            ])
          ).to.be.revertedWith('invalid algebra fee receiver');
        });
      });
    });
  });

  describe('#FactoryOwner permissioned actions', async () => {
    const ALGEBRA_FEE = 100; // 10%

    it('can accept fee change proposal', async () => {
      await vault.proposeAlgebraFeeChange(ALGEBRA_FEE);
      await vault.acceptAlgebraFeeChangeProposal(ALGEBRA_FEE);
      expect(await vault.algebraFee()).to.be.eq(ALGEBRA_FEE);
      expect(await vault.hasNewAlgebraFeeProposal()).to.be.eq(false);
    });

    it('only factory owner can accept fee change proposal', async () => {
      await vault.proposeAlgebraFeeChange(ALGEBRA_FEE);
      await expect(vault.connect(other).acceptAlgebraFeeChangeProposal(ALGEBRA_FEE)).to.be.reverted;
    });

    it('can not accept invalid fee change proposal', async () => {
      await vault.proposeAlgebraFeeChange(ALGEBRA_FEE);
      await expect(vault.acceptAlgebraFeeChangeProposal(ALGEBRA_FEE - 1)).to.be.revertedWith('invalid new fee');
    });

    it('can not accept fee if nothing proposed', async () => {
      await expect(vault.acceptAlgebraFeeChangeProposal(ALGEBRA_FEE)).to.be.revertedWith('not proposed');
    });

    it('can change communityFeeReceiver', async () => {
      await vault.changeCommunityFeeReceiver(other.address);
      expect(await vault.communityFeeReceiver()).to.be.eq(other.address);
    });

    it('can not change communityFeeReceiver to zero address', async () => {
      await expect(vault.changeCommunityFeeReceiver(ethers.constants.AddressZero)).to.be.reverted;
    });

    it('only factory owner can change communityFeeReceiver', async () => {
      await expect(vault.connect(other).changeCommunityFeeReceiver(other.address)).to.be.reverted;
    });
  });

  describe('#AlgebraFeeManager permissioned actions', async () => {
    const ALGEBRA_FEE = 100; // 10%

    it('can transfer AlgebraFeeManager role', async () => {
      await vault.transferAlgebraFeeManagerRole(other.address);
      await vault.connect(other).acceptAlgebraFeeManagerRole();
      expect(await vault.algebraFeeManager()).to.be.eq(other.address);
    });

    it('only pending newAlgebraFeeManager can accept AlgebraFeeManager role', async () => {
      await vault.transferAlgebraFeeManagerRole(other.address);
      await expect(vault.acceptAlgebraFeeManagerRole()).to.be.reverted;
    });

    it('only AlgebraFeeManager can transfer AlgebraFeeManager role', async () => {
      await expect(vault.connect(other).transferAlgebraFeeManagerRole(other.address)).to.be.reverted;
    });

    it('can change AlgebraFeeReceiver', async () => {
      await expect(vault.connect(other).changeAlgebraFeeReceiver(other.address)).to.be.reverted;
      await expect(vault.changeAlgebraFeeReceiver(ethers.constants.AddressZero)).to.be.reverted;

      await vault.changeAlgebraFeeReceiver(other.address);
      expect(await vault.algebraFeeReceiver()).to.be.eq(other.address);
    });

    it('can propose new fee and cancel proposal', async () => {
      expect(await vault.proposedNewAlgebraFee()).to.be.eq(0);
      expect(await vault.hasNewAlgebraFeeProposal()).to.be.eq(false);

      await expect(vault.connect(other).proposeAlgebraFeeChange(ALGEBRA_FEE)).to.be.reverted;
      await expect(vault.proposeAlgebraFeeChange(1001)).to.be.reverted;

      await vault.proposeAlgebraFeeChange(ALGEBRA_FEE);
      expect(await vault.proposedNewAlgebraFee()).to.be.eq(ALGEBRA_FEE);
      expect(await vault.hasNewAlgebraFeeProposal()).to.be.eq(true);

      await expect(vault.connect(other).cancelAlgebraFeeChangeProposal()).to.be.reverted;
      await vault.cancelAlgebraFeeChangeProposal();

      expect(await vault.proposedNewAlgebraFee()).to.be.eq(0);
      expect(await vault.hasNewAlgebraFeeProposal()).to.be.eq(false);
    });
  });
});
