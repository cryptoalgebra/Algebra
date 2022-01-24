const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const deployDataPath = path.resolve(__dirname, '../../../deploys.json');
  const deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));

  const maxIncentiveStartLeadTime = 2592000;
  const maxIncentiveDuration = 63072000;

  const AlgebraIncentiveFarmingFactory = await hre.ethers.getContractFactory("AlgebraIncentiveFarming");
  const AlgebraIncentiveFarming = await AlgebraIncentiveFarmingFactory.deploy(deploysData.poolDeployer, deploysData.nonfungiblePositionManager, maxIncentiveStartLeadTime, maxIncentiveDuration);

  await AlgebraIncentiveFarming.deployed();

  const AlgebraEternalFarmingFactory = await hre.ethers.getContractFactory("AlgebraEternalFarming");
  const AlgebraEternalFarming = await AlgebraEternalFarmingFactory.deploy(deploysData.poolDeployer, deploysData.nonfungiblePositionManager, maxIncentiveStartLeadTime, maxIncentiveDuration);

  await AlgebraEternalFarming.deployed();

  const FarmingCenterFactory = await hre.ethers.getContractFactory("FarmingCenter");
  const FarmingCenter =  await FarmingCenterFactory.deploy(AlgebraIncentiveFarming.address, AlgebraEternalFarming.address, deploysData.nonfungiblePositionManager);

  await FarmingCenter.deployed();

  const AlgebraFactory = await hre.ethers.getContractFactory("AlgebraFactory");
  const factory = await AlgebraFactory.attach(deploysData.factory);

  //await factory.setFarmingAddress(FarmingCenter.address);

  console.log("AlgebraIncentiveFarming deployed to:", AlgebraIncentiveFarming.address);
  console.log("AlgebraEternalFarming deployed to:", AlgebraEternalFarming.address);
  console.log("FarmingCenter deployed to:", FarmingCenter.address);

  

  // await hre.run("verify:verify", {
  //   address: AlgebraFarming.address,
  //   constructorArguments: [
  //     deploysData.poolDeployer,
  //     deploysData.nonfungiblePositionManager,
  //     VirtualPoolDeployer.address,
  //     maxIncentiveStartLeadTime,
  //     maxIncentiveDuration,
  //   ],
  // });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });