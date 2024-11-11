const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {

    const deployDataPath = path.resolve(__dirname, '../../../deploys.json')
    const deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'))

    const weth = "0x94373a4919b3240d86ea41593d5eba789fef3848";
    const factory = "0xDfCC62B3eE40EE453Cb2788576B56e746FC79827";
    const poolDeployer = "0x43680a9e859e72158303cEC7F15CE99a04A09674";
    const entryPoint = "0xF949F5f29cD04E359C66163D86eBFF7CAb9C26f3"

    const customDeployerFactory = await hre.ethers.getContractFactory("LimitOrderCustomPoolDeployer");
    const customDeployer = await customDeployerFactory.deploy(factory, entryPoint);

    await customDeployer.waitForDeployment()

    console.log("customDeployer to:", customDeployer.target);

    const LimitOrderPluginFactory = await hre.ethers.getContractFactory("LimitOrderPlugin");
    const loPlugin = await LimitOrderPluginFactory.deploy(weth, poolDeployer, customDeployer.target, factory);

    await loPlugin.waitForDeployment()

    console.log("Limit order plugin to:", loPlugin.target);

    await customDeployer.setLimitOrderPlugin(loPlugin.target);

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