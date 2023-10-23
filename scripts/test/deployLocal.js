const ethers = require('ethers');
const path = require('path');
const fs = require('fs');
const execSync = require('child_process').execSync;
const bn = require('bignumber.js');
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

const NETWORK = 'localHardhat';
const DEFAULT_HARDHAT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const RPC = 'http://127.0.0.1:8545/';

const provider = new ethers.JsonRpcProvider(RPC);
let signer = new ethers.Wallet(DEFAULT_HARDHAT_PRIVATE_KEY, provider);

function encodePriceSqrt(reserve1, reserve0) {
  return BigInt(new bn(reserve1.toString()).div(reserve0.toString()).sqrt().multipliedBy(new bn(2).pow(96)).integerValue(3).toString());
}

function deployProtocol(network) {
  execSync(`cd src/core && npx hardhat run --network ${network} scripts/deploy.js`, { stdio: 'inherit' });

  //execSync(`cd src/plugins && npx hardhat run --network ${network} scripts/deploy.js`, { stdio: 'inherit' });

  execSync(`cd src/periphery && npx hardhat run --network ${network} scripts/deploy.js`, { stdio: 'inherit' });

  //execSync(`cd src/farming && npx hardhat run --network ${network} scripts/deploy.js`, { stdio: 'inherit' });
}

function deployTestTokens(network) {
  execSync(`cd src/core && npx hardhat run --network ${network} scripts/test/deployTestTokens.js`, { stdio: 'inherit' });
}

function getDeploysData() {
  const deployDataPath = path.resolve(__dirname, '../../deploys.json');
  return JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));
}

async function approveTestTokens(deploysData) {
  const { abi: TestTokenAbi } = require('../../src/core/artifacts/contracts/test/TestERC20.sol/TestERC20.json');
  const testToken0 = new ethers.Contract(deploysData.testToken0, TestTokenAbi, signer);
  const testToken1 = new ethers.Contract(deploysData.testToken1, TestTokenAbi, signer);

  const tx1 = await testToken0.approve(deploysData.nonfungiblePositionManager, ethers.MaxUint256);
  await tx1.wait();

  const tx2 = await testToken1.approve(deploysData.nonfungiblePositionManager, ethers.MaxUint256);
  await tx2.wait();

  const tx3 = await testToken0.approve(deploysData.swapRouter, ethers.MaxUint256);
  await tx3.wait();

  const tx4 = await testToken1.approve(deploysData.swapRouter, ethers.MaxUint256);
  await tx4.wait();

  console.log('Tokens approved');
}

async function mintFullRangeLiquidity(deploysData) {
  const { abi: NfTPosManagerAbi } = require('../../src/periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
  const positionManager = new ethers.Contract(deploysData.nonfungiblePositionManager, NfTPosManagerAbi, signer);

  const tx1 = await positionManager.createAndInitializePoolIfNecessary(deploysData.testToken0, deploysData.testToken1, encodePriceSqrt(1, 1));
  await tx1.wait();

  const mintParams = {
    token0: deploysData.testToken0,
    token1: deploysData.testToken1,
    tickLower: -887220,
    tickUpper: 887220,
    amount0Desired: 10n * 10n ** 18n,
    amount1Desired: 10n * 10n ** 18n,
    amount0Min: 0,
    amount1Min: 0,
    recipient: signer.address,
    deadline: 2n ** 32n - 1n,
  };

  const mintResult = await positionManager.mint.staticCall(mintParams);
  const tx2 = await positionManager.mint(mintParams);
  await tx2.wait();

  const { abi: FactoryAbi } = require('../../src/core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json');
  const algebraFactory = new ethers.Contract(deploysData.factory, FactoryAbi, signer);

  const poolAddress = await algebraFactory.poolByPair.staticCall(deploysData.testToken0, deploysData.testToken1);
  console.log(`Pool address: ${poolAddress}`);
  console.log(`Liquidity minted, tokenId: ${mintResult.tokenId}`);

  return poolAddress;
}

async function doSwapZtO(deploysData) {
  const { abi: SwapRouterAbi } = require('../../src/periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');
  const swapRouter = new ethers.Contract(deploysData.swapRouter, SwapRouterAbi, signer);

  const tx = await swapRouter.exactInputSingle({
    tokenIn: deploysData.testToken0,
    tokenOut: deploysData.testToken1,
    recipient: signer.address,
    deadline: 2n ** 32n - 1n,
    amountIn: (1n * 10n ** 18n) / 100n,
    amountOutMinimum: 0,
    limitSqrtPrice: 0n,
  });

  await tx.wait();

  console.log('Swap done');
}

async function getPoolFullState(deploysData, poolAddress) {
  const { abi: PoolAbi } = require('../../src/core/artifacts/contracts/AlgebraPool.sol/AlgebraPool.json');
  const pool = new ethers.Contract(poolAddress, PoolAbi, signer);

  const ammState = await pool.safelyGetStateOfAMM();

  console.log(`Pool: ${poolAddress}, token0: ${deploysData.testToken0}, token1: ${deploysData.testToken1}`);
  console.log(`Current price: ${ammState.sqrtPrice}`);
  console.log(`Current tick: ${ammState.tick}`);
  console.log(`Current liquidity: ${ammState.activeLiquidity}`);
  console.log(`Last known fee: ${ammState.lastFee}`);
  console.log(`Next active tick: ${ammState.nextTick}`);
  console.log(`Previous active tick: ${ammState.previousTick}`);
}

async function main() {
  deployProtocol(NETWORK);
  deployTestTokens(NETWORK);

  const deploysData = getDeploysData();
  await approveTestTokens(deploysData);
  const poolAddress = await mintFullRangeLiquidity(deploysData);
  await doSwapZtO(deploysData);
  await getPoolFullState(deploysData, poolAddress);
}

main()
  .then(() => {
    console.log('Deploy local finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
