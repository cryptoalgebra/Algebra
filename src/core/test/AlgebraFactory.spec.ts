import { Wallet } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { AlgebraFactory } from '../typechain/AlgebraFactory'
//import { DataStorageOperator } from "../typechain/DataStorageOperator";
import { AlgebraPoolDeployer } from "../typechain/AlgebraPoolDeployer";
import { expect } from './shared/expect'
import { vaultAddress } from "./shared/fixtures";
import snapshotGasCost from './shared/snapshotGasCost'

import { FeeAmount, getCreate2Address, TICK_SPACINGS } from './shared/utilities'

const { constants } = ethers

const TEST_ADDRESSES: [string, string] = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000',
]

const createFixtureLoader = waffle.createFixtureLoader

describe('AlgebraFactory', () => {
  let wallet: Wallet, other: Wallet

  let factory: AlgebraFactory
  let poolDeployer: AlgebraPoolDeployer
  let poolBytecode: string
  const fixture = async () => {
    const poolDeployerFactory = await ethers.getContractFactory('AlgebraPoolDeployer')
    poolDeployer = (await poolDeployerFactory.deploy()) as AlgebraPoolDeployer
    const factoryFactory = await ethers.getContractFactory('AlgebraFactory')
    const _factory = (await factoryFactory.deploy(poolDeployer.address, vaultAddress)) as AlgebraFactory
    await poolDeployer.setFactory(_factory.address)
    return _factory;
  }

  let loadFixture: ReturnType<typeof createFixtureLoader>
  before('create fixture loader', async () => {
    ;[wallet, other] = await (ethers as any).getSigners()

    loadFixture = createFixtureLoader([wallet, other])
  })

  before('load pool bytecode', async () => {
    poolBytecode = (await ethers.getContractFactory('AlgebraPool')).bytecode
  })

  beforeEach('deploy factory', async () => {
    factory = await loadFixture(fixture)
  })

  it('owner is deployer', async () => {
    expect(await factory.owner()).to.eq(wallet.address)
  })

  it('factory bytecode size  [ @skip-on-coverage ]', async () => {
    expect(((await waffle.provider.getCode(factory.address)).length - 2) / 2).to.matchSnapshot()
  })

  it('pool bytecode size  [ @skip-on-coverage ]', async () => {
    await factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1])
    const poolAddress = getCreate2Address(poolDeployer.address, TEST_ADDRESSES, poolBytecode)
    expect(((await waffle.provider.getCode(poolAddress)).length - 2) / 2).to.matchSnapshot()
  })

  async function createAndCheckPool(
    tokens: [string, string],
    feeAmount: FeeAmount
  ) {
    const create2Address = getCreate2Address(poolDeployer.address, tokens, poolBytecode)
    const create = factory.createPool(tokens[0], tokens[1])

    await expect(create)
      .to.emit(factory, 'Pool')

    await expect(factory.createPool(tokens[0], tokens[1])).to.be.reverted
    await expect(factory.createPool(tokens[1], tokens[0])).to.be.reverted
    expect(await factory.poolByPair(tokens[0], tokens[1]), 'getPool in order').to.eq(create2Address)
    expect(await factory.poolByPair(tokens[1], tokens[0]), 'getPool in reverse').to.eq(create2Address)

    const poolContractFactory = await ethers.getContractFactory('AlgebraPool')
    const pool = poolContractFactory.attach(create2Address)
    expect(await pool.factory(), 'pool factory address').to.eq(factory.address)
    expect(await pool.token0(), 'pool token0').to.eq(TEST_ADDRESSES[0])
    expect(await pool.token1(), 'pool token1').to.eq(TEST_ADDRESSES[1])
  }

  describe('#createPool', () => {
    it('succeeds for low fee pool', async () => {
      await createAndCheckPool(TEST_ADDRESSES, FeeAmount.LOW)
    })

    it('succeeds for medium fee pool', async () => {
      await createAndCheckPool(TEST_ADDRESSES, FeeAmount.MEDIUM)
    })
    it('succeeds for high fee pool', async () => {
      await createAndCheckPool(TEST_ADDRESSES, FeeAmount.HIGH)
    })

    it('succeeds if tokens are passed in reverse', async () => {
      await createAndCheckPool([TEST_ADDRESSES[1], TEST_ADDRESSES[0]], FeeAmount.MEDIUM)
    })

    it('fails if token a == token b', async () => {
      await expect(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[0])).to.be.reverted
    })

    it('fails if token a is 0 or token b is 0', async () => {
      await expect(factory.createPool(TEST_ADDRESSES[0], constants.AddressZero)).to.be.reverted
      await expect(factory.createPool(constants.AddressZero, TEST_ADDRESSES[0])).to.be.reverted
      await expect(factory.createPool(constants.AddressZero, constants.AddressZero)).to.be.revertedWith(
        ''
      )
    })

    it('gas [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1]))
    })
  })

  describe('#setOwner', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setOwner(wallet.address)).to.be.reverted
    })

    it('updates owner', async () => {
      await factory.setOwner(other.address)
      expect(await factory.owner()).to.eq(other.address)
    })

    it('emits event', async () => {
      await expect(factory.setOwner(other.address))
        .to.emit(factory, 'Owner')
        .withArgs(other.address)
    })

    it('cannot be called by original owner', async () => {
      await factory.setOwner(other.address)
      await expect(factory.setOwner(wallet.address)).to.be.reverted
    })
  })
})
