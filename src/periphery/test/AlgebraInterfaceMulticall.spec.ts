import { MaxUint256, Wallet, ZeroHash } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { AlgebraInterfaceMulticall, AlgebraInterfaceMulticall3 } from '../typechain';
import { expect } from './shared/expect';

// neither multicall has this function and neither has a fallback, so a call to it reverts without data
const UNKNOWN_FUNCTION = '0x12345678';

describe('AlgebraInterfaceMulticall', () => {
  let wallet: Wallet;
  let multicall: AlgebraInterfaceMulticall;
  let target: string;

  const fixture = async () =>
    (await (await ethers.getContractFactory('AlgebraInterfaceMulticall')).deploy()) as any as AlgebraInterfaceMulticall;

  // the calls go back to the multicall's own getters
  const call = (gasLimit: number, callData: string) => ({ target, gasLimit, callData });
  const encode = (name: string, args: any[] = []) => multicall.interface.encodeFunctionData(name as any, args as any);
  const decode = (name: string, data: string) => multicall.interface.decodeFunctionResult(name as any, data)[0];

  before(async () => {
    [wallet] = await (ethers as any).getSigners();
  });

  beforeEach(async () => {
    multicall = await loadFixture(fixture);
    target = await multicall.getAddress();
  });

  it('multicall returns the block number and the result of every call, the failed one included', async () => {
    const holder = Wallet.createRandom().address;
    await wallet.sendTransaction({ to: holder, value: 12345 });
    const latest = (await ethers.provider.getBlock('latest'))!;

    const [blockNumber, results] = await multicall.multicall.staticCall([
      call(100_000, encode('getEthBalance', [holder])),
      call(100_000, UNKNOWN_FUNCTION),
      call(100_000, encode('getCurrentBlockTimestamp')),
      call(100_000, encode('gaslimit')),
    ]);
    expect(blockNumber).to.eq(latest.number);
    expect(results.map((result) => result.success)).to.deep.eq([true, false, true, true]);
    expect(decode('getEthBalance', results[0].returnData)).to.eq(12345);
    expect(results[1].returnData).to.eq('0x');
    expect(decode('getCurrentBlockTimestamp', results[2].returnData)).to.eq(latest.timestamp);
    expect(decode('gaslimit', results[3].returnData)).to.eq(latest.gasLimit);
    for (const result of results) expect(result.gasUsed).to.be.gt(0);
  });

  it('multicall gives every call only its gas limit', async () => {
    const [, [limited, outOfGas]] = await multicall.multicall.staticCall([
      call(50_000, encode('gasLeft')),
      // a cold balance read alone costs 2600
      call(1_000, encode('getEthBalance', [Wallet.createRandom().address])),
    ]);
    expect(decode('gasLeft', limited.returnData)).to.be.within(49_000, 50_000);
    expect(outOfGas.success).to.eq(false);
  });

  it('multicallWithGasLimitation stops after the call that leaves less gas than the buffer', async () => {
    const calls = [0, 1, 2].map(() => call(100_000, encode('getCurrentBlockTimestamp')));

    let [, results, lastSuccessIndex] = await multicall.multicallWithGasLimitation.staticCall(calls, 0);
    expect(lastSuccessIndex).to.eq(2);
    expect(results.map((result) => result.success)).to.deep.eq([true, true, true]);

    // no gas left reaches this buffer, so only the first call runs and the other results stay empty
    [, results, lastSuccessIndex] = await multicall.multicallWithGasLimitation.staticCall(calls, MaxUint256);
    expect(lastSuccessIndex).to.eq(0);
    expect(results[0].success).to.eq(true);
    expect(results.slice(1).map((result) => [...result])).to.deep.eq([
      [false, 0n, '0x'],
      [false, 0n, '0x'],
    ]);
  });

  it('multicallWithGasLimitation reverts on an empty batch, the last index underflows', async () => {
    await expect(multicall.multicallWithGasLimitation.staticCall([], 0)).to.be.revertedWithPanic(0x11);
  });
});

describe('AlgebraInterfaceMulticall3', () => {
  let wallet: Wallet;
  let multicall: AlgebraInterfaceMulticall3;
  let target: string;
  let chainId: bigint;

  const fixture = async () =>
    (await (
      await ethers.getContractFactory('AlgebraInterfaceMulticall3')
    ).deploy()) as any as AlgebraInterfaceMulticall3;

  const encode = (name: string, args: any[] = []) => multicall.interface.encodeFunctionData(name as any, args as any);
  const decode = (name: string, data: string) => multicall.interface.decodeFunctionResult(name as any, data)[0];
  const chainIdCall = () => ({ target, callData: encode('getChainId') });
  const failingCall = () => ({ target, callData: UNKNOWN_FUNCTION });

  before(async () => {
    [wallet] = await (ethers as any).getSigners();
    ({ chainId } = await ethers.provider.getNetwork());
  });

  beforeEach(async () => {
    multicall = await loadFixture(fixture);
    target = await multicall.getAddress();
  });

  it('aggregate returns the block number and the return data, a failed call reverts the batch', async () => {
    const [blockNumber, returnData] = await multicall.aggregate.staticCall([
      { target, callData: encode('getBlockNumber') },
      chainIdCall(),
    ]);
    expect(blockNumber).to.eq(await ethers.provider.getBlockNumber());
    expect(decode('getBlockNumber', returnData[0])).to.eq(blockNumber);
    expect(decode('getChainId', returnData[1])).to.eq(chainId);

    await expect(multicall.aggregate([chainIdCall(), failingCall()])).to.be.revertedWith('Multicall3: call failed');
  });

  it('tryAggregate and tryBlockAndAggregate report a failed call unless all must succeed', async () => {
    const calls = [chainIdCall(), failingCall()];
    const results = await multicall.tryAggregate.staticCall(false, calls);
    expect(results.map((result) => result.success)).to.deep.eq([true, false]);
    expect(decode('getChainId', results[0].returnData)).to.eq(chainId);
    await expect(multicall.tryAggregate(true, calls)).to.be.revertedWith('Multicall3: call failed');

    // blockhash() of the block the calls run in is always zero, and so is the returned hash
    const [blockNumber, blockHash, blockResults] = await multicall.tryBlockAndAggregate.staticCall(false, calls);
    expect(blockNumber).to.eq(await ethers.provider.getBlockNumber());
    expect(blockHash).to.eq(ZeroHash);
    expect(blockResults).to.deep.eq(results);
    await expect(multicall.blockAndAggregate(calls)).to.be.revertedWith('Multicall3: call failed');
    const [, , [result]] = await multicall.blockAndAggregate.staticCall([chainIdCall()]);
    expect(result.success).to.eq(true);
  });

  it('aggregate3 reverts only on a failed call that does not allow failure', async () => {
    const results = await multicall.aggregate3.staticCall([
      { ...chainIdCall(), allowFailure: false },
      { ...failingCall(), allowFailure: true },
    ]);
    expect(results.map((result) => result.success)).to.deep.eq([true, false]);
    expect(decode('getChainId', results[0].returnData)).to.eq(chainId);

    await expect(
      multicall.aggregate3([
        { ...chainIdCall(), allowFailure: false },
        { ...failingCall(), allowFailure: false },
      ])
    ).to.be.revertedWith('Multicall3: call failed');
  });

  it('aggregate3Value sends every call its value, and the values must add up to the value sent', async () => {
    const [first, second] = [Wallet.createRandom().address, Wallet.createRandom().address];
    const calls = [
      { target: first, allowFailure: false, value: 3, callData: '0x' },
      { target: second, allowFailure: false, value: 4, callData: '0x' },
    ];
    await expect(multicall.aggregate3Value(calls, { value: 7 })).to.changeEtherBalances(
      [first, second, multicall],
      [3, 4, 0]
    );
    await expect(multicall.aggregate3Value(calls, { value: 8 })).to.be.revertedWith('Multicall3: value mismatch');

    // the getters do not accept value
    await expect(
      multicall.aggregate3Value([{ ...chainIdCall(), allowFailure: false, value: 1 }], { value: 1 })
    ).to.be.revertedWith('Multicall3: call failed');
  });

  it('the getters read the block, the chain and a balance', async () => {
    const holder = Wallet.createRandom().address;
    await wallet.sendTransaction({ to: holder, value: 12345 });
    const latest = (await ethers.provider.getBlock('latest'))!;
    const previous = (await ethers.provider.getBlock(latest.number - 1))!;
    const { mixHash } = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);

    const getters: [string, any[], any][] = [
      ['getBlockNumber', [], latest.number],
      ['getBlockHash', [previous.number], previous.hash],
      ['getLastBlockHash', [], previous.hash],
      ['getCurrentBlockTimestamp', [], latest.timestamp],
      ['getCurrentBlockGasLimit', [], latest.gasLimit],
      ['getCurrentBlockCoinbase', [], latest.miner],
      // since the merge the opcode returns prevrandao
      ['getCurrentBlockDifficulty', [], BigInt(mixHash)],
      // Hardhat runs eth_call with a zero base fee
      ['getBasefee', [], 0n],
      ['getChainId', [], chainId],
      ['getEthBalance', [holder], 12345n],
    ];
    // one batch, so every getter sees the same block
    const results = await multicall.aggregate3.staticCall(
      getters.map(([name, args]) => ({ target, allowFailure: false, callData: encode(name, args) }))
    );
    for (const [i, [name, , expected]] of getters.entries())
      expect(decode(name, results[i].returnData), name).to.eq(expected);
  });
});
