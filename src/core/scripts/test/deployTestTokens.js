const hre = require('hardhat');
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const TokenFactory = await hre.ethers.getContractFactory('TestERC20');
  const tokenA = await TokenFactory.deploy(ethers.MaxUint256 / 2n);
  const tokenB = await TokenFactory.deploy(ethers.MaxUint256 / 2n);

  const addressA = await tokenA.getAddress();
  const addressB = await tokenB.getAddress();

  const [token0, token1] = BigInt(addressA) < BigInt(addressB) ? [addressA, addressB] : [addressB, addressA];

  console.log(`TestToken0: ${token0}`);
  console.log(`TestToken1: ${token1}`);

  const deployDataPath = path.resolve(__dirname, '../../../../deploys.json');
  let deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));
  deploysData.testToken0 = token0;
  deploysData.testToken1 = token1;
  fs.writeFileSync(deployDataPath, JSON.stringify(deploysData), 'utf-8');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
