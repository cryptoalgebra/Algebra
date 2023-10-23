import { MaxUint256, Contract, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  IUniswapV2Pair,
  IAlgebraFactory,
  IWNativeToken,
  MockTimeNonfungiblePositionManager,
  TestERC20,
  V3Migrator,
} from '../typechain';
import completeFixture from './shared/completeFixture';
import { v2FactoryFixture } from './shared/externalFixtures';

import { abi as PAIR_V2_ABI } from '@uniswap/v2-core/build/UniswapV2Pair.json';
import { expect } from 'chai';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import snapshotGasCost from './shared/snapshotGasCost';
import { sortedTokens } from './shared/tokenSort';
import { getMaxTick, getMinTick } from './shared/ticks';

type TestERC20WithAddress = TestERC20 & { address: string | undefined };

describe('V3Migrator', () => {
  let wallet: Wallet;

  const migratorFixture: () => Promise<{
    factoryV2: Contract;
    factoryV3: IAlgebraFactory;
    token: TestERC20WithAddress;
    wnative: IWNativeToken;
    nft: MockTimeNonfungiblePositionManager;
    migrator: V3Migrator;
  }> = async () => {
    const { factory, tokens, nft, wnative } = await completeFixture();
    let _tokens = tokens as [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];

    const { factory: factoryV2 } = await v2FactoryFixture();

    const token = _tokens[0];
    token.address = await token.getAddress();

    await token.approve(await factoryV2.getAddress(), MaxUint256);
    await wnative.deposit({ value: 10000 });
    await wnative.approve(nft, MaxUint256);

    // deploy the migrator
    const migrator = (await (
      await ethers.getContractFactory('V3Migrator')
    ).deploy(factory, wnative, nft, await factory.poolDeployer())) as any as V3Migrator;

    return {
      factoryV2,
      factoryV3: factory,
      token,
      wnative,
      nft,
      migrator,
    };
  };

  let factoryV2: Contract;
  let factoryV3: IAlgebraFactory;
  let token: TestERC20WithAddress;
  let wnative: IWNativeToken;
  let nft: MockTimeNonfungiblePositionManager;
  let migrator: V3Migrator;
  let pair: IUniswapV2Pair;

  before('create fixture loader', async () => {
    const wallets = await (ethers as any).getSigners();
    wallet = wallets[0];
  });

  beforeEach('load fixture', async () => {
    ({ factoryV2, factoryV3, token, wnative, nft, migrator } = await loadFixture(migratorFixture));
  });

  afterEach('ensure allowances are cleared', async () => {
    const allowanceToken = await token.allowance(migrator, nft);
    const allowanceWNativeToken = await wnative.allowance(migrator, nft);
    expect(allowanceToken).to.be.eq(0);
    expect(allowanceWNativeToken).to.be.eq(0);
  });

  afterEach('ensure balances are cleared', async () => {
    const balanceToken = await token.balanceOf(migrator);
    const balanceWNativeToken = await wnative.balanceOf(migrator);
    expect(balanceToken).to.be.eq(0);
    expect(balanceWNativeToken).to.be.eq(0);
  });

  afterEach('ensure eth balance is cleared', async () => {
    const balanceNative = await ethers.provider.getBalance(migrator);
    expect(balanceNative).to.be.eq(0);
  });

  describe('#migrate', () => {
    let tokenLower: boolean;

    const expectedLiquidity = 10000 - 1000;

    beforeEach(async () => {
      tokenLower = (await wnative.getAddress()) > (await token.getAddress());
    });

    beforeEach('add V2 liquidity', async () => {
      await factoryV2.createPair(await token.getAddress(), await wnative.getAddress());

      const pairAddress = await factoryV2.getPair(await token.getAddress(), await wnative.getAddress());

      pair = new ethers.Contract(pairAddress, PAIR_V2_ABI, wallet) as any as IUniswapV2Pair;

      await token.transfer(pairAddress, 10000);
      await wnative.transfer(pairAddress, 10000);

      await pair.mint(wallet.address);

      expect(await pair.balanceOf(wallet.address)).to.be.eq(expectedLiquidity);
    });

    it('fails if v3 pool is not initialized', async () => {
      await pair.approve(migrator, expectedLiquidity);
      await expect(
        migrator.migrate({
          pair: await pair.getAddress(),
          liquidityToMigrate: expectedLiquidity,
          percentageToMigrate: 100,
          token0: tokenLower ? await token.getAddress() : await wnative.getAddress(),
          token1: tokenLower ? await wnative.getAddress() : await token.getAddress(),
          tickLower: -1,
          tickUpper: 1,
          amount0Min: 9000,
          amount1Min: 9000,
          recipient: wallet.address,
          deadline: 1,
          refundAsNative: false,
        })
      ).to.be.reverted;
    });

    it('works once v3 pool is initialized', async () => {
      const [token0, token1] = await sortedTokens(wnative, token);
      await migrator.createAndInitializePoolIfNecessary(token0, token1, encodePriceSqrt(1, 1));

      await pair.approve(migrator, expectedLiquidity);
      await migrator.migrate({
        pair: await pair.getAddress(),
        liquidityToMigrate: expectedLiquidity,
        percentageToMigrate: 100,
        token0: tokenLower ? await token.getAddress() : await wnative.getAddress(),
        token1: tokenLower ? await wnative.getAddress() : await token.getAddress(),
        tickLower: getMinTick(60),
        tickUpper: getMaxTick(60),
        amount0Min: 9000,
        amount1Min: 9000,
        recipient: wallet.address,
        deadline: 1,
        refundAsNative: false,
      });

      const position = await nft.positions(1);
      expect(position.liquidity).to.be.eq(9000);

      const poolAddress = await factoryV3.poolByPair(await token.getAddress(), await wnative.getAddress());
      expect(await token.balanceOf(poolAddress)).to.be.eq(9000);
      expect(await wnative.balanceOf(poolAddress)).to.be.eq(9000);
    });

    it('works for partial', async () => {
      const [token0, token1] = await sortedTokens(wnative, token);
      await migrator.createAndInitializePoolIfNecessary(token0, token1, encodePriceSqrt(1, 1));

      const tokenBalanceBefore = await token.balanceOf(wallet.address);
      const wnativeBalanceBefore = await wnative.balanceOf(wallet.address);

      await pair.approve(migrator, expectedLiquidity);
      await migrator.migrate({
        pair: await pair.getAddress(),
        liquidityToMigrate: expectedLiquidity,
        percentageToMigrate: 50,
        token0: tokenLower ? await token.getAddress() : await wnative.getAddress(),
        token1: tokenLower ? await wnative.getAddress() : await token.getAddress(),
        tickLower: getMinTick(60),
        tickUpper: getMaxTick(60),
        amount0Min: 4500,
        amount1Min: 4500,
        recipient: wallet.address,
        deadline: 1,
        refundAsNative: false,
      });

      const tokenBalanceAfter = await token.balanceOf(wallet.address);
      const wnativeBalanceAfter = await wnative.balanceOf(wallet.address);

      expect(tokenBalanceAfter - tokenBalanceBefore).to.be.eq(4500);
      expect(wnativeBalanceAfter - wnativeBalanceBefore).to.be.eq(4500);

      const position = await nft.positions(1);
      expect(position.liquidity).to.be.eq(4500);

      const poolAddress = await factoryV3.poolByPair(await token.getAddress(), await wnative.getAddress());
      expect(await token.balanceOf(poolAddress)).to.be.eq(4500);
      expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500);
    });

    it('double the price', async () => {
      const [token0, token1] = await sortedTokens(wnative, token);
      await migrator.createAndInitializePoolIfNecessary(token0, token1, encodePriceSqrt(2, 1));

      const tokenBalanceBefore = await token.balanceOf(wallet.address);
      const wnativeBalanceBefore = await wnative.balanceOf(wallet.address);

      await pair.approve(migrator, expectedLiquidity);
      await migrator.migrate({
        pair: await pair.getAddress(),
        liquidityToMigrate: expectedLiquidity,
        percentageToMigrate: 100,
        token0: tokenLower ? await token.getAddress() : await wnative.getAddress(),
        token1: tokenLower ? await wnative.getAddress() : await token.getAddress(),
        tickLower: getMinTick(60),
        tickUpper: getMaxTick(60),
        amount0Min: 4500,
        amount1Min: 8999,
        recipient: wallet.address,
        deadline: 1,
        refundAsNative: false,
      });

      const tokenBalanceAfter = await token.balanceOf(wallet.address);
      const wnativeBalanceAfter = await wnative.balanceOf(wallet.address);

      const position = await nft.positions(1);
      expect(position.liquidity).to.be.eq(6363);

      const poolAddress = await factoryV3.poolByPair(await token.getAddress(), await wnative.getAddress());
      if ((await token.getAddress()).toLowerCase() < (await wnative.getAddress()).toLowerCase()) {
        expect(await token.balanceOf(poolAddress)).to.be.eq(4500);
        expect(tokenBalanceAfter - tokenBalanceBefore).to.be.eq(4500);
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(8999);
        expect(wnativeBalanceAfter - wnativeBalanceBefore).to.be.eq(1);
      } else {
        expect(await token.balanceOf(poolAddress)).to.be.eq(8999);
        expect(tokenBalanceAfter - tokenBalanceBefore).to.be.eq(1);
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500);
        expect(wnativeBalanceAfter - wnativeBalanceBefore).to.be.eq(4500);
      }
    });

    it('half the price', async () => {
      const [token0, token1] = await sortedTokens(wnative, token);
      await migrator.createAndInitializePoolIfNecessary(token0, token1, encodePriceSqrt(1, 2));

      const tokenBalanceBefore = await token.balanceOf(wallet.address);
      const wnativeBalanceBefore = await wnative.balanceOf(wallet.address);

      await pair.approve(migrator, expectedLiquidity);
      await migrator.migrate({
        pair: pair,
        liquidityToMigrate: expectedLiquidity,
        percentageToMigrate: 100,
        token0: tokenLower ? token : wnative,
        token1: tokenLower ? wnative : token,
        tickLower: getMinTick(60),
        tickUpper: getMaxTick(60),
        amount0Min: 8999,
        amount1Min: 4500,
        recipient: wallet.address,
        deadline: 1,
        refundAsNative: false,
      });

      const tokenBalanceAfter = await token.balanceOf(wallet.address);
      const wnativeBalanceAfter = await wnative.balanceOf(wallet.address);

      const position = await nft.positions(1);
      expect(position.liquidity).to.be.eq(6363);

      const poolAddress = await factoryV3.poolByPair(await token.getAddress(), await wnative.getAddress());
      if ((await token.getAddress()).toLowerCase() < (await wnative.getAddress()).toLowerCase()) {
        expect(await token.balanceOf(poolAddress)).to.be.eq(8999);
        expect(tokenBalanceAfter - tokenBalanceBefore).to.be.eq(1);
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500);
        expect(wnativeBalanceAfter - wnativeBalanceBefore).to.be.eq(4500);
      } else {
        expect(await token.balanceOf(poolAddress)).to.be.eq(4500);
        expect(tokenBalanceAfter - tokenBalanceBefore).to.be.eq(4500);
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(8999);
        expect(wnativeBalanceAfter - wnativeBalanceBefore).to.be.eq(1);
      }
    });

    it('double the price - as Native', async () => {
      const [token0, token1] = await sortedTokens(wnative, token);
      await migrator.createAndInitializePoolIfNecessary(token0, token1, encodePriceSqrt(2, 1));

      const tokenBalanceBefore = await token.balanceOf(wallet.address);

      await pair.approve(migrator, expectedLiquidity);
      await expect(
        migrator.migrate({
          pair: pair,
          liquidityToMigrate: expectedLiquidity,
          percentageToMigrate: 100,
          token0: tokenLower ? token : wnative,
          token1: tokenLower ? wnative : token,
          tickLower: getMinTick(60),
          tickUpper: getMaxTick(60),
          amount0Min: 4500,
          amount1Min: 8999,
          recipient: wallet.address,
          deadline: 1,
          refundAsNative: true,
        })
      )
        .to.emit(wnative, 'Withdrawal')
        .withArgs(await migrator.getAddress(), tokenLower ? 1 : 4500);

      const tokenBalanceAfter = await token.balanceOf(wallet.address);

      const position = await nft.positions(1);
      expect(position.liquidity).to.be.eq(6363);

      const poolAddress = await factoryV3.poolByPair(await token.getAddress(), await wnative.getAddress());
      if (tokenLower) {
        expect(await token.balanceOf(poolAddress)).to.be.eq(4500);
        expect(tokenBalanceAfter - tokenBalanceBefore).to.be.eq(4500);
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(8999);
      } else {
        expect(await token.balanceOf(poolAddress)).to.be.eq(8999);
        expect(tokenBalanceAfter - tokenBalanceBefore).to.be.eq(1);
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500);
      }
    });

    it('half the price - as Native', async () => {
      const [token0, token1] = await sortedTokens(wnative, token);
      await migrator.createAndInitializePoolIfNecessary(token0, token1, encodePriceSqrt(1, 2));

      const tokenBalanceBefore = await token.balanceOf(wallet.address);

      await pair.approve(migrator, expectedLiquidity);
      await expect(
        migrator.migrate({
          pair: pair,
          liquidityToMigrate: expectedLiquidity,
          percentageToMigrate: 100,
          token0: tokenLower ? token : wnative,
          token1: tokenLower ? wnative : token,
          tickLower: getMinTick(60),
          tickUpper: getMaxTick(60),
          amount0Min: 8999,
          amount1Min: 4500,
          recipient: wallet.address,
          deadline: 1,
          refundAsNative: true,
        })
      )
        .to.emit(wnative, 'Withdrawal')
        .withArgs(await migrator.getAddress(), tokenLower ? 4500 : 1);

      const tokenBalanceAfter = await token.balanceOf(wallet.address);

      const position = await nft.positions(1);
      expect(position.liquidity).to.be.eq(6363);

      const poolAddress = await factoryV3.poolByPair(await token.getAddress(), await wnative.getAddress());
      if (tokenLower) {
        expect(await token.balanceOf(poolAddress)).to.be.eq(8999);
        expect(tokenBalanceAfter - tokenBalanceBefore).to.be.eq(1);
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500);
      } else {
        expect(await token.balanceOf(poolAddress)).to.be.eq(4500);
        expect(tokenBalanceAfter - tokenBalanceBefore).to.be.eq(4500);
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(8999);
      }
    });

    it('gas [ @skip-on-coverage ]', async () => {
      const [token0, token1] = await sortedTokens(wnative, token);
      await migrator.createAndInitializePoolIfNecessary(token0, token1, encodePriceSqrt(1, 1));

      await pair.approve(migrator, expectedLiquidity);
      await snapshotGasCost(
        migrator.migrate({
          pair: await pair.getAddress(),
          liquidityToMigrate: expectedLiquidity,
          percentageToMigrate: 100,
          token0: tokenLower ? await token.getAddress() : await wnative.getAddress(),
          token1: tokenLower ? await wnative.getAddress() : await token.getAddress(),
          tickLower: getMinTick(60),
          tickUpper: getMaxTick(60),
          amount0Min: 9000,
          amount1Min: 9000,
          recipient: wallet.address,
          deadline: 1,
          refundAsNative: false,
        })
      );
    });
  });
});
