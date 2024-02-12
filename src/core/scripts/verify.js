const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const deployDataPath = path.resolve(__dirname, '../../../deploys.json');
  let deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));

  await hre.run('verify:verify', {
    address: deploysData.factory,
    constructorArguments: [deploysData.poolDeployer],
  });

  await hre.run('verify:verify', {
    address: deploysData.poolDeployer,
    constructorArguments: [deploysData.factory],
  });

  await hre.run('verify:verify', {
    address: deploysData.vault,
    constructorArguments: [deploysData.factory, deploysData.poolDeployer],
  });

  await hre.run('verify:verify', {
    address: deploysData.vaultFactory,
    constructorArguments: [deploysData.vault],
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
