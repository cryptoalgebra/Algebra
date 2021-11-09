import { LoadFixtureFunction } from '../types'
import { ethers } from 'hardhat'
import { AlgebraFarming } from '../../typechain'
import { algebraFixture, AlgebraFixtureType } from '../shared/fixtures'
import { expect } from '../shared'
import { createFixtureLoader, provider } from '../shared/provider'

let loadFixture: LoadFixtureFunction

describe('unit/Deployment', () => {
  let context: AlgebraFixtureType

  before('loader', async () => {
    loadFixture = createFixtureLoader(provider.getWallets(), provider)
  })

  beforeEach('create fixture loader', async () => {
    context = await loadFixture(algebraFixture)
  })

  it('deploys and has an address', async () => {
    const farmingFactory = await ethers.getContractFactory('AlgebraFarming')
    const farming = (await farmingFactory.deploy(
      context.deployer.address,
      context.nft.address,
      context.vdeployer.address,
      2 ** 32,
      2 ** 32
    )) as AlgebraFarming
    expect(farming.address).to.be.a.string
  })

  it('sets immutable variables', async () => {
    const farmingFactory = await ethers.getContractFactory('AlgebraFarming')
    const farming = (await farmingFactory.deploy(
      context.deployer.address,
      context.nft.address,
      context.vdeployer.address,
      2 ** 32,
      2 ** 32
    )) as AlgebraFarming

    expect(await farming.deployer()).to.equal(context.deployer.address)
    expect(await farming.nonfungiblePositionManager()).to.equal(context.nft.address)
    expect(await farming.maxIncentiveDuration()).to.equal(2 ** 32)
    expect(await farming.maxIncentiveStartLeadTime()).to.equal(2 ** 32)
  })
})
