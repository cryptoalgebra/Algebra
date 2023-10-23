const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {

    const deployDataPath = path.resolve(__dirname, '../../../deploys.json')
    const deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'))

    const BasePluginV1Factory = await hre.ethers.getContractFactory("BasePluginV1Factory");
    const dsFactory = await BasePluginV1Factory.deploy(deploysData.factory);

    await dsFactory.waitForDeployment()

    console.log("PluginFactory to:", dsFactory.target);

    const factory = await hre.ethers.getContractAt('IAlgebraFactory', deploysData.factory)

    await factory.setDefaultPluginFactory(dsFactory.target)
    console.log('Updated plugin factory address in factory')

    deploysData.BasePluginV1Factory = dsFactory.target;
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