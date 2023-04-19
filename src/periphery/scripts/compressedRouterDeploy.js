const hre = require('hardhat')
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

async function main() {

  // WNativeTokenAddress  
  const WNativeTokenAddress = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const factory = "0x9C2ABD632771b433E5E7507BcaA41cA3b25D8544";
  const poolDeployer = "0x24E85F5F94C6017d2d87b434394e87df4e4D56E3";
  // arg1 factory address
  // arg2 wnative address
  const SwapRouterFactory = await hre.ethers.getContractFactory("SwapRouterCompressedV1");
  const SwapRouter = await SwapRouterFactory.deploy(factory, WNativeTokenAddress, poolDeployer);

  await SwapRouter.deployed();

  console.log('SwapRouter deployed to:', SwapRouter.address)

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
