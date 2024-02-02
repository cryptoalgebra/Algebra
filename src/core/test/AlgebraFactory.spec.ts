import { Wallet, getCreateAddress, ZeroAddress, keccak256 } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { AlgebraFactory, AlgebraPoolDeployer, MockDefaultPluginFactory } from '../typechain';
import { expect } from './shared/expect';
import { ZERO_ADDRESS } from './shared/fixtures';
import snapshotGasCost from './shared/snapshotGasCost';

import { getCreate2Address, encodePriceSqrt } from './shared/utilities';

const TEST_ADDRESSES: [string, string, string] = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000',
  '0x3000000000000000000000000000000000000000',
];

describe('AlgebraFactory', () => {
  let wallet: Wallet, other: Wallet;

  let factory: AlgebraFactory;
  let poolDeployer: AlgebraPoolDeployer;
  let poolBytecode: string;
  let defaultPluginFactory: MockDefaultPluginFactory;

  const fixture = async () => {
    const [deployer] = await ethers.getSigners();
    // precompute
    const poolDeployerAddress = getCreateAddress({
      from: deployer.address,
      nonce: (await ethers.provider.getTransactionCount(deployer.address)) + 1,
    });

    const factoryFactory = await ethers.getContractFactory('AlgebraFactory');
    const factory = (await factoryFactory.deploy(poolDeployerAddress)) as any as AlgebraFactory;

    const poolDeployerFactory = await ethers.getContractFactory('AlgebraPoolDeployer');
    const poolDeployer = (await poolDeployerFactory.deploy(factory)) as any as AlgebraPoolDeployer;

    const vaultFactory = await ethers.getContractFactory('AlgebraCommunityVault');
    const vault = await vaultFactory.deploy(factory, deployer.address);

    const vaultFactoryStubFactory = await ethers.getContractFactory('AlgebraVaultFactoryStub');
    const vaultFactoryStub = await vaultFactoryStubFactory.deploy(vault);

    await factory.setVaultFactory(vaultFactoryStub);

    const defaultPluginFactoryFactory = await ethers.getContractFactory('MockDefaultPluginFactory');
    const defaultPluginFactory = (await defaultPluginFactoryFactory.deploy()) as any as MockDefaultPluginFactory;

    return { factory, poolDeployer, defaultPluginFactory };
  };

  before('create fixture loader', async () => {
    [wallet, other] = await (ethers as any).getSigners();
  });

  before('load pool bytecode', async () => {
    poolBytecode = (await ethers.getContractFactory('AlgebraPool')).bytecode;
  });

  beforeEach('deploy factory', async () => {
    ({ factory, poolDeployer, defaultPluginFactory } = await loadFixture(fixture));
  });

  it('cannot create invalid vault factory stub', async () => {
    const vaultFactoryStubFactory = await ethers.getContractFactory('AlgebraVaultFactoryStub');
    expect(vaultFactoryStubFactory.deploy(ZeroAddress)).to.be.revertedWithoutReason;
  });

  it('owner is deployer', async () => {
    expect(await factory.owner()).to.eq(wallet.address);
  });

  it('has POOL_INIT_CODE_HASH', async () => {
    expect(await factory.POOL_INIT_CODE_HASH()).to.be.not.eq(
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    );
  });

  it('has POOLS_ADMINISTRATOR_ROLE', async () => {
    expect(await factory.POOLS_ADMINISTRATOR_ROLE()).to.be.eq(
      '0xb73ce166ead2f8e9add217713a7989e4edfba9625f71dfd2516204bb67ad3442'
    );
  });

  it('has correct POOL_INIT_CODE_HASH [ @skip-on-coverage ]', async () => {
    expect(await factory.POOL_INIT_CODE_HASH()).to.be.eq(keccak256(poolBytecode));
  });

  it('cannot deploy factory with incorrect poolDeployer', async () => {
    const factoryFactory = await ethers.getContractFactory('AlgebraFactory');
    expect(factoryFactory.deploy(ZeroAddress)).to.be.revertedWithoutReason;
  });

  it('factory bytecode size  [ @skip-on-coverage ]', async () => {
    expect(((await ethers.provider.getCode(factory)).length - 2) / 2).to.matchSnapshot();
  });

  it('pool bytecode size  [ @skip-on-coverage ]', async () => {
    await factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1]);
    const poolAddress = getCreate2Address(
      await poolDeployer.getAddress(),
      [TEST_ADDRESSES[0], TEST_ADDRESSES[1]],
      poolBytecode
    );
    expect(((await ethers.provider.getCode(poolAddress)).length - 2) / 2).to.matchSnapshot();
  });

  async function createAndCheckPool(tokens: [string, string]) {
    const create2Address = getCreate2Address(await poolDeployer.getAddress(), tokens, poolBytecode);
    const create = factory.createPool(tokens[0], tokens[1]);

    await expect(create).to.emit(factory, 'Pool');

    await expect(factory.createPool(tokens[0], tokens[1])).to.be.reverted;
    await expect(factory.createPool(tokens[1], tokens[0])).to.be.reverted;
    expect(await factory.poolByPair(tokens[0], tokens[1]), 'getPool in order').to.eq(create2Address);
    expect(await factory.poolByPair(tokens[1], tokens[0]), 'getPool in reverse').to.eq(create2Address);

    const poolContractFactory = await ethers.getContractFactory('AlgebraPool');
    const pool = poolContractFactory.attach(create2Address);
    expect(await pool.factory(), 'pool factory address').to.eq(await factory.getAddress());
    expect(await pool.token0(), 'pool token0').to.eq(TEST_ADDRESSES[0]);
    expect(await pool.token1(), 'pool token1').to.eq(TEST_ADDRESSES[1]);
  }

  describe('#createPool', () => {
    it('succeeds for pool', async () => {
      await createAndCheckPool([TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);
    });

    it('succeeds if tokens are passed in reverse', async () => {
      await createAndCheckPool([TEST_ADDRESSES[1], TEST_ADDRESSES[0]]);
    });

    it('correctly computes pool address [ @skip-on-coverage ]', async () => {
      await factory.setDefaultPluginFactory(defaultPluginFactory);
      await createAndCheckPool([TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);

      let poolAddress = await factory.poolByPair(TEST_ADDRESSES[0], TEST_ADDRESSES[1]);
      const addressCalculatedByFactory = await factory.computePoolAddress(TEST_ADDRESSES[0], TEST_ADDRESSES[1]);

      expect(addressCalculatedByFactory).to.be.eq(poolAddress);
    });

    it('succeeds if defaultPluginFactory set [ @skip-on-coverage ]', async () => {
      await factory.setDefaultPluginFactory(defaultPluginFactory);
      await createAndCheckPool([TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);

      let poolAddress = await factory.poolByPair(TEST_ADDRESSES[0], TEST_ADDRESSES[1]);
      let pluginAddress = await defaultPluginFactory.pluginsForPools(poolAddress);

      const poolContractFactory = await ethers.getContractFactory('AlgebraPool');
      let pool = poolContractFactory.attach(poolAddress);
      expect(await pool.plugin()).to.be.eq(pluginAddress);
    });

    it('creates plugin in defaultPluginFactory', async () => {
      await factory.setDefaultPluginFactory(defaultPluginFactory);
      await createAndCheckPool([TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);

      let poolAddress = await factory.poolByPair(TEST_ADDRESSES[0], TEST_ADDRESSES[1]);
      // in coverage mode bytecode hash can be different from specified in factory
      let pluginAddress = await defaultPluginFactory.pluginsForPools(
        await factory.computePoolAddress(TEST_ADDRESSES[0], TEST_ADDRESSES[1])
      );

      const poolContractFactory = await ethers.getContractFactory('AlgebraPool');
      let pool = poolContractFactory.attach(poolAddress);
      expect(await pool.plugin()).to.be.eq(pluginAddress);
    });

    it('sets vault in pool', async () => {
      await createAndCheckPool([TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);

      let poolAddress = await factory.poolByPair(TEST_ADDRESSES[0], TEST_ADDRESSES[1]);
      const poolContractFactory = await ethers.getContractFactory('AlgebraPool');
      let pool = poolContractFactory.attach(poolAddress);

      await pool.initialize(encodePriceSqrt(1, 1));
      expect(await pool.communityVault()).to.not.eq(ZeroAddress);
    });

    it('works without community vault factory', async () => {
      await factory.setVaultFactory(ZeroAddress);
      await createAndCheckPool([TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);

      let poolAddress = await factory.poolByPair(TEST_ADDRESSES[0], TEST_ADDRESSES[1]);
      const poolContractFactory = await ethers.getContractFactory('AlgebraPool');
      let pool = poolContractFactory.attach(poolAddress);
      await pool.initialize(encodePriceSqrt(1, 1));
      expect(await pool.communityVault()).to.eq(ZeroAddress);
    });

    it('fails if trying to create via pool deployer directly', async () => {
      await expect(poolDeployer.deploy(TEST_ADDRESSES[0], TEST_ADDRESSES[0], TEST_ADDRESSES[0])).to.be.reverted;
    });

    it('fails if token a == token b', async () => {
      await expect(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[0])).to.be.reverted;
    });

    it('fails if token a is 0 or token b is 0', async () => {
      await expect(factory.createPool(TEST_ADDRESSES[0], ZeroAddress)).to.be.reverted;
      await expect(factory.createPool(ZeroAddress, TEST_ADDRESSES[0])).to.be.reverted;
      expect(factory.createPool(ZeroAddress, ZeroAddress)).to.be.revertedWithoutReason;
    });

    it('gas [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1]));
    });

    it('gas for second pool [ @skip-on-coverage ]', async () => {
      await factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1]);
      await snapshotGasCost(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[2]));
    });
  });
  describe('Pool deployer', () => {
    it('cannot set zero address as factory', async () => {
      const poolDeployerFactory = await ethers.getContractFactory('AlgebraPoolDeployer');
      await expect(poolDeployerFactory.deploy(ZeroAddress)).to.be.reverted;
    });
  });

  describe('#transferOwnership', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).transferOwnership(wallet.address)).to.be.reverted;
      await expect(factory.connect(other).startRenounceOwnership()).to.be.reverted;
      await expect(factory.connect(other).renounceOwnership()).to.be.reverted;
      await expect(factory.connect(other).stopRenounceOwnership()).to.be.reverted;
    });

    it('updates owner', async () => {
      await factory.transferOwnership(other.address);
      await factory.connect(other).acceptOwnership();
      expect(await factory.owner()).to.eq(other.address);
    });

    it('emits event', async () => {
      await factory.transferOwnership(other.address);
      await expect(factory.connect(other).acceptOwnership())
        .to.emit(factory, 'OwnershipTransferred')
        .withArgs(wallet.address, other.address);
    });

    it('cannot be called by original owner', async () => {
      await factory.transferOwnership(other.address);
      await factory.connect(other).acceptOwnership();
      await expect(factory.transferOwnership(wallet.address)).to.be.reverted;
    });

    it('renounceOwner works correct', async () => {
      await factory.startRenounceOwnership();
      await ethers.provider.send('evm_increaseTime', [86500]);
      await factory.renounceOwnership();
      expect(await factory.owner()).to.eq('0x0000000000000000000000000000000000000000');
    });

    it('renounceOwner cannot be used before delay', async () => {
      await factory.startRenounceOwnership();
      await expect(factory.renounceOwnership()).to.be.reverted;
    });

    it('startRenounceOwner cannot be used twice in a row', async () => {
      await factory.startRenounceOwnership();
      await expect(factory.startRenounceOwnership()).to.be.reverted;
    });

    it('stopRenounceOwnership works correct', async () => {
      await factory.startRenounceOwnership();
      await factory.stopRenounceOwnership();
      expect(await factory.renounceOwnershipStartTimestamp()).to.eq(0);
    });

    it('stopRenounceOwnership does not works without start', async () => {
      await expect(factory.stopRenounceOwnership()).to.be.reverted;
    });

    it('stopRenounceOwnership emits event', async () => {
      await factory.startRenounceOwnership();
      await expect(factory.stopRenounceOwnership()).to.emit(factory, 'RenounceOwnershipStop');
    });

    it('renounceOwnership does not works without start', async () => {
      await expect(factory.renounceOwnership()).to.be.reverted;
    });

    it('renounceOwner set owner to zero address', async () => {
      await factory.startRenounceOwnership();
      await time.increase(60 * 60 * 24 * 2);
      await factory.renounceOwnership();
      expect(await factory.owner()).to.be.eq(ZERO_ADDRESS);
    });

    it('renounceOwner set pending to zero address', async () => {
      await factory.transferOwnership(other.address);
      await factory.startRenounceOwnership();
      await time.increase(60 * 60 * 24 * 2);
      await factory.renounceOwnership();
      expect(await factory.owner()).to.be.eq(ZERO_ADDRESS);
      expect(await factory.pendingOwner()).to.be.eq(ZERO_ADDRESS);
    });
  });

  describe('#setDefaultCommunityFee', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setDefaultCommunityFee(30)).to.be.reverted;
    });

    it('fails if new community fee greater than max fee', async () => {
      await expect(factory.setDefaultCommunityFee(1100)).to.be.reverted;
    });

    it('fails if new community fee eq current', async () => {
      await expect(factory.setDefaultCommunityFee(0)).to.be.reverted;
    });

    it('fails if community vault factory is zero address', async () => {
      await factory.setVaultFactory(ZeroAddress);
      await expect(factory.setDefaultCommunityFee(60)).to.be.reverted;
    });

    it('works correct', async () => {
      await factory.setDefaultCommunityFee(60);
      expect(await factory.defaultCommunityFee()).to.eq(60);
    });

    it('can set to zero', async () => {
      await factory.setDefaultCommunityFee(60);
      await factory.setDefaultCommunityFee(0);
      expect(await factory.defaultCommunityFee()).to.eq(0);
    });

    it('emits event', async () => {
      await expect(factory.setDefaultCommunityFee(60)).to.emit(factory, 'DefaultCommunityFee').withArgs(60);
    });

    it('emits event when changes to zero', async () => {
      await factory.setDefaultCommunityFee(60);
      await expect(factory.setDefaultCommunityFee(0)).to.emit(factory, 'DefaultCommunityFee').withArgs(0);
    });
  });

  describe('#setDefaultFee', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setDefaultFee(200)).to.be.reverted;
    });

    it('fails if new default fee greater than max fee', async () => {
      await expect(factory.setDefaultFee(51000)).to.be.reverted;
    });

    it('fails if new default fee eq current', async () => {
      const fee = await factory.defaultFee();
      await expect(factory.setDefaultFee(fee)).to.be.reverted;
    });

    it('works correct', async () => {
      await factory.setDefaultFee(60);
      expect(await factory.defaultFee()).to.eq(60);
    });

    it('emits event', async () => {
      await expect(factory.setDefaultFee(60)).to.emit(factory, 'DefaultFee').withArgs(60);
    });
  });

  describe('#setDefaultTickspacing', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setDefaultTickspacing(30)).to.be.reverted;
    });

    it('fails if new default tickspacing greater than max & lt min', async () => {
      await expect(factory.setDefaultTickspacing(1100)).to.be.reverted;
      await expect(factory.setDefaultTickspacing(-1100)).to.be.reverted;
    });

    it('fails if new default tickspacing eq current', async () => {
      await expect(factory.setDefaultTickspacing(60)).to.be.reverted;
    });

    it('works correct', async () => {
      await factory.setDefaultTickspacing(50);
      expect(await factory.defaultTickspacing()).to.eq(50);
    });

    it('emits event', async () => {
      await expect(factory.setDefaultTickspacing(50)).to.emit(factory, 'DefaultTickspacing').withArgs(50);
    });
  });

  describe('#setDefaultPluginFactory', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setDefaultPluginFactory(other.address)).to.be.reverted;
    });

    it('fails if equals current value', async () => {
      await expect(factory.setDefaultPluginFactory(ZeroAddress)).to.be.reverted;
    });

    it('emits event', async () => {
      await expect(factory.setDefaultPluginFactory(other.address))
        .to.emit(factory, 'DefaultPluginFactory')
        .withArgs(other.address);
    });
  });

  describe('#setVaultFactory', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setVaultFactory(other.address)).to.be.reverted;
    });

    it('fails if equals current value', async () => {
      const vaultFactoryAddress = await factory.vaultFactory();
      await expect(factory.setVaultFactory(vaultFactoryAddress)).to.be.reverted;
    });

    it('fails if tries to set to zero with nonzero default community fee', async () => {
      await factory.setDefaultCommunityFee(60);
      await expect(factory.setVaultFactory(ZeroAddress)).to.be.reverted;
    });

    it('emits event', async () => {
      await expect(factory.setVaultFactory(other.address)).to.emit(factory, 'VaultFactory').withArgs(other.address);
    });
  });

  it('hasRoleOrOwner', async () => {
    expect(
      await factory.hasRoleOrOwner('0x0000000000000000000000000000000000000000000000000000000000000000', wallet.address)
    ).to.eq(true);
    expect(
      await factory.hasRoleOrOwner('0x0000000000000000000000000000000000000000000000000000000000000000', other.address)
    ).to.eq(false);

    await factory.grantRole('0x0000000000000000000000000000000000000000000000000000000000000001', other.address);
    expect(
      await factory.hasRoleOrOwner('0x0000000000000000000000000000000000000000000000000000000000000001', other.address)
    ).to.eq(true);
  });

  it('defaultConfigurationForPool', async () => {
    const { communityFee, tickSpacing, communityVault, fee } = await factory.defaultConfigurationForPool(ZeroAddress);
    expect(communityFee).to.eq(0);
    expect(tickSpacing).to.eq(60);
    expect(communityVault).to.not.eq(ZeroAddress);
    expect(fee).to.eq(500);
  });

  it('defaultConfigurationForPool works without vault factory', async () => {
    await factory.setVaultFactory(ZeroAddress);
    const { communityFee, tickSpacing, communityVault, fee } = await factory.defaultConfigurationForPool(ZeroAddress);
    expect(communityFee).to.eq(0);
    expect(tickSpacing).to.eq(60);
    expect(communityVault).to.eq(ZeroAddress);
    expect(fee).to.eq(500);
  });
});
