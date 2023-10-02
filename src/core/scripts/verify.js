const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {

    const deployDataPath = path.resolve(__dirname, '../../../deploys.json');
    let deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));

    const poolDeployer = deploysData.poolDeployer;

    const factory = await hre.ethers.getContractAt(
        'IAlgebraFactory',
        deploysData.factory
        )

    const vaultAddress = await factory.communityVault();

    await hre.run("verify:verify", {
        address: deploysData.factory,
        constructorArguments: [
            poolDeployer
        ],
        });

    await hre.run("verify:verify", {
        address: poolDeployer,
        constructorArguments: [
            factory,
            vaultAddress
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