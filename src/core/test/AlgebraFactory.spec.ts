import { Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { AlgebraFactory } from '../typechain/AlgebraFactory'
import { AlgebraPoolDeployer } from "../typechain/AlgebraPoolDeployer";
import { expect } from './shared/expect'
import { vaultAddress } from "./shared/fixtures";
import snapshotGasCost from './shared/snapshotGasCost'

import { getCreate2Address } from './shared/utilities'

const { constants } = ethers

const TEST_ADDRESSES: [string, string] = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000',
]

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


  before('create fixture loader', async () => {
    ;[wallet, other] = await (ethers as any).getSigners()
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
    expect(((await ethers.provider.getCode(factory.address)).length - 2) / 2).to.matchSnapshot()
  })

  it('pool bytecode size  [ @skip-on-coverage ]', async () => {
    await factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1])
    const poolAddress = getCreate2Address(poolDeployer.address, TEST_ADDRESSES, poolBytecode)
    expect(((await ethers.provider.getCode(poolAddress)).length - 2) / 2).to.matchSnapshot()
  })

  async function createAndCheckPool(
    tokens: [string, string]
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
    it('succeeds for pool', async () => {
      await createAndCheckPool(TEST_ADDRESSES)
    })

    it('succeeds if tokens are passed in reverse', async () => {
      await createAndCheckPool([TEST_ADDRESSES[1], TEST_ADDRESSES[0]])
    })

    it('fails if trying to create via pool deployer directly', async () => {
      await expect(poolDeployer.deploy(TEST_ADDRESSES[0], factory.address, TEST_ADDRESSES[0], TEST_ADDRESSES[0])).to.be.reverted
    })

    it('fails if token a == token b', async () => {
      await expect(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[0])).to.be.reverted
    })

    it('fails if token a is 0 or token b is 0', async () => {
      await expect(factory.createPool(TEST_ADDRESSES[0], constants.AddressZero)).to.be.reverted
      await expect(factory.createPool(constants.AddressZero, TEST_ADDRESSES[0])).to.be.reverted
      await expect(factory.createPool(constants.AddressZero, constants.AddressZero)).to.be.revertedWithoutReason
    })

    it('gas [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1]))
    })
  })
  describe('Pool deployer', () => {
    it('cannot change factory after initialization', async () => {
      await expect(poolDeployer.setFactory(wallet.address)).to.be.reverted
    })

    it('cannot set zero address as factory', async () => {
      const poolDeployerFactory = await ethers.getContractFactory('AlgebraPoolDeployer')
      const _poolDeployer = (await poolDeployerFactory.deploy()) as AlgebraPoolDeployer
      await expect(_poolDeployer.setFactory(constants.AddressZero)).to.be.reverted
    })

    it('cannot set factory if caller is not owner', async () => {
      const poolDeployerFactory = await ethers.getContractFactory('AlgebraPoolDeployer')
      const _poolDeployer = (await poolDeployerFactory.deploy()) as AlgebraPoolDeployer
      await expect(_poolDeployer.connect(other).setFactory(TEST_ADDRESSES[0])).to.be.reverted
    })

    it('can set factory', async () => {
      const poolDeployerFactory = await ethers.getContractFactory('AlgebraPoolDeployer')
      const _poolDeployer = (await poolDeployerFactory.deploy()) as AlgebraPoolDeployer
      await expect(_poolDeployer.setFactory(TEST_ADDRESSES[0])).to.be.not.reverted;
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

    it('cannot set current owner', async () => {
      await factory.setOwner(other.address);
      await expect(factory.connect(other).setOwner(other.address)).to.be.reverted;
    })
  })

  describe('#setFarmingAddress', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setFarmingAddress(wallet.address)).to.be.reverted;
    })

    it('updates farmingAddress', async () => {
      await factory.setFarmingAddress(other.address);
      expect(await factory.farmingAddress()).to.eq(other.address);
    })

    it('emits event', async () => {
      await expect(factory.setFarmingAddress(other.address))
        .to.emit(factory, 'FarmingAddress')
        .withArgs(other.address);
    })

    it('cannot set current address', async () => {
      await factory.setFarmingAddress(other.address);
      await expect(factory.setFarmingAddress(other.address)).to.be.reverted;
    })
  })

  describe('#setVaultAddress', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setVaultAddress(wallet.address)).to.be.reverted;
    })

    it('updates vaultAddress', async () => {
      await factory.setVaultAddress(other.address);
      expect(await factory.vaultAddress()).to.eq(other.address);
    })

    it('emits event', async () => {
      await expect(factory.setVaultAddress(other.address))
        .to.emit(factory, 'VaultAddress')
        .withArgs(other.address);
    })

    it('cannot set current address', async () => {
      await factory.setVaultAddress(other.address);
      await expect(factory.setVaultAddress(other.address)).to.be.reverted;
    })
  })

  describe('#setBaseFeeConfiguration', () => {
    const configuration  = {
      alpha1: 3002,
      alpha2: 10009,
      beta1: 1001,
      beta2: 1006,
      gamma1: 20,
      gamma2: 22,
      volumeBeta: 1007,
      volumeGamma: 26,
      baseFee: 150
    }
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setBaseFeeConfiguration(
        configuration.alpha1,
        configuration.alpha2,
        configuration.beta1,
        configuration.beta2,
        configuration.gamma1,
        configuration.gamma2,
        configuration.volumeBeta,
        configuration.volumeGamma,
        configuration.baseFee
      )).to.be.reverted;
    })

    it('updates baseFeeConfiguration', async () => {
      await factory.setBaseFeeConfiguration(
        configuration.alpha1,
        configuration.alpha2,
        configuration.beta1,
        configuration.beta2,
        configuration.gamma1,
        configuration.gamma2,
        configuration.volumeBeta,
        configuration.volumeGamma,
        configuration.baseFee
      )

      const newConfig = await factory.baseFeeConfiguration();

      expect(newConfig.alpha1).to.eq(configuration.alpha1);
      expect(newConfig.alpha2).to.eq(configuration.alpha2);
      expect(newConfig.beta1).to.eq(configuration.beta1);
      expect(newConfig.beta2).to.eq(configuration.beta2);
      expect(newConfig.gamma1).to.eq(configuration.gamma1);
      expect(newConfig.gamma2).to.eq(configuration.gamma2);
      expect(newConfig.volumeBeta).to.eq(configuration.volumeBeta);
      expect(newConfig.volumeGamma).to.eq(configuration.volumeGamma);
      expect(newConfig.baseFee).to.eq(configuration.baseFee);
    })

    it('emits event', async () => {
      await expect(factory.setBaseFeeConfiguration(
        configuration.alpha1,
        configuration.alpha2,
        configuration.beta1,
        configuration.beta2,
        configuration.gamma1,
        configuration.gamma2,
        configuration.volumeBeta,
        configuration.volumeGamma,
        configuration.baseFee
      )).to.emit(factory, 'FeeConfiguration')
        .withArgs(
          configuration.alpha1,
          configuration.alpha2,
          configuration.beta1,
          configuration.beta2,
          configuration.gamma1,
          configuration.gamma2,
          configuration.volumeBeta,
          configuration.volumeGamma,
          configuration.baseFee
        );
    })

    it('cannot exceed max fee', async () => {
      await expect(factory.setBaseFeeConfiguration(
        30000,
        30000,
        configuration.beta1,
        configuration.beta2,
        configuration.gamma1,
        configuration.gamma2,
        configuration.volumeBeta,
        configuration.volumeGamma,
        15000
      )).to.be.revertedWith('Max fee exceeded');
    })

    it('cannot set zero gamma', async () => {
      await expect(factory.setBaseFeeConfiguration(
        configuration.alpha1,
        configuration.alpha2,
        configuration.beta1,
        configuration.beta2,
        0,
        configuration.gamma2,
        configuration.volumeBeta,
        configuration.volumeGamma,
        configuration.baseFee
      )).to.be.revertedWith('Gammas must be > 0');

      await expect(factory.setBaseFeeConfiguration(
        configuration.alpha1,
        configuration.alpha2,
        configuration.beta1,
        configuration.beta2,
        configuration.gamma1,
        0,
        configuration.volumeBeta,
        configuration.volumeGamma,
        configuration.baseFee
      )).to.be.revertedWith('Gammas must be > 0');

      await expect(factory.setBaseFeeConfiguration(
        configuration.alpha1,
        configuration.alpha2,
        configuration.beta1,
        configuration.beta2,
        configuration.gamma1,
        configuration.gamma2,
        configuration.volumeBeta,
        0,
        configuration.baseFee
      )).to.be.revertedWith('Gammas must be > 0');
    })
  })
})
