const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {

    const deployDataPath = path.resolve(__dirname, '../../../deploys.json');
    let deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));

    const BasePluginV1Factory = deploysData.BasePluginV1Factory;

    await hre.run("verify:verify", {
        address: BasePluginV1Factory,
        constructorArguments: [
            deploysData.factory
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