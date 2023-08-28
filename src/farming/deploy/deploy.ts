import { Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

import * as path from "path";
import * as fs from "fs";

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  const deployDataPath = path.resolve(__dirname, '../../../deploys.json')
  const deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'))

  const poolDeployer = deploysData.poolDeployer;
  const posManager = deploysData.nonfungiblePositionManager;

  console.log(`Running deploy script`);
  const wallet = new Wallet(hre.network.config.accounts[0]);
  const deployer = new Deployer(hre, wallet);

  const eternalFarmingArtifact = await deployer.loadArtifact("AlgebraEternalFarming");
  const eternalFarmingfactory = await deployer.deploy(eternalFarmingArtifact, [poolDeployer, posManager]);
  await eternalFarmingfactory.deployed()
  console.log(`${eternalFarmingArtifact.contractName} was deployed to ${eternalFarmingfactory.address}`);
  const FCartifact = await deployer.loadArtifact("FarmingCenter");

  const FCFactory = await deployer.deploy(FCartifact, [eternalFarmingfactory.address, posManager]);
  await FCFactory.deployed()

  await eternalFarmingfactory.setFarmingCenterAddress(FCFactory.address);

  const verificationId = await hre.run("verify:verify", {
    address: eternalFarmingfactory.address,
    contract: "contracts/farmings/AlgebraEternalFarming.sol:AlgebraEternalFarming",
    constructorArguments: [poolDeployer, posManager],
  });

  const verificationId1 = await hre.run("verify:verify", {
    address: FCFactory.address,
    contract: "contracts/FarmingCenter.sol:FarmingCenter",
    constructorArguments: [eternalFarmingfactory.address, posManager],
  });

  console.log(`${FCartifact.contractName} was deployed to ${FCFactory.address}`);

}