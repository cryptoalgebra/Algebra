import { Contract, constants, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import completeFixture from './shared/completeFixture'
import { expect } from './shared/expect'
import { TestERC20, TestCallbackValidation, IAlgebraFactory } from '../typechain'

describe('CallbackValidation', () => {
  let nonpairAddr: Wallet, wallets: Wallet[]

  let callbackValidationFixture: () => Promise<{
    callbackValidation: TestCallbackValidation
    tokens: [TestERC20, TestERC20]
    factory: IAlgebraFactory
  }>;

  let callbackValidation: TestCallbackValidation
  let tokens: [TestERC20, TestERC20]
  let factory: Contract

  before('create fixture loader', async () => {
    ;[nonpairAddr, ...wallets] = await (ethers as any).getSigners()
    callbackValidationFixture = async () => {
      const { factory } = await completeFixture()
      const tokenFactory = await ethers.getContractFactory('TestERC20')
      const callbackValidationFactory = await ethers.getContractFactory('TestCallbackValidation')
      const tokens: [TestERC20, TestERC20] = [
        (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20, // do not use maxu256 to avoid overflowing
        (await tokenFactory.deploy(constants.MaxUint256.div(2))) as TestERC20,
      ]
      const callbackValidation = (await callbackValidationFactory.deploy()) as TestCallbackValidation
  
      return {
        tokens,
        callbackValidation,
        factory,
      }
    }
  })

  beforeEach('load fixture', async () => {
    ;({ callbackValidation, tokens, factory } = await loadFixture(callbackValidationFixture))
  })

  it('reverts when called from an address other than the associated AlgebraPool', async () => {
    expect(
      callbackValidation
        .connect(nonpairAddr)
        .verifyCallback(await factory.poolDeployer(), tokens[0].address, tokens[1].address)
    ).to.be.reverted
  })
})
