import { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import { TestERC20NonStandard, TransferHelperTest } from '../typechain';
import { expect } from './shared/expect';

describe('TransferHelper', () => {
  let wallet: Wallet;
  let helper: TransferHelperTest;
  let token: TestERC20NonStandard;

  before('deploy', async () => {
    [wallet] = await (ethers as any).getSigners();
    helper = (await (await ethers.getContractFactory('TransferHelperTest')).deploy()) as any as TransferHelperTest;
  });

  beforeEach('deploy token', async () => {
    token = (await (await ethers.getContractFactory('TestERC20NonStandard')).deploy()) as any as TestERC20NonStandard;
  });

  it('accepts tokens that return no data', async () => {
    await expect(helper.safeTransfer(token, wallet.address, 1)).to.emit(token, 'Called');
    await expect(helper.safeTransferFrom(token, wallet.address, wallet.address, 1)).to.emit(token, 'Called');
    await expect(helper.safeApprove(token, wallet.address, 1)).to.emit(token, 'Called');
  });

  it('reverts when a token returns false', async () => {
    await token.setReturnsFalse(true);
    await expect(helper.safeTransfer(token, wallet.address, 1)).to.be.revertedWith('ST');
    await expect(helper.safeTransferFrom(token, wallet.address, wallet.address, 1)).to.be.revertedWith('STF');
    await expect(helper.safeApprove(token, wallet.address, 1)).to.be.revertedWith('SA');
  });

  it('safeTransferNative reverts when the recipient rejects native tokens', async () => {
    await expect(helper.safeTransferNative(token, 1, { value: 1 })).to.be.revertedWith('STE');
  });
});
