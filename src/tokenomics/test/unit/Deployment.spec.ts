import { ethers } from 'hardhat'
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { AlgebraLimitFarming } from '../../typechain'
import { algebraFixture, AlgebraFixtureType } from '../shared/fixtures'
import { expect } from '../shared'
import {  provider } from '../shared/provider'


describe('unit/Deployment', () => {
  let context: AlgebraFixtureType

  beforeEach('create fixture loader', async () => {
    context = await loadFixture(algebraFixture)
  })

  it('deploys and has an address', async () => {
    const farmingFactory = await ethers.getContractFactory('AlgebraLimitFarming')
    const farming = (await farmingFactory.deploy(
      context.deployer.address,
      context.nft.address,
      2 ** 32,
      2 ** 32
    )) as AlgebraLimitFarming
    expect(farming.address).to.be.a.string
  })

  it('sets immutable variables', async () => {
    const farmingFactory = await ethers.getContractFactory('AlgebraLimitFarming')
    const farming = (await farmingFactory.deploy(
      context.deployer.address,
      context.nft.address,
      2 ** 32,
      2 ** 32
    )) as AlgebraLimitFarming

    expect(await farming.deployer()).to.equal(context.deployer.address)
    expect(await farming.nonfungiblePositionManager()).to.equal(context.nft.address)
    expect(await farming.maxIncentiveDuration()).to.equal(2 ** 32)
    expect(await farming.maxIncentiveStartLeadTime()).to.equal(2 ** 32)
  })
})
