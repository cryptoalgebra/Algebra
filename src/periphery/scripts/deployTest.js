const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

async function main() {

  const deployDataPath = path.resolve(__dirname, '../../../deploys.json');
  let deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));

  const cpFactory = await hre.ethers.getContractFactory('CustomPlugin')
  const cp = await cpFactory.deploy()

  await cp.waitForDeployment()
  console.log("CustomPlugin:",cp.target)

  const cpdFactory = await hre.ethers.getContractFactory('CustomPoolDeployerTest')
  const cpd1 = await cpdFactory.deploy(deploysData.entryPoint, await cp.getAddress())

  await cpd1.waitForDeployment()
  console.log("Custom pool deployer with plugin:", cpd1.target)

  const cpd2 = await cpdFactory.deploy(deploysData.entryPoint,"0x0000000000000000000000000000000000000000")

  await cpd2.waitForDeployment()
  console.log("Custom pool deployer without plugin",cpd2.target)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
