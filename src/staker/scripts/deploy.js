const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const deployDataPath = path.resolve(__dirname, '../../../deploys.json');
  const deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));

  const maxIncentiveStartLeadTime = 2592000;
  const maxIncentiveDuration = 63072000;

  const VirtualPoolDeployerFactory = await hre.ethers.getContractFactory("VirtualPoolDeployer");
  const VirtualPoolDeployer = await VirtualPoolDeployerFactory.deploy();

  await VirtualPoolDeployer.deployed();

  const AlgebraStakerFactory = await hre.ethers.getContractFactory("AlgebraStaker");
  const AlgebraStaker = await AlgebraStakerFactory.deploy(deploysData.poolDeployer, deploysData.nonfungiblePositionManager, VirtualPoolDeployer.address, maxIncentiveStartLeadTime, maxIncentiveDuration);

  await AlgebraStaker.deployed();

  await VirtualPoolDeployer.setFactory(AlgebraStaker.address);

  console.log("AlgebraStaker deployed to:", AlgebraStaker.address);

  await hre.run("verify:verify", {
    address: AlgebraStaker.address,
    constructorArguments: [
      deploysData.poolDeployer,
      deploysData.nonfungiblePositionManager,
      VirtualPoolDeployer.address,
      maxIncentiveStartLeadTime,
      maxIncentiveDuration,
    ],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });