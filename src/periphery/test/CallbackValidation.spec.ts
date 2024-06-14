import { Contract, Wallet, MaxUint256 } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import completeFixture from './shared/completeFixture';
import { expect } from './shared/expect';
import { TestERC20, TestCallbackValidation } from '../typechain';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const PLUGIN_DEPLOYER_ADDRESS = '0x4d55ce59980Fb4e5C4C1c450F478587e9F52a18B';

describe('CallbackValidation', () => {
  let nonpairAddr: Wallet;

  let callbackValidationFixture: () => Promise<{
    callbackValidation: TestCallbackValidation;
    tokens: [TestERC20, TestERC20];
    factory: any;
  }>;

  let callbackValidation: TestCallbackValidation;
  let tokens: [TestERC20, TestERC20];
  let factory: Contract;

  before('create fixture loader', async () => {
    [nonpairAddr] = await (ethers as any).getSigners();
    callbackValidationFixture = async () => {
      const { factory: _factory } = await loadFixture(completeFixture);
      const tokenFactory = await ethers.getContractFactory('TestERC20');
      const callbackValidationFactory = await ethers.getContractFactory('TestCallbackValidation');
      const _tokens: [TestERC20, TestERC20] = [
        (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20, // do not use maxu256 to avoid overflowing
        (await tokenFactory.deploy(MaxUint256 / 2n)) as any as TestERC20,
      ];
      const _callbackValidation = (await callbackValidationFactory.deploy()) as any as TestCallbackValidation;

      return {
        tokens: _tokens,
        callbackValidation: _callbackValidation,
        factory: _factory,
      };
    };
  });

  beforeEach('load fixture', async () => {
    ({ callbackValidation, tokens, factory } = await loadFixture(callbackValidationFixture));
  });

  it('reverts when called from an address other than the associated AlgebraPool', async () => {
    await expect(
      callbackValidation
        .connect(nonpairAddr)
        .verifyCallback(await factory.poolDeployer(), await tokens[0].getAddress(), await tokens[1].getAddress(), ZERO_ADDRESS)
    ).to.be.revertedWith('Invalid caller of callback');
  });
});
