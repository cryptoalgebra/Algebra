import { ethers } from 'hardhat'
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { AlgebraEternalFarming } from '../../typechain'
import { algebraFixture, AlgebraFixtureType } from '../shared/fixtures'
import { expect } from '../shared'
import { provider } from '../shared/provider'

describe('unit/Deployment', () => {
  let context: AlgebraFixtureType

  beforeEach('create fixture loader', async () => {
    context = await loadFixture(algebraFixture)
  })

  it('deploys and has an address', async () => {
    const farmingFactory = await ethers.getContractFactory('AlgebraEternalFarming')
    const farming = (await farmingFactory.deploy(context.deployer.address, context.nft.address)) as AlgebraEternalFarming
    expect(farming.address).to.be.a.string
  })

  it('sets immutable variables', async () => {
    const farmingFactory = await ethers.getContractFactory('AlgebraEternalFarming')
    const farming = (await farmingFactory.deploy(context.deployer.address, context.nft.address)) as AlgebraEternalFarming

    expect(await farming.nonfungiblePositionManager()).to.equal(context.nft.address)
  })
})
