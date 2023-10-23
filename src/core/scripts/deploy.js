const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    // precompute
    const poolDeployerAddress = hre.ethers.getCreateAddress({
      from: deployer.address, 
      nonce: (await ethers.provider.getTransactionCount(deployer.address)) + 1
    })

    const AlgebraFactory = await hre.ethers.getContractFactory("AlgebraFactory");
    const factory = await AlgebraFactory.deploy(poolDeployerAddress);

    await factory.waitForDeployment()
    
    const vaultAddress = await factory.communityVault();

    const PoolDeployerFactory = await hre.ethers.getContractFactory("AlgebraPoolDeployer");
    const poolDeployer  = await PoolDeployerFactory.deploy(factory.target, vaultAddress);

    await poolDeployer.waitForDeployment()

    console.log("AlgebraPoolDeployer to:", poolDeployer.target);
    console.log("AlgebraFactory deployed to:", factory.target);
    
    const deployDataPath = path.resolve(__dirname, '../../../deploys.json');
    let deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));
    deploysData.poolDeployer = poolDeployer.target;
    deploysData.factory = factory.target;
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