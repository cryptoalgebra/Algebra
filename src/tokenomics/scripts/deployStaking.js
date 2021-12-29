const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    const AlgebraTokenStaker = await hre.ethers.getContractFactory("AlgebraTokenStaking");
    const AlgebraTokenStakerDeploy = await AlgebraTokenStaker.deploy(
        '0x0169ec1f8f639b32eec6d923e24c2a2ff45b9dd6'
    );

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