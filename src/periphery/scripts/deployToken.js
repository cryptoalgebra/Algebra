const hre = require('hardhat');
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const TokenFactory = await hre.ethers.getContractFactory('TestToken');
  const tokenA = await TokenFactory.deploy(10n ** 25n, "USDC", "USDC");
 
  const addressA = await tokenA.getAddress();

  console.log(`token deployed to: ${addressA}`);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
