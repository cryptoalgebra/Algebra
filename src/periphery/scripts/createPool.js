const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const bn = require('bignumber.js');
const AlgebraFactoryComplied = require('@cryptoalgebra/integral-core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json');
const { ZeroAddress } = require('ethers');

async function main() {
  const deployDataPath = path.resolve(__dirname, '../../../deploys.json');
  let deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));

  // WNativeTokenAddress
  const token0 = '0x83D4a9Ea77a4dbA073cD90b30410Ac9F95F93E7C';
  const token1 = '0x91077c999344a0d5b2A745fA75403489EB374987';

  const signer = await hre.ethers.provider.getSigner();
  const { abi: TestTokenAbi } = require('../../core/artifacts/contracts/test/TestERC20.sol/TestERC20.json');
  const { abi: WrapTokenAbi } = require('../artifacts/contracts/interfaces/external/IWNativeToken.sol/IWNativeToken.json');
  const testToken0 = new ethers.Contract(token0, TestTokenAbi, signer);
  const testToken1 = new ethers.Contract(token1, WrapTokenAbi, signer);

  const tx0 = await testToken1.deposit({value: 5n * 10n ** 18n});
  await tx0.wait();

  const tx1 = await testToken0.approve(deploysData.nonfungiblePositionManager, ethers.MaxUint256);
  await tx1.wait();

  const tx2 = await testToken1.approve(deploysData.nonfungiblePositionManager, ethers.MaxUint256);
  await tx2.wait();

  const { abi: NfTPosManagerAbi } = require('../artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
  const positionManager = new ethers.Contract(deploysData.nonfungiblePositionManager, NfTPosManagerAbi, signer);

  const tx3 = await positionManager.createAndInitializePoolIfNecessary(token0, token1, ZeroAddress, 2n ** 96n, '0x');
  await tx3.wait();

  const mintParams = {
    token0: token0,
    token1: token1,
    deployer: ZeroAddress,
    tickLower: -887220,
    tickUpper: 887220,
    amount0Desired: 10n * 10n ** 18n,
    amount1Desired: 5n * 10n ** 18n,
    amount0Min: 0,
    amount1Min: 0,
    recipient: signer.address,
    deadline: 2n ** 32n - 1n,
  };

  const mintResult = await positionManager.mint.staticCall(mintParams);

  const tx4 = await positionManager.mint(mintParams);
  await tx4.wait();

  const { abi: FactoryAbi } = require('../../core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json');
  const algebraFactory = new ethers.Contract(deploysData.factory, FactoryAbi, signer);

  const poolAddress = await algebraFactory.poolByPair.staticCall(token0, token1);
  console.log(`Pool address: ${poolAddress}`);
  console.log(`Liquidity minted, tokenId: ${mintResult.tokenId}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
