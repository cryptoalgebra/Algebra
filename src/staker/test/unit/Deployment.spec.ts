import { LoadFixtureFunction } from '../types'
import { ethers } from 'hardhat'
import { AlgebraStaker } from '../../typechain'
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
    const stakerFactory = await ethers.getContractFactory('AlgebraStaker')
    const staker = (await stakerFactory.deploy(
      context.deployer.address,
      context.nft.address,
      2 ** 32,
      2 ** 32
    )) as AlgebraStaker
    expect(staker.address).to.be.a.string
  })

  it('sets immutable variables', async () => {
    const stakerFactory = await ethers.getContractFactory('AlgebraStaker')
    const staker = (await stakerFactory.deploy(
      context.deployer.address,
      context.nft.address,
      2 ** 32,
      2 ** 32
    )) as AlgebraStaker

    expect(await staker.deployer()).to.equal(context.deployer.address)
    expect(await staker.nonfungiblePositionManager()).to.equal(context.nft.address)
    expect(await staker.maxIncentiveDuration()).to.equal(2 ** 32)
    expect(await staker.maxIncentiveStartLeadTime()).to.equal(2 ** 32)
  })
})
