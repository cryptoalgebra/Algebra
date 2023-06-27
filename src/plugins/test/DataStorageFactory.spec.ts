import { BigNumber, BigNumberish, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import checkTimepointEquals from './shared/checkTimepointEquals'
import { expect } from './shared/expect'
import { TEST_POOL_START_TIME, pluginFactoryFixture } from './shared/fixtures'
import snapshotGasCost from './shared/snapshotGasCost'

import { DataStorageFactory, MockFactory } from "../typechain";

describe('DataStorageFactory', () => {
  let wallet: Wallet, other: Wallet

  let pluginFactory: DataStorageFactory;
  let mockAlgebraFactory: MockFactory;

  before('prepare signers', async () => {
    ;[wallet, other] = await (ethers as any).getSigners()
  })

  beforeEach('deploy test dataStorage', async () => {
    ;({ 
      pluginFactory,
      mockFactory: mockAlgebraFactory
    } = await loadFixture(pluginFactoryFixture));
  })

  describe('#Default fee configuration', () => {
    /*
    describe('#setDefaultFeeConfiguration', () => {
      const configuration  = {
        alpha1: 3002,
        alpha2: 10009,
        beta1: 1001,
        beta2: 1006,
        gamma1: 20,
        gamma2: 22,
        baseFee: 150
      }
      it('fails if caller is not owner', async () => {
        await expect(factory.connect(other).setDefaultFeeConfiguration(
          configuration
        )).to.be.reverted;
      })
  
      it('updates defaultFeeConfiguration', async () => {
        await factory.setDefaultFeeConfiguration(
          configuration
        )
  
        const newConfig = await factory.defaultFeeConfiguration();
  
        expect(newConfig.alpha1).to.eq(configuration.alpha1);
        expect(newConfig.alpha2).to.eq(configuration.alpha2);
        expect(newConfig.beta1).to.eq(configuration.beta1);
        expect(newConfig.beta2).to.eq(configuration.beta2);
        expect(newConfig.gamma1).to.eq(configuration.gamma1);
        expect(newConfig.gamma2).to.eq(configuration.gamma2);
        expect(newConfig.baseFee).to.eq(configuration.baseFee);
      })
  
      it('emits event', async () => {
        await expect(factory.setDefaultFeeConfiguration(
          configuration
        )).to.emit(factory, 'DefaultFeeConfiguration')
          .withArgs(
            [
              configuration.alpha1, 
              configuration.alpha2, 
              configuration.beta1, 
              configuration.beta2, 
              configuration.gamma1, 
              configuration.gamma2, 
              configuration.baseFee
            ]
          );
      })
  
      it('cannot exceed max fee', async () => {
        const conf2 = {...configuration};
        conf2.alpha1 = 30000;
        conf2.alpha2 = 30000;
        conf2.baseFee = 15000;
        await expect(factory.setDefaultFeeConfiguration(
          conf2
        )).to.be.revertedWith('Max fee exceeded');
      })
  
      it('cannot set zero gamma', async () => {
        let conf2 = {...configuration};
        conf2.gamma1 = 0
        await expect(factory.setDefaultFeeConfiguration(
          conf2
        )).to.be.revertedWith('Gammas must be > 0');
  
        conf2 = {...configuration};
        conf2.gamma2 = 0
        await expect(factory.setDefaultFeeConfiguration(
          conf2
        )).to.be.revertedWith('Gammas must be > 0');
  
        conf2 = {...configuration};
        conf2.gamma1 = 0
        conf2.gamma2 = 0
        await expect(factory.setDefaultFeeConfiguration(
          conf2
        )).to.be.revertedWith('Gammas must be > 0');
      })
    })*/
  })
})
