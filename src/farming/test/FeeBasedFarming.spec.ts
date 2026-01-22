import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Wallet, MaxUint256, Signer } from 'ethers';
import { 
  FeeBasedFarming,
  TestERC20,
  IAlgebraFactory,
  IAlgebraPool,
  INonfungiblePositionManager,
  ISwapRouter,
} from '../typechain';
import { algebraFactoryFixture, poolFactory, mintPosition } from './shared/fixtures';
import { encodePriceSqrt, ZERO_ADDRESS, FeeAmount, blockTimestamp, MAX_GAS_LIMIT, getMinTick, getMaxTick, TICK_SPACINGS } from './shared';

const BNe18 = (n: number | bigint) => BigInt(n) * 10n ** 18n;
const days = (n: number) => 86400 * n;

describe('FeeBasedFarming', () => {
  let deployer: Signer;
  let lpUser1: Wallet;
  let lpUser2: Wallet;
  let admin: Wallet;

  let factory: IAlgebraFactory;
  let pool: IAlgebraPool;
  let poolAddress: string;
  let token0: TestERC20;
  let token1: TestERC20;
  let rewardToken: TestERC20;
  let feeBasedFarming: FeeBasedFarming;
  let nft: INonfungiblePositionManager;
  let nftAddress: string;
  let router: ISwapRouter;

  const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];
  const minTick = getMinTick(tickSpacing);
  const maxTick = getMaxTick(tickSpacing);

  async function feeBasedFarmingFixture() {
    const { factory: _factory, tokens, nft: _nft, router: _router, ownerSigner } = await algebraFactoryFixture();
    const [, _lpUser1, _lpUser2, _admin] = (await ethers.getSigners()) as any as Wallet[];

    const _token0 = tokens[0];
    const _token1 = tokens[1];
    const _rewardToken = tokens[2];

    // Disable plugins for simplicity
    await _factory.setDefaultPluginFactory(ZERO_ADDRESS);

    // Create pool using nft helper
    await _nft.createAndInitializePoolIfNecessary(_token0, _token1, ZERO_ADDRESS, encodePriceSqrt(1, 1), '0x');
    const _poolAddress = await _factory.poolByPair(_token0, _token1);
    const _pool = poolFactory.attach(_poolAddress).connect(ownerSigner) as any as IAlgebraPool;

    const _nftAddress = await _nft.getAddress();

    // Deploy FeeBasedFarming
    const FeeBasedFarmingFactory = await ethers.getContractFactory('FeeBasedFarming');
    const _feeBasedFarming = (await FeeBasedFarmingFactory.deploy(_factory)) as any as FeeBasedFarming;

    // Grant FARMING_ADMIN_ROLE to admin
    const FARMING_ADMIN_ROLE = await _feeBasedFarming.FARMING_ADMIN_ROLE();
    await (_factory as any).grantRole(FARMING_ADMIN_ROLE, _admin.address);

    // Distribute tokens to users
    await _token0.transfer(_lpUser1.address, BNe18(100000));
    await _token1.transfer(_lpUser1.address, BNe18(100000));
    await _token0.transfer(_lpUser2.address, BNe18(100000));
    await _token1.transfer(_lpUser2.address, BNe18(100000));
    await _rewardToken.transfer(_admin.address, BNe18(1000000));

    // Approve tokens for nft and router
    const routerAddress = await _router.getAddress();
    
    await _token0.connect(_lpUser1).approve(_nftAddress, MaxUint256);
    await _token1.connect(_lpUser1).approve(_nftAddress, MaxUint256);
    await _token0.connect(_lpUser1).approve(routerAddress, MaxUint256);
    await _token1.connect(_lpUser1).approve(routerAddress, MaxUint256);
    
    await _token0.connect(_lpUser2).approve(_nftAddress, MaxUint256);
    await _token1.connect(_lpUser2).approve(_nftAddress, MaxUint256);
    await _token0.connect(_lpUser2).approve(routerAddress, MaxUint256);
    await _token1.connect(_lpUser2).approve(routerAddress, MaxUint256);

    return {
      deployer: ownerSigner,
      lpUser1: _lpUser1,
      lpUser2: _lpUser2,
      admin: _admin,
      factory: _factory,
      pool: _pool,
      poolAddress: _poolAddress,
      token0: _token0,
      token1: _token1,
      rewardToken: _rewardToken,
      feeBasedFarming: _feeBasedFarming,
      nft: _nft,
      nftAddress: _nftAddress,
      router: _router,
    };
  }

  beforeEach('load fixture', async () => {
    const fixture = await loadFixture(feeBasedFarmingFixture);
    deployer = fixture.deployer;
    lpUser1 = fixture.lpUser1;
    lpUser2 = fixture.lpUser2;
    admin = fixture.admin;
    factory = fixture.factory;
    pool = fixture.pool;
    poolAddress = fixture.poolAddress;
    token0 = fixture.token0;
    token1 = fixture.token1;
    rewardToken = fixture.rewardToken;
    feeBasedFarming = fixture.feeBasedFarming;
    nft = fixture.nft;
    nftAddress = fixture.nftAddress;
    router = fixture.router;
  });

  describe('#setupFarming', () => {
    it('should setup farming with correct parameters', async () => {
      const rewardAmount = BNe18(100000);
      const duration = days(30);

      await rewardToken.connect(admin).approve(feeBasedFarming, rewardAmount);
      
      await feeBasedFarming.connect(admin).setupFarming(
        poolAddress,
        rewardToken,
        rewardAmount,
        duration
      );

      const config = await feeBasedFarming.farmingConfigs(poolAddress);
      expect(config.rewardToken).to.equal(await rewardToken.getAddress());
      expect(config.rewardRate).to.equal(rewardAmount / BigInt(duration));
    });

    it('should fail if duration is 0', async () => {
      const rewardAmount = BNe18(100000);
      
      await rewardToken.connect(admin).approve(feeBasedFarming, rewardAmount);
      
      await expect(
        feeBasedFarming.connect(admin).setupFarming(poolAddress, rewardToken, rewardAmount, 0)
      ).to.be.revertedWith('Duration must be > 0');
    });

    it('should fail if reward is 0', async () => {
      await expect(
        feeBasedFarming.connect(admin).setupFarming(poolAddress, rewardToken, 0, days(30))
      ).to.be.revertedWith('Reward must be > 0');
    });
  });

  describe('#accumulatedFees0 tracking', () => {
    it('should accumulate fees when swap occurs (zeroToOne)', async () => {
      // Get initial accumulatedFees0
      const initialFees = await pool.accumulatedFees0();
      expect(initialFees).to.equal(0);

      // Add liquidity via NFT Position Manager
      const deadline = (await blockTimestamp()) + 10000;
      
      await mintPosition(nft.connect(lpUser1), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: minTick,
        tickUpper: maxTick,
        recipient: lpUser1.address,
        amount0Desired: BNe18(1000),
        amount1Desired: BNe18(1000),
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      // Perform swap (zeroToOne) via router
      await router.connect(lpUser1).exactInputSingle({
        tokenIn: await token0.getAddress(),
        tokenOut: await token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: lpUser1.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(100),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      // Check that accumulatedFees0 increased
      const feesAfterSwap = await pool.accumulatedFees0();
      expect(feesAfterSwap).to.be.gt(0);
    });

    it('should NOT accumulate fees when swap is oneToZero', async () => {
      // Add liquidity
      const deadline = (await blockTimestamp()) + 10000;
      
      await mintPosition(nft.connect(lpUser1), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: minTick,
        tickUpper: maxTick,
        recipient: lpUser1.address,
        amount0Desired: BNe18(1000),
        amount1Desired: BNe18(1000),
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      const feesBeforeSwap = await pool.accumulatedFees0();

      // Perform swap (oneToZero) via router
      await router.connect(lpUser1).exactInputSingle({
        tokenIn: await token1.getAddress(),
        tokenOut: await token0.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: lpUser1.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(100),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      // accumulatedFees0 should not change (we only track token0 fees)
      const feesAfterSwap = await pool.accumulatedFees0();
      expect(feesAfterSwap).to.equal(feesBeforeSwap);
    });
  });

  describe('#enterFarming and pendingReward', () => {
    it('should calculate pending reward based on fees earned', async () => {
      // Setup farming
      const rewardAmount = BNe18(100000);
      const duration = days(30);

      await rewardToken.connect(admin).approve(feeBasedFarming, rewardAmount);
      await feeBasedFarming.connect(admin).setupFarming(poolAddress, rewardToken, rewardAmount, duration);

      // User1 creates position via NFPM (NFPM owns the position in pool)
      const deadline = (await blockTimestamp()) + 10000;
      
      await mintPosition(nft.connect(lpUser1), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: minTick,
        tickUpper: maxTick,
        recipient: lpUser1.address,
        amount0Desired: BNe18(1000),
        amount1Desired: BNe18(1000),
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      // Check that farming entry was recorded
      const farmingPosition = await feeBasedFarming.farmingPositions(poolAddress, nftAddress, minTick, maxTick);
      console.log('Farming position:');
      console.log('  liquidity:', farmingPosition.liquidity.toString());
      console.log('  feeGrowthInside0AtEntry:', farmingPosition.feeGrowthInside0AtEntry.toString());
      console.log('  accumulatedFees0AtEntry:', farmingPosition.accumulatedFees0AtEntry.toString());
      console.log('  entryTimestamp:', farmingPosition.entryTimestamp.toString());

      // Perform swaps to accumulate fees
      await router.connect(lpUser1).exactInputSingle({
        tokenIn: await token0.getAddress(),
        tokenOut: await token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: lpUser1.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(100),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      // Check pool state after swap
      const accumulatedFees0 = await pool.accumulatedFees0();
      console.log('Pool accumulatedFees0 after swap:', accumulatedFees0.toString());

      // Advance time
      await time.increase(days(1));

      // Check pending reward using NFPM address as owner (since NFPM owns pool positions)
      const [reward, feesEarned] = await feeBasedFarming.pendingReward(poolAddress, nftAddress, minTick, maxTick);

      console.log('Fees earned:', feesEarned.toString());
      console.log('Reward:', reward.toString());

      expect(feesEarned).to.be.gt(0);
      expect(reward).to.be.gt(0);
    });
  });

  describe('#proportional reward distribution', () => {
    it('should distribute rewards proportionally to fees earned', async () => {
      // Setup farming
      const rewardAmount = BNe18(100000);
      const duration = days(30);

      await rewardToken.connect(admin).approve(feeBasedFarming, rewardAmount);
      await feeBasedFarming.connect(admin).setupFarming(poolAddress, rewardToken, rewardAmount, duration);

      const deadline = (await blockTimestamp()) + 10000;

      // User1 creates position in narrow range around current tick (0)
      // Position 1: ticks -60 to 60 (narrow range, more fees per liquidity)
      await mintPosition(nft.connect(lpUser1), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: -tickSpacing,
        tickUpper: tickSpacing,
        recipient: lpUser1.address,
        amount0Desired: BNe18(1000),
        amount1Desired: BNe18(1000),
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      // User2 creates position in wide range
      // Position 2: full range (less fees per liquidity)
      await mintPosition(nft.connect(lpUser2), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: minTick,
        tickUpper: maxTick,
        recipient: lpUser2.address,
        amount0Desired: BNe18(1000),
        amount1Desired: BNe18(1000),
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      // Perform swaps to accumulate fees (price stays near 0 so narrow range earns more)
      for (let i = 0; i < 5; i++) {
        await router.connect(lpUser1).exactInputSingle({
          tokenIn: await token0.getAddress(),
          tokenOut: await token1.getAddress(),
          deployer: ZERO_ADDRESS,
          recipient: lpUser1.address,
          deadline: (await blockTimestamp()) + 10000,
          amountIn: BNe18(10),
          amountOutMinimum: 0,
          limitSqrtPrice: 0,
        }, { gasLimit: MAX_GAS_LIMIT });
      }

      // Advance time
      await time.increase(days(7));

      // Check rewards for both positions (using NFPM address)
      const [reward1, fees1] = await feeBasedFarming.pendingReward(poolAddress, nftAddress, -tickSpacing, tickSpacing);
      const [reward2, fees2] = await feeBasedFarming.pendingReward(poolAddress, nftAddress, minTick, maxTick);

      console.log('Position 1 (narrow) - Fees:', fees1.toString(), 'Reward:', reward1.toString());
      console.log('Position 2 (wide) - Fees:', fees2.toString(), 'Reward:', reward2.toString());

      // Narrow range position should earn more fees (concentrated liquidity)
      expect(fees1).to.be.gt(fees2);
      // And therefore more rewards
      expect(reward1).to.be.gt(reward2);
    });
  });

  describe('#addRewards', () => {
    it('should extend farming duration and add rewards', async () => {
      // Initial setup
      const rewardAmount = BNe18(100000);
      const duration = days(30);

      await rewardToken.connect(admin).approve(feeBasedFarming, rewardAmount * 2n);
      await feeBasedFarming.connect(admin).setupFarming(poolAddress, rewardToken, rewardAmount, duration);

      const configBefore = await feeBasedFarming.farmingConfigs(poolAddress);

      // Add more rewards
      await feeBasedFarming.connect(admin).addRewards(poolAddress, rewardAmount, days(15));

      const configAfter = await feeBasedFarming.farmingConfigs(poolAddress);

      // End time should be extended
      expect(configAfter.rewardEndTime).to.be.gt(configBefore.rewardEndTime);
    });
  });

  describe('#position lifecycle', () => {
    it('should record correct entry point for position created after swaps', async () => {
      // This test verifies that positions created after some swaps
      // have correct accumulatedFees0AtEntry recorded
      
      const rewardAmount = BNe18(100000);
      const duration = days(30);

      await rewardToken.connect(admin).approve(feeBasedFarming, rewardAmount);
      await feeBasedFarming.connect(admin).setupFarming(poolAddress, rewardToken, rewardAmount, duration);

      // Create initial position for liquidity
      const deadline = (await blockTimestamp()) + 10000;
      await mintPosition(nft.connect(lpUser1), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: minTick,
        tickUpper: maxTick,
        recipient: lpUser1.address,
        amount0Desired: BNe18(1000),
        amount1Desired: BNe18(1000),
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      // Check entry for first position
      const pos1 = await feeBasedFarming.farmingPositions(poolAddress, nftAddress, minTick, maxTick);
      expect(pos1.accumulatedFees0AtEntry).to.equal(0); // No swaps yet
      expect(pos1.entryTimestamp).to.be.gt(0);

      // Do some swaps
      await router.connect(lpUser1).exactInputSingle({
        tokenIn: await token0.getAddress(),
        tokenOut: await token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: lpUser1.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(50),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      const accumulatedAfterSwap = await pool.accumulatedFees0();
      expect(accumulatedAfterSwap).to.be.gt(0);

      // Create second position with DIFFERENT tick range AFTER the swap
      await mintPosition(nft.connect(lpUser2), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: -tickSpacing * 10,
        tickUpper: tickSpacing * 10,
        recipient: lpUser2.address,
        amount0Desired: BNe18(1000),
        amount1Desired: BNe18(1000),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Check entry for second position - should have accumulatedFees0AtEntry > 0
      const pos2 = await feeBasedFarming.farmingPositions(poolAddress, nftAddress, -tickSpacing * 10, tickSpacing * 10);
      expect(pos2.accumulatedFees0AtEntry).to.equal(accumulatedAfterSwap);
      expect(pos2.entryTimestamp).to.be.gt(pos1.entryTimestamp);
      
      console.log('Position 1 accumulatedFees0AtEntry:', pos1.accumulatedFees0AtEntry.toString());
      console.log('Position 2 accumulatedFees0AtEntry:', pos2.accumulatedFees0AtEntry.toString());
    });

    it('should handle multiple positions with different tick ranges earning different fees', async () => {
      const rewardAmount = BNe18(100000);
      const duration = days(30);

      await rewardToken.connect(admin).approve(feeBasedFarming, rewardAmount);
      await feeBasedFarming.connect(admin).setupFarming(poolAddress, rewardToken, rewardAmount, duration);

      const deadline = (await blockTimestamp()) + 10000;

      // Position 1: Very narrow range (high concentration)
      await mintPosition(nft.connect(lpUser1), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: -tickSpacing,
        tickUpper: tickSpacing,
        recipient: lpUser1.address,
        amount0Desired: BNe18(100),
        amount1Desired: BNe18(100),
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      // Position 2: Medium range
      await mintPosition(nft.connect(lpUser1), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: -tickSpacing * 10,
        tickUpper: tickSpacing * 10,
        recipient: lpUser1.address,
        amount0Desired: BNe18(100),
        amount1Desired: BNe18(100),
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      // Position 3: Full range
      await mintPosition(nft.connect(lpUser1), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: minTick,
        tickUpper: maxTick,
        recipient: lpUser1.address,
        amount0Desired: BNe18(100),
        amount1Desired: BNe18(100),
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      // Do swaps near tick 0
      for (let i = 0; i < 10; i++) {
        await router.connect(lpUser1).exactInputSingle({
          tokenIn: await token0.getAddress(),
          tokenOut: await token1.getAddress(),
          deployer: ZERO_ADDRESS,
          recipient: lpUser1.address,
          deadline: (await blockTimestamp()) + 10000,
          amountIn: BNe18(5),
          amountOutMinimum: 0,
          limitSqrtPrice: 0,
        }, { gasLimit: MAX_GAS_LIMIT });
      }

      await time.increase(days(1));

      const [reward1, fees1] = await feeBasedFarming.pendingReward(poolAddress, nftAddress, -tickSpacing, tickSpacing);
      const [reward2, fees2] = await feeBasedFarming.pendingReward(poolAddress, nftAddress, -tickSpacing * 10, tickSpacing * 10);
      const [reward3, fees3] = await feeBasedFarming.pendingReward(poolAddress, nftAddress, minTick, maxTick);

      console.log('Narrow range - Fees:', fees1.toString(), 'Reward:', reward1.toString());
      console.log('Medium range - Fees:', fees2.toString(), 'Reward:', reward2.toString());
      console.log('Full range - Fees:', fees3.toString(), 'Reward:', reward3.toString());

      // Narrower positions should earn more fees per unit of liquidity
      expect(fees1).to.be.gt(fees2);
      expect(fees2).to.be.gt(fees3);
    });
  });

  describe('#edge cases', () => {
    it('should return 0 reward if no swaps occurred', async () => {
      const rewardAmount = BNe18(100000);
      const duration = days(30);

      await rewardToken.connect(admin).approve(feeBasedFarming, rewardAmount);
      await feeBasedFarming.connect(admin).setupFarming(poolAddress, rewardToken, rewardAmount, duration);

      const deadline = (await blockTimestamp()) + 10000;
      await mintPosition(nft.connect(lpUser1), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: minTick,
        tickUpper: maxTick,
        recipient: lpUser1.address,
        amount0Desired: BNe18(1000),
        amount1Desired: BNe18(1000),
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      await time.increase(days(10));

      // No swaps = no fees = no rewards
      const [reward, feesEarned] = await feeBasedFarming.pendingReward(poolAddress, nftAddress, minTick, maxTick);

      expect(feesEarned).to.equal(0);
      expect(reward).to.equal(0);
    });

    it('should return 0 for non-existent position', async () => {
      const rewardAmount = BNe18(100000);
      const duration = days(30);

      await rewardToken.connect(admin).approve(feeBasedFarming, rewardAmount);
      await feeBasedFarming.connect(admin).setupFarming(poolAddress, rewardToken, rewardAmount, duration);

      // Check reward for position that doesn't exist
      const [reward, feesEarned] = await feeBasedFarming.pendingReward(poolAddress, nftAddress, -1000, 1000);

      expect(feesEarned).to.equal(0);
      expect(reward).to.equal(0);
    });

    it('should return 0 if farming not set up', async () => {
      const deadline = (await blockTimestamp()) + 10000;
      await mintPosition(nft.connect(lpUser1), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: minTick,
        tickUpper: maxTick,
        recipient: lpUser1.address,
        amount0Desired: BNe18(1000),
        amount1Desired: BNe18(1000),
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      // Do swap
      await router.connect(lpUser1).exactInputSingle({
        tokenIn: await token0.getAddress(),
        tokenOut: await token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: lpUser1.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(100),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      // Farming not set up - should return 0 reward but fees should still be tracked
      const [reward, feesEarned] = await feeBasedFarming.pendingReward(poolAddress, nftAddress, minTick, maxTick);

      // Fees earned but no reward (farming not set up)
      expect(reward).to.equal(0);
    });

    it('should handle position out of range', async () => {
      const rewardAmount = BNe18(100000);
      const duration = days(30);

      await rewardToken.connect(admin).approve(feeBasedFarming, rewardAmount);
      await feeBasedFarming.connect(admin).setupFarming(poolAddress, rewardToken, rewardAmount, duration);

      const deadline = (await blockTimestamp()) + 10000;

      // First create an in-range position so swaps can happen
      await mintPosition(nft.connect(lpUser1), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: minTick,
        tickUpper: maxTick,
        recipient: lpUser1.address,
        amount0Desired: BNe18(1000),
        amount1Desired: BNe18(1000),
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      // Create position far from current price (tick 0)
      // This position should not earn fees from swaps near tick 0
      await mintPosition(nft.connect(lpUser2), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: tickSpacing * 100,
        tickUpper: tickSpacing * 200,
        recipient: lpUser2.address,
        amount0Desired: BNe18(1000),
        amount1Desired: 0, // Only token0 since we're above current price
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      // Do swap near tick 0 - only in-range position earns fees
      await router.connect(lpUser1).exactInputSingle({
        tokenIn: await token0.getAddress(),
        tokenOut: await token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: lpUser1.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(10),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      await time.increase(days(1));

      // In-range position should earn fees
      const [rewardInRange, feesInRange] = await feeBasedFarming.pendingReward(
        poolAddress, 
        nftAddress, 
        minTick, 
        maxTick
      );
      expect(feesInRange).to.be.gt(0);

      // Out of range position earns no fees
      const [reward, feesEarned] = await feeBasedFarming.pendingReward(
        poolAddress, 
        nftAddress, 
        tickSpacing * 100, 
        tickSpacing * 200
      );

      expect(feesEarned).to.equal(0);
      expect(reward).to.equal(0);
    });
  });

  describe('#farming after end time', () => {
    it('should cap rewards at farming end time', async () => {
      const rewardAmount = BNe18(100000);
      const duration = days(7); // Short duration

      await rewardToken.connect(admin).approve(feeBasedFarming, rewardAmount);
      await feeBasedFarming.connect(admin).setupFarming(poolAddress, rewardToken, rewardAmount, duration);

      const deadline = (await blockTimestamp()) + 10000;
      await mintPosition(nft.connect(lpUser1), {
        token0: token0,
        token1: token1,
        fee: FeeAmount.MEDIUM,
        tickLower: minTick,
        tickUpper: maxTick,
        recipient: lpUser1.address,
        amount0Desired: BNe18(1000),
        amount1Desired: BNe18(1000),
        amount0Min: 0,
        amount1Min: 0,
        deadline,
      });

      // Do swap
      await router.connect(lpUser1).exactInputSingle({
        tokenIn: await token0.getAddress(),
        tokenOut: await token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: lpUser1.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(100),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      // Advance past farming end time
      await time.increase(days(10));

      const [rewardAfterEnd] = await feeBasedFarming.pendingReward(poolAddress, nftAddress, minTick, maxTick);

      // Advance even more time
      await time.increase(days(30));

      const [rewardLater] = await feeBasedFarming.pendingReward(poolAddress, nftAddress, minTick, maxTick);

      // Rewards should be capped - not increase after end time
      expect(rewardAfterEnd).to.equal(rewardLater);
    });
  });
});
