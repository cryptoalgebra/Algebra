import { ethers } from 'hardhat';
import { SafeERC20NamerTest } from '../typechain';
import { expect } from './shared/expect';

describe('SafeERC20Namer', () => {
  let namer: SafeERC20NamerTest;

  before('deploy test library', async () => {
    namer = (await (await ethers.getContractFactory('SafeERC20NamerTest')).deploy()) as any as SafeERC20NamerTest;
  });

  it('reads a bytes32 symbol', async () => {
    const token = await (await ethers.getContractFactory('TestBytes32Symbol')).deploy();
    expect(await namer.tokenSymbol(token)).to.eq('B32');
  });

  it('derives the symbol from the address when symbol() is missing', async () => {
    const token = await (await ethers.getContractFactory('TestNoSymbol')).deploy();
    const address = await token.getAddress();
    expect(await namer.tokenSymbol(token)).to.eq(address.slice(2, 8).toUpperCase());
  });
});
