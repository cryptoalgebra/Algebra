const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {

    const deployDataPath = path.resolve(__dirname, '../../../deploys.json');
    let deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));

    await hre.run("verify:verify", {
        address: deploysData.tickLens,
        constructorArguments: [],
        });

    await hre.run("verify:verify", {
        address: deploysData.entryPoint,
        constructorArguments: [
            deploysData.factory
        ],
        });

    await hre.run("verify:verify", {
        address: deploysData.quoter,
        constructorArguments: [
            deploysData.factory,
            deploysData.wrapped,
            deploysData.poolDeployer
        ],
        });

    await hre.run("verify:verify", {
        address: deploysData.quoterV2,
        constructorArguments: [
            deploysData.factory,
            deploysData.wrapped,
            deploysData.poolDeployer
        ],
        });
   
    await hre.run("verify:verify", {
        address: deploysData.swapRouter,
        constructorArguments: [
            deploysData.factory,
            deploysData.wrapped,
            deploysData.poolDeployer
        ],
        });

    await hre.run("verify:verify", {
        address: deploysData.proxy,
        constructorArguments: [
            deploysData.nftDescriptor,
            deploysData.admin,
            "0x"
        ],
        });   
    
    await hre.run("verify:verify", {
        address: deploysData.nftDescriptor,
        constructorArguments: [
            deploysData.wrapped,
            "ETH",
            []
        ],
        });    

    await hre.run("verify:verify", {
        address: deploysData.nonfungiblePositionManager,
        constructorArguments: [
            deploysData.factory,
            deploysData.wrapped,
            deploysData.proxy,
            deploysData.poolDeployer
        ],
        });

    await hre.run("verify:verify", {
        address: deploysData.mcall,
        constructorArguments: [],
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