const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const AlgebraTokenStaker = await hre.ethers.getContractFactory("AlgebraTokenStaking");
  const AlgebraTokenStakerDeploy = await AlgebraTokenStaker.deploy('0xB347b9f5B56b431B2CF4e1d90a5995f7519ca792');

  await AlgebraTokenStakerDeploy.deployed();

  console.log("AlgebraTokenStakerDeploy deployed to:", AlgebraTokenStakerDeploy.address);

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