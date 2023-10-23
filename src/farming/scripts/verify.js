const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {

    const deployDataPath = path.resolve(__dirname, '../../../deploys.json');
    let deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));

    await hre.run("verify:verify", {
        address: deploysData.eternal,
        constructorArguments: [
            deploysData.poolDeployer,
            deploysData.nonfungiblePositionManager
        ],
        });
   
    await hre.run("verify:verify", {
        address: deploysData.fc,
        constructorArguments: [
            deploysData.eternal,
            deploysData.poolDeployer
        ],
        });

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });