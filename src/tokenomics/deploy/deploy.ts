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
  // Initialize the wallet.
  const wallet = new Wallet(hre.network.config.accounts[0]);
  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);

  // Load contract
  const eternalFarmingArtifact = await deployer.loadArtifact("AlgebraEternalFarming");
  // `greeting` is an argument for contract constructor.
  const eternalFarmingfactory = await deployer.deploy(eternalFarmingArtifact, [poolDeployer, posManager]);
  await eternalFarmingfactory.deployed()
  // Show the contract info.
  console.log(`${eternalFarmingArtifact.contractName} was deployed to ${eternalFarmingfactory.address}`);
    // Load contract
  const FCartifact = await deployer.loadArtifact("FarmingCenter");
    // `greeting` is an argument for contract constructor.
  const FCFactory = await deployer.deploy(FCartifact, [eternalFarmingfactory.address, posManager]);
  await FCFactory.deployed()

  await eternalFarmingfactory.setFarmingCenterAddress(FCFactory.address);

  console.log(`${FCartifact.contractName} was deployed to ${FCFactory.address}`);

}