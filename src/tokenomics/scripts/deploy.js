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

  const AlgebraFarmingFactory = await hre.ethers.getContractFactory("AlgebraFarming");
  const AlgebraFarming = await AlgebraFarmingFactory.deploy(deploysData.poolDeployer, deploysData.nonfungiblePositionManager, VirtualPoolDeployer.address, maxIncentiveStartLeadTime, maxIncentiveDuration);

  await AlgebraFarming.deployed();

  await VirtualPoolDeployer.setFarming(AlgebraFarming.address);

  console.log("AlgebraFarming deployed to:", AlgebraFarming.address);

  await hre.run("verify:verify", {
    address: AlgebraFarming.address,
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