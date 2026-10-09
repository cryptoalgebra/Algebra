import { Wallet, getCreateAddress, ZeroAddress, keccak256 } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture, reset, time } from '@nomicfoundation/hardhat-network-helpers';
import { AlgebraFactory, AlgebraPoolDeployer, IAlgebraFactory, MockDefaultPluginFactory, TestAlgebraReentrantCallee } from '../typechain';
import { expect } from './shared/expect';
import { ZERO_ADDRESS } from './shared/fixtures';
import snapshotGasCost from './shared/snapshotGasCost';

import { getCreate2Address, getCreate2CustomAddress, encodePriceSqrt } from './shared/utilities';

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
  let vaultAddress: string;

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
    const poolDeployer = (await poolDeployerFactory.deploy(factory, await factory.poolExtension())) as any as AlgebraPoolDeployer;

    const vaultFactory = await ethers.getContractFactory('AlgebraCommunityVault');
    const vault = await vaultFactory.deploy(factory);

    const vaultFactoryStubFactory = await ethers.getContractFactory('AlgebraVaultFactoryStub');
    const vaultFactoryStub = await vaultFactoryStubFactory.deploy(vault);

    await factory.setVaultFactory(vaultFactoryStub);

    const defaultPluginFactoryFactory = await ethers.getContractFactory('MockDefaultPluginFactory');
    const defaultPluginFactory = (await defaultPluginFactoryFactory.deploy()) as any as MockDefaultPluginFactory;

    return { factory, poolDeployer, defaultPluginFactory, vaultAddress: await vault.getAddress() };
  };

  before('create fixture loader', async () => {
    // gas depends on deployed addresses, so start from a fresh chain regardless of earlier spec files
    await reset();
    [wallet, other] = await (ethers as any).getSigners();
  });

  before('load pool bytecode', async () => {
    poolBytecode = (await ethers.getContractFactory('AlgebraPool')).bytecode;
  });

  beforeEach('deploy factory', async () => {
    ({ factory, poolDeployer, defaultPluginFactory, vaultAddress } = await loadFixture(fixture));
  });

  it('cannot create invalid vault factory stub', async () => {
    const vaultFactoryStubFactory = await ethers.getContractFactory('AlgebraVaultFactoryStub');
    await expect(vaultFactoryStubFactory.deploy(ZeroAddress)).to.be.revertedWithoutReason();
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
    await expect(factoryFactory.deploy(ZeroAddress)).to.be.revertedWithoutReason();
  });

  it('factory bytecode size  [ @skip-on-coverage ]', async () => {
    expect(((await ethers.provider.getCode(factory)).length - 2) / 2).to.matchSnapshot();
  });

  it('pool bytecode size  [ @skip-on-coverage ]', async () => {
    await factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1], '0x');
    const poolAddress = getCreate2Address(
      await poolDeployer.getAddress(),
      [TEST_ADDRESSES[0], TEST_ADDRESSES[1]],
      poolBytecode
    );
    expect(((await ethers.provider.getCode(poolAddress)).length - 2) / 2).to.matchSnapshot();
  });

  async function createAndCheckPool(tokens: [string, string]) {
    const create2Address = getCreate2Address(await poolDeployer.getAddress(), tokens, poolBytecode);
    const create = factory.createPool(tokens[0], tokens[1], '0x');

    await expect(create).to.emit(factory, 'Pool').withArgs(TEST_ADDRESSES[0], TEST_ADDRESSES[1], create2Address);
    await expect(create).to.not.emit(factory, 'CustomPool');

    await expect(factory.createPool(tokens[0], tokens[1], '0x')).to.be.revertedWithoutReason();
    await expect(factory.createPool(tokens[1], tokens[0], '0x')).to.be.revertedWithoutReason();
    expect(await factory.poolByPair(tokens[0], tokens[1]), 'getPool in order').to.eq(create2Address);
    expect(await factory.poolByPair(tokens[1], tokens[0]), 'getPool in reverse').to.eq(create2Address);

    const poolContractFactory = await ethers.getContractFactory('AlgebraPool');
    const pool = poolContractFactory.attach(create2Address);
    expect(await pool.factory(), 'pool factory address').to.eq(await factory.getAddress());
    expect(await pool.token0(), 'pool token0').to.eq(TEST_ADDRESSES[0]);
    expect(await pool.token1(), 'pool token1').to.eq(TEST_ADDRESSES[1]);
    expect(await pool.deployer(), 'pool deployer').to.eq(ZeroAddress);
    expect(await pool.algebraPoolExtension(), 'pool extension').to.eq(await factory.poolExtension());
  }

  describe('#createPool', () => {
    it('succeeds for pool', async () => {
      await createAndCheckPool([TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);
    });

    it('cannot reenter from default plugin factory', async () => {
      const reentrant = await (await ethers.getContractFactory('MockReentrantPluginFactory')).deploy();
      await factory.setDefaultPluginFactory(reentrant);
      await expect(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1], '0x')).to.be.revertedWith(
        'ReentrancyGuard: reentrant call'
      );
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

    it('data passed to defaultPluginFactory', async () => {
      await factory.setDefaultPluginFactory(defaultPluginFactory);
      const create = factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1], '0x0200');

     await expect(create).to.emit(defaultPluginFactory, 'DataOnPoolCreation').withArgs('0x0200');
    });

    it('sets vault in pool', async () => {
      await createAndCheckPool([TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);

      let poolAddress = await factory.poolByPair(TEST_ADDRESSES[0], TEST_ADDRESSES[1]);
      const poolContractFactory = await ethers.getContractFactory('AlgebraPool');
      let pool = poolContractFactory.attach(poolAddress);

      await pool.initialize(encodePriceSqrt(1, 1));
      expect(await pool.communityVault()).to.eq(vaultAddress);
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
      await expect(
        poolDeployer.deploy(TEST_ADDRESSES[0], TEST_ADDRESSES[0], TEST_ADDRESSES[0], TEST_ADDRESSES[0])
      ).to.be.revertedWithoutReason();
    });

    it('fails if token a == token b', async () => {
      await expect(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[0], '0x')).to.be.revertedWithoutReason();
    });

    it('fails if token a is 0 or token b is 0', async () => {
      await expect(factory.createPool(TEST_ADDRESSES[0], ZeroAddress, '0x')).to.be.revertedWithoutReason();
      await expect(factory.createPool(ZeroAddress, TEST_ADDRESSES[0], '0x')).to.be.revertedWithoutReason();
      await expect(factory.createPool(ZeroAddress, ZeroAddress, '0x')).to.be.revertedWithoutReason();
    });

    it('gas [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1], '0x'));
    });

    it('gas for second pool [ @skip-on-coverage ]', async () => {
      await factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1], '0x');
      await snapshotGasCost(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[2], '0x'));
    });
  });

  describe('#createCustomPool', () => {
    let customPoolCreator: any;

    async function createAndCheckCustomPool(_factory: IAlgebraFactory, tokens: [string, string], data: string = '0x') {
      const create2Address = getCreate2CustomAddress(
        await poolDeployer.getAddress(),
        await customPoolCreator.getAddress(),
        tokens,
        poolBytecode
      );
      const create = customPoolCreator.createCustomPool(_factory, tokens[0], tokens[1], data);

      await expect(create)
        .to.emit(_factory, 'CustomPool')
        .withArgs(await customPoolCreator.getAddress(), TEST_ADDRESSES[0], TEST_ADDRESSES[1], create2Address);
      await expect(create).to.emit(_factory, 'Pool').withArgs(TEST_ADDRESSES[0], TEST_ADDRESSES[1], create2Address);
      await expect(create).to.emit(customPoolCreator, 'BeforeCreateHook');

      await expect(
        customPoolCreator.createCustomPool(_factory, tokens[0], tokens[1], data)
      ).to.be.revertedWithoutReason();
      await expect(
        customPoolCreator.createCustomPool(_factory, tokens[1], tokens[0], data)
      ).to.be.revertedWithoutReason();
      expect(await _factory.customPoolByPair(customPoolCreator, tokens[0], tokens[1]), 'getPool in order').to.eq(
        create2Address
      );
      expect(await _factory.customPoolByPair(customPoolCreator, tokens[1], tokens[0]), 'getPool in reverse').to.eq(
        create2Address
      );

      const poolContractFactory = await ethers.getContractFactory('AlgebraPool');
      const pool = poolContractFactory.attach(create2Address);
      expect(await pool.factory(), 'pool factory address').to.eq(await factory.getAddress());
      expect(await pool.token0(), 'pool token0').to.eq(TEST_ADDRESSES[0]);
      expect(await pool.token1(), 'pool token1').to.eq(TEST_ADDRESSES[1]);
      expect(await pool.deployer(), 'pool deployer').to.eq(await customPoolCreator.getAddress());
    }

    beforeEach('Deploy CustomPoolCreator', async () => {
      const CustomPoolCreator = await ethers.getContractFactory('MockCustomPoolCreator');
      customPoolCreator = await CustomPoolCreator.deploy();

      const CUSTOM_POOL_DEPLOYER = await factory.CUSTOM_POOL_DEPLOYER();
      await factory.grantRole(CUSTOM_POOL_DEPLOYER, customPoolCreator);
    });

    it('succeeds for pool', async () => {
      await createAndCheckCustomPool(factory, [TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);
    });

    it('succeeds if tokens are passed in reverse', async () => {
      await createAndCheckCustomPool(factory, [TEST_ADDRESSES[1], TEST_ADDRESSES[0]]);
    });

    it('correctly computes pool address [ @skip-on-coverage ]', async () => {
      await createAndCheckCustomPool(factory, [TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);

      let poolAddress = await factory.customPoolByPair(customPoolCreator, TEST_ADDRESSES[0], TEST_ADDRESSES[1]);
      const addressCalculatedByFactory = await factory.computeCustomPoolAddress(
        customPoolCreator,
        TEST_ADDRESSES[0],
        TEST_ADDRESSES[1]
      );

      expect(addressCalculatedByFactory).to.be.eq(poolAddress);
    });

    it('a standard pool created after a custom one has no deployer', async () => {
      await createAndCheckCustomPool(factory, [TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);

      // the next deploy overwrites the cache anyway, so the reset is only visible in between
      const [plugin, _factory, token0, token1, extension, deployer] = await poolDeployer.getDeployParameters();
      expect([plugin, token0, token1, deployer], 'deploy cache').to.deep.eq([ZeroAddress, ZeroAddress, ZeroAddress, ZeroAddress]);
      expect(_factory).to.eq(await factory.getAddress());
      expect(extension).to.eq(await factory.poolExtension());

      await createAndCheckPool([TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);
    });

    it('cannot reenter from custom pool deployer', async () => {

      const reentrant = (await (
        await ethers.getContractFactory('TestAlgebraReentrantCallee')
      ).deploy()) as any as TestAlgebraReentrantCallee;

      const CUSTOM_POOL_DEPLOYER = await factory.CUSTOM_POOL_DEPLOYER();
      await factory.grantRole(CUSTOM_POOL_DEPLOYER, await reentrant.getAddress());
      // the tests happen in solidity
      await expect(reentrant.createCustomPool(factory, TEST_ADDRESSES[1], TEST_ADDRESSES[2], '0x')).to.be.revertedWith('ReentrancyGuard: reentrant call');
    });

    it('sets vault in pool', async () => {
      await createAndCheckCustomPool(factory, [TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);

      let poolAddress = await factory.customPoolByPair(customPoolCreator, TEST_ADDRESSES[0], TEST_ADDRESSES[1]);
      const poolContractFactory = await ethers.getContractFactory('AlgebraPool');
      let pool = poolContractFactory.attach(poolAddress);

      await pool.initialize(encodePriceSqrt(1, 1));
      expect(await pool.communityVault()).to.eq(vaultAddress);
    });

    it('works without community vault factory', async () => {
      await factory.setVaultFactory(ZeroAddress);
      await createAndCheckCustomPool(factory, [TEST_ADDRESSES[0], TEST_ADDRESSES[1]]);

      let poolAddress = await factory.customPoolByPair(customPoolCreator, TEST_ADDRESSES[0], TEST_ADDRESSES[1]);
      const poolContractFactory = await ethers.getContractFactory('AlgebraPool');
      let pool = poolContractFactory.attach(poolAddress);
      await pool.initialize(encodePriceSqrt(1, 1));
      expect(await pool.communityVault()).to.eq(ZeroAddress);
    });

    it('fails if trying to create via pool deployer directly', async () => {
      await expect(
        poolDeployer.deploy(TEST_ADDRESSES[0], TEST_ADDRESSES[0], TEST_ADDRESSES[0], customPoolCreator)
      ).to.be.revertedWithoutReason();
    });

    it('fails if token a == token b', async () => {
      await expect(
        customPoolCreator.createCustomPool(factory, TEST_ADDRESSES[0], TEST_ADDRESSES[0], '0x')
      ).to.be.revertedWithoutReason();
    });

    it('fails if token a is 0 or token b is 0', async () => {
      await expect(
        customPoolCreator.createCustomPool(factory, TEST_ADDRESSES[0], ZeroAddress, '0x')
      ).to.be.revertedWithoutReason();
      await expect(
        customPoolCreator.createCustomPool(factory, ZeroAddress, TEST_ADDRESSES[0], '0x')
      ).to.be.revertedWithoutReason();
      await expect(
        customPoolCreator.createCustomPool(factory, ZeroAddress, ZeroAddress, '0x')
      ).to.be.revertedWithoutReason();
    });

    it('fails if called by address without a role', async () => {
      await expect(
        factory.createCustomPool(customPoolCreator, ZeroAddress, TEST_ADDRESSES[0], TEST_ADDRESSES[1], '0x')
      ).to.be.revertedWith('Can`t create custom pools');
    });

    it('gas [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(customPoolCreator.createCustomPool(factory, TEST_ADDRESSES[0], TEST_ADDRESSES[1], '0x'));
    });

    it('gas for second pool [ @skip-on-coverage ]', async () => {
      await customPoolCreator.createCustomPool(factory, TEST_ADDRESSES[0], TEST_ADDRESSES[1], '0x');
      await snapshotGasCost(customPoolCreator.createCustomPool(factory, TEST_ADDRESSES[0], TEST_ADDRESSES[2], '0x'));
    });
  });

  describe('Pool deployer', () => {
    it('cannot set zero address as factory', async () => {
      const poolDeployerFactory = await ethers.getContractFactory('AlgebraPoolDeployer');
      await expect(poolDeployerFactory.deploy(ZeroAddress, ZeroAddress)).to.be.revertedWithoutReason();
    });
  });

  describe('#transferOwnership', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).transferOwnership(wallet.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
      await expect(factory.connect(other).startRenounceOwnership()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
      await expect(factory.connect(other).renounceOwnership()).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(factory.connect(other).stopRenounceOwnership()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('updates owner and emits event', async () => {
      await factory.transferOwnership(other.address);
      await expect(factory.connect(other).acceptOwnership())
        .to.emit(factory, 'OwnershipTransferred')
        .withArgs(wallet.address, other.address);
      expect(await factory.owner()).to.eq(other.address);
    });

    it('cannot be called by original owner', async () => {
      await factory.transferOwnership(other.address);
      await factory.connect(other).acceptOwnership();
      await expect(factory.transferOwnership(wallet.address)).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('renounceOwner works only once the delay has passed, emitting an event at the start and at the finish', async () => {
      // RENOUNCE_OWNERSHIP_DELAY is private, one day
      const delay = 24n * 60n * 60n;
      const start = BigInt(await time.latest()) + 1n;
      await time.setNextBlockTimestamp(start);
      await expect(factory.startRenounceOwnership())
        .to.emit(factory, 'RenounceOwnershipStart')
        .withArgs(start, start + delay);
      expect(await factory.renounceOwnershipStartTimestamp()).to.eq(start);

      await time.setNextBlockTimestamp(start + delay - 1n);
      await expect(factory.renounceOwnership()).to.be.revertedWithoutReason();

      await time.setNextBlockTimestamp(start + delay);
      await expect(factory.renounceOwnership())
        .to.emit(factory, 'RenounceOwnershipFinish')
        .withArgs(start + delay);
      expect(await factory.owner()).to.eq(ZERO_ADDRESS);
      expect(await factory.renounceOwnershipStartTimestamp()).to.eq(0);
    });

    it('startRenounceOwner cannot be used twice in a row', async () => {
      await factory.startRenounceOwnership();
      await expect(factory.startRenounceOwnership()).to.be.revertedWithoutReason();
    });

    it('stopRenounceOwnership works correct and emits event', async () => {
      await factory.startRenounceOwnership();
      const stop = BigInt(await time.latest()) + 1n;
      await time.setNextBlockTimestamp(stop);
      await expect(factory.stopRenounceOwnership()).to.emit(factory, 'RenounceOwnershipStop').withArgs(stop);
      expect(await factory.renounceOwnershipStartTimestamp()).to.eq(0);
    });

    it('stopRenounceOwnership does not works without start', async () => {
      await expect(factory.stopRenounceOwnership()).to.be.revertedWithoutReason();
    });

    it('renounceOwnership does not works without start', async () => {
      await expect(factory.renounceOwnership()).to.be.revertedWithoutReason();
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
      await expect(factory.connect(other).setDefaultCommunityFee(30)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('fails if new community fee is greater than max fee or equals the current one', async () => {
      await expect(factory.setDefaultCommunityFee(1001)).to.be.revertedWithoutReason();
      await expect(factory.setDefaultCommunityFee(0)).to.be.revertedWithoutReason();
    });

    it('fails if community vault factory is zero address', async () => {
      await factory.setVaultFactory(ZeroAddress);
      await expect(factory.setDefaultCommunityFee(60)).to.be.revertedWithoutReason();
    });

    it('sets and turns off the default community fee, emitting an event each time', async () => {
      for (const fee of [1000, 60, 0]) {
        await expect(factory.setDefaultCommunityFee(fee), `fee ${fee}`)
          .to.emit(factory, 'DefaultCommunityFee')
          .withArgs(fee);
        expect(await factory.defaultCommunityFee(), `fee ${fee}`).to.eq(fee);
      }
    });
  });

  describe('#setDefaultFee', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setDefaultFee(200)).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('fails if new default fee greater than max fee', async () => {
      await expect(factory.setDefaultFee(50001)).to.be.revertedWithoutReason();
    });

    it('fails if new default fee eq current', async () => {
      const fee = await factory.defaultFee();
      await expect(factory.setDefaultFee(fee)).to.be.revertedWithoutReason();
    });

    it('sets the default fee up to the max, emitting an event each time', async () => {
      for (const fee of [60, 50000]) {
        await expect(factory.setDefaultFee(fee), `fee ${fee}`).to.emit(factory, 'DefaultFee').withArgs(fee);
        expect(await factory.defaultFee(), `fee ${fee}`).to.eq(fee);
      }
    });
  });

  describe('#setDefaultTickspacing', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setDefaultTickspacing(30)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('fails if new default tickspacing is out of range or equals the current one', async () => {
      await expect(factory.setDefaultTickspacing(501)).to.be.revertedWithoutReason();
      await expect(factory.setDefaultTickspacing(0)).to.be.revertedWithoutReason();
      await expect(factory.setDefaultTickspacing(60)).to.be.revertedWithoutReason();
    });

    it('sets the default tickspacing within the range, emitting an event each time', async () => {
      for (const spacing of [50, 500, 1]) {
        await expect(factory.setDefaultTickspacing(spacing), `spacing ${spacing}`)
          .to.emit(factory, 'DefaultTickspacing')
          .withArgs(spacing);
        expect(await factory.defaultTickspacing(), `spacing ${spacing}`).to.eq(spacing);
      }
    });
  });

  describe('#setDefaultPluginFactory', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setDefaultPluginFactory(other.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('fails if equals current value', async () => {
      await expect(factory.setDefaultPluginFactory(ZeroAddress)).to.be.revertedWithoutReason();
    });

    it('works correct and emits event', async () => {
      await expect(factory.setDefaultPluginFactory(other.address))
        .to.emit(factory, 'DefaultPluginFactory')
        .withArgs(other.address);
      expect(await factory.defaultPluginFactory()).to.eq(other.address);
    });
  });

  describe('#setVaultFactory', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setVaultFactory(other.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('fails if equals current value', async () => {
      const vaultFactoryAddress = await factory.vaultFactory();
      await expect(factory.setVaultFactory(vaultFactoryAddress)).to.be.revertedWithoutReason();
    });

    it('fails if tries to set to zero with nonzero default community fee', async () => {
      await factory.setDefaultCommunityFee(60);
      await expect(factory.setVaultFactory(ZeroAddress)).to.be.revertedWithoutReason();
    });

    it('works correct and emits event', async () => {
      await expect(factory.setVaultFactory(other.address)).to.emit(factory, 'VaultFactory').withArgs(other.address);
      expect(await factory.vaultFactory()).to.eq(other.address);
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
    const { communityFee, tickSpacing, fee } = await factory.defaultConfigurationForPool();
    expect(communityFee).to.eq(0);
    expect(tickSpacing).to.eq(60);
    expect(fee).to.eq(500);
  });

  it('defaultConfigurationForPool works without vault factory', async () => {
    await factory.setVaultFactory(ZeroAddress);
    const { communityFee, tickSpacing, fee } = await factory.defaultConfigurationForPool();
    expect(communityFee).to.eq(0);
    expect(tickSpacing).to.eq(60);
    expect(fee).to.eq(500);
  });

});
