import { Contract } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { PeripheryImmutableStateTest, IWNativeToken } from '../typechain';
import { expect } from './shared/expect';
import { v3RouterFixture } from './shared/externalFixtures';

describe('PeripheryImmutableState', () => {
  const nonfungiblePositionManagerFixture: () => Promise<{
    wnative: IWNativeToken;
    factory: any;
    state: PeripheryImmutableStateTest;
  }> = async () => {
    const { wnative, factory } = await v3RouterFixture();

    const stateFactory = await ethers.getContractFactory('PeripheryImmutableStateTest');
    const state = (await stateFactory.deploy(
      factory,
      wnative,
      await factory.poolDeployer()
    )) as any as PeripheryImmutableStateTest;

    return {
      wnative,
      factory,
      state,
    };
  };

  let factory: Contract;
  let wnative: IWNativeToken;
  let state: PeripheryImmutableStateTest;

  beforeEach('load fixture', async () => {
    ({ state, wnative, factory } = await loadFixture(nonfungiblePositionManagerFixture));
  });

  it('bytecode size [ @skip-on-coverage ]', async () => {
    expect(((await ethers.provider.getCode(await state.getAddress())).length - 2) / 2).to.matchSnapshot();
  });

  describe('#WNativeToken', () => {
    it('points to WNativeToken', async () => {
      expect(await state.WNativeToken()).to.eq(await wnative.getAddress());
    });
  });

  describe('#factory', () => {
    it('points to v3 core factory', async () => {
      expect(await state.factory()).to.eq(await factory.getAddress());
    });
  });
});
