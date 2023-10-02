const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {

    const deployDataPath = path.resolve(__dirname, '../../../deploys.json')
    const deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'))

    const weth = "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6";

    const BasePluginV1Factory = await hre.ethers.getContractFactory("BasePluginV1Factory");
    const dsFactory = await BasePluginV1Factory.deploy(deploysData.factory);

    await dsFactory.waitForDeployment()

    console.log("PluginFactory to:", dsFactory.target);

    const factory = await hre.ethers.getContractAt('IAlgebraFactory', deploysData.factory)

    await factory.setDefaultPluginFactory(dsFactory.target)
    console.log('Updated plugin factory address in factory')

    const LimitOrderPluginFactory = await hre.ethers.getContractFactory("LimitOrderPlugin");
    const loPlugin = await LimitOrderPluginFactory.deploy(weth, deploysData.poolDeployer,dsFactory.target, deploysData.factory);

    await loPlugin.waitForDeployment()

    console.log("Limit order plugin to:", loPlugin.target);

    await dsFactory.setLimitOrderPlugin(loPlugin.target);

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